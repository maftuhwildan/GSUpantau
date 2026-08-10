import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '../db/seed';
import { db } from '../db';
import { lines, devices, sensorEvents, receivingSessions, receivings } from '../db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeDeviceEventsRequest(events: Array<Record<string, unknown>>, overrides: Record<string, unknown> = {}) {
    return new NextRequest('http://localhost:3000/api/device/events', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${device1Secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        device_id: device1.deviceCode,
        line_id: line1.lineCode,
        events,
        ...overrides,
      }),
    });
  }

  function makeValidEvent(overrides: Record<string, unknown> = {}) {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
      event_id: `B13-${unique}`,
      boot_id: `BOOT-B13-${unique}`,
      sequence: Math.floor(Math.random() * 1000000),
      event_type: 'DETECTION',
      device_time: new Date().toISOString(),
      event_mode: 'PRODUCTION',
      ...overrides,
    };
  }

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

  describe('Device API Hardening (Batch 13)', () => {
    it.each([
      ['event_id kosong', { event_id: '' }],
      ['event_id terlalu panjang', { event_id: 'E'.repeat(101) }],
      ['boot_id kosong', { boot_id: '' }],
      ['boot_id terlalu panjang', { boot_id: 'B'.repeat(101) }],
      ['sequence negatif', { sequence: -1 }],
      ['sequence overflow', { sequence: 2147483648 }],
      ['sequence pecahan', { sequence: 1.25 }],
      ['device_time tanpa timezone', { device_time: '2026-08-07T10:15:32' }],
      ['device_time tidak valid', { device_time: 'bukan-timestamp' }],
      ['device_time tanggal kalender tidak valid', { device_time: '2026-02-30T10:15:32Z' }],
      ['device_time offset tidak valid', { device_time: '2026-08-07T10:15:32+14:30' }],
    ])('should reject invalid event contract: %s', async (_caseName, overrides) => {
      const req = makeDeviceEventsRequest([makeValidEvent(overrides)]);

      const res = await eventsHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject uploads larger than 100 events', async () => {
      const events = Array.from({ length: 101 }, (_, index) =>
        makeValidEvent({
          event_id: `B13-OVERSIZED-${Date.now()}-${index}`,
          boot_id: `BOOT-B13-OVERSIZED-${Date.now()}`,
          sequence: index,
        })
      );

      const res = await eventsHandler(makeDeviceEventsRequest(events));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject malformed JSON as a validation error', async () => {
      const req = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${device1Secret}`,
          'content-type': 'application/json',
        },
        body: '{invalid-json',
      });
      const res = await eventsHandler(req);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept a new boot that restarts sequence at zero', async () => {
      const event = makeValidEvent({
        event_id: `B13-ZERO-${Date.now()}`,
        boot_id: `BOOT-B13-ZERO-${Date.now()}`,
        sequence: 0,
      });

      const res = await eventsHandler(makeDeviceEventsRequest([event]));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.accepted).toBe(1);
      expect(json.events[0].sequence).toBe(0);
    });

    it('should accept the maximum signed 32-bit sequence', async () => {
      const event = makeValidEvent({
        event_id: `B13-MAX-SEQUENCE-${Date.now()}`,
        boot_id: `BOOT-B13-MAX-SEQUENCE-${Date.now()}`,
        sequence: 2147483647,
      });
      const res = await eventsHandler(makeDeviceEventsRequest([event]));
      expect(res.status).toBe(200);
      expect((await res.json()).accepted).toBe(1);
    });

    it('should preserve the complete original event as raw payload', async () => {
      const eventId = `B13-RAW-${Date.now()}`;
      const diagnostic = {
        sensor_channel: 2,
        calibration: { threshold: 742, sample_window_ms: 25 },
      };
      const event = makeValidEvent({ event_id: eventId, diagnostic });

      const res = await eventsHandler(makeDeviceEventsRequest([event]));
      expect(res.status).toBe(200);

      const [saved] = await db.select().from(sensorEvents).where(eq(sensorEvents.eventId, eventId));
      expect(saved.rawPayload).toEqual(event);
      expect((saved.rawPayload as Record<string, unknown>).diagnostic).toEqual(diagnostic);
    });

    it('should keep one boot sequence stream across all event types', async () => {
      const bootId = `BOOT-B13-STREAM-${Date.now()}`;
      const sequence = Math.floor(Math.random() * 1000000);
      const heartbeatId = `B13-STREAM-HB-${Date.now()}`;
      const detectionId = `B13-STREAM-DET-${Date.now()}`;

      const firstRes = await eventsHandler(
        makeDeviceEventsRequest([
          makeValidEvent({
            event_id: heartbeatId,
            boot_id: bootId,
            sequence,
            event_type: 'HEARTBEAT',
          }),
        ])
      );
      expect(firstRes.status).toBe(200);
      expect((await firstRes.json()).accepted).toBe(1);

      const secondRes = await eventsHandler(
        makeDeviceEventsRequest([
          makeValidEvent({
            event_id: detectionId,
            boot_id: bootId,
            sequence,
            event_type: 'DETECTION',
          }),
        ])
      );
      expect(secondRes.status).toBe(200);
      const secondJson = await secondRes.json();
      expect(secondJson.accepted).toBe(0);
      expect(secondJson.duplicates).toBe(1);

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
      expect(matching[0].eventType).toBe('HEARTBEAT');
    });

    it('should persist one physical event once for concurrent retries', async () => {
      const bootId = `BOOT-B13-CONCURRENT-${Date.now()}`;
      const sequence = Math.floor(Math.random() * 1000000);
      const eventId = `B13-CONCURRENT-${Date.now()}`;
      const payload = makeValidEvent({
        event_id: eventId,
        boot_id: bootId,
        sequence,
      });

      const [res1, res2] = await Promise.all([
        eventsHandler(makeDeviceEventsRequest([payload])),
        eventsHandler(makeDeviceEventsRequest([payload])),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const [json1, json2] = await Promise.all([res1.json(), res2.json()]);
      expect(json1.accepted + json2.accepted).toBe(1);
      expect(json1.duplicates + json2.duplicates).toBe(1);

      const matching = await db
        .select()
        .from(sensorEvents)
        .where(eq(sensorEvents.eventId, eventId));

      expect(matching.length).toBe(1);
    });

    it('should roll back a partially processed batch after a mid-batch storage error and allow exact retry', async () => {
      const acceptedId = `B13-MIDBATCH-OK-${Date.now()}`;
      const rejectedId = `B13-MIDBATCH-FAIL-${Date.now()}`;
      const bootId = `BOOT-B13-MIDBATCH-${Date.now()}`;
      const payload = [
        makeValidEvent({ event_id: acceptedId, boot_id: bootId, sequence: 100 }),
        makeValidEvent({ event_id: rejectedId, boot_id: bootId, sequence: 101 }),
      ];

      await db.execute(sql.raw(`
        ALTER TABLE sensor_events
        ADD CONSTRAINT sensor_events_test_mid_batch_failure
        CHECK (event_id NOT LIKE 'B13-MIDBATCH-FAIL-%')
      `));

      try {
        const failedRes = await eventsHandler(makeDeviceEventsRequest(payload));
        expect(failedRes.status).toBe(500);
        expect((await failedRes.json()).error.code).toBe('INTERNAL_ERROR');

        const savedAfterFailure = await db
          .select()
          .from(sensorEvents)
          .where(or(eq(sensorEvents.eventId, acceptedId), eq(sensorEvents.eventId, rejectedId)));
        expect(savedAfterFailure).toHaveLength(0);
      } finally {
        await db.execute(sql.raw(`
          ALTER TABLE sensor_events
          DROP CONSTRAINT sensor_events_test_mid_batch_failure
        `));
      }

      const retryRes = await eventsHandler(makeDeviceEventsRequest(payload));
      expect(retryRes.status).toBe(200);
      const retryJson = await retryRes.json();
      expect(retryJson.accepted).toBe(2);

      const savedAfterRetry = await db
        .select()
        .from(sensorEvents)
        .where(or(eq(sensorEvents.eventId, acceptedId), eq(sensorEvents.eventId, rejectedId)));
      expect(savedAfterRetry).toHaveLength(2);
    });

    it('should log a rapid boot change across separate authenticated uploads without rejecting it', async () => {
      const prefix = `B13-RAPID-BOOT-${Date.now()}`;
      const firstRes = await eventsHandler(
        makeDeviceEventsRequest([
          makeValidEvent({ event_id: `${prefix}-1`, boot_id: `${prefix}-BOOT-A`, sequence: 0 }),
        ])
      );
      expect(firstRes.status).toBe(200);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const secondRes = await eventsHandler(
        makeDeviceEventsRequest([
          makeValidEvent({ event_id: `${prefix}-2`, boot_id: `${prefix}-BOOT-B`, sequence: 0 }),
        ])
      );
      expect(secondRes.status).toBe(200);
      expect((await secondRes.json()).accepted).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'Device boot_id changed within diagnostic window',
        expect.objectContaining({
          previous_boot_id: `${prefix}-BOOT-A`,
          incoming_boot_id: `${prefix}-BOOT-B`,
        })
      );
    });

    it('should log multiple boot IDs in one upload without rejecting the events', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const bootPrefix = `BOOT-B13-MULTI-${Date.now()}`;

      const res = await eventsHandler(
        makeDeviceEventsRequest([
          makeValidEvent({
            event_id: `B13-MULTI-1-${Date.now()}`,
            boot_id: `${bootPrefix}-A`,
            sequence: 0,
          }),
          makeValidEvent({
            event_id: `B13-MULTI-2-${Date.now()}`,
            boot_id: `${bootPrefix}-B`,
            sequence: 0,
          }),
        ])
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.accepted).toBe(2);
      expect(warnSpy).toHaveBeenCalledWith(
        'Device upload contains multiple boot_id values',
        expect.objectContaining({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          boot_count: 2,
        })
      );
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
