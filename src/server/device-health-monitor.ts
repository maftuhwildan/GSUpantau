import { db } from '@/db';
import { devices } from '@/db/schema';
import {
  buildDeviceStatusPayload,
  deriveEffectiveDeviceStatus,
  getDeviceHealthSettings,
  type DeviceEffectiveStatus,
} from '@/lib/device-health';
import { wsBroadcaster } from '@/lib/ws';

const DEFAULT_MONITOR_INTERVAL_MS = 5_000;

export interface DeviceHealthMonitorState {
  initialized: boolean;
  statuses: Map<string, DeviceEffectiveStatus>;
}

const globalForDeviceHealth = globalThis as unknown as {
  deviceHealthMonitor?: {
    timer: NodeJS.Timeout;
    state: DeviceHealthMonitorState;
  };
};

export async function scanAndBroadcastDeviceHealthChanges(
  state: DeviceHealthMonitorState,
  now: Date = new Date()
) {
  const settings = await getDeviceHealthSettings();
  const allDevices = await db.select().from(devices);
  const nextStatuses = new Map<string, DeviceEffectiveStatus>();
  const broadcasts: Array<Record<string, unknown>> = [];

  for (const device of allDevices) {
    const effectiveStatus = deriveEffectiveDeviceStatus(device, settings, now);
    nextStatuses.set(device.id, effectiveStatus);

    const previousStatus = state.statuses.get(device.id);
    if (state.initialized && previousStatus !== undefined && previousStatus !== effectiveStatus) {
      broadcasts.push(buildDeviceStatusPayload(device, settings, now));
    }
  }

  state.initialized = true;
  state.statuses = nextStatuses;

  for (const payload of broadcasts) {
    wsBroadcaster.broadcast('device.status_updated', payload);
  }

  return broadcasts;
}

export function startDeviceHealthMonitor(intervalMs = DEFAULT_MONITOR_INTERVAL_MS) {
  if (process.env.NODE_ENV === 'test') return null;
  if (globalForDeviceHealth.deviceHealthMonitor) {
    return globalForDeviceHealth.deviceHealthMonitor;
  }

  const state: DeviceHealthMonitorState = {
    initialized: false,
    statuses: new Map(),
  };

  const run = () => {
    scanAndBroadcastDeviceHealthChanges(state).catch((error) => {
      console.error('Device health monitor error:', error);
    });
  };

  run();
  const timer = setInterval(run, intervalMs);
  const monitor = { timer, state };
  globalForDeviceHealth.deviceHealthMonitor = monitor;
  return monitor;
}
