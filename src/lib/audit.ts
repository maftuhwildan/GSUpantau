import { db } from '@/db';
import { auditLogs } from '@/db/schema';

export interface CreateAuditLogParams {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string | null;
  source?: string;
  requestId?: string | null;
}

// eslint-disable-next-line
export async function createAuditLog(
  params: CreateAuditLogParams,
  tx?: any
) {
  const dbClient = tx || db;
  const [log] = await dbClient
    .insert(auditLogs)
    .values({
      actorId: params.actorId || null,
      actorRole: params.actorRole || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeData: params.beforeData ? JSON.parse(JSON.stringify(params.beforeData)) : null,
      afterData: params.afterData ? JSON.parse(JSON.stringify(params.afterData)) : null,
      reason: params.reason || null,
      source: params.source || 'WEB',
      requestId: params.requestId || null,
    })
    .returning();
  return log;
}

export const recordAuditLog = createAuditLog;
