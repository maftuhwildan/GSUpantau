import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { devices } from '@/db/schema';
import { verifyDeviceCredential } from '@/lib/device-auth';
import { validationError } from '@/lib/errors';
import { wsBroadcaster } from '@/lib/ws';
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
    const updateData: Partial<typeof devices.$inferInsert> = {
      lastHeartbeatAt: now,
      status: 'ONLINE',
      updatedAt: now,
    };

    if (firmware_version !== undefined) updateData.firmwareVersion = firmware_version;
    if (wifi_rssi !== undefined) updateData.wifiRssi = wifi_rssi;
    if (diagnostic_payload !== undefined) updateData.diagnosticPayload = diagnostic_payload;

    await db.update(devices).set(updateData).where(eq(devices.id, device!.id));

    // Broadcast device status update
    wsBroadcaster.broadcast('device.status_updated', {
      device_id: device!.id,
      device_code: device!.deviceCode,
      status: 'ONLINE',
      last_heartbeat_at: now.toISOString(),
      wifi_rssi: wifi_rssi ?? device!.wifiRssi,
    });

    return NextResponse.json({
      status: 'OK',
      server_time: now.toISOString(),
    });
  } catch (error) {
    console.error('POST /api/device/heartbeat error:', error);
    return validationError('Terjadi kesalahan saat memproses heartbeat perangkat');
  }
}
