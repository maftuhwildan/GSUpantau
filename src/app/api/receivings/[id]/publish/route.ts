import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { receivings } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { validationError, notFoundError, internalError, createErrorResponse, AppError, buildErrorResponse } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { wsBroadcaster } from '@/lib/ws';
import { eq } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requirePermission(req, 'receiving:publish');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(receivings)
        .where(eq(receivings.id, id))
        .for('update');

      if (!existing) {
        throw new AppError('NOT_FOUND', 'Surat Jalan (Receiving) tidak ditemukan.', 404);
      }

      if (existing.status !== 'DRAFT') {
        throw new AppError(
          'INVALID_STATUS',
          `Hanya Surat Jalan berstatus DRAFT yang dapat diterbitkan (Publish). Status saat ini: ${existing.status}`,
          400
        );
      }

      // Validate completeness before publish
      if (!existing.deliveryNoteNumber || !existing.licensePlateSnapshot || !existing.driverNameSnapshot || !existing.supplierNameSnapshot) {
        throw new AppError('VALIDATION_ERROR', 'Data Surat Jalan tidak lengkap untuk diterbitkan.', 400);
      }

      if (!existing.manifestCount || existing.manifestCount <= 0) {
        throw new AppError('VALIDATION_ERROR', 'Jumlah manifest harus lebih besar dari 0.', 400);
      }

      const [published] = await tx
        .update(receivings)
        .set({
          status: 'WAITING',
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(receivings.id, id))
        .returning();

      const auditLog = await createAuditLog(
        {
          actorId: user!.id,
          actorRole: user!.roles[0],
          action: 'RECEIVING_PUBLISH',
          entityType: 'receiving',
          entityId: id,
          beforeData: existing,
          afterData: published,
          source: 'WEB',
        },
        tx
      );

      return { publishedReceiving: published, auditLog };
    });

    wsBroadcaster.broadcast('receiving.queue_updated', {
      line_id: result.publishedReceiving.lineId,
      reason: 'RECEIVING_PUBLISH',
    });
    wsBroadcaster.broadcast('audit.created', {
      audit_log_id: result.auditLog.id,
      action: result.auditLog.action,
      entity_type: result.auditLog.entityType,
      entity_id: result.auditLog.entityId,
      line_id: result.publishedReceiving.lineId,
    });

    return NextResponse.json({ receiving: result.publishedReceiving });
  } catch (error) {
    if (error instanceof AppError) {
      return buildErrorResponse(error);
    }
    console.error('POST /api/receivings/:id/publish error:', error);
    return internalError();
  }
}
