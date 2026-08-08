import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { receivings, receivingSessions, sensorEvents } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError } from '@/lib/errors';
import { getDateRangeFromStrings } from '@/lib/time';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'reports:view');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const lineId = searchParams.get('line_id');

    const receivingConditions = [eq(receivings.status, 'COMPLETED')];
    if (dateFrom) receivingConditions.push(gte(receivings.receivingDate, dateFrom));
    if (dateTo) receivingConditions.push(lte(receivings.receivingDate, dateTo));
    if (lineId) receivingConditions.push(eq(receivings.lineId, lineId));

    const completedReceivings = await db.query.receivings.findMany({
      where: and(...receivingConditions),
      with: { line: true, truck: true, supplier: true },
      orderBy: [desc(receivings.receivingDate), desc(receivings.createdAt)],
    });

    let totalManifest = 0;
    let totalActual = 0;

    const formattedList = await Promise.all(
      completedReceivings.map(async (rec) => {
        totalManifest += rec.manifestCount;
        let actualCount = 0;

        // Derive actual ONLY from COMPLETED session for COMPLETED receiving
        const session = await db.query.receivingSessions.findFirst({
          where: and(
            eq(receivingSessions.receivingId, rec.id),
            eq(receivingSessions.status, 'COMPLETED')
          ),
        });

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
          totalActual += actualCount;
        }

        const differenceCount = actualCount - rec.manifestCount;
        const differencePercent =
          rec.manifestCount > 0
            ? Number(((differenceCount / rec.manifestCount) * 100).toFixed(2))
            : 0;

        return {
          ...rec,
          actualCount,
          differenceCount,
          differencePercent,
        };
      })
    );

    const totalDifference = totalActual - totalManifest;
    const totalDifferencePercent =
      totalManifest > 0 ? Number(((totalDifference / totalManifest) * 100).toFixed(2)) : 0;

    // Assigned vs Unassigned Detections using authoritative receivedAt server timestamp & SITE_TIMEZONE
    const detectionsConditions = [
      eq(sensorEvents.eventType, 'DETECTION'),
      eq(sensorEvents.eventMode, 'PRODUCTION'),
    ];

    const { start, end } = getDateRangeFromStrings(dateFrom, dateTo);
    if (start) detectionsConditions.push(gte(sensorEvents.receivedAt, start));
    if (end) detectionsConditions.push(lte(sensorEvents.receivedAt, end));
    if (lineId) detectionsConditions.push(eq(sensorEvents.lineId, lineId));

    const detectionsStats = await db
      .select({
        status: sensorEvents.assignmentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(sensorEvents)
      .where(and(...detectionsConditions))
      .groupBy(sensorEvents.assignmentStatus);

    let assignedDetections = 0;
    let unassignedDetections = 0;
    detectionsStats.forEach((stat) => {
      if (stat.status === 'ASSIGNED') assignedDetections += stat.count;
      if (stat.status === 'UNASSIGNED') unassignedDetections += stat.count;
    });

    return NextResponse.json({
      summary: {
        totalManifest,
        totalActual,
        totalDifference,
        totalDifferencePercent,
        assignedDetections,
        unassignedDetections,
      },
      list: formattedList,
    });
  } catch (error) {
    console.error('Reports API error:', error);
    return internalError();
  }
}
