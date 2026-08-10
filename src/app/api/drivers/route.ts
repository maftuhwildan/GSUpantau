import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { drivers } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError, validationError, createErrorResponse } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { eq, ilike, or, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const createDriverSchema = z.object({
  name: z.string().min(1, 'Nama supir wajib diisi.').max(100),
  phone: z.string().max(30).optional().nullable(),
  licenseNumber: z.string().max(50).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status') || undefined;

    let query = db.select().from(drivers).$dynamic();

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(drivers.name, `%${search}%`),
          ilike(drivers.phone, `%${search}%`),
          ilike(drivers.licenseNumber, `%${search}%`)
        )
      );
    }
    if (status) {
      conditions.push(eq(drivers.status, status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const list = await query.orderBy(desc(drivers.createdAt));
    return NextResponse.json({ drivers: list });
  } catch (error) {
    console.error('GET /api/drivers error:', error);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = createDriverSchema.safeParse(body);
    if (!parsed.success) {
      return validationError('Input tidak valid.', parsed.error.flatten().fieldErrors as Record<string, unknown>);
    }

    const { name, phone, licenseNumber } = parsed.data;

    // Check license number uniqueness if provided
    if (licenseNumber) {
      const existing = await db.query.drivers.findFirst({
        where: eq(drivers.licenseNumber, licenseNumber),
      });
      if (existing) {
        return createErrorResponse('CONFLICT', `Nomor SIM '${licenseNumber}' sudah terdaftar.`, 409);
      }
    }

    const [driver] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(drivers).values({
        name,
        phone: phone ?? null,
        licenseNumber: licenseNumber ?? null,
        status: 'ACTIVE',
      }).returning();

      await createAuditLog({
        actorId: user!.id,
        actorRole: user!.roles[0] ?? null,
        action: 'CREATE_DRIVER',
        entityType: 'driver',
        entityId: created.id,
        afterData: created,
        source: 'WEB',
      }, tx);

      return [created];
    });

    return NextResponse.json({ driver }, { status: 201 });
  } catch (error) {
    console.error('POST /api/drivers error:', error);
    return internalError();
  }
}
