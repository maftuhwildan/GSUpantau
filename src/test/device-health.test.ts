import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '../db';
import { runSeed } from '../db/seed';
import { appSettings, devices, lines, users } from '../db/schema';
import { SESSION_COOKIE_NAME, signSessionToken } from '../lib/auth';
import {
  deriveEffectiveDeviceStatus,
  getDeviceHealthSettings,
} from '../lib/device-health';
import { wsBroadcaster, type WebSocketMessage } from '../lib/ws';
import {
  scanAndBroadcastDeviceHealthChanges,
  type DeviceHealthMonitorState,
} from '../server/device-health-monitor';
import { GET as configHandler } from '../app/api/device/config/route';
import { POST as heartbeatHandler } from '../app/api/device/heartbeat/route';
import { POST as eventsHandler } from '../app/api/device/events/route';
import { GET as operatorDashboardHandler } from '../app/api/dashboard/operator/route';
import { GET as adminDashboardHandler } from '../app/api/dashboard/admin/route';
import { GET as linesHandler } from '../app/api/lines/route';
import { eq } from 'drizzle-orm';

describe('Batch 15: Device Health and Offline Detection', () => {
  let line1: typeof lines.$inferSelect;
  let device1: typeof devices.$inferSelect;
  let operatorCookie: string;
  let adminCookie: string;

  beforeEach(async () => {
    wsBroadcaster.clearClientsForTest();
    await runSeed();

    [line1] = await db.select().from(lines).where(eq(lines.lineCode, 'LINE-01'));
    [device1] = await db.select().from(devices).where(eq(devices.deviceCode, 'ESP32-LINE-01'));

    const [operator] = await db.select().from(users).where(eq(users.email, 'operator@local.test'));
    const [admin] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));

    const operatorToken = await signSessionToken({
      userId: operator.id,
      email: operator.email,
      name: operator.name,
      roles: ['OPERATOR'],
      expiresAt: Date.now() + 3600 * 1000,
    });
    const adminToken = await signSessionToken({
      userId: admin.id,
      email: admin.email,
      name: admin.name,
      roles: ['ADMIN'],
      expiresAt: Date.now() + 3600 * 1000,
    });

    operatorCookie = `${SESSION_COOKIE_NAME}=${operatorToken}`;
    adminCookie = `${SESSION_COOKIE_NAME}=${adminToken}`;
  }, 30_000);

  async function setSetting(key: string, value: number) {
    await db.update(appSettings).set({ value }).where(eq(appSettings.key, key));
  }

  function deviceConfigRequest() {
    return new NextRequest(
      `http://localhost:3000/api/device/config?device_id=${device1.deviceCode}&line_id=${line1.lineCode}`,
      {
        method: 'GET',
        headers: { authorization: 'Bearer secret-device-key-01' },
      }
    );
  }

  function heartbeatRequest() {
    return new NextRequest('http://localhost:3000/api/device/heartbeat', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-device-key-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        device_id: device1.deviceCode,
        line_id: line1.lineCode,
        firmware_version: 'v15.0.0-test',
        wifi_rssi: -49,
        diagnostic_payload: { free_heap: 123456, batch: 15 },
      }),
    });
  }

  it('derives UNREGISTERED, ONLINE, DEGRADED, OFFLINE, and preserves MAINTENANCE', () => {
    const now = new Date('2026-08-10T10:00:00.000Z');
    const settings = { degradedThresholdSeconds: 15, offlineThresholdSeconds: 30 };

    expect(deriveEffectiveDeviceStatus({ status: 'ONLINE', lastHeartbeatAt: null }, settings, now)).toBe('UNREGISTERED');
    expect(
      deriveEffectiveDeviceStatus(
        { status: 'OFFLINE', lastHeartbeatAt: new Date(now.getTime() - 5_000) },
        settings,
        now
      )
    ).toBe('ONLINE');
    expect(
      deriveEffectiveDeviceStatus(
        { status: 'ONLINE', lastHeartbeatAt: new Date(now.getTime() - 15_000) },
        settings,
        now
      )
    ).toBe('DEGRADED');
    expect(
      deriveEffectiveDeviceStatus(
        { status: 'ONLINE', lastHeartbeatAt: new Date(now.getTime() - 30_000) },
        settings,
        now
      )
    ).toBe('OFFLINE');
    expect(
      deriveEffectiveDeviceStatus(
        { status: 'MAINTENANCE', lastHeartbeatAt: new Date(now.getTime() - 60_000) },
        settings,
        now
      )
    ).toBe('MAINTENANCE');
  });

  it('reads health thresholds and device config values from app_settings', async () => {
    await setSetting('heartbeat_degraded_threshold_seconds', 4);
    await setSetting('heartbeat_offline_threshold_seconds', 9);
    await setSetting('heartbeat_interval_seconds', 3);
    await setSetting('batch_upload_max_events', 42);

    await expect(getDeviceHealthSettings()).resolves.toMatchObject({
      degradedThresholdSeconds: 4,
      offlineThresholdSeconds: 9,
      heartbeatIntervalSeconds: 3,
      batchUploadMaxEvents: 42,
    });

    const res = await configHandler(deviceConfigRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.heartbeat_interval_seconds).toBe(3);
    expect(json.batch_upload_max_events).toBe(42);
  });

  it('returns UNREGISTERED before the first heartbeat when device data is read', async () => {
    await db
      .update(devices)
      .set({ status: 'ONLINE', lastHeartbeatAt: null })
      .where(eq(devices.id, device1.id));

    const res = await operatorDashboardHandler(
      new NextRequest('http://localhost:3000/api/dashboard/operator', {
        headers: { cookie: operatorCookie },
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.device.status).toBe('UNREGISTERED');
    expect(json.device.lastHeartbeatAt).toBeNull();
  });

  it('preserves MAINTENANCE override and heartbeat diagnostics during heartbeat and event uploads', async () => {
    await db.update(devices).set({ status: 'MAINTENANCE' }).where(eq(devices.id, device1.id));

    const heartbeatRes = await heartbeatHandler(heartbeatRequest());
    expect(heartbeatRes.status).toBe(200);
    expect((await heartbeatRes.json()).device_status).toBe('MAINTENANCE');

    const [afterHeartbeat] = await db.select().from(devices).where(eq(devices.id, device1.id));
    expect(afterHeartbeat.status).toBe('MAINTENANCE');
    expect(afterHeartbeat.firmwareVersion).toBe('v15.0.0-test');
    expect(afterHeartbeat.wifiRssi).toBe(-49);
    expect(afterHeartbeat.diagnosticPayload).toEqual({ free_heap: 123456, batch: 15 });

    const eventRes = await eventsHandler(
      new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-device-key-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: `B15-MAINT-${Date.now()}`,
              boot_id: `B15-MAINT-BOOT-${Date.now()}`,
              sequence: 0,
              event_type: 'DETECTION',
              device_time: new Date().toISOString(),
              event_mode: 'PRODUCTION',
            },
          ],
        }),
      })
    );
    expect(eventRes.status).toBe(200);

    const [afterEvent] = await db.select().from(devices).where(eq(devices.id, device1.id));
    expect(afterEvent.status).toBe('MAINTENANCE');
  });

  it('shows stale device status and last heartbeat separately on dashboards', async () => {
    await setSetting('heartbeat_degraded_threshold_seconds', 5);
    await setSetting('heartbeat_offline_threshold_seconds', 10);
    const staleHeartbeat = new Date(Date.now() - 11_000);
    await db
      .update(devices)
      .set({ status: 'ONLINE', lastHeartbeatAt: staleHeartbeat })
      .where(eq(devices.id, device1.id));

    const operatorRes = await operatorDashboardHandler(
      new NextRequest('http://localhost:3000/api/dashboard/operator', {
        headers: { cookie: operatorCookie },
      })
    );
    expect(operatorRes.status).toBe(200);
    const operatorJson = await operatorRes.json();
    expect(operatorJson.device.status).toBe('OFFLINE');
    expect(new Date(operatorJson.device.lastHeartbeatAt).getTime()).toBe(staleHeartbeat.getTime());
    expect(operatorJson.activeSession.lastDetection).not.toBe(operatorJson.device.lastHeartbeatAt);
    expect(JSON.stringify(operatorJson)).not.toContain('credentialHash');

    const adminRes = await adminDashboardHandler(
      new NextRequest('http://localhost:3000/api/dashboard/admin', {
        headers: { cookie: adminCookie },
      })
    );
    expect(adminRes.status).toBe(200);
    const adminJson = await adminRes.json();
    const lineOverview = adminJson.linesOverview.find((item: any) => item.line.id === line1.id);
    expect(lineOverview.device.status).toBe('OFFLINE');
    expect(new Date(lineOverview.device.lastHeartbeatAt).getTime()).toBe(staleHeartbeat.getTime());
    expect(JSON.stringify(adminJson)).not.toContain('credentialHash');
  });

  it('returns current device health from lines API without credentials and scopes Operators', async () => {
    await setSetting('heartbeat_degraded_threshold_seconds', 5);
    await setSetting('heartbeat_offline_threshold_seconds', 10);
    const staleHeartbeat = new Date(Date.now() - 11_000);
    await db
      .update(devices)
      .set({ status: 'ONLINE', lastHeartbeatAt: staleHeartbeat })
      .where(eq(devices.id, device1.id));

    const adminRes = await linesHandler(
      new NextRequest('http://localhost:3000/api/lines', {
        headers: { cookie: adminCookie },
      })
    );
    expect(adminRes.status).toBe(200);
    const adminJson = await adminRes.json();
    const adminLine = adminJson.lines.find((line: any) => line.id === line1.id);
    const adminDevice = adminLine.devices.find((device: any) => device.id === device1.id);
    expect(adminDevice.status).toBe('OFFLINE');
    expect(new Date(adminDevice.lastHeartbeatAt).getTime()).toBe(staleHeartbeat.getTime());
    expect(JSON.stringify(adminJson)).not.toContain('credentialHash');
    expect(JSON.stringify(adminJson)).not.toContain(device1.credentialHash);

    const operatorRes = await linesHandler(
      new NextRequest('http://localhost:3000/api/lines', {
        headers: { cookie: operatorCookie },
      })
    );
    expect(operatorRes.status).toBe(200);
    const operatorJson = await operatorRes.json();
    expect(operatorJson.lines).toHaveLength(1);
    expect(operatorJson.lines[0].id).toBe(line1.id);
    expect(operatorJson.lines[0].devices).toHaveLength(1);
    expect(operatorJson.lines[0].devices[0].lineId).toBe(line1.id);
  });

  it('does not refresh lastHeartbeatAt from detection-only uploads', async () => {
    const staleHeartbeat = new Date(Date.now() - 60_000);
    await db
      .update(devices)
      .set({ status: 'ONLINE', lastHeartbeatAt: staleHeartbeat })
      .where(eq(devices.id, device1.id));

    const res = await eventsHandler(
      new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-device-key-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: `B15-DETECTION-NO-HB-${Date.now()}`,
              boot_id: `B15-DETECTION-NO-HB-BOOT-${Date.now()}`,
              sequence: 0,
              event_type: 'DETECTION',
              device_time: new Date().toISOString(),
              event_mode: 'PRODUCTION',
            },
          ],
        }),
      })
    );

    expect(res.status).toBe(200);
    const [updated] = await db.select().from(devices).where(eq(devices.id, device1.id));
    expect(updated.lastHeartbeatAt?.getTime()).toBe(staleHeartbeat.getTime());
  });

  it('device health monitor broadcasts only effective status changes', async () => {
    await setSetting('heartbeat_degraded_threshold_seconds', 5);
    await setSetting('heartbeat_offline_threshold_seconds', 10);
    await db
      .update(devices)
      .set({ status: 'ONLINE', lastHeartbeatAt: new Date(Date.now() - 11_000) })
      .where(eq(devices.id, device1.id));

    const messages: WebSocketMessage[] = [];
    const unsubscribe = wsBroadcaster.subscribe((message) => messages.push(message));
    const state: DeviceHealthMonitorState = {
      initialized: true,
      statuses: new Map([[device1.id, 'ONLINE']]),
    };

    const firstBroadcasts = await scanAndBroadcastDeviceHealthChanges(state);
    const secondBroadcasts = await scanAndBroadcastDeviceHealthChanges(state);
    unsubscribe();

    expect(firstBroadcasts).toHaveLength(1);
    expect(firstBroadcasts[0]).toMatchObject({
      device_id: device1.id,
      line_id: line1.id,
      status: 'OFFLINE',
    });
    expect(secondBroadcasts).toHaveLength(0);
    expect(messages.filter((message) => message.type === 'device.status_updated')).toHaveLength(1);
  });

  it('broadcasts a fresh heartbeat timestamp without emitting a false status change', async () => {
    await db
      .update(devices)
      .set({ status: 'ONLINE', lastHeartbeatAt: new Date() })
      .where(eq(devices.id, device1.id));

    const messages: WebSocketMessage[] = [];
    const unsubscribe = wsBroadcaster.subscribe((message) => messages.push(message));
    const res = await heartbeatHandler(heartbeatRequest());
    unsubscribe();

    expect(res.status).toBe(200);
    expect(messages.filter((message) => message.type === 'device.heartbeat_received')).toHaveLength(1);
    expect(messages.filter((message) => message.type === 'device.status_updated')).toHaveLength(0);
    const heartbeatMessage = messages.find((message) => message.type === 'device.heartbeat_received');
    expect(heartbeatMessage?.payload).toMatchObject({
      device_id: device1.id,
      status: 'ONLINE',
    });
    expect(new Date(heartbeatMessage!.payload.last_heartbeat_at as string).getTime()).toBeGreaterThan(
      Date.now() - 5_000
    );
  });

  it('heartbeat brings a stale non-maintenance device back ONLINE without changing boot_id idempotency rules', async () => {
    await setSetting('heartbeat_degraded_threshold_seconds', 5);
    await setSetting('heartbeat_offline_threshold_seconds', 10);
    await db
      .update(devices)
      .set({ status: 'OFFLINE', lastHeartbeatAt: new Date(Date.now() - 11_000) })
      .where(eq(devices.id, device1.id));

    const messages: WebSocketMessage[] = [];
    const unsubscribe = wsBroadcaster.subscribe((message) => messages.push(message));
    const res = await heartbeatHandler(heartbeatRequest());
    expect(res.status).toBe(200);
    const heartbeatJson = await res.json();
    expect(heartbeatJson.device_status).toBe('ONLINE');
    expect(new Date(heartbeatJson.last_heartbeat_at).getTime()).toBeGreaterThan(Date.now() - 5_000);
    expect(heartbeatJson.firmware_version).toBe('v15.0.0-test');
    expect(heartbeatJson.wifi_rssi).toBe(-49);
    expect(messages.some((message) => message.type === 'device.heartbeat_received')).toBe(true);
    expect(messages.some((message) => message.type === 'device.status_updated')).toBe(true);
    unsubscribe();

    const [updated] = await db.select().from(devices).where(eq(devices.id, device1.id));
    expect(updated.status).toBe('ONLINE');

    const firstEvent = {
      event_id: `B15-BOOT-${Date.now()}`,
      boot_id: `B15-BOOT-ID-${Date.now()}`,
      sequence: 0,
      event_type: 'DETECTION',
      device_time: new Date().toISOString(),
      event_mode: 'PRODUCTION',
    };
    const duplicateEvent = { ...firstEvent, event_id: `${firstEvent.event_id}-retry` };

    const firstRes = await eventsHandler(
      new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-device-key-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ device_id: device1.deviceCode, line_id: line1.lineCode, events: [firstEvent] }),
      })
    );
    const duplicateRes = await eventsHandler(
      new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-device-key-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ device_id: device1.deviceCode, line_id: line1.lineCode, events: [duplicateEvent] }),
      })
    );

    expect(firstRes.status).toBe(200);
    expect((await firstRes.json()).accepted).toBe(1);
    expect(duplicateRes.status).toBe(200);
    const duplicateJson = await duplicateRes.json();
    expect(duplicateJson.accepted).toBe(0);
    expect(duplicateJson.duplicates).toBe(1);
  });

  it('broadcasts batched heartbeat events after refreshing the heartbeat timestamp', async () => {
    const staleHeartbeat = new Date(Date.now() - 60_000);
    await db
      .update(devices)
      .set({ status: 'ONLINE', lastHeartbeatAt: staleHeartbeat })
      .where(eq(devices.id, device1.id));

    const messages: WebSocketMessage[] = [];
    const unsubscribe = wsBroadcaster.subscribe((message) => messages.push(message));
    const res = await eventsHandler(
      new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-device-key-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_id: device1.deviceCode,
          line_id: line1.lineCode,
          events: [
            {
              event_id: `B15-HEARTBEAT-${Date.now()}`,
              boot_id: `B15-HEARTBEAT-BOOT-${Date.now()}`,
              sequence: 0,
              event_type: 'HEARTBEAT',
              device_time: new Date().toISOString(),
              event_mode: 'PRODUCTION',
            },
          ],
        }),
      })
    );
    unsubscribe();

    expect(res.status).toBe(200);
    const [updated] = await db.select().from(devices).where(eq(devices.id, device1.id));
    expect(updated.lastHeartbeatAt!.getTime()).toBeGreaterThan(staleHeartbeat.getTime());
    const heartbeatMessage = messages.find((message) => message.type === 'device.heartbeat_received');
    expect(heartbeatMessage?.payload).toMatchObject({
      device_id: device1.id,
      device_code: device1.deviceCode,
      line_id: line1.id,
      status: 'ONLINE',
    });
  });
});
