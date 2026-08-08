import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sensorEvents } from '@/db/schema';
import { requirePermission, checkOperatorLineAccess } from '@/lib/auth';
import { forbiddenError, internalError } from '@/lib/errors';
import { eq, and, desc, gte, lte } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requirePermission(req, 'sensor:view');
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    let lineId = searchParams.get('line_id');
    const deviceId = searchParams.get('device_id');
    const eventType = searchParams.get('event_type');
    const assignmentStatus = searchParams.get('assignment_status');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
    const limit = isNaN(limitParam) ? 50 : Math.min(limitParam, 100);

    // ── Operator line restriction ─────────────────────────────────────────
    const lineAccessError = checkOperatorLineAccess(user!, lineId);
    if (lineAccessError) return lineAccessError;

    // For operator-only users, always force filter to their assigned line.
    if (user!.roles.includes('OPERATOR') && !user!.roles.includes('ADMIN')) {
      if (!user!.assignedLineId) {
        return forbiddenError('Operator belum ditugaskan pada jalur (Line) mana pun.');
      }
      lineId = user!.assignedLineId;
    }
    // ─────────────────────────────────────────────────────────────────────

    const conditions = [];
    if (lineId) conditions.push(eq(sensorEvents.lineId, lineId));
    if (deviceId) conditions.push(eq(sensorEvents.deviceId, deviceId));
    if (eventType) conditions.push(eq(sensorEvents.eventType, eventType));
    if (assignmentStatus) conditions.push(eq(sensorEvents.assignmentStatus, assignmentStatus));

    if (dateFrom) conditions.push(gte(sensorEvents.deviceTime, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(sensorEvents.deviceTime, new Date(dateTo)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const events = await db.query.sensorEvents.findMany({
      where: whereClause,
      with: {
        device: true,
        line: true,
        session: {
          with: { receiving: true },
        },
      },
      orderBy: [desc(sensorEvents.deviceTime)],
      limit,
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Sensor Events API error:', error);
    return internalError();
  }
}
