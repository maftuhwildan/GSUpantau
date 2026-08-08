import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '../db/seed';
import { db } from '../db';
import { lines, devices, sensorEvents, receivingSessions, receivings } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { POST as eventsHandler } from '../app/api/device/events/route';
import { POST as heartbeatHandler } from '../app/api/device/heartbeat/route';
import { GET as configHandler } from '../app/api/device/config/route';

describe('Device API & Sensor Events Ingestion (Batch 6)', () => {
  let line1: typeof lines.$inferSelect;
  let line2: typeof lines.$inferSelect;
  let device1: typeof devices.$inferSelect;
  let device2: typeof devices.$inferSelect;

  const device1Secret = 'secret-device-key-01';
  const device2Secret = 'secret-device-key-02';
  const device1BootId = 'test-boot-device-01';
  const device2BootId = 'test-boot-device-02';

  beforeAll(async () => {
    await runSeed();

    const allLines = await db.select().from(lines);
    line1 = allLines.find((l) => l.lineCode === 'LINE-01') || allLines[0];
    line2 = allLines.find((l) => l.lineCode === 'LINE-02') || allLines[1];

    const allDevices = await db.select().from(devices);
    device1 = allDevices.find((d) => d.deviceCode === 'ESP32-LINE-01') || allDevices[0];
    device2 = allDevices.find((d) => d.deviceCode === 'ESP32-LINE-02') || allDevices[1];
  });

  describe('Device Authentication & Verification', () => {
    it('should reject requests without Authorization header', async () => {
      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: 'TEST-NOAUTH-01',
              boot_id: device1BootId,
              sequence: 999901,
              event_type: 'DETECTION',
              device_time: new Date().toISOString(),
            },
          ],
        }),
      });

      const res = await eventsHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests with invalid secret', async () => {
      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: 'TEST-BADSECRET-01',
              boot_id: device1BootId,
              sequence: 999902,
              event_type: 'DETECTION',
              device_time: new Date().toISOString(),
            },
          ],
        }),
      });

      const res = await eventsHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests for unregistered device', async () => {
      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${device1Secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_id: 'NON-EXISTENT-DEVICE',
          line_id: line1.lineCode,
          events: [
            {
              event_id: 'TEST-UNREG-01',
              boot_id: device1BootId,
              sequence: 999903,
              event_type: 'DETECTION',
              device_time: new Date().toISOString(),
            },
          ],
        }),
      });

      const res = await eventsHandler(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('DEVICE_UNREGISTERED');
    });

    it('should reject requests with line mismatch', async () => {
      // Device 1 belongs to Line 1, but we pass Line 2
      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${device1Secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line2.lineCode,
          events: [
            {
              event_id: 'TEST-MISMATCH-01',
              boot_id: device1BootId,
              sequence: 999904,
              event_type: 'DETECTION',
              device_time: new Date().toISOString(),
            },
          ],
        }),
      });

      const res = await eventsHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('DEVICE_LINE_MISMATCH');
    });
  });

  describe('Sensor Event Ingestion & Session Assignment', () => {
    it('should assign detection to UNASSIGNED when no active session on line', async () => {
      // Ensure Line 2 has no active session
      await db
        .update(receivingSessions)
        .set({ status: 'COMPLETED' })
        .where(eq(receivingSessions.lineId, line2.id));

      const eventId = `EVT-UNASSIGNED-${Date.now()}`;
      const sequence = Math.floor(Math.random() * 800000) + 100000;

      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${device2Secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_id: device2.deviceCode,
          line_id: line2.lineCode,
          events: [
            {
              event_id: eventId,
              boot_id: device2BootId,
              sequence,
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
      expect(json.duplicates).toBe(0);
      expect(json.events[0].assignment_status).toBe('UNASSIGNED');
      expect(json.events[0].session_id).toBeNull();

      // Check database record
      const [savedEvt] = await db
        .select()
        .from(sensorEvents)
        .where(eq(sensorEvents.eventId, eventId));

      expect(savedEvt).toBeDefined();
      expect(savedEvt.assignmentStatus).toBe('UNASSIGNED');
      expect(savedEvt.sessionId).toBeNull();
    });

    it('should assign detection to ASSIGNED when active session exists on line', async () => {
      // Ensure Line 1 has an active session
      let [activeSession] = await db
        .select()
        .from(receivingSessions)
        .where(and(eq(receivingSessions.lineId, line1.id), eq(receivingSessions.status, 'COUNTING')));

      if (!activeSession) {
        // Create an active session on line 1 for testing
        const [rec] = await db.select().from(receivings).limit(1);
        [activeSession] = await db
          .insert(receivingSessions)
          .values({
            receivingId: rec.id,
            lineId: line1.id,
            status: 'COUNTING',
            startedBy: rec.createdBy!,
          })
          .returning();
      }

      const eventId = `EVT-ASSIGNED-${Date.now()}`;
      const sequence = Math.floor(Math.random() * 800000) + 100000;

      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${device1Secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: eventId,
              boot_id: device1BootId,
              sequence,
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
      expect(json.events[0].session_id).toBe(activeSession.id);

      // Check DB
      const [savedEvt] = await db
        .select()
        .from(sensorEvents)
        .where(eq(sensorEvents.eventId, eventId));

      expect(savedEvt).toBeDefined();
      expect(savedEvt.assignmentStatus).toBe('ASSIGNED');
      expect(savedEvt.sessionId).toBe(activeSession.id);
    });

    it('should reject the same sequence within one boot but accept it after a new boot', async () => {
      const eventId = `EVT-DUP-${Date.now()}`;
      const sequence = Math.floor(Math.random() * 800000) + 100000;
      const bootId = `BOOT-DUP-${Date.now()}`;

      const payload = {
        device_id: device1.deviceCode,
        line_id: line1.lineCode,
        events: [
          {
            event_id: eventId,
            boot_id: bootId,
            sequence,
            event_type: 'DETECTION',
            device_time: new Date().toISOString(),
            event_mode: 'PRODUCTION',
          },
        ],
      };

      // First upload
      const req1 = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${device1Secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const res1 = await eventsHandler(req1);
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.accepted).toBe(1);
      expect(json1.duplicates).toBe(0);

      // A rebuilt retry with a different event_id and later timestamp is still
      // the same physical detection inside the same boot.
      const retryPayload = {
        ...payload,
        events: [
          {
            ...payload.events[0],
            event_id: `${eventId}-rebuilt-retry`,
            device_time: new Date(Date.now() + 1000).toISOString(),
          },
        ],
      };

      const req2 = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${device1Secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(retryPayload),
      });

      const res2 = await eventsHandler(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.accepted).toBe(0);
      expect(json2.duplicates).toBe(1);
      expect(json2.events[0].status).toBe('DUPLICATE');

      // The boot-scoped sequence exists only once.
      const matching = await db
        .select()
        .from(sensorEvents)
        .where(
          and(
            eq(sensorEvents.deviceId, device1.id),
            eq(sensorEvents.bootId, bootId),
            eq(sensorEvents.sequence, sequence)
          )
        );

      expect(matching.length).toBe(1);

      // After a device reboot, sequence may restart and must be accepted.
      const rebootPayload = {
        ...payload,
        events: [
          {
            ...payload.events[0],
            event_id: `${eventId}-new-boot`,
            boot_id: `${bootId}-restarted`,
          },
        ],
      };
      const rebootReq = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${device1Secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(rebootPayload),
      });

      const rebootRes = await eventsHandler(rebootReq);
      expect(rebootRes.status).toBe(200);
      const rebootJson = await rebootRes.json();
      expect(rebootJson.accepted).toBe(1);
      expect(rebootJson.duplicates).toBe(0);
    });

    it('should not increment actual count for HEARTBEAT or DEVICE_RESTART events', async () => {
      const eventIdHb = `EVT-HB-${Date.now()}`;
      const eventIdRestart = `EVT-RST-${Date.now()}`;

      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${device1Secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: eventIdHb,
              boot_id: device1BootId,
              sequence: 999101,
              event_type: 'HEARTBEAT',
              device_time: new Date().toISOString(),
            },
            {
              event_id: eventIdRestart,
              boot_id: `${device1BootId}-restart`,
              sequence: 999102,
              event_type: 'DEVICE_RESTART',
              device_time: new Date().toISOString(),
            },
          ],
        }),
      });

      const res = await eventsHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.accepted).toBe(2);

      // Check assigned status: HEARTBEAT and DEVICE_RESTART are stored, but not assigned to session
      const [hbEvt] = await db
        .select()
        .from(sensorEvents)
        .where(eq(sensorEvents.eventId, eventIdHb));

      expect(hbEvt.assignmentStatus).toBe('UNASSIGNED');
    });
  });

  describe('Device Heartbeat API', () => {
    it('should update device status and lastHeartbeatAt on valid heartbeat', async () => {
      const req = new NextRequest('http://localhost:3000/api/device/heartbeat', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${device1Secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          firmware_version: 'v1.3.0',
          wifi_rssi: -55,
          diagnostic_payload: { free_heap: 135000 },
        }),
      });

      const res = await heartbeatHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('OK');
      expect(json.server_time).toBeDefined();

      // Verify DB updated
      const [updatedDev] = await db
        .select()
        .from(devices)
        .where(eq(devices.id, device1.id));

      expect(updatedDev.status).toBe('ONLINE');
      expect(updatedDev.firmwareVersion).toBe('v1.3.0');
      expect(updatedDev.wifiRssi).toBe(-55);
      expect(updatedDev.lastHeartbeatAt).toBeDefined();
    });
  });

  describe('Device Config API', () => {
    it('should return config for authenticated device', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/device/config?device_id=${device1.deviceCode}&line_id=${line1.lineCode}`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${device1Secret}`,
          },
        }
      );

      const res = await configHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.device_id).toBe(device1.deviceCode);
      expect(json.line_id).toBe(line1.lineCode);
      expect(json.heartbeat_interval_seconds).toBe(10);
      expect(json.batch_upload_max_events).toBe(100);
    });
  });
});
