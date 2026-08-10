import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trucks } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError, validationError, notFoundError, createErrorResponse } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';

const updateTruckSchema = z.object({
  licensePlate: z.string().min(1).max(20).transform((v) => v.toUpperCase().trim()).optional(),
  carrierName: z.string().max(100).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const truck = await db.query.trucks.findFirst({ where: eq(trucks.id, id) });
    if (!truck) return notFoundError('Truck tidak ditemukan.');
    return NextResponse.json({ truck });
  } catch (error) {
    console.error('GET /api/trucks/[id] error:', error);
    return internalError();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateTruckSchema.safeParse(body);
    if (!parsed.success) {
      return validationError('Input tidak valid.', parsed.error.flatten().fieldErrors as Record<string, unknown>);
    }

    const before = await db.query.trucks.findFirst({ where: eq(trucks.id, id) });
    if (!before) return notFoundError('Truck tidak ditemukan.');

    const updates = parsed.data;

    // Check license plate uniqueness if changing
    if (updates.licensePlate && updates.licensePlate !== before.licensePlate) {
      const existing = await db.query.trucks.findFirst({
        where: and(eq(trucks.licensePlate, updates.licensePlate), ne(trucks.id, id)),
      });
      if (existing) {
        return createErrorResponse('CONFLICT', `Plat nomor '${updates.licensePlate}' sudah terdaftar.`, 409);
      }
    }

    const [truck] = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(trucks)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(trucks.id, id))
        .returning();

      await createAuditLog({
        actorId: user!.id,
        actorRole: user!.roles[0] ?? null,
        action: 'UPDATE_TRUCK',
        entityType: 'truck',
        entityId: id,
        beforeData: before,
        afterData: updated,
        source: 'WEB',
      }, tx);

      return [updated];
    });

    return NextResponse.json({ truck });
  } catch (error) {
    console.error('PATCH /api/trucks/[id] error:', error);
    return internalError();
  }
}
