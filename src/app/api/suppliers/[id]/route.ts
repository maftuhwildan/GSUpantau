import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError, validationError, notFoundError, createErrorResponse } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';

const updateSupplierSchema = z.object({
  code: z.string().min(1).max(50).transform((v) => v.toUpperCase().trim()).optional(),
  name: z.string().min(1).max(100).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, id) });
    if (!supplier) return notFoundError('Supplier tidak ditemukan.');
    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('GET /api/suppliers/[id] error:', error);
    return internalError();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return validationError('Input tidak valid.', parsed.error.flatten().fieldErrors as Record<string, unknown>);
    }

    const before = await db.query.suppliers.findFirst({ where: eq(suppliers.id, id) });
    if (!before) return notFoundError('Supplier tidak ditemukan.');

    const updates = parsed.data;

    // Check supplier code uniqueness if changing
    if (updates.code && updates.code !== before.code) {
      const existing = await db.query.suppliers.findFirst({
        where: and(eq(suppliers.code, updates.code), ne(suppliers.id, id)),
      });
      if (existing) {
        return createErrorResponse('CONFLICT', `Kode supplier '${updates.code}' sudah terdaftar.`, 409);
      }
    }

    const [supplier] = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(suppliers)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(suppliers.id, id))
        .returning();

      await createAuditLog({
        actorId: user!.id,
        actorRole: user!.roles[0] ?? null,
        action: 'UPDATE_SUPPLIER',
        entityType: 'supplier',
        entityId: id,
        beforeData: before,
        afterData: updated,
        source: 'WEB',
      }, tx);

      return [updated];
    });

    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('PATCH /api/suppliers/[id] error:', error);
    return internalError();
  }
}
