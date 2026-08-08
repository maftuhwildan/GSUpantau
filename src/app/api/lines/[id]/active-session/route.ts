import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { receivingSessions, receivings, sensorEvents, devices, lines } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { createErrorResponse, forbiddenError, notFoundError } from '@/lib/errors';
import { eq, and, desc, count } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requirePermission(req, 'dashboard:view');
  if (errorResponse) return errorResponse;

  try {
    const { id: lineId } = await params;

    const isOperatorOnly = user!.roles.includes('OPERATOR') && !user!.roles.includes('ADMIN');
    if (isOperatorOnly) {
      if (!user!.assignedLineId || user!.assignedLineId !== lineId) {
        return forbiddenError('Akses ditolak. Anda tidak memiliki akses ke jalur (Line) ini.');
      }
    }

    // Check line exists
    const [line] = await db
      .select()
      .from(lines)
      .where(eq(lines.id, lineId));

    if (!line) {
      return notFoundError('Jalur (Line) tidak ditemukan');
    }

    // Find active session for line
    const [activeSession] = await db
      .select()
      .from(receivingSessions)
      .where(
        and(
          eq(receivingSessions.lineId, lineId),
          eq(receivingSessions.status, 'COUNTING')
        )
      );

    if (!activeSession) {
      return NextResponse.json({ activeSession: null });
    }

    // Fetch receiving
    const [receiving] = await db
      .select()
      .from(receivings)
      .where(eq(receivings.id, activeSession.receivingId));

    // Fetch device on this line
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.lineId, lineId));

    // Derived actual count
    const [cntResult] = await db
      .select({ total: count() })
      .from(sensorEvents)
      .where(
        and(
          eq(sensorEvents.sessionId, activeSession.id),
          eq(sensorEvents.eventType, 'DETECTION'),
          eq(sensorEvents.eventMode, 'PRODUCTION'),
          eq(sensorEvents.assignmentStatus, 'ASSIGNED')
        )
      );

    const actualCount = Number(cntResult?.total ?? 0);
    const manifestCount = receiving ? receiving.manifestCount : 0;
    const differenceCount = actualCount - manifestCount;
    const differencePercent =
      manifestCount > 0
        ? Number(((differenceCount / manifestCount) * 100).toFixed(2))
        : null;

    // Fetch last detection event
    const [lastDetection] = await db
      .select()
      .from(sensorEvents)
      .where(
        and(
          eq(sensorEvents.sessionId, activeSession.id),
          eq(sensorEvents.eventType, 'DETECTION')
        )
      )
      .orderBy(desc(sensorEvents.receivedAt))
      .limit(1);

    // Fetch recent 10 detections
    const recentDetections = await db
      .select()
      .from(sensorEvents)
      .where(
        and(
          eq(sensorEvents.sessionId, activeSession.id),
          eq(sensorEvents.eventType, 'DETECTION')
        )
      )
      .orderBy(desc(sensorEvents.receivedAt))
      .limit(10);

    return NextResponse.json({
      activeSession: {
        id: activeSession.id,
        status: activeSession.status,
        startedAt: activeSession.startedAt,
        startedBy: activeSession.startedBy,
        lineId: activeSession.lineId,
        lineName: line.name,
        lineCode: line.lineCode,
        receiving: receiving
          ? {
              id: receiving.id,
              receivingNumber: receiving.receivingNumber,
              deliveryNoteNumber: receiving.deliveryNoteNumber,
              licensePlateSnapshot: receiving.licensePlateSnapshot,
              driverNameSnapshot: receiving.driverNameSnapshot,
              supplierNameSnapshot: receiving.supplierNameSnapshot,
              manifestCount: receiving.manifestCount,
              notes: receiving.notes,
            }
          : null,
        actualCount,
        differenceCount,
        differencePercent,
        lastDetection: lastDetection
          ? {
              id: lastDetection.id,
              sequence: lastDetection.sequence,
              receivedAt: lastDetection.receivedAt,
              deviceTime: lastDetection.deviceTime,
            }
          : null,
        recentDetections: recentDetections.map((ev) => ({
          id: ev.id,
          sequence: ev.sequence,
          receivedAt: ev.receivedAt,
          status: ev.assignmentStatus,
        })),
        deviceStatus: device
          ? {
              id: device.id,
              deviceCode: device.deviceCode,
              name: device.name,
              status: device.status,
              lastHeartbeatAt: device.lastHeartbeatAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('GET /api/lines/:id/active-session error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Terjadi kesalahan server', 500);
  }
}
