import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { receivings } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { validationError, notFoundError, internalError, createErrorResponse } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
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

    const [existing] = await db
      .select()
      .from(receivings)
      .where(eq(receivings.id, id));

    if (!existing) {
      return notFoundError('Surat Jalan (Receiving) tidak ditemukan.');
    }

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED' || existing.status === 'COUNTING') {
      return createErrorResponse(
        'INVALID_STATUS',
        `Surat Jalan dengan status ${existing.status} tidak dapat dibatalkan melalui tindakan ini.`,
        400
      );
    }

    const [cancelledReceiving] = await db
      .update(receivings)
      .set({
        status: 'CANCELLED',
        notes: existing.notes ? `${existing.notes} | Dibatalkan: ${reason}` : `Dibatalkan: ${reason}`,
        updatedAt: new Date(),
      })
      .where(eq(receivings.id, id))
      .returning();

    await createAuditLog({
      actorId: user!.id,
      actorRole: user!.roles[0],
      action: 'RECEIVING_CANCEL',
      entityType: 'receiving',
      entityId: id,
      beforeData: existing,
      afterData: cancelledReceiving,
      reason,
      source: 'WEB',
    });

    return NextResponse.json({ receiving: cancelledReceiving });
  } catch (error) {
    console.error('POST /api/receivings/:id/cancel error:', error);
    return internalError();
  }
}
