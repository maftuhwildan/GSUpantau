import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { lines, receivingSessions } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import {
  AppError,
  buildErrorResponse,
  internalError,
  validationError,
  notFoundError,
} from '@/lib/errors';
import { createAuditLog } from '@/lib/audit';
import { lockCountingLine } from '@/lib/counting-lock';
import { wsBroadcaster } from '@/lib/ws';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateLineSchema = z.object({
  name: z.string().min(1, 'Nama jalur wajib diisi.').max(100).trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
  reason: z.string().max(255).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requirePermission(req, 'lines_devices:manage');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const line = await db.query.lines.findFirst({ where: eq(lines.id, id) });
    if (!line) return notFoundError('Jalur tidak ditemukan.');
    return NextResponse.json({ line });
  } catch (error) {
    console.error('GET /api/lines/[id] error:', error);
    return internalError();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, errorResponse } = await requirePermission(req, 'lines_devices:manage');
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateLineSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(
        'Input tidak valid.',
        parsed.error.flatten().fieldErrors as Record<string, unknown>
      );
    }

    const { name, status, reason } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const lockedLine = await lockCountingLine(tx, id);
      if (!lockedLine) {
        throw new AppError('NOT_FOUND', 'Jalur tidak ditemukan.', 404);
      }

      if (status && status !== 'ACTIVE' && lockedLine.status === 'ACTIVE') {
        const [activeSession] = await tx
          .select()
          .from(receivingSessions)
          .where(
            and(
              eq(receivingSessions.lineId, id),
              eq(receivingSessions.status, 'COUNTING')
            )
          )
          .limit(1);

        if (activeSession) {
          throw new AppError(
            'CONFLICT',
            'Jalur tidak dapat dinonaktifkan atau dialihkan ke maintenance saat sesi counting sedang aktif.',
            409
          );
        }
      }

      const updateData: Partial<typeof lines.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (status !== undefined) updateData.status = status;

      const [updated] = await tx
        .update(lines)
        .set(updateData)
        .where(eq(lines.id, id))
        .returning();

      const auditLog = await createAuditLog(
        {
          actorId: user!.id,
          actorRole: user!.roles[0] ?? null,
          action: 'UPDATE_LINE',
          entityType: 'line',
          entityId: id,
          beforeData: lockedLine,
          afterData: updated,
          reason: reason ?? null,
          source: 'WEB',
        },
        tx
      );

      return { updated, auditLog };
    });

    wsBroadcaster.broadcast('audit.created', {
      audit_log_id: result.auditLog.id,
      action: result.auditLog.action,
      entity_type: result.auditLog.entityType,
      entity_id: result.auditLog.entityId,
      line_id: id,
    });

    return NextResponse.json({ line: result.updated });
  } catch (error) {
    if (error instanceof AppError) {
      return buildErrorResponse(error);
    }
    console.error('PATCH /api/lines/[id] error:', error);
    return internalError();
  }
}

