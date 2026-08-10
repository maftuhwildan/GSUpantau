import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { lines, devices, receivingSessions, receivings, sensorEvents } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { forbiddenError, internalError } from '@/lib/errors';
import { getDeviceHealthSettings, selectPublicLineDeviceHealth } from '@/lib/device-health';
import { getStartOfTodayInSiteTimezone, getStartOfTomorrowInSiteTimezone } from '@/lib/time';
import { eq, and, sql, desc, gte, lt, asc, or, isNull } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'dashboard:view');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    let lineId = searchParams.get('line_id');

    const isOperatorOnly = user!.roles.includes('OPERATOR') && !user!.roles.includes('ADMIN');

    if (isOperatorOnly) {
      if (!user!.assignedLineId) {
        return forbiddenError('Operator belum ditugaskan pada jalur (Line) mana pun.');
      }
      if (lineId && lineId !== user!.assignedLineId) {
        return forbiddenError('Akses ditolak. Anda tidak memiliki akses ke jalur (Line) ini.');
      }
      lineId = user!.assignedLineId;
    }

    if (!lineId) {
      const firstLine = await db.query.lines.findFirst();
      lineId = firstLine?.id || null;
    }

    if (!lineId) {
      return NextResponse.json({ error: 'No line available' }, { status: 404 });
    }

    const line = await db.query.lines.findFirst({ where: eq(lines.id, lineId) });
    const settings = await getDeviceHealthSettings();
    const deviceRecords = await db.query.devices.findMany({ where: eq(devices.lineId, lineId) });
    const device = selectPublicLineDeviceHealth(deviceRecords, settings);

    const activeSession = await db.query.receivingSessions.findFirst({
      where: and(eq(receivingSessions.lineId, lineId), eq(receivingSessions.status, 'COUNTING')),
      with: {
        receiving: {
          with: { truck: true, driver: true, supplier: true },
        },
      },
    });

    let actualCount = 0;
    let lastDetection = null;
    if (activeSession) {
      const actualRes = await db
        .select({
          count: sql<number>`count(*)::int`,
          lastTime: sql<Date>`max(${sensorEvents.receivedAt})`,
        })
        .from(sensorEvents)
        .where(
          and(
            eq(sensorEvents.sessionId, activeSession.id),
            eq(sensorEvents.eventType, 'DETECTION'),
            eq(sensorEvents.eventMode, 'PRODUCTION'),
            eq(sensorEvents.assignmentStatus, 'ASSIGNED')
          )
        );
      actualCount = actualRes[0]?.count || 0;
      lastDetection = actualRes[0]?.lastTime || null;
    }

    // Scope waiting queue to the selected line (assigned to line or unassigned to any line)
    const waitingQueue = await db
      .select({
        id: receivings.id,
        receivingNumber: receivings.receivingNumber,
        deliveryNoteNumber: receivings.deliveryNoteNumber,
        receivingDate: receivings.receivingDate,
        queuePosition: receivings.queuePosition,
        manifestCount: receivings.manifestCount,
        status: receivings.status,
        licensePlateSnapshot: receivings.licensePlateSnapshot,
        supplierNameSnapshot: receivings.supplierNameSnapshot,
        createdAt: receivings.createdAt,
      })
      .from(receivings)
      .where(
        and(
          eq(receivings.status, 'WAITING'),
          or(eq(receivings.lineId, lineId), isNull(receivings.lineId))
        )
      )
      .orderBy(asc(receivings.queuePosition), desc(receivings.createdAt))
      .limit(5);

    const startOfToday = getStartOfTodayInSiteTimezone();
    const startOfTomorrow = getStartOfTomorrowInSiteTimezone();

    // Scope detection statistics to the selected line and filter by receivedAt & SITE_TIMEZONE
    const detectionsStats = await db
      .select({
        status: sensorEvents.assignmentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(sensorEvents)
      .where(
        and(
          eq(sensorEvents.lineId, lineId),
          eq(sensorEvents.eventType, 'DETECTION'),
          eq(sensorEvents.eventMode, 'PRODUCTION'),
          gte(sensorEvents.receivedAt, startOfToday),
          lt(sensorEvents.receivedAt, startOfTomorrow)
        )
      )
      .groupBy(sensorEvents.assignmentStatus);

    let assignedDetections = 0;
    let unassignedDetections = 0;
    detectionsStats.forEach((stat) => {
      if (stat.status === 'ASSIGNED') assignedDetections += stat.count;
      if (stat.status === 'UNASSIGNED') unassignedDetections += stat.count;
    });

    return NextResponse.json({
      line,
      device,
      activeSession: activeSession ? { ...activeSession, actualCount, lastDetection } : null,
      waitingQueue,
      assignedDetections,
      unassignedDetections,
    });
  } catch (error) {
    console.error('Operator Dashboard error:', error);
    return internalError();
  }
}
