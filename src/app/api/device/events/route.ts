import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { sensorEvents, receivingSessions, devices } from '@/db/schema';
import { verifyDeviceCredential } from '@/lib/device-auth';
import { validationError } from '@/lib/errors';
import { wsBroadcaster } from '@/lib/ws';
import { eq, and, or, sql } from 'drizzle-orm';

const eventItemSchema = z.object({
  event_id: z.string().min(1, { message: 'event_id wajib diisi' }),
  sequence: z.number().int({ message: 'sequence harus berupa angka bulat' }),
  event_type: z.enum(['DETECTION', 'HEARTBEAT', 'DEVICE_RESTART'], {
    errorMap: () => ({ message: 'event_type harus DETECTION, HEARTBEAT, atau DEVICE_RESTART' }),
  }),
  device_time: z.string().min(1, { message: 'device_time wajib diisi' }),
  event_mode: z.enum(['PRODUCTION', 'TEST', 'MAINTENANCE']).optional().default('PRODUCTION'),
});

const deviceEventsSchema = z.object({
  device_id: z.string().min(1, { message: 'device_id wajib diisi' }),
  line_id: z.string().min(1, { message: 'line_id wajib diisi' }),
  events: z.array(eventItemSchema).min(1, { message: 'events tidak boleh kosong' }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = deviceEventsSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Input tidak valid';
      return validationError(firstIssue);
    }

    const { device_id, line_id, events } = parsed.data;

    // Verify Device Auth & Line match
    const { device, line, errorResponse } = await verifyDeviceCredential(req, device_id, line_id);
    if (errorResponse) return errorResponse;

    // Get active session for line
    const [activeSession] = await db
      .select()
      .from(receivingSessions)
      .where(and(eq(receivingSessions.lineId, line!.id), eq(receivingSessions.status, 'COUNTING')));

    let acceptedCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;
    const eventResults: Array<{
      event_id: string;
      status: string;
      assignment_status: string;
      session_id: string | null;
    }> = [];

    let hasAssignedDetection = false;

    for (const evt of events) {
      try {
        // Check for duplicate
        const [existing] = await db
          .select()
          .from(sensorEvents)
          .where(
            eq(sensorEvents.eventId, evt.event_id)
          );

        if (existing) {
          duplicateCount++;
          eventResults.push({
            event_id: evt.event_id,
            status: 'DUPLICATE',
            assignment_status: existing.assignmentStatus,
            session_id: existing.sessionId,
          });
          continue;
        }

        // Determine assignment status
        let assignmentStatus = 'UNASSIGNED';
        let assignedSessionId: string | null = null;

        if (activeSession && evt.event_type === 'DETECTION') {
          assignmentStatus = 'ASSIGNED';
          assignedSessionId = activeSession.id;
          hasAssignedDetection = true;
        }

        const deviceTimeDate = new Date(evt.device_time);
        const validDeviceTime = isNaN(deviceTimeDate.getTime()) ? new Date() : deviceTimeDate;

        // Insert sensor event
        await db.insert(sensorEvents).values({
          eventId: evt.event_id,
          deviceId: device!.id,
          lineId: line!.id,
          sequence: evt.sequence,
          eventType: evt.event_type,
          deviceTime: validDeviceTime,
          receivedAt: new Date(),
          sessionId: assignedSessionId,
          assignmentStatus,
          eventMode: evt.event_mode,
          rawPayload: evt as unknown as Record<string, unknown>,
        });

        acceptedCount++;
        eventResults.push({
          event_id: evt.event_id,
          status: 'ACCEPTED',
          assignment_status: assignmentStatus,
          session_id: assignedSessionId,
        });

        // Broadcast sensor event received
        wsBroadcaster.broadcast('sensor.event_received', {
          event_id: evt.event_id,
          line_id: line!.id,
          device_id: device!.id,
          event_type: evt.event_type,
          assignment_status: assignmentStatus,
        });
      } catch (evtErr) {
        console.error(`Error inserting event ${evt.event_id}:`, evtErr);
        rejectedCount++;
        eventResults.push({
          event_id: evt.event_id,
          status: 'REJECTED',
          assignment_status: 'UNASSIGNED',
          session_id: null,
        });
      }
    }

    // Update device status & last heartbeat
    await db
      .update(devices)
      .set({
        lastHeartbeatAt: new Date(),
        status: 'ONLINE',
        updatedAt: new Date(),
      })
      .where(eq(devices.id, device!.id));

    // If any detection was assigned to active session, broadcast updated counter
    if (hasAssignedDetection && activeSession) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sensorEvents)
        .where(
          and(
            eq(sensorEvents.sessionId, activeSession.id),
            eq(sensorEvents.eventType, 'DETECTION'),
            eq(sensorEvents.eventMode, 'PRODUCTION'),
            eq(sensorEvents.assignmentStatus, 'ASSIGNED')
          )
        );

      const actualCount = countResult?.count || 0;

      wsBroadcaster.broadcast('session.counter_updated', {
        session_id: activeSession.id,
        line_id: line!.id,
        actual_count: actualCount,
      });
    }

    return NextResponse.json({
      accepted: acceptedCount,
      duplicates: duplicateCount,
      rejected: rejectedCount,
      events: eventResults,
    });
  } catch (error) {
    console.error('POST /api/device/events error:', error);
    return validationError('Terjadi kesalahan saat memproses event perangkat');
  }
}
