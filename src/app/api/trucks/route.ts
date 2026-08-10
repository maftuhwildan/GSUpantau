import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trucks } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError, validationError, createErrorResponse } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { eq, ilike, or, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const createTruckSchema = z.object({
  licensePlate: z.string().min(1, 'Plat nomor wajib diisi.').max(20).transform((v) => v.toUpperCase().trim()),
  carrierName: z.string().max(100).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status') || undefined;

    let query = db.select().from(trucks).$dynamic();

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(trucks.licensePlate, `%${search}%`),
          ilike(trucks.carrierName, `%${search}%`)
        )
      );
    }
    if (status) {
      conditions.push(eq(trucks.status, status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const list = await query.orderBy(desc(trucks.createdAt));
    return NextResponse.json({ trucks: list });
  } catch (error) {
    console.error('GET /api/trucks error:', error);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = createTruckSchema.safeParse(body);
    if (!parsed.success) {
      return validationError('Input tidak valid.', parsed.error.flatten().fieldErrors as Record<string, unknown>);
    }

    const { licensePlate, carrierName } = parsed.data;

    // Check license plate uniqueness
    const existing = await db.query.trucks.findFirst({
      where: eq(trucks.licensePlate, licensePlate),
    });
    if (existing) {
      return createErrorResponse('CONFLICT', `Plat nomor '${licensePlate}' sudah terdaftar.`, 409);
    }

    const [truck] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(trucks).values({
        licensePlate,
        carrierName: carrierName ?? null,
        status: 'ACTIVE',
      }).returning();

      await createAuditLog({
        actorId: user!.id,
        actorRole: user!.roles[0] ?? null,
        action: 'CREATE_TRUCK',
        entityType: 'truck',
        entityId: created.id,
        afterData: created,
        source: 'WEB',
      }, tx);

      return [created];
    });

    return NextResponse.json({ truck }, { status: 201 });
  } catch (error) {
    console.error('POST /api/trucks error:', error);
    return internalError();
  }
}
