import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { receivings, receivingSessions } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { createErrorResponse, validationError, notFoundError } from '@/lib/errors';
import { wsBroadcaster } from '@/lib/ws';
import { eq } from 'drizzle-orm';

const cancelSessionSchema = z.object({
  reason: z.string().min(1, { message: 'Alasan pembatalan sesi wajib diisi' }),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requirePermission(req, 'session:cancel');
  if (errorResponse) return errorResponse;

  try {
    const { id: sessionId } = await params;
    const body = await req.json();
    const parsed = cancelSessionSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Alasan pembatalan tidak valid';
      return validationError(firstIssue);
    }

    const { reason } = parsed.data;

    const [session] = await db
      .select()
      .from(receivingSessions)
      .where(eq(receivingSessions.id, sessionId));

    if (!session) {
      return notFoundError('Sesi penghitungan tidak ditemukan');
    }

    if (session.status !== 'COUNTING') {
      return createErrorResponse(
        'INVALID_STATUS',
        `Sesi tidak dapat dibatalkan karena status saat ini: ${session.status}`,
        400
      );
    }

    const updatedSession = await db.transaction(async (tx) => {
      const [cancSession] = await tx
        .update(receivingSessions)
        .set({
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: user!.id,
          cancellationReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(receivingSessions.id, session.id))
        .returning();

      await tx
        .update(receivings)
        .set({
          status: 'WAITING',
          updatedAt: new Date(),
        })
        .where(eq(receivings.id, session.receivingId));

      await recordAuditLog(
        {
          actorId: user!.id,
          actorRole: user!.roles[0],
          action: 'SESSION_CANCEL',
          entityType: 'receiving_sessions',
          entityId: session.id,
          reason,
          afterData: cancSession,
        },
        tx
      );

      return cancSession;
    });

    wsBroadcaster.broadcast('session.cancelled', {
      session_id: session.id,
      receiving_id: session.receivingId,
      reason,
    });

    return NextResponse.json({
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        cancellation_reason: updatedSession.cancellationReason,
      },
    });
  } catch (error) {
    console.error('POST /api/sessions/:id/cancel error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Terjadi kesalahan server', 500);
  }
}
