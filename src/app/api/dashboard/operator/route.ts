import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { lines, devices, receivingSessions, receivings, trucks, drivers, suppliers, sensorEvents } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { internalError } from '@/lib/errors';
import { eq, and, sql, desc, gte, asc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requirePermission(req, 'dashboard:view');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    let lineId = searchParams.get('line_id');
    
    if (!lineId) {
      const firstLine = await db.query.lines.findFirst();
      lineId = firstLine?.id || null;
    }

    if (!lineId) {
      return NextResponse.json({ error: 'No line available' }, { status: 404 });
    }

    const line = await db.query.lines.findFirst({ where: eq(lines.id, lineId) });
    const device = await db.query.devices.findFirst({ where: eq(devices.lineId, lineId) });

    const activeSession = await db.query.receivingSessions.findFirst({
      where: and(eq(receivingSessions.lineId, lineId), eq(receivingSessions.status, 'COUNTING')),
      with: {
        receiving: {
          with: { truck: true, driver: true, supplier: true }
        }
      }
    });

    let actualCount = 0;
    let lastDetection = null;
    if (activeSession) {
      const actualRes = await db.select({ 
        count: sql<number>`count(*)::int`, 
        lastTime: sql<Date>`max(${sensorEvents.deviceTime})` 
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

    const waitingQueue = await db.select({
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
    .where(eq(receivings.status, 'WAITING'))
    .orderBy(asc(receivings.queuePosition), desc(receivings.createdAt))
    .limit(5);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const detectionsStats = await db.select({
      status: sensorEvents.assignmentStatus,
      count: sql<number>`count(*)::int`
    })
    .from(sensorEvents)
    .where(
      and(
        eq(sensorEvents.eventType, 'DETECTION'),
        eq(sensorEvents.eventMode, 'PRODUCTION'),
        gte(sensorEvents.receivedAt, today)
      )
    )
    .groupBy(sensorEvents.assignmentStatus);

    let assignedDetections = 0;
    let unassignedDetections = 0;
    detectionsStats.forEach(stat => {
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
