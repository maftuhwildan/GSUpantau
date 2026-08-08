import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError } from '@/lib/errors';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'audit:view');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const entityType = searchParams.get('entity_type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
    const limit = isNaN(limitParam) ? 50 : Math.min(limitParam, 100);

    const conditions = [];
    if (action) conditions.push(eq(auditLogs.action, action));
    if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
    
    if (dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(auditLogs.createdAt, new Date(dateTo)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        actorRole: auditLogs.actorRole,
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
      .limit(limit);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Audit Logs API error:', error);
    return internalError();
  }
}
