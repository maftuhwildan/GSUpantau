import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { drivers } from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { internalError } from '@/lib/errors';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const list = await db
      .select()
      .from(drivers)
      .where(eq(drivers.status, 'ACTIVE'))
      .orderBy(drivers.name);

    return NextResponse.json({ drivers: list });
  } catch (error) {
    console.error('GET /api/drivers error:', error);
    return internalError();
  }
}
