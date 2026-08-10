import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError } from '@/lib/errors';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  try {
    const list = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.status, 'ACTIVE'))
      .orderBy(suppliers.name);

    return NextResponse.json({ suppliers: list });
  } catch (error) {
    console.error('GET /api/suppliers error:', error);
    return internalError();
  }
}
