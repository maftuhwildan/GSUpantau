import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { appSettings, devices } from '@/db/schema';

export type DeviceStoredStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE' | 'UNREGISTERED';
export type DeviceEffectiveStatus = DeviceStoredStatus;

export const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 10;
export const DEFAULT_BATCH_UPLOAD_MAX_EVENTS = 100;
export const MAX_BATCH_UPLOAD_EVENTS = 100;
export const DEFAULT_HEARTBEAT_DEGRADED_THRESHOLD_SECONDS = 15;
export const DEFAULT_HEARTBEAT_OFFLINE_THRESHOLD_SECONDS = 30;

export interface DeviceHealthSettings {
  heartbeatIntervalSeconds: number;
  batchUploadMaxEvents: number;
  degradedThresholdSeconds: number;
  offlineThresholdSeconds: number;
}

export interface DeviceHealthInput {
  status: string;
  lastHeartbeatAt: Date | string | null;
}

const HEALTH_SETTING_KEYS = [
  'heartbeat_interval_seconds',
  'batch_upload_max_events',
  'heartbeat_degraded_threshold_seconds',
  'heartbeat_offline_threshold_seconds',
];

function positiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeBatchUploadMaxEvents(value: unknown) {
  return Math.min(
    positiveInt(value, DEFAULT_BATCH_UPLOAD_MAX_EVENTS),
    MAX_BATCH_UPLOAD_EVENTS
  );
}

export async function getDeviceHealthSettings(database: typeof db = db): Promise<DeviceHealthSettings> {
  const rows = await database
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, HEALTH_SETTING_KEYS));

  const values = new Map(rows.map((row) => [row.key, row.value]));

  let degradedThresholdSeconds = positiveInt(
    values.get('heartbeat_degraded_threshold_seconds'),
    DEFAULT_HEARTBEAT_DEGRADED_THRESHOLD_SECONDS
  );
  let offlineThresholdSeconds = positiveInt(
    values.get('heartbeat_offline_threshold_seconds'),
    DEFAULT_HEARTBEAT_OFFLINE_THRESHOLD_SECONDS
  );

  if (degradedThresholdSeconds >= offlineThresholdSeconds) {
    degradedThresholdSeconds = DEFAULT_HEARTBEAT_DEGRADED_THRESHOLD_SECONDS;
    offlineThresholdSeconds = DEFAULT_HEARTBEAT_OFFLINE_THRESHOLD_SECONDS;
  }

  return {
    heartbeatIntervalSeconds: positiveInt(
      values.get('heartbeat_interval_seconds'),
      DEFAULT_HEARTBEAT_INTERVAL_SECONDS
    ),
    batchUploadMaxEvents: normalizeBatchUploadMaxEvents(
      values.get('batch_upload_max_events')
    ),
    degradedThresholdSeconds,
    offlineThresholdSeconds,
  };
}

export function deriveEffectiveDeviceStatus(
  device: DeviceHealthInput,
  settings: Pick<DeviceHealthSettings, 'degradedThresholdSeconds' | 'offlineThresholdSeconds'>,
  now: Date = new Date()
): DeviceEffectiveStatus {
  if (device.status === 'MAINTENANCE') return 'MAINTENANCE';
  if (!device.lastHeartbeatAt) return 'UNREGISTERED';

  const lastHeartbeat =
    device.lastHeartbeatAt instanceof Date
      ? device.lastHeartbeatAt
      : new Date(device.lastHeartbeatAt);
  const heartbeatAgeSeconds = (now.getTime() - lastHeartbeat.getTime()) / 1000;

  if (!Number.isFinite(heartbeatAgeSeconds) || heartbeatAgeSeconds < 0) {
    return 'ONLINE';
  }

  if (heartbeatAgeSeconds >= settings.offlineThresholdSeconds) return 'OFFLINE';
  if (heartbeatAgeSeconds >= settings.degradedThresholdSeconds) return 'DEGRADED';
  return 'ONLINE';
}

export function withEffectiveDeviceStatus<TDevice extends DeviceHealthInput>(
  device: TDevice,
  settings: Pick<DeviceHealthSettings, 'degradedThresholdSeconds' | 'offlineThresholdSeconds'>,
  now: Date = new Date()
): TDevice & { status: DeviceEffectiveStatus; storedStatus: string } {
  return {
    ...device,
    storedStatus: device.status,
    status: deriveEffectiveDeviceStatus(device, settings, now),
  };
}

export function toPublicDeviceHealth(
  device: typeof devices.$inferSelect,
  settings: Pick<DeviceHealthSettings, 'degradedThresholdSeconds' | 'offlineThresholdSeconds'>,
  now: Date = new Date()
) {
  const effectiveDevice = withEffectiveDeviceStatus(device, settings, now);
  return {
    id: effectiveDevice.id,
    deviceCode: effectiveDevice.deviceCode,
    lineId: effectiveDevice.lineId,
    name: effectiveDevice.name,
    status: effectiveDevice.status,
    storedStatus: effectiveDevice.storedStatus,
    lastHeartbeatAt: effectiveDevice.lastHeartbeatAt,
    firmwareVersion: effectiveDevice.firmwareVersion,
    wifiRssi: effectiveDevice.wifiRssi,
  };
}

export function shouldPersistOnlineStatus(storedStatus: string) {
  return storedStatus !== 'MAINTENANCE';
}

export function buildDeviceStatusPayload(
  device: typeof devices.$inferSelect,
  settings: Pick<DeviceHealthSettings, 'degradedThresholdSeconds' | 'offlineThresholdSeconds'>,
  now: Date = new Date()
) {
  return {
    device_id: device.id,
    device_code: device.deviceCode,
    line_id: device.lineId,
    status: deriveEffectiveDeviceStatus(device, settings, now),
    stored_status: device.status,
    last_heartbeat_at: device.lastHeartbeatAt?.toISOString() ?? null,
    firmware_version: device.firmwareVersion,
    wifi_rssi: device.wifiRssi,
  };
}
