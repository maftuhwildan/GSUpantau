import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { devices, lines } from '@/db/schema';
import { isOperatorOnly, requirePermission } from '@/lib/auth';
import { forbiddenError, internalError } from '@/lib/errors';
import { getDeviceHealthSettings, toPublicDeviceHealth } from '@/lib/device-health';
import { eq, inArray } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'dashboard:view');
  if (errorResponse) return errorResponse;

  try {
    if (isOperatorOnly(user!)) {
      if (!user!.assignedLineId) {
        return forbiddenError('Operator belum ditugaskan pada jalur (Line) mana pun.');
      }

      const list = await db
        .select()
        .from(lines)
        .where(eq(lines.id, user!.assignedLineId))
        .orderBy(lines.lineCode);

      return NextResponse.json({ lines: await addDeviceHealth(list) });
    }

    const list = await db
      .select()
      .from(lines)
      .orderBy(lines.lineCode);

    return NextResponse.json({ lines: await addDeviceHealth(list) });
  } catch (error) {
    console.error('GET /api/lines error:', error);
    return internalError();
  }
}

async function addDeviceHealth(lineList: Array<typeof lines.$inferSelect>) {
  if (lineList.length === 0) return [];

  const settings = await getDeviceHealthSettings();
  const deviceList = await db
    .select()
    .from(devices)
    .where(inArray(devices.lineId, lineList.map((line) => line.id)));

  return lineList.map((line) => ({
    ...line,
    devices: deviceList
      .filter((device) => device.lineId === line.id)
      .map((deviceRecord) => toPublicDeviceHealth(deviceRecord, settings)),
  }));
}
