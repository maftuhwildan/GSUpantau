import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { receivings, receivingSessions } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { AppError, buildErrorResponse, createErrorResponse, forbiddenError, validationError, notFoundError } from '@/lib/errors';
import { lockCountingLine } from '@/lib/counting-lock';
import { wsBroadcaster } from '@/lib/ws';
import { and, eq } from 'drizzle-orm';

const cancelSessionSchema = z.object({
  reason: z.string().min(1, { message: 'Alasan pembatalan wajib diisi' }),
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

    const isOperatorOnly = user!.roles.includes('OPERATOR') && !user!.roles.includes('ADMIN');
    if (isOperatorOnly) {
      if (!user!.assignedLineId || session.lineId !== user!.assignedLineId) {
        return forbiddenError('Akses ditolak. Anda tidak memiliki akses ke jalur (Line) ini.');
      }
    }

    if (session.status !== 'COUNTING') {
      return createErrorResponse(
        'INVALID_STATUS',
        `Sesi tidak dapat dibatalkan karena status saat ini: ${session.status}`,
        400
      );
    }

    const updatedSession = await db.transaction(async (tx) => {
      const lockedLine = await lockCountingLine(tx, session.lineId);
      if (!lockedLine) {
        throw new AppError('NOT_FOUND', 'Jalur (Line) sesi tidak ditemukan', 404);
      }

      const [cancSession] = await tx
        .update(receivingSessions)
        .set({
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: user!.id,
          cancellationReason: reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(receivingSessions.id, session.id),
            eq(receivingSessions.status, 'COUNTING')
          )
        )
        .returning();

      if (!cancSession) {
        throw new AppError(
          'CONFLICT',
          'Sesi sudah diselesaikan atau dibatalkan oleh request lain',
          409
        );
      }

      const [waitingReceiving] = await tx
        .update(receivings)
        .set({
          status: 'WAITING',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(receivings.id, session.receivingId),
            eq(receivings.status, 'COUNTING')
          )
        )
        .returning();

      if (!waitingReceiving) {
        throw new AppError(
          'CONFLICT',
          'Surat Jalan sudah diubah oleh request lain',
          409
        );
      }

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
    if (error instanceof AppError) {
      return buildErrorResponse(error);
    }
    console.error('POST /api/sessions/:id/cancel error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Terjadi kesalahan server', 500);
  }
}
