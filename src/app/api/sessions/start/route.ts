import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { receivings, receivingSessions } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { AppError, buildErrorResponse, createErrorResponse, validationError, notFoundError } from '@/lib/errors';
import { lockCountingLine } from '@/lib/counting-lock';
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
      if (receiving.status === 'COUNTING') {
        return createErrorResponse(
          'CONFLICT',
          'Surat Jalan sudah memiliki sesi counting aktif',
          409
        );
      }
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

    if (receiving.lineId && line_id && receiving.lineId !== line_id) {
      return createErrorResponse(
        'CONFLICT',
        'Jalur (Line) request tidak sesuai dengan Surat Jalan',
        409
      );
    }

    // The line row is the serialization boundary shared by session transitions
    // and sensor-event assignment.
    const newSession = await db.transaction(async (tx) => {
      const lockedLine = await lockCountingLine(tx, targetLineId);
      if (!lockedLine) {
        throw new AppError('NOT_FOUND', 'Jalur (Line) penghitungan tidak ditemukan', 404);
      }
      if (lockedLine.status !== 'ACTIVE') {
        throw new AppError(
          'INVALID_STATUS',
          `Jalur (Line) tidak dapat digunakan karena status saat ini: ${lockedLine.status}`,
          400
        );
      }

      const [currentReceiving] = await tx
        .select()
        .from(receivings)
        .where(eq(receivings.id, receiving_id));

      if (!currentReceiving) {
        throw new AppError('NOT_FOUND', 'Data Surat Jalan tidak ditemukan', 404);
      }
      if (currentReceiving.status !== 'WAITING') {
        throw new AppError(
          'CONFLICT',
          'Surat Jalan sudah diproses oleh request lain',
          409
        );
      }
      if (currentReceiving.lineId && currentReceiving.lineId !== targetLineId) {
        throw new AppError(
          'CONFLICT',
          'Jalur (Line) request tidak sesuai dengan Surat Jalan',
          409
        );
      }

      const [existingActiveSession] = await tx
        .select()
        .from(receivingSessions)
        .where(
          and(
            eq(receivingSessions.lineId, targetLineId),
            eq(receivingSessions.status, 'COUNTING')
          )
        );

      if (existingActiveSession) {
        throw new AppError(
          'SESSION_ALREADY_ACTIVE',
          'Jalur (Line) ini sudah memiliki sesi counting yang sedang aktif',
          409
        );
      }

      const [claimedReceiving] = await tx
        .update(receivings)
        .set({
          status: 'COUNTING',
          lineId: targetLineId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(receivings.id, currentReceiving.id),
            eq(receivings.status, 'WAITING')
          )
        )
        .returning();

      if (!claimedReceiving) {
        throw new AppError(
          'CONFLICT',
          'Surat Jalan sudah diproses oleh request lain',
          409
        );
      }

      const [session] = await tx
        .insert(receivingSessions)
        .values({
          receivingId: currentReceiving.id,
          lineId: targetLineId,
          status: 'COUNTING',
          startedBy: user!.id,
          startedAt: new Date(),
        })
        .returning();

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
      receiving_id: newSession.receivingId,
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
    if (error instanceof AppError) {
      return buildErrorResponse(error);
    }
    const errorCode = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
    if (errorCode === '23505') {
      return createErrorResponse(
        'SESSION_ALREADY_ACTIVE',
        'Jalur atau Surat Jalan sudah memiliki sesi counting aktif',
        409
      );
    }
    console.error('POST /api/sessions/start error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Terjadi kesalahan server', 500);
  }
}
