import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { sensorEvents, receivingSessions, devices } from '@/db/schema';
import { verifyDeviceCredential } from '@/lib/device-auth';
import { validationError } from '@/lib/errors';
import { lockCountingLine } from '@/lib/counting-lock';
import { wsBroadcaster } from '@/lib/ws';
import { eq, and, or, sql } from 'drizzle-orm';

const eventItemSchema = z.object({
  event_id: z.string().min(1, { message: 'event_id wajib diisi' }),
  boot_id: z.string().min(1, { message: 'boot_id wajib diisi' }).max(100, { message: 'boot_id maksimal 100 karakter' }),
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

    const ingestionResult = await db.transaction(async (tx) => {
      const lockedLine = await lockCountingLine(tx, line!.id);
      if (!lockedLine) {
        throw new Error('Jalur perangkat tidak ditemukan saat memproses event');
      }

      // Read the active session only after the same line lock used by
      // start/finish/cancel has been acquired.
      const [activeSession] = await tx
        .select()
        .from(receivingSessions)
        .where(
          and(
            eq(receivingSessions.lineId, lockedLine.id),
            eq(receivingSessions.status, 'COUNTING')
          )
        );

      let acceptedCount = 0;
      let duplicateCount = 0;
      let hasAssignedDetection = false;
      const eventResults: Array<{
        event_id: string;
        boot_id: string;
        sequence: number;
        status: string;
        assignment_status: string;
        session_id: string | null;
      }> = [];
      const sensorBroadcasts: Array<Record<string, unknown>> = [];

      for (const evt of events) {
        // A retry is duplicate when either event_id or the sequence inside the
        // same device boot has already been accepted. A new boot may safely
        // restart sequence numbering from zero.
        const [existing] = await tx
          .select()
          .from(sensorEvents)
          .where(
            or(
              eq(sensorEvents.eventId, evt.event_id),
              and(
                eq(sensorEvents.deviceId, device!.id),
                eq(sensorEvents.bootId, evt.boot_id),
                eq(sensorEvents.sequence, evt.sequence)
              )
            )
          );

        if (existing) {
          duplicateCount++;
          eventResults.push({
            event_id: evt.event_id,
            boot_id: evt.boot_id,
            sequence: evt.sequence,
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
        }

        const deviceTimeDate = new Date(evt.device_time);
        const validDeviceTime = isNaN(deviceTimeDate.getTime()) ? new Date() : deviceTimeDate;

        // Insert sensor event
        const [insertedEvent] = await tx
          .insert(sensorEvents)
          .values({
            eventId: evt.event_id,
            bootId: evt.boot_id,
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
          })
          .onConflictDoNothing()
          .returning();

        // Covers concurrent retries that pass the pre-insert lookup together.
        if (!insertedEvent) {
          const [duplicate] = await tx
            .select()
            .from(sensorEvents)
            .where(
              or(
                eq(sensorEvents.eventId, evt.event_id),
                and(
                  eq(sensorEvents.deviceId, device!.id),
                  eq(sensorEvents.bootId, evt.boot_id),
                  eq(sensorEvents.sequence, evt.sequence)
                )
              )
            );

          duplicateCount++;
          eventResults.push({
            event_id: evt.event_id,
            boot_id: evt.boot_id,
            sequence: evt.sequence,
            status: 'DUPLICATE',
            assignment_status: duplicate?.assignmentStatus || 'UNASSIGNED',
            session_id: duplicate?.sessionId || null,
          });
          continue;
        }

        acceptedCount++;
        if (assignedSessionId) {
          hasAssignedDetection = true;
        }
        eventResults.push({
          event_id: evt.event_id,
          boot_id: evt.boot_id,
          sequence: evt.sequence,
          status: 'ACCEPTED',
          assignment_status: assignmentStatus,
          session_id: assignedSessionId,
        });

        // Broadcasts are queued until the transaction commits.
        sensorBroadcasts.push({
          event_id: evt.event_id,
          boot_id: evt.boot_id,
          sequence: evt.sequence,
          line_id: line!.id,
          device_id: device!.id,
          event_type: evt.event_type,
          assignment_status: assignmentStatus,
        });
      }

      await tx
        .update(devices)
        .set({
          lastHeartbeatAt: new Date(),
          status: 'ONLINE',
          updatedAt: new Date(),
        })
        .where(eq(devices.id, device!.id));

      let counterBroadcast: Record<string, unknown> | null = null;
      if (hasAssignedDetection && activeSession) {
        const [countResult] = await tx
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

        counterBroadcast = {
          session_id: activeSession.id,
          line_id: lockedLine.id,
          actual_count: countResult?.count || 0,
        };
      }

      return {
        acceptedCount,
        duplicateCount,
        eventResults,
        sensorBroadcasts,
        counterBroadcast,
      };
    });

    for (const payload of ingestionResult.sensorBroadcasts) {
      wsBroadcaster.broadcast('sensor.event_received', payload);
    }
    if (ingestionResult.counterBroadcast) {
      wsBroadcaster.broadcast('session.counter_updated', ingestionResult.counterBroadcast);
    }

    return NextResponse.json({
      accepted: ingestionResult.acceptedCount,
      duplicates: ingestionResult.duplicateCount,
      rejected: 0,
      events: ingestionResult.eventResults,
    });
  } catch (error) {
    console.error('POST /api/device/events error:', error);
    return validationError('Terjadi kesalahan saat memproses event perangkat');
  }
}
