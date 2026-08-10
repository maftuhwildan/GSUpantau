import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { devices } from '@/db/schema';
import { verifyDeviceCredential } from '@/lib/device-auth';
import { internalError, validationError } from '@/lib/errors';
import { wsBroadcaster } from '@/lib/ws';
import {
  buildDeviceStatusPayload,
  deriveEffectiveDeviceStatus,
  getDeviceHealthSettings,
  shouldPersistOnlineStatus,
} from '@/lib/device-health';
import { eq } from 'drizzle-orm';

const deviceHeartbeatSchema = z.object({
  device_id: z.string().min(1, { message: 'device_id wajib diisi' }),
  line_id: z.string().min(1, { message: 'line_id wajib diisi' }),
  firmware_version: z.string().optional(),
  wifi_rssi: z.number().int().optional(),
  diagnostic_payload: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = deviceHeartbeatSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Input tidak valid';
      return validationError(firstIssue);
    }

    const { device_id, line_id, firmware_version, wifi_rssi, diagnostic_payload } = parsed.data;

    // Verify Device Auth & Line match
    const { device, errorResponse } = await verifyDeviceCredential(req, device_id, line_id);
    if (errorResponse) return errorResponse;

    const now = new Date();
    const settings = await getDeviceHealthSettings();
    const previousEffectiveStatus = deriveEffectiveDeviceStatus(device!, settings, now);
    const updateData: Partial<typeof devices.$inferInsert> = {
      lastHeartbeatAt: now,
      updatedAt: now,
    };

    if (shouldPersistOnlineStatus(device!.status)) updateData.status = 'ONLINE';
    if (firmware_version !== undefined) updateData.firmwareVersion = firmware_version;
    if (wifi_rssi !== undefined) updateData.wifiRssi = wifi_rssi;
    if (diagnostic_payload !== undefined) updateData.diagnosticPayload = diagnostic_payload;

    const [updatedDevice] = await db
      .update(devices)
      .set(updateData)
      .where(eq(devices.id, device!.id))
      .returning();

    const effectiveStatus = deriveEffectiveDeviceStatus(updatedDevice, settings, now);
    const healthPayload = buildDeviceStatusPayload(updatedDevice, settings, now);
    wsBroadcaster.broadcast('device.heartbeat_received', healthPayload);
    if (effectiveStatus !== previousEffectiveStatus) {
      wsBroadcaster.broadcast('device.status_updated', healthPayload);
    }

    return NextResponse.json({
      status: 'OK',
      server_time: now.toISOString(),
      device_status: effectiveStatus,
      last_heartbeat_at: updatedDevice.lastHeartbeatAt?.toISOString() ?? now.toISOString(),
      firmware_version: updatedDevice.firmwareVersion,
      wifi_rssi: updatedDevice.wifiRssi,
    });
  } catch (error) {
    console.error('POST /api/device/heartbeat error:', error);
    return internalError('Terjadi kesalahan saat memproses heartbeat perangkat');
  }
}
