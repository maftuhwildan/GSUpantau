import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { receivings, receivingSessions, sensorEvents, reconciliationReviews } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { createErrorResponse, validationError, notFoundError } from '@/lib/errors';
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

    if (session.status !== 'COUNTING') {
      return createErrorResponse(
        'INVALID_STATUS',
        `Sesi sudah tidak aktif. Status saat ini: ${session.status}`,
        400
      );
    }

    // Query receiving
    const [receiving] = await db
      .select()
      .from(receivings)
      .where(eq(receivings.id, session.receivingId));

    if (!receiving) {
      return notFoundError('Data Surat Jalan terkait tidak ditemukan');
    }

    const { actualCount, differenceCount, differencePercent, updatedSession } = await db.transaction(
      async (tx) => {
        // 1. Update session
        const [completedSession] = await tx
          .update(receivingSessions)
          .set({
            status: 'COMPLETED',
            finishedAt: new Date(),
            finishedBy: user!.id,
            updatedAt: new Date(),
          })
          .where(eq(receivingSessions.id, session.id))
          .returning();

        // 2. Update receiving
        await tx
          .update(receivings)
          .set({
            status: 'COMPLETED',
            updatedAt: new Date(),
          })
          .where(eq(receivings.id, session.receivingId));

        // 3. Derived actual count
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
    console.error('POST /api/sessions/:id/finish error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Terjadi kesalahan server', 500);
  }
}
