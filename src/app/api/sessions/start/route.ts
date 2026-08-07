import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { receivings, receivingSessions } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { createErrorResponse, validationError, notFoundError } from '@/lib/errors';
import { wsBroadcaster } from '@/lib/ws';
import { eq, and } from 'drizzle-orm';

const startSessionSchema = z.object({
  receiving_id: z.string().uuid({ message: 'ID receiving tidak valid' }),
  line_id: z.string().uuid({ message: 'ID line tidak valid' }).optional(),
});

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'session:start');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = startSessionSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Input tidak valid';
      return validationError(firstIssue);
    }

    const { receiving_id, line_id } = parsed.data;

    // Check receiving
    const [receiving] = await db
      .select()
      .from(receivings)
      .where(eq(receivings.id, receiving_id));

    if (!receiving) {
      return notFoundError('Data Surat Jalan tidak ditemukan');
    }

    if (receiving.status !== 'WAITING') {
      return createErrorResponse(
        'INVALID_STATUS',
        `Hanya Surat Jalan dengan status WAITING yang dapat dimulai. Status saat ini: ${receiving.status}`,
        400
      );
    }

    const targetLineId = line_id || receiving.lineId;
    if (!targetLineId) {
      return validationError('Jalur (Line) penghitungan wajib ditentukan');
    }

    // Check if line already has an active session
    const [existingActiveSession] = await db
      .select()
      .from(receivingSessions)
      .where(
        and(
          eq(receivingSessions.lineId, targetLineId),
          eq(receivingSessions.status, 'COUNTING')
        )
      );

    if (existingActiveSession) {
      return createErrorResponse(
        'SESSION_ALREADY_ACTIVE',
        'Jalur (Line) ini sudah memiliki sesi counting yang sedang aktif',
        409
      );
    }

    // Execute in transaction
    const newSession = await db.transaction(async (tx) => {
      const [session] = await tx
        .insert(receivingSessions)
        .values({
          receivingId: receiving.id,
          lineId: targetLineId,
          status: 'COUNTING',
          startedBy: user!.id,
          startedAt: new Date(),
        })
        .returning();

      await tx
        .update(receivings)
        .set({
          status: 'COUNTING',
          lineId: targetLineId,
          updatedAt: new Date(),
        })
        .where(eq(receivings.id, receiving.id));

      await recordAuditLog(
        {
          actorId: user!.id,
          actorRole: user!.roles[0],
          action: 'SESSION_START',
          entityType: 'receiving_sessions',
          entityId: session.id,
          afterData: session,
        },
        tx
      );

      return session;
    });

    wsBroadcaster.broadcast('session.started', {
      session_id: newSession.id,
      receiving_id: receiving.id,
      line_id: targetLineId,
    });

    return NextResponse.json(
      {
        session: {
          id: newSession.id,
          receiving_id: newSession.receivingId,
          line_id: newSession.lineId,
          status: newSession.status,
          started_at: newSession.startedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/sessions/start error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Terjadi kesalahan server', 500);
  }
}
