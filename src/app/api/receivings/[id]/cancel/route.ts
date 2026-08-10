import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { receivings } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { validationError, notFoundError, internalError, createErrorResponse, AppError, buildErrorResponse } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { wsBroadcaster } from '@/lib/ws';
import { eq } from 'drizzle-orm';

const cancelSchema = z.object({
  reason: z.string().min(1, 'Alasan pembatalan wajib diisi.'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requirePermission(req, 'receiving:cancel');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const body = await req.json();
    const parseResult = cancelSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError('Alasan pembatalan wajib diisi.');
    }

    const { reason } = parseResult.data;

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(receivings)
        .where(eq(receivings.id, id))
        .for('update');

      if (!existing) {
        throw new AppError('NOT_FOUND', 'Surat Jalan (Receiving) tidak ditemukan.', 404);
      }

      if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED' || existing.status === 'COUNTING') {
        throw new AppError(
          'INVALID_STATUS',
          `Surat Jalan dengan status ${existing.status} tidak dapat dibatalkan melalui tindakan ini.`,
          400
        );
      }

      const [cancelled] = await tx
        .update(receivings)
        .set({
          status: 'CANCELLED',
          notes: existing.notes ? `${existing.notes} | Dibatalkan: ${reason}` : `Dibatalkan: ${reason}`,
          updatedAt: new Date(),
        })
        .where(eq(receivings.id, id))
        .returning();

      const auditLog = await createAuditLog(
        {
          actorId: user!.id,
          actorRole: user!.roles[0],
          action: 'RECEIVING_CANCEL',
          entityType: 'receiving',
          entityId: id,
          beforeData: existing,
          afterData: cancelled,
          reason,
          source: 'WEB',
        },
        tx
      );

      return { cancelledReceiving: cancelled, auditLog };
    });

    wsBroadcaster.broadcast('receiving.queue_updated', {
      line_id: result.cancelledReceiving.lineId,
      reason: 'RECEIVING_CANCEL',
    });
    wsBroadcaster.broadcast('audit.created', {
      audit_log_id: result.auditLog.id,
      action: result.auditLog.action,
      entity_type: result.auditLog.entityType,
      entity_id: result.auditLog.entityId,
      line_id: result.cancelledReceiving.lineId,
    });

    return NextResponse.json({ receiving: result.cancelledReceiving });
  } catch (error) {
    if (error instanceof AppError) {
      return buildErrorResponse(error);
    }
    console.error('POST /api/receivings/:id/cancel error:', error);
    return internalError();
  }
}
