import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { lines } from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { internalError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const list = await db
      .select()
      .from(lines)
      .orderBy(lines.lineCode);

    return NextResponse.json({ lines: list });
  } catch (error) {
    console.error('GET /api/lines error:', error);
    return internalError();
  }
}
