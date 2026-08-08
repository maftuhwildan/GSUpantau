import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { receivings, lines, devices, receivingSessions, sensorEvents, users, auditLogs } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError } from '@/lib/errors';
import { eq, and, sql, desc, gte, inArray } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'dashboard:view');
  if (errorResponse) return errorResponse;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stringToday = today.toISOString().split('T')[0];

    // 1. Receivings today
    const receivingsToday = await db.select().from(receivings).where(gte(receivings.receivingDate, stringToday));
    
    let totalManifestToday = 0;
    let actualCompletedToday = 0;
    let finalDifferenceCount = 0;
    let completedReceivingCount = 0;
    let waitingQueueCount = 0;

    const completedReceivings = receivingsToday.filter(r => r.status === 'COMPLETED');
    const waitingReceivings = await db.select({ count: sql<number>`count(*)::int` }).from(receivings).where(eq(receivings.status, 'WAITING'));
    waitingQueueCount = waitingReceivings[0]?.count || 0;

    totalManifestToday = receivingsToday.reduce((sum, r) => sum + r.manifestCount, 0);
    completedReceivingCount = completedReceivings.length;

    if (completedReceivingCount > 0) {
      const completedSessionIds = (await db.select({ id: receivingSessions.id }).from(receivingSessions).where(inArray(receivingSessions.receivingId, completedReceivings.map(r => r.id)))).map(s => s.id);
      
      if (completedSessionIds.length > 0) {
        const actualRes = await db.select({ count: sql<number>`count(*)::int` })
          .from(sensorEvents)
          .where(and(
            inArray(sensorEvents.sessionId, completedSessionIds),
            eq(sensorEvents.eventType, 'DETECTION'),
            eq(sensorEvents.eventMode, 'PRODUCTION'),
            eq(sensorEvents.assignmentStatus, 'ASSIGNED')
          ));
        actualCompletedToday = actualRes[0]?.count || 0;
      }
      
      const manifestOfCompleted = completedReceivings.reduce((sum, r) => sum + r.manifestCount, 0);
      finalDifferenceCount = actualCompletedToday - manifestOfCompleted;
    }

    const finalDifferencePercent = actualCompletedToday > 0 && (actualCompletedToday - finalDifferenceCount) > 0 
      ? Number(((finalDifferenceCount / (actualCompletedToday - finalDifferenceCount)) * 100).toFixed(2)) 
      : 0;

    // 2. Active Lines
    const allLines = await db.query.lines.findMany({ with: { devices: true } });
    const activeSessions = await db.query.receivingSessions.findMany({
      where: eq(receivingSessions.status, 'COUNTING'),
      with: { receiving: true }
    });
    
    const activeLinesCount = activeSessions.length;

    const linesOverview = await Promise.all(allLines.map(async (line) => {
      const session = activeSessions.find(s => s.lineId === line.id);
      let actualCount = 0;
      if (session) {
        const actualRes = await db.select({ count: sql<number>`count(*)::int` }).from(sensorEvents).where(and(eq(sensorEvents.sessionId, session.id), eq(sensorEvents.assignmentStatus, 'ASSIGNED')));
        actualCount = actualRes[0]?.count || 0;
      }
      return {
        line,
        device: line.devices[0] || null,
        activeSession: session ? { ...session, actualCount } : null
      };
    }));

    // 3. Unassigned Detections Today
    const unassignedRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(sensorEvents)
      .where(and(
        eq(sensorEvents.assignmentStatus, 'UNASSIGNED'),
        gte(sensorEvents.receivedAt, today)
      ));
    const unassignedDetectionsToday = unassignedRes[0]?.count || 0;

    // 4. Recent Audit Logs
    const recentAuditLogs = await db.select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      actorRole: auditLogs.actorRole,
      createdAt: auditLogs.createdAt,
      actor: {
        id: users.id,
        name: users.name,
        email: users.email,
      }
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(5);

    return NextResponse.json({
      totalManifestToday,
      actualCompletedToday,
      finalDifferenceCount,
      finalDifferencePercent,
      completedReceivingCount,
      activeLinesCount,
      waitingQueueCount,
      unassignedDetectionsToday,
      linesOverview,
      recentAuditLogs
    });
  } catch (error) {
    console.error('Admin Dashboard error:', error);
    return internalError();
  }
}
