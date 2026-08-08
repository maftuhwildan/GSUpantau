import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import {
  receivings,
  lines,
  trucks,
  drivers,
  suppliers,
  users,
  receivingSessions,
  manifestRevisions,
  sensorEvents,
  auditLogs,
} from '@/db/schema';
import { requirePermission, checkOperatorLineAccess, isOperatorOnly } from '@/lib/auth';
import { validationError, notFoundError, internalError, createErrorResponse, forbiddenError } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';

const updateReceivingSchema = z.object({
  receiving_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional(),
  delivery_note_number: z.string().min(1, 'Nomor Surat Jalan wajib diisi').optional(),
  document_truck_sequence: z.number().int().optional().nullable(),
  queue_position: z.number().int().min(1).optional(),
  truck_id: z.string().uuid().optional().nullable(),
  license_plate_snapshot: z.string().min(1, 'Plat nomor wajib diisi').optional(),
  driver_id: z.string().uuid().optional().nullable(),
  driver_name_snapshot: z.string().min(1, 'Nama supir wajib diisi').optional(),
  supplier_id: z.string().uuid().optional().nullable(),
  supplier_name_snapshot: z.string().min(1, 'Nama supplier wajib diisi').optional(),
  manifest_count: z.number().int().positive('Jumlah manifest harus angka positif (> 0)').optional(),
  line_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  reason: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requirePermission(req, 'receiving:view');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const [found] = await db
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
      .where(eq(receivings.id, id));

    if (!found) {
      return notFoundError('Surat Jalan (Receiving) tidak ditemukan.');
    }

    // ── Operator line restriction ─────────────────────────────────────────
    if (isOperatorOnly(user!)) {
      if (!user!.assignedLineId) {
        return forbiddenError('Operator belum ditugaskan pada jalur (Line) mana pun.');
      }
      if (found.receiving.lineId && found.receiving.lineId !== user!.assignedLineId) {
        return forbiddenError('Akses ditolak. Surat Jalan ini bukan milik jalur (Line) Anda.');
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const sessions = await db
      .select()
      .from(receivingSessions)
      .where(eq(receivingSessions.receivingId, id))
      .orderBy(desc(receivingSessions.startedAt));

    const revisions = await db
      .select({
        revision: manifestRevisions,
        changedBy: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(manifestRevisions)
      .leftJoin(users, eq(manifestRevisions.changedBy, users.id))
      .where(eq(manifestRevisions.receivingId, id))
      .orderBy(desc(manifestRevisions.createdAt));

    // Calculate actual count from assigned sensor events
    let actualCount: number | null = null;
    const recStatus = found.receiving.status;
    const isCountedOrCounting = recStatus === 'COUNTING' || recStatus === 'COMPLETED';

    if (isCountedOrCounting && sessions.length > 0) {
      const validSessions = sessions.filter((s) => s.status === recStatus);
      if (validSessions.length > 0) {
        const sessionIds = validSessions.map((s) => s.id);
        const [countResult] = await db
          .select({
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
          );
        actualCount = countResult?.count || 0;
      } else {
        actualCount = 0;
      }
    }

    const differenceCount = actualCount !== null ? actualCount - found.receiving.manifestCount : null;
    const differencePercent =
      actualCount !== null && found.receiving.manifestCount > 0
        ? Number(((differenceCount! / found.receiving.manifestCount) * 100).toFixed(2))
        : null;

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, id))
      .orderBy(desc(auditLogs.createdAt));

    return NextResponse.json({
      receiving: {
        ...found.receiving,
        lineName: found.line?.name || null,
        lineCode: found.line?.lineCode || null,
        truck: found.truck || null,
        driver: found.driver || null,
        supplier: found.supplier || null,
        createdBy: found.creator || null,
        actualCount,
        differenceCount,
        differencePercent,
        sessions,
        manifestRevisions: revisions.map((r) => ({
          ...r.revision,
          changedByName: r.changedBy?.name || 'Unknown',
        })),
        auditLogs: logs,
      },
    });
  } catch (error) {
    console.error('GET /api/receivings/:id error:', error);
    return internalError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requirePermission(req, 'receiving:update');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const [existing] = await db
      .select()
      .from(receivings)
      .where(eq(receivings.id, id));

    if (!existing) {
      return notFoundError('Surat Jalan (Receiving) tidak ditemukan.');
    }

    if (existing.status === 'COUNTING' || existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      return createErrorResponse(
        'INVALID_STATUS',
        `Data Surat Jalan dengan status ${existing.status} tidak dapat diubah.`,
        400
      );
    }

    const body = await req.json();
    const parseResult = updateReceivingSchema.safeParse(body);

    if (!parseResult.success) {
      const issues = parseResult.error.format();
      return validationError('Input pembaharuan receiving tidak valid.', { issues });
    }

    const data = parseResult.data;

    // Check manifest revision rule for WAITING
    const isManifestChanging =
      data.manifest_count !== undefined && data.manifest_count !== existing.manifestCount;

    if (existing.status === 'WAITING' && isManifestChanging) {
      if (!data.reason || data.reason.trim() === '') {
        return validationError('Alasan revisi manifest wajib diisi untuk Surat Jalan yang sudah diterbitkan.');
      }

      // Record manifest revision
      await db.insert(manifestRevisions).values({
        receivingId: existing.id,
        oldManifestCount: existing.manifestCount,
        newManifestCount: data.manifest_count!,
        reason: data.reason.trim(),
        changedBy: user!.id,
      });
    }

    // Build update object
    const updateValues: Partial<typeof receivings.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.receiving_date !== undefined) updateValues.receivingDate = data.receiving_date;
    if (data.delivery_note_number !== undefined) updateValues.deliveryNoteNumber = data.delivery_note_number;
    if (data.document_truck_sequence !== undefined) updateValues.documentTruckSequence = data.document_truck_sequence;
    if (data.queue_position !== undefined) updateValues.queuePosition = data.queue_position;
    if (data.truck_id !== undefined) updateValues.truckId = data.truck_id;
    if (data.license_plate_snapshot !== undefined) updateValues.licensePlateSnapshot = data.license_plate_snapshot;
    if (data.driver_id !== undefined) updateValues.driverId = data.driver_id;
    if (data.driver_name_snapshot !== undefined) updateValues.driverNameSnapshot = data.driver_name_snapshot;
    if (data.supplier_id !== undefined) updateValues.supplierId = data.supplier_id;
    if (data.supplier_name_snapshot !== undefined) updateValues.supplierNameSnapshot = data.supplier_name_snapshot;
    if (data.manifest_count !== undefined) updateValues.manifestCount = data.manifest_count;
    if (data.line_id !== undefined) updateValues.lineId = data.line_id;
    if (data.notes !== undefined) updateValues.notes = data.notes;

    const [updatedReceiving] = await db
      .update(receivings)
      .set(updateValues)
      .where(eq(receivings.id, id))
      .returning();

    // Record audit log
    const auditAction =
      existing.status === 'WAITING' && isManifestChanging ? 'MANIFEST_REVISION' : 'RECEIVING_UPDATE';

    await createAuditLog({
      actorId: user!.id,
      actorRole: user!.roles[0],
      action: auditAction,
      entityType: 'receiving',
      entityId: id,
      beforeData: existing,
      afterData: updatedReceiving,
      reason: data.reason || null,
      source: 'WEB',
    });

    return NextResponse.json({ receiving: updatedReceiving });
  } catch (error) {
    console.error('PATCH /api/receivings/:id error:', error);
    return internalError();
  }
}
