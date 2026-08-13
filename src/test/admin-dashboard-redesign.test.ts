import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '../db';
import { runSeed } from '../db/seed';
import {
  users,
  receivings,
  receivingSessions,
  lines,
  devices,
  sensorEvents,
  auditLogs,
} from '../db/schema';
import { signSessionToken, SESSION_COOKIE_NAME } from '../lib/auth';
import { eq, and } from 'drizzle-orm';
import { GET as getAdminDashboardHandler } from '../app/api/dashboard/admin/route';
import { getTodayStringInSiteTimezone, addCalendarDays } from '../lib/time';

describe('Admin Dashboard Redesign & API Contract', () => {
  let adminCookie: string;
  let adminUserId: string;
  let testLine1Id: string;
  let testLine2Id: string;
  let testDeviceId: string;

  beforeAll(async () => {
    await runSeed();

    const [adminUser] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));
    if (!adminUser) throw new Error('Seeded admin user not found');
    adminUserId = adminUser.id;

    const adminToken = await signSessionToken({
      userId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      roles: ['ADMIN'],
      expiresAt: Date.now() + 3600 * 1000,
    });

    adminCookie = `${SESSION_COOKIE_NAME}=${adminToken}`;

    const linesList = await db.query.lines.findMany();
    testLine1Id = linesList[0].id;
    testLine2Id = linesList[1].id;

    const device = await db.query.devices.findFirst({
      where: eq(devices.lineId, testLine1Id),
    });
    testDeviceId = device?.id || linesList[0].id;
  });

  function createReq(url: string, cookie: string = adminCookie) {
    return new NextRequest(`http://localhost${url}`, {
      headers: { cookie },
    });
  }

  it('1. Hero manifest excludes cancelled receivings', async () => {
    const todayStr = getTodayStringInSiteTimezone();

    // Insert a CANCELLED receiving for today with 5000 manifest count
    await db.insert(receivings).values({
      receivingNumber: `ADM-HERO-CAN-${Date.now()}`,
      deliveryNoteNumber: `SJ-HERO-CAN-${Date.now()}`,
      receivingDate: todayStr,
      manifestCount: 5000,
      lineId: testLine1Id,
      status: 'CANCELLED',
      licensePlateSnapshot: 'B 1111 CAN',
      driverNameSnapshot: 'Can Driver',
      supplierNameSnapshot: 'Can Supplier',
      createdBy: adminUserId,
    });

    const req = createReq('/api/dashboard/admin');
    const res = await getAdminDashboardHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    const receivingsToday = await db
      .select()
      .from(receivings)
      .where(eq(receivings.receivingDate, todayStr));
    const expectedManifest = receivingsToday
      .filter((r) => r.status !== 'CANCELLED')
      .reduce((sum, r) => sum + r.manifestCount, 0);

    expect(json.totalManifestToday).toBe(expectedManifest);
  });

  it('2. Actual and final difference only use completed sessions and completed receivings', async () => {
    const todayStr = getTodayStringInSiteTimezone();

    // Create a COMPLETED receiving today
    const [recComp] = await db
      .insert(receivings)
      .values({
        receivingNumber: `ADM-HERO-COMP-${Date.now()}`,
        deliveryNoteNumber: `SJ-HERO-COMP-${Date.now()}`,
        receivingDate: todayStr,
        manifestCount: 1000,
        lineId: testLine1Id,
        status: 'COMPLETED',
        reconciliationStatus: 'MATCHED',
        licensePlateSnapshot: 'B 2222 CMP',
        driverNameSnapshot: 'Cmp Driver',
        supplierNameSnapshot: 'Cmp Supplier',
        createdBy: adminUserId,
      })
      .returning();

    // Create completed session
    const [sessComp] = await db
      .insert(receivingSessions)
      .values({
        receivingId: recComp.id,
        lineId: testLine1Id,
        status: 'COMPLETED',
        startedBy: adminUserId,
        finishedBy: adminUserId,
        startedAt: new Date(),
        finishedAt: new Date(),
      })
      .returning();

    // Add 10 assigned production detection events to completed session
    for (let i = 1; i <= 10; i++) {
      await db.insert(sensorEvents).values({
        eventId: `EV-HERO-COMP-${i}-${Date.now()}`,
        bootId: 'BOOT-HERO',
        deviceId: testDeviceId,
        lineId: testLine1Id,
        sequence: 5000 + i,
        eventType: 'DETECTION',
        eventMode: 'PRODUCTION',
        assignmentStatus: 'ASSIGNED',
        sessionId: sessComp.id,
        deviceTime: new Date(),
        receivedAt: new Date(),
        rawPayload: {},
      });
    }

    const req = createReq('/api/dashboard/admin');
    const res = await getAdminDashboardHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.completedReceivingCount).toBeGreaterThanOrEqual(1);
    expect(json.actualCompletedToday).toBeGreaterThanOrEqual(10);
  });

  it('3. Trend uses completed receivings, production assigned detections, and site timezone daily buckets', async () => {
    const todayStr = getTodayStringInSiteTimezone();
    const prevDayStr = addCalendarDays(todayStr, -1);

    // Fetch dashboard with default 7d range
    const req = createReq(`/api/dashboard/admin?date_from=${prevDayStr}&date_to=${todayStr}`);
    const res = await getAdminDashboardHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(Array.isArray(json.trend)).toBe(true);
    expect(json.trend.length).toBe(2);
    expect(json.trend[0].date).toBe(prevDayStr);
    expect(json.trend[1].date).toBe(todayStr);
  });

  it('4. Heartbeat, test, maintenance, unassigned, and cancelled session events do not increment actual', async () => {
    const todayStr = getTodayStringInSiteTimezone();

    const [rec] = await db
      .insert(receivings)
      .values({
        receivingNumber: `ADM-NONPROD-${Date.now()}`,
        deliveryNoteNumber: `SJ-ADM-NONPROD-${Date.now()}`,
        receivingDate: todayStr,
        manifestCount: 500,
        lineId: testLine1Id,
        status: 'COMPLETED',
        reconciliationStatus: 'MATCHED',
        licensePlateSnapshot: 'B 3333 NNP',
        driverNameSnapshot: 'Driver',
        supplierNameSnapshot: 'Supplier',
        createdBy: adminUserId,
      })
      .returning();

    const [sess] = await db
      .insert(receivingSessions)
      .values({
        receivingId: rec.id,
        lineId: testLine1Id,
        status: 'COMPLETED',
        startedBy: adminUserId,
        finishedBy: adminUserId,
        startedAt: new Date(),
        finishedAt: new Date(),
      })
      .returning();

    // Insert 1 valid assigned production detection
    await db.insert(sensorEvents).values({
      eventId: `EV-ADM-VALID-${Date.now()}`,
      bootId: 'BOOT-ADM',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 6001,
      eventType: 'DETECTION',
      eventMode: 'PRODUCTION',
      assignmentStatus: 'ASSIGNED',
      sessionId: sess.id,
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    // Insert HEARTBEAT
    await db.insert(sensorEvents).values({
      eventId: `EV-ADM-HB-${Date.now()}`,
      bootId: 'BOOT-ADM',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 6002,
      eventType: 'HEARTBEAT',
      eventMode: 'PRODUCTION',
      assignmentStatus: 'ASSIGNED',
      sessionId: sess.id,
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    // Insert TEST mode
    await db.insert(sensorEvents).values({
      eventId: `EV-ADM-TEST-${Date.now()}`,
      bootId: 'BOOT-ADM',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 6003,
      eventType: 'DETECTION',
      eventMode: 'TEST',
      assignmentStatus: 'ASSIGNED',
      sessionId: sess.id,
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    // Insert UNASSIGNED
    await db.insert(sensorEvents).values({
      eventId: `EV-ADM-UNASS-${Date.now()}`,
      bootId: 'BOOT-ADM',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 6004,
      eventType: 'DETECTION',
      eventMode: 'PRODUCTION',
      assignmentStatus: 'UNASSIGNED',
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    const req = createReq('/api/dashboard/admin');
    const res = await getAdminDashboardHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    const recItem = json.recentReceivings.find((r: any) => r.id === rec.id);
    expect(recItem).toBeDefined();
    expect(recItem.actualCount).toBe(1);
  });

  it('5. Default 7-day period and valid custom range return correct daily buckets', async () => {
    const todayStr = getTodayStringInSiteTimezone();
    const dateFrom = addCalendarDays(todayStr, -4);

    const req = createReq(`/api/dashboard/admin?date_from=${dateFrom}&date_to=${todayStr}`);
    const res = await getAdminDashboardHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.trend.length).toBe(5);
    expect(json.trend[0].date).toBe(dateFrom);
    expect(json.trend[4].date).toBe(todayStr);
  });

  it('6. Rejects invalid date range parameters with VALIDATION_ERROR', async () => {
    const todayStr = getTodayStringInSiteTimezone();
    const prevStr = addCalendarDays(todayStr, -1);

    // Only date_from provided
    const req1 = createReq(`/api/dashboard/admin?date_from=${prevStr}`);
    const res1 = await getAdminDashboardHandler(req1);
    expect(res1.status).toBe(400);

    // date_from > date_to
    const req2 = createReq(`/api/dashboard/admin?date_from=${todayStr}&date_to=${prevStr}`);
    const res2 = await getAdminDashboardHandler(req2);
    expect(res2.status).toBe(400);

    // Range > 31 days
    const farPastStr = addCalendarDays(todayStr, -35);
    const req3 = createReq(`/api/dashboard/admin?date_from=${farPastStr}&date_to=${todayStr}`);
    const res3 = await getAdminDashboardHandler(req3);
    expect(res3.status).toBe(400);
  });

  it('7. Recent receivings display actual as null for DRAFT, WAITING, and CANCELLED status', async () => {
    const todayStr = getTodayStringInSiteTimezone();

    const [draftRec] = await db
      .insert(receivings)
      .values({
        receivingNumber: `REC-DFT-${Date.now()}`,
        deliveryNoteNumber: `SJ-DFT-${Date.now()}`,
        receivingDate: todayStr,
        manifestCount: 1200,
        lineId: testLine1Id,
        status: 'DRAFT',
        licensePlateSnapshot: 'B 4444 DFT',
        driverNameSnapshot: 'Draft Driver',
        supplierNameSnapshot: 'Draft Supplier',
        createdBy: adminUserId,
      })
      .returning();

    const req = createReq('/api/dashboard/admin');
    const res = await getAdminDashboardHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    const item = json.recentReceivings.find((r: any) => r.id === draftRec.id);
    expect(item).toBeDefined();
    expect(item.actualCount).toBeNull();
    expect(item.differenceCount).toBeNull();
    expect(item.differencePercent).toBeNull();
  });

  it('8. Line overview returns waiting queue count per line and last detection timestamp', async () => {
    const req = createReq('/api/dashboard/admin');
    const res = await getAdminDashboardHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(Array.isArray(json.linesOverview)).toBe(true);

    const line1Overview = json.linesOverview.find((l: any) => l.line.id === testLine1Id);
    expect(line1Overview).toBeDefined();
    expect(line1Overview).toHaveProperty('waitingQueueCount');
    expect(line1Overview).toHaveProperty('lastDetectionAt');
  });
});
