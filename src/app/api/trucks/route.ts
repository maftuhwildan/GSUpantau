import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trucks } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError } from '@/lib/errors';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'master_data:manage');
  if (errorResponse) return errorResponse;

  try {
    const list = await db
      .select()
      .from(trucks)
      .where(eq(trucks.status, 'ACTIVE'))
      .orderBy(trucks.licensePlate);

    return NextResponse.json({ trucks: list });
  } catch (error) {
    console.error('GET /api/trucks error:', error);
    return internalError();
  }
}
