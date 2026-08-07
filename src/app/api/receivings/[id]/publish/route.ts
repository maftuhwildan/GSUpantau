import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { receivings } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { validationError, notFoundError, internalError, createErrorResponse } from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { eq } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requirePermission(req, 'receiving:publish');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const [existing] = await db
      .select()
      .from(receivings)
      .where(eq(receivings.id, id));

    if (!existing) {
      return notFoundError('Surat Jalan (Receiving) tidak ditemukan.');
    }

    if (existing.status !== 'DRAFT') {
      return createErrorResponse(
        'INVALID_STATUS',
        `Hanya Surat Jalan berstatus DRAFT yang dapat diterbitkan (Publish). Status saat ini: ${existing.status}`,
        400
      );
    }

    // Validate completeness before publish
    if (!existing.deliveryNoteNumber || !existing.licensePlateSnapshot || !existing.driverNameSnapshot || !existing.supplierNameSnapshot) {
      return validationError('Data Surat Jalan tidak lengkap untuk diterbitkan.');
    }

    if (!existing.manifestCount || existing.manifestCount <= 0) {
      return validationError('Jumlah manifest harus lebih besar dari 0.');
    }

    const [publishedReceiving] = await db
      .update(receivings)
      .set({
        status: 'WAITING',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(receivings.id, id))
      .returning();

    await createAuditLog({
      actorId: user!.id,
      actorRole: user!.roles[0],
      action: 'RECEIVING_PUBLISH',
      entityType: 'receiving',
      entityId: id,
      beforeData: existing,
      afterData: publishedReceiving,
      source: 'WEB',
    });

    return NextResponse.json({ receiving: publishedReceiving });
  } catch (error) {
    console.error('POST /api/receivings/:id/publish error:', error);
    return internalError();
  }
}
