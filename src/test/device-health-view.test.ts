import { describe, expect, it } from 'vitest';
import { applyDeviceHealthViewUpdate } from '../lib/device-health-view';

describe('device health view synchronization', () => {
  it('replaces the matching device health snapshot and preserves simulator metadata', () => {
    const lines = [
      {
        id: 'line-1',
        devices: [
          {
            id: 'device-1',
            deviceCode: 'ESP32-LINE-01',
            status: 'OFFLINE',
            lastHeartbeatAt: '2026-08-10T06:37:41.000Z',
            firmwareVersion: 'v1.0.0',
            wifiRssi: -70,
            defaultSecret: 'simulator-secret',
          },
        ],
      },
    ];

    const updated = applyDeviceHealthViewUpdate(lines, {
      deviceCode: 'ESP32-LINE-01',
      status: 'ONLINE',
      lastHeartbeatAt: '2026-08-10T06:42:12.000Z',
      firmwareVersion: 'v1.2.0-sim',
      wifiRssi: -58,
    });

    expect(updated[0].devices[0]).toEqual({
      id: 'device-1',
      deviceCode: 'ESP32-LINE-01',
      status: 'ONLINE',
      lastHeartbeatAt: '2026-08-10T06:42:12.000Z',
      firmwareVersion: 'v1.2.0-sim',
      wifiRssi: -58,
      defaultSecret: 'simulator-secret',
    });
    expect(lines[0].devices[0].status).toBe('OFFLINE');
  });

  it('leaves unrelated device snapshots unchanged', () => {
    const lines = [
      {
        devices: [
          {
            deviceCode: 'ESP32-LINE-02',
            status: 'DEGRADED',
            lastHeartbeatAt: null,
          },
        ],
      },
    ];

    const updated = applyDeviceHealthViewUpdate(lines, {
      deviceCode: 'ESP32-LINE-01',
      status: 'ONLINE',
      lastHeartbeatAt: '2026-08-10T06:42:12.000Z',
    });

    expect(updated[0]).toBe(lines[0]);
  });
});
