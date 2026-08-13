import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError, validationError } from '@/lib/errors';
import { getDateRangeFromStrings } from '@/lib/time';
import { canonicalizeAuditEntityType, getAuditEntityAliases } from '@/lib/audit-filter';
import { eq, and, desc, asc, gte, lt, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';

function sanitizeAuditData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeAuditData);
  }

  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('credentialhash') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      sanitized[key] = sanitizeAuditData(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
}

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'audit:view');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const entityType = searchParams.get('entity_type') || searchParams.get('entityType');
    const actorId = searchParams.get('actor_id') || searchParams.get('actorId');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
    const limit = isNaN(limitParam) ? 50 : Math.min(limitParam, 100);

    if (actorId && actorId !== 'SYSTEM' && !z.string().uuid().safeParse(actorId).success) {
      return validationError('actor_id tidak valid.');
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return validationError('date_from tidak boleh lebih besar dari date_to.');
    }

    let start: Date | null = null;
    let endExclusive: Date | null = null;
    try {
      const range = getDateRangeFromStrings(dateFrom, dateTo);
      start = range.start;
      endExclusive = range.endExclusive;
    } catch (err: any) {
      return validationError(err.message || 'Format tanggal tidak valid.');
    }

    const conditions = [];
    if (action) conditions.push(eq(auditLogs.action, action));
    if (entityType) conditions.push(inArray(auditLogs.entityType, getAuditEntityAliases(entityType)));
    if (actorId === 'SYSTEM') conditions.push(isNull(auditLogs.actorId));
    else if (actorId) conditions.push(eq(auditLogs.actorId, actorId));
    
    if (start) conditions.push(gte(auditLogs.createdAt, start));
    if (endExclusive) conditions.push(lt(auditLogs.createdAt, endExclusive));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, actionOptions, entityOptions] = await Promise.all([
      db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        actorRole: auditLogs.actorRole,
        beforeData: auditLogs.beforeData,
        afterData: auditLogs.afterData,
        reason: auditLogs.reason,
        source: auditLogs.source,
        createdAt: auditLogs.createdAt,
        actor: {
          id: users.id,
          name: users.name,
          email: users.email,
        }
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit),
      db.selectDistinct({ value: auditLogs.action })
        .from(auditLogs)
        .orderBy(asc(auditLogs.action)),
      db.selectDistinct({ value: auditLogs.entityType })
        .from(auditLogs)
        .orderBy(asc(auditLogs.entityType)),
    ]);

    const sanitizedLogs = logs.map((log) => ({
      ...log,
      beforeData: sanitizeAuditData(log.beforeData),
      afterData: sanitizeAuditData(log.afterData),
    }));

    return NextResponse.json({
      logs: sanitizedLogs,
      filters: {
        actions: actionOptions.map((option) => option.value),
        entityTypes: Array.from(new Set(
          entityOptions.map((option) => canonicalizeAuditEntityType(option.value))
        )).sort(),
      },
    });
  } catch (error) {
    console.error('Audit Logs API error:', error);
    return internalError();
  }
}
