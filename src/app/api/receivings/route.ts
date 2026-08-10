import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { receivings, lines, trucks, drivers, suppliers, users, receivingSessions, sensorEvents } from '@/db/schema';
import { requirePermission, checkOperatorLineAccess, isOperatorOnly } from '@/lib/auth';
import { validationError, internalError, forbiddenError } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { eq, and, gte, lte, or, ilike, asc, desc, inArray, sql } from 'drizzle-orm';

const createReceivingSchema = z.object({
  receiving_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  delivery_note_number: z.string().min(1, 'Nomor Surat Jalan wajib diisi'),
  document_truck_sequence: z.number().int().optional().nullable(),
  queue_position: z.number().int().min(1).default(1),
  truck_id: z.string().uuid().optional().nullable(),
  license_plate_snapshot: z.string().min(1, 'Plat nomor wajib diisi'),
  driver_id: z.string().uuid().optional().nullable(),
  driver_name_snapshot: z.string().min(1, 'Nama supir wajib diisi'),
  supplier_id: z.string().uuid().optional().nullable(),
  supplier_name_snapshot: z.string().min(1, 'Nama supplier wajib diisi'),
  manifest_count: z.number().int().positive('Jumlah manifest harus berupa angka positif (> 0)'),
  line_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'receiving:view');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    let lineIdParam = searchParams.get('line_id');
    const dateFromParam = searchParams.get('date_from');
    const dateToParam = searchParams.get('date_to');
    const searchParam = searchParams.get('search');

    // ── Operator line restriction ─────────────────────────────────────────
    const lineAccessError = checkOperatorLineAccess(user!, lineIdParam);
    if (lineAccessError) return lineAccessError;

    if (isOperatorOnly(user!)) {
      if (!user!.assignedLineId) {
        return forbiddenError('Operator belum ditugaskan pada jalur (Line) mana pun.');
      }
      lineIdParam = user!.assignedLineId;
    }
    // ─────────────────────────────────────────────────────────────────────

    const conditions = [];

    if (statusParam) {
      conditions.push(eq(receivings.status, statusParam));
    }
    if (lineIdParam) {
      conditions.push(eq(receivings.lineId, lineIdParam));
    }
    if (dateFromParam) {
      conditions.push(gte(receivings.receivingDate, dateFromParam));
    }
    if (dateToParam) {
      conditions.push(lte(receivings.receivingDate, dateToParam));
    }
    if (searchParam && searchParam.trim() !== '') {
      const term = `%${searchParam.trim()}%`;
      conditions.push(
        or(
          ilike(receivings.deliveryNoteNumber, term),
          ilike(receivings.receivingNumber, term),
          ilike(receivings.licensePlateSnapshot, term),
          ilike(receivings.driverNameSnapshot, term),
          ilike(receivings.supplierNameSnapshot, term)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const list = await db
      .select({
        receiving: receivings,
        line: lines,
        truck: trucks,
        driver: drivers,
        supplier: suppliers,
        creator: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(receivings)
      .leftJoin(lines, eq(receivings.lineId, lines.id))
      .leftJoin(trucks, eq(receivings.truckId, trucks.id))
      .leftJoin(drivers, eq(receivings.driverId, drivers.id))
      .leftJoin(suppliers, eq(receivings.supplierId, suppliers.id))
      .leftJoin(users, eq(receivings.createdBy, users.id))
      .where(whereClause)
      .orderBy(asc(receivings.queuePosition), desc(receivings.createdAt));

    // Get actual count derived from sensor_events for each receiving
    const receivingIds = list.map((item) => item.receiving.id);

    const actualCountsMap: Record<string, number> = {};

    if (receivingIds.length > 0) {
      // Find session IDs associated with these receivings
      // Only include COUNTING or COMPLETED sessions
      const sessions = await db
        .select({
          id: receivingSessions.id,
          receivingId: receivingSessions.receivingId,
          status: receivingSessions.status,
        })
        .from(receivingSessions)
        .where(
          and(
            inArray(receivingSessions.receivingId, receivingIds),
            inArray(receivingSessions.status, ['COUNTING', 'COMPLETED'])
          )
        );

      if (sessions.length > 0) {
        const sessionToReceivingMap: Record<string, { receivingId: string; status: string }> = {};
        sessions.forEach((s) => {
          sessionToReceivingMap[s.id] = { receivingId: s.receivingId, status: s.status };
        });
        const sessionIds = sessions.map((s) => s.id);

        const eventCounts = await db
          .select({
            sessionId: sensorEvents.sessionId,
            count: sql<number>`count(*)::int`,
          })
          .from(sensorEvents)
          .where(
            and(
              inArray(sensorEvents.sessionId, sessionIds),
              eq(sensorEvents.eventType, 'DETECTION'),
              eq(sensorEvents.eventMode, 'PRODUCTION'),
              eq(sensorEvents.assignmentStatus, 'ASSIGNED')
            )
          )
          .groupBy(sensorEvents.sessionId);

        eventCounts.forEach((ec) => {
          if (ec.sessionId) {
            const sessionInfo = sessionToReceivingMap[ec.sessionId];
            if (sessionInfo) {
              actualCountsMap[sessionInfo.receivingId] =
                (actualCountsMap[sessionInfo.receivingId] || 0) + Number(ec.count);
            }
          }
        });
      }
    }

    const formattedList = list.map(({ receiving, line, truck, driver, supplier, creator }) => {
      const isCountedOrCounting = receiving.status === 'COUNTING' || receiving.status === 'COMPLETED';
      const actualCount = isCountedOrCounting ? (actualCountsMap[receiving.id] ?? 0) : null;
      const differenceCount = actualCount !== null ? actualCount - receiving.manifestCount : null;
      const differencePercent =
        actualCount !== null && receiving.manifestCount > 0
          ? Number(((differenceCount! / receiving.manifestCount) * 100).toFixed(2))
          : null;

      return {
        ...receiving,
        lineName: line?.name || null,
        lineCode: line?.lineCode || null,
        truck: truck || null,
        driver: driver || null,
        supplier: supplier || null,
        createdBy: creator || null,
        actualCount,
        differenceCount,
        differencePercent,
      };
    });

    return NextResponse.json({ receivings: formattedList });
  } catch (error) {
    console.error('GET /api/receivings error:', error);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'receiving:create');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parseResult = createReceivingSchema.safeParse(body);

    if (!parseResult.success) {
      const issues = parseResult.error.format();
      return validationError('Input data receiving tidak valid.', { issues });
    }

    const data = parseResult.data;

    // Generate unique receiving number: RCV-YYYYMMDD-XXXX
    const dateCompact = data.receiving_date.replace(/-/g, '');
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const receivingNumber = `REC-${dateCompact}-${randomSeq}`;

    const newReceiving = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(receivings)
        .values({
          receivingNumber,
          deliveryNoteNumber: data.delivery_note_number,
          receivingDate: data.receiving_date,
          documentTruckSequence: data.document_truck_sequence || null,
          queuePosition: data.queue_position,
          truckId: data.truck_id || null,
          licensePlateSnapshot: data.license_plate_snapshot,
          driverId: data.driver_id || null,
          driverNameSnapshot: data.driver_name_snapshot,
          supplierId: data.supplier_id || null,
          supplierNameSnapshot: data.supplier_name_snapshot,
          manifestCount: data.manifest_count,
          lineId: data.line_id || null,
          status: 'DRAFT',
          reconciliationStatus: 'PENDING',
          notes: data.notes || null,
          createdBy: user!.id,
        })
        .returning();

      await createAuditLog(
        {
          actorId: user!.id,
          actorRole: user!.roles[0],
          action: 'RECEIVING_CREATE',
          entityType: 'receiving',
          entityId: inserted.id,
          afterData: inserted,
          source: 'WEB',
        },
        tx
      );

      return inserted;
    });

    return NextResponse.json({ receiving: newReceiving }, { status: 201 });
  } catch (error) {
    console.error('POST /api/receivings error:', error);
    return internalError();
  }
}
