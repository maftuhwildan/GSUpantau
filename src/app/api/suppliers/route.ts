import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError, validationError, createErrorResponse } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { eq, ilike, or, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const createSupplierSchema = z.object({
  code: z.string().min(1, 'Kode supplier wajib diisi.').max(50).transform((v) => v.toUpperCase().trim()),
  name: z.string().min(1, 'Nama supplier wajib diisi.').max(100),
  address: z.string().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status') || undefined;

    let query = db.select().from(suppliers).$dynamic();

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(suppliers.name, `%${search}%`),
          ilike(suppliers.code, `%${search}%`),
          ilike(suppliers.address, `%${search}%`)
        )
      );
    }
    if (status) {
      conditions.push(eq(suppliers.status, status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const list = await query.orderBy(desc(suppliers.createdAt));
    return NextResponse.json({ suppliers: list });
  } catch (error) {
    console.error('GET /api/suppliers error:', error);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = createSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return validationError('Input tidak valid.', parsed.error.flatten().fieldErrors as Record<string, unknown>);
    }

    const { code, name, address, phone } = parsed.data;

    // Check supplier code uniqueness
    const existing = await db.query.suppliers.findFirst({
      where: eq(suppliers.code, code),
    });
    if (existing) {
      return createErrorResponse('CONFLICT', `Kode supplier '${code}' sudah terdaftar.`, 409);
    }

    const [supplier] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(suppliers).values({
        code,
        name,
        address: address ?? null,
        phone: phone ?? null,
        status: 'ACTIVE',
      }).returning();

      await createAuditLog({
        actorId: user!.id,
        actorRole: user!.roles[0] ?? null,
        action: 'CREATE_SUPPLIER',
        entityType: 'supplier',
        entityId: created.id,
        afterData: created,
        source: 'WEB',
      }, tx);

      return [created];
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    console.error('POST /api/suppliers error:', error);
    return internalError();
  }
}
