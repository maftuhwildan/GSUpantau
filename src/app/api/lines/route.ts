import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { devices, lines } from '@/db/schema';
import { isOperatorOnly, requirePermission } from '@/lib/auth';
import {
  forbiddenError,
  internalError,
  validationError,
  createErrorResponse,
} from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { wsBroadcaster } from '@/lib/ws';
import { getDeviceHealthSettings, toPublicDeviceHealth } from '@/lib/device-health';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

const createLineSchema = z.object({
  lineCode: z
    .string()
    .min(1, 'Kode jalur wajib diisi.')
    .max(50)
    .transform((v) => v.toUpperCase().trim()),
  name: z.string().min(1, 'Nama jalur wajib diisi.').max(100).trim(),
});

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'dashboard:view');
  if (errorResponse) return errorResponse;

  try {
    if (isOperatorOnly(user!)) {
      if (!user!.assignedLineId) {
        return forbiddenError('Operator belum ditugaskan pada jalur (Line) mana pun.');
      }

      const list = await db
        .select()
        .from(lines)
        .where(eq(lines.id, user!.assignedLineId))
        .orderBy(lines.lineCode);

      return NextResponse.json({ lines: await addDeviceHealth(list) });
    }

    const list = await db.select().from(lines).orderBy(lines.lineCode);

    return NextResponse.json({ lines: await addDeviceHealth(list) });
  } catch (error) {
    console.error('GET /api/lines error:', error);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'lines_devices:manage');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = createLineSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(
        'Input tidak valid.',
        parsed.error.flatten().fieldErrors as Record<string, unknown>
      );
    }

    const { lineCode, name } = parsed.data;

    // Check lineCode uniqueness
    const existing = await db.query.lines.findFirst({
      where: eq(lines.lineCode, lineCode),
    });
    if (existing) {
      return createErrorResponse(
        'CONFLICT',
        `Kode jalur '${lineCode}' sudah terdaftar.`,
        409
      );
    }

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(lines)
        .values({ lineCode, name, status: 'ACTIVE' })
        .returning();

      const auditLog = await createAuditLog(
        {
          actorId: user!.id,
          actorRole: user!.roles[0] ?? null,
          action: 'CREATE_LINE',
          entityType: 'line',
          entityId: created.id,
          afterData: created,
          source: 'WEB',
        },
        tx
      );

      return { line: created, auditLog };
    });

    wsBroadcaster.broadcast('audit.created', {
      audit_log_id: result.auditLog.id,
      action: result.auditLog.action,
      entity_type: result.auditLog.entityType,
      entity_id: result.auditLog.entityId,
      line_id: result.line.id,
    });

    return NextResponse.json({ line: result.line }, { status: 201 });
  } catch (error) {
    console.error('POST /api/lines error:', error);
    return internalError();
  }
}


async function addDeviceHealth(lineList: Array<typeof lines.$inferSelect>) {
  if (lineList.length === 0) return [];

  const settings = await getDeviceHealthSettings();
  const deviceList = await db
    .select()
    .from(devices)
    .where(inArray(devices.lineId, lineList.map((line) => line.id)));

  return lineList.map((line) => ({
    ...line,
    devices: deviceList
      .filter((device) => device.lineId === line.id)
      .map((deviceRecord) => toPublicDeviceHealth(deviceRecord, settings)),
  }));
}
