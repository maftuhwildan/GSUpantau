import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { receivings, lines, devices, receivingSessions, sensorEvents, users, auditLogs } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { internalError, validationError } from '@/lib/errors';
import { getDeviceHealthSettings, selectPublicLineDeviceHealth } from '@/lib/device-health';
import {
  getStartOfTodayInSiteTimezone,
  getStartOfTomorrowInSiteTimezone,
  getTodayStringInSiteTimezone,
  addCalendarDays,
  parseDateOnly,
} from '@/lib/time';
import { eq, and, sql, desc, gte, lte, lt, inArray, or, isNull } from 'drizzle-orm';
import { z } from 'zod';

const querySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal date_from harus YYYY-MM-DD').optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal date_to harus YYYY-MM-DD').optional(),
});

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireRole(req, 'ADMIN');
  if (errorResponse) return errorResponse;

  try {
    const searchParams = req.nextUrl.searchParams;
    const dateFromParam = searchParams.get('date_from') || undefined;
    const dateToParam = searchParams.get('date_to') || undefined;

    const parsedQuery = querySchema.safeParse({
      date_from: dateFromParam,
      date_to: dateToParam,
    });

    if (!parsedQuery.success) {
      return validationError('Format tanggal tidak valid.', parsedQuery.error.flatten());
    }

    if ((dateFromParam && !dateToParam) || (!dateFromParam && dateToParam)) {
      return validationError('date_from dan date_to keduanya wajib diisi jika salah satu diberikan.');
    }

    const stringToday = getTodayStringInSiteTimezone();
    const startOfToday = getStartOfTodayInSiteTimezone();
    const startOfTomorrow = getStartOfTomorrowInSiteTimezone();

    let dateFrom = dateFromParam;
    let dateTo = dateToParam;

    if (!dateFrom || !dateTo) {
      dateTo = stringToday;
      dateFrom = addCalendarDays(stringToday, -6);
    }

    if (dateFrom > dateTo) {
      return validationError('date_from tidak boleh setelah date_to.');
    }

    const dFrom = parseDateOnly(dateFrom);
    const dTo = parseDateOnly(dateTo);
    const utcFrom = Date.UTC(dFrom.year, dFrom.month - 1, dFrom.day);
    const utcTo = Date.UTC(dTo.year, dTo.month - 1, dTo.day);
    const diffDays = Math.round((utcTo - utcFrom) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 31) {
      return validationError('Rentang tanggal maksimum 31 hari.');
    }

    // 1. Receivings today for Hero KPI
    const receivingsToday = await db.select().from(receivings).where(eq(receivings.receivingDate, stringToday));
    
    // Exclude CANCELLED receivings from today's manifest total
    const nonCancelledReceivingsToday = receivingsToday.filter((r) => r.status !== 'CANCELLED');
    const totalManifestToday = nonCancelledReceivingsToday.reduce((sum, r) => sum + r.manifestCount, 0);

    const completedReceivingsToday = receivingsToday.filter((r) => r.status === 'COMPLETED');
    const completedReceivingCount = completedReceivingsToday.length;

    let actualCompletedToday = 0;
    let finalDifferenceCount = 0;

    if (completedReceivingCount > 0) {
      // Derive actual ONLY from COMPLETED sessions belonging to COMPLETED receivings
      const completedSessionIds = (
        await db
          .select({ id: receivingSessions.id })
          .from(receivingSessions)
          .where(
            and(
              inArray(receivingSessions.receivingId, completedReceivingsToday.map((r) => r.id)),
              eq(receivingSessions.status, 'COMPLETED')
            )
          )
      ).map((s) => s.id);
      
      if (completedSessionIds.length > 0) {
        const actualRes = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(sensorEvents)
          .where(
            and(
              inArray(sensorEvents.sessionId, completedSessionIds),
              eq(sensorEvents.eventType, 'DETECTION'),
              eq(sensorEvents.eventMode, 'PRODUCTION'),
              eq(sensorEvents.assignmentStatus, 'ASSIGNED')
            )
          );
        actualCompletedToday = actualRes[0]?.count || 0;
      }
      
      const manifestOfCompleted = completedReceivingsToday.reduce((sum, r) => sum + r.manifestCount, 0);
      finalDifferenceCount = actualCompletedToday - manifestOfCompleted;
    }

    const manifestOfCompletedToday = completedReceivingsToday.reduce((sum, r) => sum + r.manifestCount, 0);
    const finalDifferencePercent =
      completedReceivingCount > 0 && manifestOfCompletedToday > 0
        ? Number(((finalDifferenceCount / manifestOfCompletedToday) * 100).toFixed(2))
        : 0;

    // Waiting queue count total
    const waitingReceivingsRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(receivings)
      .where(eq(receivings.status, 'WAITING'));
    const waitingQueueCount = waitingReceivingsRes[0]?.count || 0;

    // Review required count
    const reviewRequiredRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(receivings)
      .where(eq(receivings.reconciliationStatus, 'REVIEW_REQUIRED'));
    const reviewRequiredCount = reviewRequiredRes[0]?.count || 0;

    // 2. Active Lines and Overview
    const allLines = await db.query.lines.findMany({ with: { devices: true } });
    const settings = await getDeviceHealthSettings();
    const activeSessions = await db.query.receivingSessions.findMany({
      where: eq(receivingSessions.status, 'COUNTING'),
      with: { receiving: true },
    });
    
    const activeLinesCount = activeSessions.length;

    const linesOverview = await Promise.all(
      allLines.map(async (line) => {
        const session = activeSessions.find((s) => s.lineId === line.id);
        let actualCount = 0;
        if (session) {
          const actualRes = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(sensorEvents)
            .where(
              and(
                eq(sensorEvents.sessionId, session.id),
                eq(sensorEvents.eventType, 'DETECTION'),
                eq(sensorEvents.eventMode, 'PRODUCTION'),
                eq(sensorEvents.assignmentStatus, 'ASSIGNED')
              )
            );
          actualCount = actualRes[0]?.count || 0;
        }

        // Line-specific waiting queue count
        const lineWaitingRes = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(receivings)
          .where(
            and(
              eq(receivings.status, 'WAITING'),
              or(eq(receivings.lineId, line.id), isNull(receivings.lineId))
            )
          );
        const lineWaitingQueueCount = lineWaitingRes[0]?.count || 0;

        // Last detection timestamp for this line
        const lastEv = await db
          .select({ receivedAt: sensorEvents.receivedAt })
          .from(sensorEvents)
          .where(
            and(
              eq(sensorEvents.lineId, line.id),
              eq(sensorEvents.eventType, 'DETECTION')
            )
          )
          .orderBy(desc(sensorEvents.receivedAt))
          .limit(1);

        const lastDetectionAt = lastEv[0]?.receivedAt ? lastEv[0].receivedAt.toISOString() : null;

        const { devices: lineDevices, ...safeLine } = line;
        return {
          line: safeLine,
          device: selectPublicLineDeviceHealth(lineDevices, settings),
          activeSession: session ? { ...session, actualCount } : null,
          waitingQueueCount: lineWaitingQueueCount,
          lastDetectionAt,
        };
      })
    );

    // 3. Unassigned Detections Today
    const unassignedRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sensorEvents)
      .where(
        and(
          eq(sensorEvents.eventType, 'DETECTION'),
          eq(sensorEvents.eventMode, 'PRODUCTION'),
          eq(sensorEvents.assignmentStatus, 'UNASSIGNED'),
          gte(sensorEvents.receivedAt, startOfToday),
          lt(sensorEvents.receivedAt, startOfTomorrow)
        )
      );
    const unassignedDetectionsToday = unassignedRes[0]?.count || 0;

    // 4. Trend (Daily buckets from dateFrom to dateTo inclusive)
    const completedReceivingsInRange = await db
      .select({
        id: receivings.id,
        receivingDate: receivings.receivingDate,
        manifestCount: receivings.manifestCount,
      })
      .from(receivings)
      .where(
        and(
          gte(receivings.receivingDate, dateFrom),
          lte(receivings.receivingDate, dateTo),
          eq(receivings.status, 'COMPLETED')
        )
      );

    const completedSessionIdsAll = (
      completedReceivingsInRange.length > 0
        ? await db
            .select({
              id: receivingSessions.id,
              receivingId: receivingSessions.receivingId,
            })
            .from(receivingSessions)
            .where(
              and(
                inArray(
                  receivingSessions.receivingId,
                  completedReceivingsInRange.map((r) => r.id)
                ),
                eq(receivingSessions.status, 'COMPLETED')
              )
            )
        : []
    );

    const sessionIdToReceivingIdMap = new Map<string, string>();
    completedSessionIdsAll.forEach((s) => sessionIdToReceivingIdMap.set(s.id, s.receivingId));

    const sessionIdsList = Array.from(sessionIdToReceivingIdMap.keys());

    let detectionCountsBySession = new Map<string, number>();
    if (sessionIdsList.length > 0) {
      const counts = await db
        .select({
          sessionId: sensorEvents.sessionId,
          count: sql<number>`count(*)::int`,
        })
        .from(sensorEvents)
        .where(
          and(
            inArray(sensorEvents.sessionId, sessionIdsList),
            eq(sensorEvents.eventType, 'DETECTION'),
            eq(sensorEvents.eventMode, 'PRODUCTION'),
            eq(sensorEvents.assignmentStatus, 'ASSIGNED')
          )
        )
        .groupBy(sensorEvents.sessionId);

      counts.forEach((c) => {
        if (c.sessionId) detectionCountsBySession.set(c.sessionId, c.count);
      });
    }

    // Aggregate by date
    const dateMap = new Map<string, { manifest: number; actual: number; count: number }>();

    completedReceivingsInRange.forEach((r) => {
      const existing = dateMap.get(r.receivingDate) || { manifest: 0, actual: 0, count: 0 };
      existing.manifest += r.manifestCount;
      existing.count += 1;

      // Find sessions for this receiving
      completedSessionIdsAll
        .filter((s) => s.receivingId === r.id)
        .forEach((s) => {
          existing.actual += detectionCountsBySession.get(s.id) || 0;
        });

      dateMap.set(r.receivingDate, existing);
    });

    // Build complete list of days from dateFrom to dateTo
    const trend: Array<{
      date: string;
      manifestCount: number;
      actualCount: number;
      completedReceivingCount: number;
    }> = [];

    let curr = dateFrom;
    while (curr <= dateTo) {
      const data = dateMap.get(curr) || { manifest: 0, actual: 0, count: 0 };
      trend.push({
        date: curr,
        manifestCount: data.manifest,
        actualCount: data.actual,
        completedReceivingCount: data.count,
      });
      curr = addCalendarDays(curr, 1);
    }

    // 5. Recent Receivings (5 newest items)
    const recentReceivingsRaw = await db.query.receivings.findMany({
      orderBy: [desc(receivings.updatedAt), desc(receivings.createdAt)],
      limit: 5,
      with: {
        line: true,
      },
    });

    const recentReceivings = await Promise.all(
      recentReceivingsRaw.map(async (r) => {
        let actualCount: number | null = null;

        if (r.status === 'COMPLETED') {
          const compSessions = await db
            .select({ id: receivingSessions.id })
            .from(receivingSessions)
            .where(
              and(
                eq(receivingSessions.receivingId, r.id),
                eq(receivingSessions.status, 'COMPLETED')
              )
            );
          if (compSessions.length > 0) {
            const actualRes = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(sensorEvents)
              .where(
                and(
                  inArray(sensorEvents.sessionId, compSessions.map((s) => s.id)),
                  eq(sensorEvents.eventType, 'DETECTION'),
                  eq(sensorEvents.eventMode, 'PRODUCTION'),
                  eq(sensorEvents.assignmentStatus, 'ASSIGNED')
                )
              );
            actualCount = actualRes[0]?.count || 0;
          } else {
            actualCount = 0;
          }
        } else if (r.status === 'COUNTING') {
          const activeSess = await db
            .select({ id: receivingSessions.id })
            .from(receivingSessions)
            .where(
              and(
                eq(receivingSessions.receivingId, r.id),
                eq(receivingSessions.status, 'COUNTING')
              )
            )
            .limit(1);

          if (activeSess[0]) {
            const actualRes = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(sensorEvents)
              .where(
                and(
                  eq(sensorEvents.sessionId, activeSess[0].id),
                  eq(sensorEvents.eventType, 'DETECTION'),
                  eq(sensorEvents.eventMode, 'PRODUCTION'),
                  eq(sensorEvents.assignmentStatus, 'ASSIGNED')
                )
              );
            actualCount = actualRes[0]?.count || 0;
          } else {
            actualCount = 0;
          }
        }

        const differenceCount = actualCount !== null ? actualCount - r.manifestCount : null;
        const differencePercent =
          actualCount !== null && r.manifestCount > 0
            ? Number(((differenceCount! / r.manifestCount) * 100).toFixed(2))
            : null;

        return {
          id: r.id,
          receivingNumber: r.receivingNumber,
          deliveryNoteNumber: r.deliveryNoteNumber,
          receivingDate: r.receivingDate,
          licensePlateSnapshot: r.licensePlateSnapshot,
          supplierNameSnapshot: r.supplierNameSnapshot,
          line: r.line ? { id: r.line.id, name: r.line.name, lineCode: r.line.lineCode } : null,
          status: r.status,
          reconciliationStatus: r.reconciliationStatus,
          manifestCount: r.manifestCount,
          actualCount,
          differenceCount,
          differencePercent,
          updatedAt: r.updatedAt.toISOString(),
        };
      })
    );

    // 6. Recent Audit Logs (5 newest items)
    const recentAuditLogs = await db
      .select({
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
        },
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
      reviewRequiredCount,
      unassignedDetectionsToday,
      linesOverview,
      trend,
      recentReceivings,
      recentAuditLogs,
    });
  } catch (error) {
    console.error('Admin Dashboard error:', error);
    return internalError();
  }
}
