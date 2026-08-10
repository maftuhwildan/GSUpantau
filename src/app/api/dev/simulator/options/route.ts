import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { lines, devices } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { internalError } from '@/lib/errors';
import { getDeviceHealthSettings, withEffectiveDeviceStatus } from '@/lib/device-health';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireRole(req, 'ADMIN');
  if (errorResponse) return errorResponse;

  try {

    const allLines = await db.select().from(lines).orderBy(lines.lineCode);
    const allDevices = await db.select().from(devices);
    const settings = await getDeviceHealthSettings();

    const result = allLines.map((line) => {
      const lineDevices = allDevices
        .filter((d) => d.lineId === line.id)
        .map((deviceRecord) => {
          const dev = withEffectiveDeviceStatus(deviceRecord, settings);
          let defaultSecret = '';
          if (dev.deviceCode === 'ESP32-LINE-01') {
            defaultSecret = 'secret-device-key-01';
          } else if (dev.deviceCode === 'ESP32-LINE-02') {
            defaultSecret = 'secret-device-key-02';
          }

          return {
            id: dev.id,
            deviceCode: dev.deviceCode,
            name: dev.name,
            status: dev.status,
            firmwareVersion: dev.firmwareVersion,
            wifiRssi: dev.wifiRssi,
            lastHeartbeatAt: dev.lastHeartbeatAt,
            defaultSecret,
          };
        });

      return {
        id: line.id,
        lineCode: line.lineCode,
        name: line.name,
        status: line.status,
        devices: lineDevices,
      };
    });

    return NextResponse.json({ lines: result });
  } catch (error) {
    console.error('GET /api/dev/simulator/options error:', error);
    return internalError('Gagal mengambil data simulator options');
  }
}
