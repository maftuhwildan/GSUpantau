import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { receivings, receivingSessions, sensorEvents, reconciliationReviews } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { AppError, buildErrorResponse, createErrorResponse, forbiddenError, validationError, notFoundError } from '@/lib/errors';
import { lockCountingLine } from '@/lib/counting-lock';
import { wsBroadcaster } from '@/lib/ws';
import { eq, and, count } from 'drizzle-orm';

const finishSessionSchema = z.object({
  confirmation: z.literal(true, {
    errorMap: () => ({ message: 'Konfirmasi penyelesaian wajib (confirmation: true)' }),
  }),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requirePermission(req, 'session:finish');
  if (errorResponse) return errorResponse;

  try {
    const { id: sessionId } = await params;
    const body = await req.json();
    const parsed = finishSessionSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Konfirmasi tidak valid';
      return validationError(firstIssue);
    }

    // Query session
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
        `Sesi sudah tidak aktif. Status saat ini: ${session.status}`,
        400
      );
    }

    const { actualCount, differenceCount, differencePercent, updatedSession } = await db.transaction(
      async (tx) => {
        const lockedLine = await lockCountingLine(tx, session.lineId);
        if (!lockedLine) {
          throw new AppError('NOT_FOUND', 'Jalur (Line) sesi tidak ditemukan', 404);
        }

        // Conditional transition makes concurrent finish/cancel requests have
        // exactly one winner after taking the shared line lock.
        const [completedSession] = await tx
          .update(receivingSessions)
          .set({
            status: 'COMPLETED',
            finishedAt: new Date(),
            finishedBy: user!.id,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(receivingSessions.id, session.id),
              eq(receivingSessions.status, 'COUNTING')
            )
          )
          .returning();

        if (!completedSession) {
          throw new AppError(
            'CONFLICT',
            'Sesi sudah diselesaikan atau dibatalkan oleh request lain',
            409
          );
        }

        const [receiving] = await tx
          .select()
          .from(receivings)
          .where(eq(receivings.id, session.receivingId));

        if (!receiving) {
          throw new AppError('NOT_FOUND', 'Data Surat Jalan terkait tidak ditemukan', 404);
        }

        // The line remains locked while the final count is derived, so sensor
        // assignment cannot append events to this session after reconciliation.
        const [cntResult] = await tx
          .select({ total: count() })
          .from(sensorEvents)
          .where(
            and(
              eq(sensorEvents.sessionId, session.id),
              eq(sensorEvents.eventType, 'DETECTION'),
              eq(sensorEvents.eventMode, 'PRODUCTION'),
              eq(sensorEvents.assignmentStatus, 'ASSIGNED')
            )
          );

        const derivedActual = Number(cntResult?.total ?? 0);
        const manifestCount = receiving.manifestCount;
        const diffCount = derivedActual - manifestCount;
        const diffPercent =
          manifestCount > 0
            ? Number(((diffCount / manifestCount) * 100).toFixed(2))
            : null;

        // 4. Record reconciliation review
        const reconStatus = diffCount === 0 ? 'MATCHED' : 'REVIEW_REQUIRED';

        const [completedReceiving] = await tx
          .update(receivings)
          .set({
            status: 'COMPLETED',
            reconciliationStatus: reconStatus,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(receivings.id, session.receivingId),
              eq(receivings.status, 'COUNTING')
            )
          )
          .returning();

        if (!completedReceiving) {
          throw new AppError(
            'CONFLICT',
            'Surat Jalan sudah diubah oleh request lain',
            409
          );
        }

        await tx.insert(reconciliationReviews).values({
          receivingId: session.receivingId,
          sessionId: session.id,
          status: reconStatus,
          differenceCount: diffCount,
          differencePercent: diffPercent,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 5. Record audit log
        await recordAuditLog(
          {
            actorId: user!.id,
            actorRole: user!.roles[0],
            action: 'SESSION_FINISH',
            entityType: 'receiving_sessions',
            entityId: session.id,
            beforeData: {
              status: session.status,
              finishedAt: session.finishedAt,
              finishedBy: session.finishedBy,
            },
            afterData: {
              status: 'COMPLETED',
              actualCount: derivedActual,
              differenceCount: diffCount,
              differencePercent: diffPercent,
            },
          },
          tx
        );

        return {
          actualCount: derivedActual,
          differenceCount: diffCount,
          differencePercent: diffPercent,
          updatedSession: completedSession,
        };
      }
    );

    wsBroadcaster.broadcast('session.finished', {
      session_id: session.id,
      receiving_id: session.receivingId,
      actual_count: actualCount,
      difference_count: differenceCount,
      difference_percent: differencePercent,
    });

    return NextResponse.json({
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        actual_count: actualCount,
        difference_count: differenceCount,
        difference_percent: differencePercent,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return buildErrorResponse(error);
    }
    console.error('POST /api/sessions/:id/finish error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Terjadi kesalahan server', 500);
  }
}
