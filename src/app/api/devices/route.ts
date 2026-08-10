import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { devices, lines } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import {
  internalError,
  validationError,
  createErrorResponse,
  notFoundError,
} from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { wsBroadcaster } from '@/lib/ws';
import { getDeviceHealthSettings, toPublicDeviceHealth } from '@/lib/device-health';
import { eq, ilike, or, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const createDeviceSchema = z.object({
  deviceCode: z
    .string()
    .min(1, 'Kode perangkat wajib diisi.')
    .max(50)
    .transform((v) => v.toUpperCase().trim()),
  lineId: z.string().uuid('ID jalur tidak valid.'),
  name: z.string().min(1, 'Nama perangkat wajib diisi.').max(100).trim(),
});

/**
 * Generate a cryptographically random plaintext secret and its bcrypt hash.
 * We store only the hash; the plaintext is shown once and discarded.
 */
async function generateDeviceCredential(): Promise<{ plaintext: string; hash: string }> {
  const plaintext = randomBytes(32).toString('hex');
  const hash = await bcrypt.hash(plaintext, 10);
  return { plaintext, hash };
}

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'lines_devices:manage');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const lineId = searchParams.get('line_id') || undefined;
    const status = searchParams.get('status') || undefined;

    let query = db.select().from(devices).$dynamic();

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(devices.deviceCode, `%${search}%`),
          ilike(devices.name, `%${search}%`)
        )
      );
    }
    if (lineId) {
      conditions.push(eq(devices.lineId, lineId));
    }
    if (status) {
      conditions.push(eq(devices.status, status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const rawList = await query.orderBy(desc(devices.createdAt));
    const settings = await getDeviceHealthSettings();

    // Never expose credentialHash
    const list = rawList.map((d) => toPublicDeviceHealth(d, settings));

    return NextResponse.json({ devices: list });
  } catch (error) {
    console.error('GET /api/devices error:', error);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'lines_devices:manage');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = createDeviceSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(
        'Input tidak valid.',
        parsed.error.flatten().fieldErrors as Record<string, unknown>
      );
    }

    const { deviceCode, lineId, name } = parsed.data;

    // Check line exists
    const line = await db.query.lines.findFirst({ where: eq(lines.id, lineId) });
    if (!line) {
      return notFoundError('Jalur tidak ditemukan.');
    }

    // Check deviceCode uniqueness
    const existing = await db.query.devices.findFirst({
      where: eq(devices.deviceCode, deviceCode),
    });
    if (existing) {
      return createErrorResponse(
        'CONFLICT',
        `Kode perangkat '${deviceCode}' sudah terdaftar.`,
        409
      );
    }

    const { plaintext, hash } = await generateDeviceCredential();

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(devices)
        .values({
          deviceCode,
          lineId,
          name,
          credentialHash: hash,
          status: 'UNREGISTERED',
        })
        .returning();

      // Audit log excludes credential_hash
      const auditLog = await createAuditLog(
        {
          actorId: user!.id,
          actorRole: user!.roles[0] ?? null,
          action: 'REGISTER_DEVICE',
          entityType: 'device',
          entityId: created.id,
          afterData: {
            id: created.id,
            deviceCode: created.deviceCode,
            lineId: created.lineId,
            name: created.name,
            status: created.status,
          },
          source: 'WEB',
        },
        tx
      );

      return { device: created, auditLog };
    });

    const settings = await getDeviceHealthSettings();
    const publicDevice = toPublicDeviceHealth(result.device, settings);

    wsBroadcaster.broadcast('device.status_updated', {
      device_id: publicDevice.deviceCode,
      line_id: publicDevice.lineId,
      status: publicDevice.status,
    });

    wsBroadcaster.broadcast('audit.created', {
      audit_log_id: result.auditLog.id,
      action: result.auditLog.action,
      entity_type: result.auditLog.entityType,
      entity_id: result.auditLog.entityId,
      line_id: publicDevice.lineId,
    });

    // Return plaintext secret once – it will not be retrievable again
    return NextResponse.json(
      { device: publicDevice, secret: plaintext },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/devices error:', error);
    return internalError();
  }
}

