import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { drivers } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError, validationError, notFoundError, createErrorResponse } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';

const updateDriverSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
  licenseNumber: z.string().max(50).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const driver = await db.query.drivers.findFirst({ where: eq(drivers.id, id) });
    if (!driver) return notFoundError('Supir tidak ditemukan.');
    return NextResponse.json({ driver });
  } catch (error) {
    console.error('GET /api/drivers/[id] error:', error);
    return internalError();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateDriverSchema.safeParse(body);
    if (!parsed.success) {
      return validationError('Input tidak valid.', parsed.error.flatten().fieldErrors as Record<string, unknown>);
    }

    const before = await db.query.drivers.findFirst({ where: eq(drivers.id, id) });
    if (!before) return notFoundError('Supir tidak ditemukan.');

    const updates = parsed.data;

    // Check license number uniqueness if changing
    if (updates.licenseNumber && updates.licenseNumber !== before.licenseNumber) {
      const existing = await db.query.drivers.findFirst({
        where: and(eq(drivers.licenseNumber, updates.licenseNumber), ne(drivers.id, id)),
      });
      if (existing) {
        return createErrorResponse('CONFLICT', `Nomor SIM '${updates.licenseNumber}' sudah terdaftar.`, 409);
      }
    }

    const [driver] = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(drivers)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(drivers.id, id))
        .returning();

      await createAuditLog({
        actorId: user!.id,
        actorRole: user!.roles[0] ?? null,
        action: 'UPDATE_DRIVER',
        entityType: 'driver',
        entityId: id,
        beforeData: before,
        afterData: updated,
        source: 'WEB',
      }, tx);

      return [updated];
    });

    return NextResponse.json({ driver });
  } catch (error) {
    console.error('PATCH /api/drivers/[id] error:', error);
    return internalError();
  }
}
