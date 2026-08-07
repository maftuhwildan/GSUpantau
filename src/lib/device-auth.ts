import { db } from '@/db';
import { devices, lines } from '@/db/schema';
import { createErrorResponse } from './errors';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export interface DeviceAuthResult {
  device: typeof devices.$inferSelect | null;
  line: typeof lines.$inferSelect | null;
  errorResponse: NextResponse | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function verifyDeviceCredential(
  req: Request,
  deviceIdOrCode: string,
  lineIdOrCode?: string
): Promise<DeviceAuthResult> {
  // Extract authorization header
  const authHeader = req.headers.get('authorization') || req.headers.get('x-device-secret');
  if (!authHeader) {
    return {
      device: null,
      line: null,
      errorResponse: createErrorResponse(
        'UNAUTHORIZED',
        'Kredensial perangkat tidak ditemukan pada header Authorization atau X-Device-Secret.',
        401
      ),
    };
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
  if (!token) {
    return {
      device: null,
      line: null,
      errorResponse: createErrorResponse('UNAUTHORIZED', 'Token kredensial perangkat kosong.', 401),
    };
  }

  // Find device safely checking UUID vs deviceCode
  const isDeviceUuid = UUID_REGEX.test(deviceIdOrCode);
  const deviceWhere = isDeviceUuid
    ? or(eq(devices.id, deviceIdOrCode), eq(devices.deviceCode, deviceIdOrCode))
    : eq(devices.deviceCode, deviceIdOrCode);

  const [device] = await db.select().from(devices).where(deviceWhere);

  if (!device) {
    return {
      device: null,
      line: null,
      errorResponse: createErrorResponse(
        'DEVICE_UNREGISTERED',
        `Perangkat '${deviceIdOrCode}' tidak terdaftar dalam sistem.`,
        404
      ),
    };
  }

  // Compare token with credentialHash
  const isMatch = await bcrypt.compare(token, device.credentialHash);
  if (!isMatch) {
    return {
      device: null,
      line: null,
      errorResponse: createErrorResponse('UNAUTHORIZED', 'Kredensial perangkat tidak valid.', 401),
    };
  }

  // Find line associated with device
  const [line] = await db.select().from(lines).where(eq(lines.id, device.lineId));

  if (!line) {
    return {
      device: null,
      line: null,
      errorResponse: createErrorResponse(
        'DEVICE_LINE_MISMATCH',
        'Jalur (Line) perangkat tidak ditemukan dalam sistem.',
        400
      ),
    };
  }

  // If lineIdOrCode is provided, verify it matches device line
  if (lineIdOrCode) {
    if (line.id !== lineIdOrCode && line.lineCode !== lineIdOrCode) {
      return {
        device: null,
        line: null,
        errorResponse: createErrorResponse(
          'DEVICE_LINE_MISMATCH',
          `Perangkat '${device.deviceCode}' terdaftar pada jalur '${line.lineCode}', tidak sesuai dengan '${lineIdOrCode}'.`,
          400
        ),
      };
    }
  }

  return {
    device,
    line,
    errorResponse: null,
  };
}
