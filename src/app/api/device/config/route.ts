import { NextRequest, NextResponse } from 'next/server';
import { verifyDeviceCredential } from '@/lib/device-auth';
import { getDeviceHealthSettings } from '@/lib/device-health';
import { internalError, validationError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const device_id = searchParams.get('device_id') || req.headers.get('x-device-id');
    const line_id = searchParams.get('line_id') || req.headers.get('x-line-id') || undefined;

    if (!device_id) {
      return validationError('device_id wajib ditentukan pada parameter URL atau header');
    }

    // Verify Device Auth & Line match
    const { device, line, errorResponse } = await verifyDeviceCredential(req, device_id, line_id);
    if (errorResponse) return errorResponse;

    const settings = await getDeviceHealthSettings();

    return NextResponse.json({
      device_id: device!.deviceCode,
      line_id: line!.lineCode,
      server_time: new Date().toISOString(),
      heartbeat_interval_seconds: settings.heartbeatIntervalSeconds,
      batch_upload_max_events: settings.batchUploadMaxEvents,
    });
  } catch (error) {
    console.error('GET /api/device/config error:', error);
    return internalError('Terjadi kesalahan saat mengambil konfigurasi perangkat');
  }
}
