import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '../db/seed';
import { db } from '../db';
import { lines, devices, sensorEvents, receivingSessions, receivings, users } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { GET as optionsHandler } from '../app/api/dev/simulator/options/route';
import { POST as eventsHandler } from '../app/api/device/events/route';
import { POST as heartbeatHandler } from '../app/api/device/heartbeat/route';
import { POST as startSessionHandler } from '../app/api/sessions/start/route';
import { SESSION_COOKIE_NAME, signSessionToken } from '../lib/auth';

describe('Sensor Simulator Integration (Batch 7)', () => {
  let line1: typeof lines.$inferSelect;
  let line2: typeof lines.$inferSelect;
  let device1: typeof devices.$inferSelect;
  let device2: typeof devices.$inferSelect;
  let adminToken: string;

  const device1Secret = 'secret-device-key-01';
  const device2Secret = 'secret-device-key-02';
  const device1BootId = 'simulator-boot-device-01';
  const device2BootId = 'simulator-boot-device-02';

  beforeAll(async () => {
    await runSeed();

    const allLines = await db.select().from(lines);
    line1 = allLines.find((l) => l.lineCode === 'LINE-01') || allLines[0];
    line2 = allLines.find((l) => l.lineCode === 'LINE-02') || allLines[1];

    const allDevices = await db.select().from(devices);
    device1 = allDevices.find((d) => d.deviceCode === 'ESP32-LINE-01') || allDevices[0];
    device2 = allDevices.find((d) => d.deviceCode === 'ESP32-LINE-02') || allDevices[1];

    const admin = await db.query.users.findFirst({
      where: eq(users.email, 'admin@local.test'),
    });

    // Create session token for admin user
    adminToken = await signSessionToken({
      userId: admin!.id,
      email: 'admin@local.test',
      name: 'Admin',
      roles: ['ADMIN'],
      expiresAt: Date.now() + 86400000,
    });
  });

  describe('Simulator Options Endpoint', () => {
    it('should return available lines and devices with default dev secrets', async () => {
      const req = new NextRequest('http://localhost:3000/api/dev/simulator/options', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
      });

      const res = await optionsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.lines).toBeDefined();
      expect(json.lines.length).toBeGreaterThan(0);

      const foundLine1 = json.lines.find((l: any) => l.lineCode === 'LINE-01');
      expect(foundLine1).toBeDefined();
      expect(foundLine1.devices.length).toBeGreaterThan(0);
      expect(foundLine1.devices[0].defaultSecret).toBe(device1Secret);
    });
  });

  describe('Simulating Detections via Device API', () => {
    let activeSessionId: string;

    beforeAll(async () => {
      // Find a WAITING receiving to start a session on LINE-01
      const [waitingReceiving] = await db
        .select()
        .from(receivings)
        .where(and(eq(receivings.lineId, line1.id), eq(receivings.status, 'WAITING')));

      if (waitingReceiving) {
        const startReq = new NextRequest('http://localhost:3000/api/sessions/start', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          },
          body: JSON.stringify({
            receiving_id: waitingReceiving.id,
            line_id: line1.id,
          }),
        });

        const startRes = await startSessionHandler(startReq);
        const startJson = await startRes.json();
        if (startRes.status === 200 && startJson.session) {
          activeSessionId = startJson.session.id;
        }
      }

      if (!activeSessionId) {
        // Fallback: check existing counting session
        const [existingSession] = await db
          .select()
          .from(receivingSessions)
          .where(and(eq(receivingSessions.lineId, line1.id), eq(receivingSessions.status, 'COUNTING')));
        activeSessionId = existingSession?.id || '';
      }
    });

    it('should assign single detection to active session when line has active session (Scenario 17)', async () => {
      const eventId = `SIM-LINE01-${Date.now()}-001`;

      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${device1Secret}`,
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: eventId,
              boot_id: device1BootId,
              sequence: 80001,
              event_type: 'DETECTION',
              device_time: new Date().toISOString(),
              event_mode: 'PRODUCTION',
            },
          ],
        }),
      });

      const res = await eventsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.accepted).toBe(1);
      expect(json.events[0].assignment_status).toBe('ASSIGNED');
      expect(json.events[0].session_id).toBe(activeSessionId);
    });

    it('should mark detection as UNASSIGNED when no active session is present on target line', async () => {
      // LINE-02 has no active session
      const eventId = `SIM-LINE02-${Date.now()}-001`;

      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${device2Secret}`,
        },
        body: JSON.stringify({
          device_id: device2.deviceCode,
          line_id: line2.lineCode,
          events: [
            {
              event_id: eventId,
              boot_id: device2BootId,
              sequence: 90001,
              event_type: 'DETECTION',
              device_time: new Date().toISOString(),
              event_mode: 'PRODUCTION',
            },
          ],
        }),
      });

      const res = await eventsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.accepted).toBe(1);
      expect(json.events[0].assignment_status).toBe('UNASSIGNED');
      expect(json.events[0].session_id).toBeNull();
    });

    it('should prove idempotency when sending duplicate detection event (Scenario 18)', async () => {
      const duplicateEventId = `SIM-DUP-${Date.now()}`;
      const duplicateSeq = 88888;

      // 1. First Send
      const req1 = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${device1Secret}`,
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: duplicateEventId,
              boot_id: device1BootId,
              sequence: duplicateSeq,
              event_type: 'DETECTION',
              device_time: new Date().toISOString(),
            },
          ],
        }),
      });

      const res1 = await eventsHandler(req1);
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.accepted).toBe(1);

      // Get count after first send
      const [countAfterFirst] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sensorEvents)
        .where(eq(sensorEvents.sessionId, activeSessionId));

      // 2. Second Send (Duplicate)
      const req2 = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${device1Secret}`,
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: duplicateEventId,
              boot_id: device1BootId,
              sequence: duplicateSeq,
              event_type: 'DETECTION',
              device_time: new Date().toISOString(),
            },
          ],
        }),
      });

      const res2 = await eventsHandler(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.duplicates).toBe(1);
      expect(json2.events[0].status).toBe('DUPLICATE');

      // Get count after second send (should be identical)
      const [countAfterSecond] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sensorEvents)
        .where(eq(sensorEvents.sessionId, activeSessionId));

      expect(countAfterSecond.count).toBe(countAfterFirst.count);
    });

    it('should accept delayed events with backdated timestamp', async () => {
      const delayedEventId = `SIM-DELAYED-${Date.now()}`;
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${device1Secret}`,
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: delayedEventId,
              boot_id: device1BootId,
              sequence: 88899,
              event_type: 'DETECTION',
              device_time: tenMinutesAgo,
            },
          ],
        }),
      });

      const res = await eventsHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.accepted).toBe(1);
    });

    it('should update device last heartbeat and online status when receiving heartbeat from simulator', async () => {
      const req = new NextRequest('http://localhost:3000/api/device/heartbeat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${device1Secret}`,
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          firmware_version: 'v1.2.0-sim',
          wifi_rssi: -60,
          diagnostic_payload: { free_heap: 120000 },
        }),
      });

      const res = await heartbeatHandler(req);
      expect(res.status).toBe(200);

      const [updatedDevice] = await db.select().from(devices).where(eq(devices.id, device1.id));
      expect(updatedDevice.status).toBe('ONLINE');
      expect(updatedDevice.lastHeartbeatAt).toBeDefined();
    });

    it('should handle DEVICE_RESTART event without incrementing session actual count', async () => {
      const [countBefore] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sensorEvents)
        .where(and(eq(sensorEvents.sessionId, activeSessionId), eq(sensorEvents.eventType, 'DETECTION')));

      const restartEventId = `SIM-RESTART-${Date.now()}`;

      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${device1Secret}`,
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: restartEventId,
              boot_id: `${device1BootId}-restart`,
              sequence: 1,
              event_type: 'DEVICE_RESTART',
              device_time: new Date().toISOString(),
            },
          ],
        }),
      });

      const res = await eventsHandler(req);
      expect(res.status).toBe(200);

      const [countAfter] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sensorEvents)
        .where(and(eq(sensorEvents.sessionId, activeSessionId), eq(sensorEvents.eventType, 'DETECTION')));

      expect(countAfter.count).toBe(countBefore.count);
    });
  });
});
