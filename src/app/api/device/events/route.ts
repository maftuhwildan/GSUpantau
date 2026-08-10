import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { sensorEvents, receivingSessions, devices } from '@/db/schema';
import { verifyDeviceCredential } from '@/lib/device-auth';
import { internalError, validationError } from '@/lib/errors';
import { lockCountingLine } from '@/lib/counting-lock';
import { wsBroadcaster } from '@/lib/ws';
import { eq, and, or, sql, desc } from 'drizzle-orm';

const ISO_8601_WITH_TIMEZONE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/;
const MAX_SEQUENCE = 2147483647;
const MAX_UPLOAD_EVENTS = 100;
const BOOT_CHANGE_DIAGNOSTIC_WINDOW_MS = 5 * 60 * 1000;

function parseDeviceTime(value: string): Date | null {
  const match = ISO_8601_WITH_TIMEZONE.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number(`0.${match[7] || '0'}`) * 1000;
  const offsetHour = match[8] === 'Z' ? 0 : Number(match[10]);
  const offsetMinute = match[8] === 'Z' ? 0 : Number(match[11]);

  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  const validCalendarDate =
    calendarCheck.getUTCFullYear() === year &&
    calendarCheck.getUTCMonth() === month - 1 &&
    calendarCheck.getUTCDate() === day;
  const validClock = hour <= 23 && minute <= 59 && second <= 59;
  const validOffset =
    offsetMinute <= 59 &&
    offsetHour <= 14 &&
    (offsetHour < 14 || offsetMinute === 0);

  if (!validCalendarDate || !validClock || !validOffset) return null;

  const signedOffsetMinutes =
    match[8] === 'Z'
      ? 0
      : (match[9] === '+' ? 1 : -1) * (offsetHour * 60 + offsetMinute);
  const instant = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
    - signedOffsetMinutes * 60 * 1000;
  const parsed = new Date(instant);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const eventItemSchema = z.object({
  event_id: z
    .string()
    .min(1, { message: 'event_id wajib diisi' })
    .max(100, { message: 'event_id maksimal 100 karakter' }),
  boot_id: z.string().min(1, { message: 'boot_id wajib diisi' }).max(100, { message: 'boot_id maksimal 100 karakter' }),
  sequence: z
    .number()
    .int({ message: 'sequence harus berupa angka bulat' })
    .min(0, { message: 'sequence tidak boleh negatif' })
    .max(MAX_SEQUENCE, { message: 'sequence melebihi batas maksimum' }),
  event_type: z.enum(['DETECTION', 'HEARTBEAT', 'DEVICE_RESTART'], {
    errorMap: () => ({ message: 'event_type harus DETECTION, HEARTBEAT, atau DEVICE_RESTART' }),
  }),
  device_time: z
    .string()
    .min(1, { message: 'device_time wajib diisi' })
    .refine((value) => parseDeviceTime(value) !== null, {
      message: 'device_time harus ISO-8601 valid dengan timezone',
    }),
  event_mode: z.enum(['PRODUCTION', 'TEST', 'MAINTENANCE']).optional().default('PRODUCTION'),
}).passthrough();

const deviceEventsSchema = z.object({
  device_id: z.string().min(1, { message: 'device_id wajib diisi' }),
  line_id: z.string().min(1, { message: 'line_id wajib diisi' }),
  events: z
    .array(eventItemSchema)
    .min(1, { message: 'events tidak boleh kosong' })
    .max(MAX_UPLOAD_EVENTS, { message: 'Maksimal 100 event per upload' }),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationError('Payload JSON tidak valid');
    }

    const parsed = deviceEventsSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Input tidak valid';
      return validationError(firstIssue);
    }

    const { device_id, line_id, events } = parsed.data;
    const rawEvents = (body as { events: Array<Record<string, unknown>> }).events;
    const bootIds = new Set(events.map((evt) => evt.boot_id));

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

      let bootChangeDiagnostic: { previousBootId: string; incomingBootId: string; ageMs: number } | null = null;
      if (bootIds.size === 1) {
        const incomingBootId = events[0].boot_id;
        const [latestDeviceEvent] = await tx
          .select({ bootId: sensorEvents.bootId, receivedAt: sensorEvents.receivedAt })
          .from(sensorEvents)
          .where(eq(sensorEvents.deviceId, device!.id))
          .orderBy(desc(sensorEvents.receivedAt))
          .limit(1);

        if (latestDeviceEvent && latestDeviceEvent.bootId !== incomingBootId) {
          const ageMs = Date.now() - latestDeviceEvent.receivedAt.getTime();
          if (ageMs >= 0 && ageMs <= BOOT_CHANGE_DIAGNOSTIC_WINDOW_MS) {
            bootChangeDiagnostic = {
              previousBootId: latestDeviceEvent.bootId,
              incomingBootId,
              ageMs,
            };
          }
        }
      }

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

      for (const [eventIndex, evt] of events.entries()) {
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

        const deviceTimeDate = parseDeviceTime(evt.device_time);
        if (!deviceTimeDate) {
          throw new Error('device_time tidak valid setelah validasi');
        }

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
            deviceTime: deviceTimeDate,
            receivedAt: new Date(),
            sessionId: assignedSessionId,
            assignmentStatus,
            eventMode: evt.event_mode,
            rawPayload: rawEvents[eventIndex],
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
        bootChangeDiagnostic,
      };
    });

    if (bootIds.size > 1) {
      console.warn('Device upload contains multiple boot_id values', {
        device_id,
        line_id,
        boot_count: bootIds.size,
      });
    }
    if (ingestionResult.bootChangeDiagnostic) {
      console.warn('Device boot_id changed within diagnostic window', {
        device_id,
        line_id,
        previous_boot_id: ingestionResult.bootChangeDiagnostic.previousBootId,
        incoming_boot_id: ingestionResult.bootChangeDiagnostic.incomingBootId,
        age_ms: ingestionResult.bootChangeDiagnostic.ageMs,
        window_ms: BOOT_CHANGE_DIAGNOSTIC_WINDOW_MS,
      });
    }

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
    return internalError('Terjadi kesalahan saat menyimpan event perangkat');
  }
}
