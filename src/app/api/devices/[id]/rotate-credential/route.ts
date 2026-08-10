import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { devices } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError, notFoundError } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { wsBroadcaster } from '@/lib/ws';
import { getDeviceHealthSettings, toPublicDeviceHealth } from '@/lib/device-health';
import { eq } from 'drizzle-orm';

async function generateDeviceCredential(): Promise<{ plaintext: string; hash: string }> {
  const plaintext = randomBytes(32).toString('hex');
  const hash = await bcrypt.hash(plaintext, 10);
  return { plaintext, hash };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requirePermission(req, 'lines_devices:manage');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const before = await db.query.devices.findFirst({ where: eq(devices.id, id) });
    if (!before) return notFoundError('Perangkat tidak ditemukan.');

    const { plaintext, hash } = await generateDeviceCredential();

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(devices)
        .set({ credentialHash: hash, updatedAt: new Date() })
        .where(eq(devices.id, id))
        .returning();

      const auditLog = await createAuditLog(
        {
          actorId: user!.id,
          actorRole: user!.roles[0] ?? null,
          action: 'ROTATE_DEVICE_CREDENTIAL',
          entityType: 'device',
          entityId: id,
          beforeData: {
            id: before.id,
            deviceCode: before.deviceCode,
            lineId: before.lineId,
          },
          afterData: {
            id: updated.id,
            deviceCode: updated.deviceCode,
            lineId: updated.lineId,
            credentialRotatedAt: new Date().toISOString(),
          },
          source: 'WEB',
        },
        tx
      );

      return { device: updated, auditLog };
    });

    wsBroadcaster.broadcast('audit.created', {
      audit_log_id: result.auditLog.id,
      action: result.auditLog.action,
      entity_type: result.auditLog.entityType,
      entity_id: result.auditLog.entityId,
      line_id: result.device.lineId,
    });

    const settings = await getDeviceHealthSettings();
    const publicDevice = toPublicDeviceHealth(result.device, settings);

    // Return new plaintext once — previous secret is immediately invalidated
    return NextResponse.json({ device: publicDevice, secret: plaintext });
  } catch (error) {
    console.error('POST /api/devices/[id]/rotate-credential error:', error);
    return internalError();
  }
}

