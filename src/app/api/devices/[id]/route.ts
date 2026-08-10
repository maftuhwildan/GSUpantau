import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { devices, lines, receivingSessions } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import {
  AppError,
  buildErrorResponse,
  internalError,
  validationError,
  notFoundError,
} from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { lockCountingLine } from '@/lib/counting-lock';
import { wsBroadcaster } from '@/lib/ws';
import { getDeviceHealthSettings, toPublicDeviceHealth } from '@/lib/device-health';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateDeviceSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  lineId: z.string().uuid('ID jalur tidak valid.').optional(),
  status: z.enum(['ONLINE', 'DEGRADED', 'OFFLINE', 'MAINTENANCE', 'UNREGISTERED']).optional(),
  reason: z.string().max(255).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requirePermission(req, 'lines_devices:manage');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const device = await db.query.devices.findFirst({ where: eq(devices.id, id) });
    if (!device) return notFoundError('Perangkat tidak ditemukan.');

    const settings = await getDeviceHealthSettings();
    return NextResponse.json({ device: toPublicDeviceHealth(device, settings) });
  } catch (error) {
    console.error('GET /api/devices/[id] error:', error);
    return internalError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requirePermission(req, 'lines_devices:manage');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateDeviceSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(
        'Input tidak valid.',
        parsed.error.flatten().fieldErrors as Record<string, unknown>
      );
    }

    const { name, lineId: newLineId, status, reason } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(devices).where(eq(devices.id, id));
      if (!before) {
        throw new AppError('NOT_FOUND', 'Perangkat tidak ditemukan.', 404);
      }

      // Guard: lock origin line and check active counting session if reassigning
      if (newLineId && newLineId !== before.lineId) {
        await lockCountingLine(tx, before.lineId);

        const [activeSession] = await tx
          .select()
          .from(receivingSessions)
          .where(
            and(
              eq(receivingSessions.lineId, before.lineId),
              eq(receivingSessions.status, 'COUNTING')
            )
          )
          .limit(1);

        if (activeSession) {
          throw new AppError(
            'CONFLICT',
            'Perangkat tidak dapat dipindahkan ke jalur lain saat jalur asal sedang dalam sesi counting aktif.',
            409
          );
        }

        const targetLine = await tx.query.lines.findFirst({ where: eq(lines.id, newLineId) });
        if (!targetLine) {
          throw new AppError('NOT_FOUND', 'Jalur tujuan tidak ditemukan.', 404);
        }
      }

      const updates: Partial<typeof devices.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (newLineId !== undefined) updates.lineId = newLineId;
      if (status !== undefined) updates.status = status;

      const [updated] = await tx
        .update(devices)
        .set(updates)
        .where(eq(devices.id, id))
        .returning();

      const auditLog = await createAuditLog(
        {
          actorId: user!.id,
          actorRole: user!.roles[0] ?? null,
          action: 'UPDATE_DEVICE',
          entityType: 'device',
          entityId: id,
          beforeData: {
            id: before.id,
            deviceCode: before.deviceCode,
            lineId: before.lineId,
            name: before.name,
            status: before.status,
          },
          afterData: {
            id: updated.id,
            deviceCode: updated.deviceCode,
            lineId: updated.lineId,
            name: updated.name,
            status: updated.status,
          },
          reason: reason ?? null,
          source: 'WEB',
        },
        tx
      );

      return { updated, auditLog, before };
    });

    const settings = await getDeviceHealthSettings();
    const publicDevice = toPublicDeviceHealth(result.updated, settings);

    wsBroadcaster.broadcast('device.status_updated', {
      device_id: result.updated.deviceCode,
      line_id: result.updated.lineId,
      previous_line_id: result.before.lineId,
      status: publicDevice.status,
    });

    wsBroadcaster.broadcast('audit.created', {
      audit_log_id: result.auditLog.id,
      action: result.auditLog.action,
      entity_type: result.auditLog.entityType,
      entity_id: result.auditLog.entityId,
      line_id: result.updated.lineId,
    });

    return NextResponse.json({ device: publicDevice });
  } catch (error) {
    if (error instanceof AppError) {
      return buildErrorResponse(error);
    }
    console.error('PATCH /api/devices/[id] error:', error);
    return internalError();
  }
}

