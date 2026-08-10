import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { lines } from '@/db/schema';
import { isOperatorOnly, requirePermission } from '@/lib/auth';
import { forbiddenError, internalError } from '@/lib/errors';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'dashboard:view');
  if (errorResponse) return errorResponse;

  try {
    if (isOperatorOnly(user!)) {
      if (!user!.assignedLineId) {
        return forbiddenError('Operator belum ditugaskan pada jalur (Line) mana pun.');
      }

      const list = await db
        .select()
        .from(lines)
        .where(eq(lines.id, user!.assignedLineId))
        .orderBy(lines.lineCode);

      return NextResponse.json({ lines: list });
    }

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
