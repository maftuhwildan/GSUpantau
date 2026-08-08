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
} from '../db/schema';
import { signSessionToken, SESSION_COOKIE_NAME } from '../lib/auth';
import { eq, and } from 'drizzle-orm';
import { GET as getReceivingsHandler } from '../app/api/receivings/route';
import { GET as getReceivingDetailHandler } from '../app/api/receivings/[id]/route';
import { GET as getAdminDashboardHandler } from '../app/api/dashboard/admin/route';
import { GET as getOperatorDashboardHandler } from '../app/api/dashboard/operator/route';
import { GET as getReportsHandler } from '../app/api/reports/route';
import { getTodayStringInSiteTimezone } from '../lib/time';

describe('Batch 10: Actual Count, Dashboard, and Report Correctness', () => {
  let adminCookie: string;
  let operatorCookie: string;
  let adminUserId: string;
  let operatorUserId: string;
  let testLine1Id: string;
  let testLine2Id: string;
  let testDeviceId: string;

  beforeAll(async () => {
    await runSeed();

    const [adminUser] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));
    const [operatorUser] = await db.select().from(users).where(eq(users.email, 'operator@local.test'));

    if (!adminUser || !operatorUser) {
      throw new Error('Seeded test users not found');
    }

    adminUserId = adminUser.id;
    operatorUserId = operatorUser.id;

    const adminToken = await signSessionToken({
      userId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      roles: ['ADMIN'],
      expiresAt: Date.now() + 3600 * 1000,
    });

    const operatorToken = await signSessionToken({
      userId: operatorUser.id,
      email: operatorUser.email,
      name: operatorUser.name,
      roles: ['OPERATOR'],
      expiresAt: Date.now() + 3600 * 1000,
    });

    adminCookie = `${SESSION_COOKIE_NAME}=${adminToken}`;
    operatorCookie = `${SESSION_COOKIE_NAME}=${operatorToken}`;

    const linesList = await db.query.lines.findMany();
    testLine1Id = linesList[0].id;
    testLine2Id = linesList[1].id;

    const device = await db.query.devices.findFirst({
      where: eq(devices.lineId, testLine1Id),
    });
    testDeviceId = device?.id || linesList[0].id;
  });

  beforeEach(async () => {
    // Clear any existing active COUNTING sessions on testLine1Id before each test
    await db
      .update(receivingSessions)
      .set({ status: 'COMPLETED', finishedAt: new Date() })
      .where(and(eq(receivingSessions.lineId, testLine1Id), eq(receivingSessions.status, 'COUNTING')));
  });

  function createReq(url: string, cookie: string) {
    return new NextRequest(`http://localhost${url}`, {
      headers: { cookie },
    });
  }

  it('should return actualCount as null for DRAFT, WAITING, and CANCELLED receivings', async () => {
    const todayStr = getTodayStringInSiteTimezone();

    // Create DRAFT receiving
    const [draftRec] = await db
      .insert(receivings)
      .values({
        receivingNumber: `TEST-DRAFT-${Date.now()}`,
        deliveryNoteNumber: `SJ-DRAFT-${Date.now()}`,
        receivingDate: todayStr,
        manifestCount: 1000,
        lineId: testLine1Id,
        status: 'DRAFT',
        licensePlateSnapshot: 'B 1111 DFT',
        driverNameSnapshot: 'Draft Driver',
        supplierNameSnapshot: 'Draft Supplier',
        createdBy: adminUserId,
      })
      .returning();

    // Create WAITING receiving
    const [waitingRec] = await db
      .insert(receivings)
      .values({
        receivingNumber: `TEST-WAIT-${Date.now()}`,
        deliveryNoteNumber: `SJ-WAIT-${Date.now()}`,
        receivingDate: todayStr,
        manifestCount: 2000,
        lineId: testLine1Id,
        status: 'WAITING',
        licensePlateSnapshot: 'B 2222 WAI',
        driverNameSnapshot: 'Waiting Driver',
        supplierNameSnapshot: 'Waiting Supplier',
        createdBy: adminUserId,
      })
      .returning();

    // Create CANCELLED receiving
    const [cancelledRec] = await db
      .insert(receivings)
      .values({
        receivingNumber: `TEST-CAN-${Date.now()}`,
        deliveryNoteNumber: `SJ-CAN-${Date.now()}`,
        receivingDate: todayStr,
        manifestCount: 1500,
        lineId: testLine1Id,
        status: 'CANCELLED',
        licensePlateSnapshot: 'B 3333 CAN',
        driverNameSnapshot: 'Cancelled Driver',
        supplierNameSnapshot: 'Cancelled Supplier',
        createdBy: adminUserId,
      })
      .returning();

    // Test GET /api/receivings
    const reqList = createReq('/api/receivings', adminCookie);
    const resList = await getReceivingsHandler(reqList);
    expect(resList.status).toBe(200);

    const jsonList = await resList.json();
    const itemDraft = jsonList.receivings.find((r: any) => r.id === draftRec.id);
    const itemWait = jsonList.receivings.find((r: any) => r.id === waitingRec.id);
    const itemCan = jsonList.receivings.find((r: any) => r.id === cancelledRec.id);

    expect(itemDraft.actualCount).toBeNull();
    expect(itemWait.actualCount).toBeNull();
    expect(itemCan.actualCount).toBeNull();

    // Test GET /api/receivings/:id for WAITING receiving
    const reqDetail = createReq(`/api/receivings/${waitingRec.id}`, adminCookie);
    const resDetail = await getReceivingDetailHandler(reqDetail, {
      params: Promise.resolve({ id: waitingRec.id }),
    });
    expect(resDetail.status).toBe(200);

    const jsonDetail = await resDetail.json();
    expect(jsonDetail.receiving.actualCount).toBeNull();
  });

  it('should exclude events from CANCELLED sessions when a receiving is restarted', async () => {
    const todayStr = getTodayStringInSiteTimezone();

    // Create a receiving
    const [rec] = await db
      .insert(receivings)
      .values({
        receivingNumber: `TEST-RESTART-${Date.now()}`,
        deliveryNoteNumber: `SJ-RESTART-${Date.now()}`,
        receivingDate: todayStr,
        manifestCount: 500,
        lineId: testLine1Id,
        status: 'COUNTING',
        licensePlateSnapshot: 'B 9999 RST',
        driverNameSnapshot: 'Restart Driver',
        supplierNameSnapshot: 'Restart Supplier',
        createdBy: adminUserId,
      })
      .returning();

    // Session 1: Cancelled session
    const [session1] = await db
      .insert(receivingSessions)
      .values({
        receivingId: rec.id,
        lineId: testLine1Id,
        status: 'CANCELLED',
        startedBy: adminUserId,
        startedAt: new Date(),
        cancelledAt: new Date(),
        cancelledBy: adminUserId,
        cancellationReason: 'Wrong truck selected',
      })
      .returning();

    // Insert 2 events assigned to Session 1
    await db.insert(sensorEvents).values({
      eventId: `EV-SES1-1-${Date.now()}`,
      bootId: 'BOOT-1',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 1001,
      eventType: 'DETECTION',
      eventMode: 'PRODUCTION',
      assignmentStatus: 'ASSIGNED',
      sessionId: session1.id,
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    await db.insert(sensorEvents).values({
      eventId: `EV-SES1-2-${Date.now()}`,
      bootId: 'BOOT-1',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 1002,
      eventType: 'DETECTION',
      eventMode: 'PRODUCTION',
      assignmentStatus: 'ASSIGNED',
      sessionId: session1.id,
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    // Session 2: Active COUNTING session for restarted receiving
    const [session2] = await db
      .insert(receivingSessions)
      .values({
        receivingId: rec.id,
        lineId: testLine1Id,
        status: 'COUNTING',
        startedBy: adminUserId,
        startedAt: new Date(),
      })
      .returning();

    // Insert 5 events assigned to active Session 2
    for (let i = 1; i <= 5; i++) {
      await db.insert(sensorEvents).values({
        eventId: `EV-SES2-${i}-${Date.now()}`,
        bootId: 'BOOT-1',
        deviceId: testDeviceId,
        lineId: testLine1Id,
        sequence: 2000 + i,
        eventType: 'DETECTION',
        eventMode: 'PRODUCTION',
        assignmentStatus: 'ASSIGNED',
        sessionId: session2.id,
        deviceTime: new Date(),
        receivedAt: new Date(),
        rawPayload: {},
      });
    }

    // Verify GET /api/receivings/:id ONLY counts session 2 events (5 events), excluding session 1
    const reqDetail = createReq(`/api/receivings/${rec.id}`, adminCookie);
    const resDetail = await getReceivingDetailHandler(reqDetail, {
      params: Promise.resolve({ id: rec.id }),
    });
    expect(resDetail.status).toBe(200);

    const jsonDetail = await resDetail.json();
    expect(jsonDetail.receiving.actualCount).toBe(5);
  });

  it('should exclude HEARTBEAT, DEVICE_RESTART, TEST mode, and MAINTENANCE mode events from actual count', async () => {
    const todayStr = getTodayStringInSiteTimezone();

    const [rec] = await db
      .insert(receivings)
      .values({
        receivingNumber: `TEST-NONPROD-${Date.now()}`,
        deliveryNoteNumber: `SJ-NONPROD-${Date.now()}`,
        receivingDate: todayStr,
        manifestCount: 300,
        lineId: testLine1Id,
        status: 'COUNTING',
        licensePlateSnapshot: 'B 8888 NOP',
        driverNameSnapshot: 'NonProd Driver',
        supplierNameSnapshot: 'NonProd Supplier',
        createdBy: adminUserId,
      })
      .returning();

    const [session] = await db
      .insert(receivingSessions)
      .values({
        receivingId: rec.id,
        lineId: testLine1Id,
        status: 'COUNTING',
        startedBy: adminUserId,
        startedAt: new Date(),
      })
      .returning();

    // Ingest 2 valid production detection events
    await db.insert(sensorEvents).values({
      eventId: `PROD-1-${Date.now()}`,
      bootId: 'BOOT-NP',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 3001,
      eventType: 'DETECTION',
      eventMode: 'PRODUCTION',
      assignmentStatus: 'ASSIGNED',
      sessionId: session.id,
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    await db.insert(sensorEvents).values({
      eventId: `PROD-2-${Date.now()}`,
      bootId: 'BOOT-NP',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 3002,
      eventType: 'DETECTION',
      eventMode: 'PRODUCTION',
      assignmentStatus: 'ASSIGNED',
      sessionId: session.id,
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    // Ingest non-production / non-detection events
    await db.insert(sensorEvents).values({
      eventId: `HB-1-${Date.now()}`,
      bootId: 'BOOT-NP',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 3003,
      eventType: 'HEARTBEAT',
      eventMode: 'PRODUCTION',
      assignmentStatus: 'ASSIGNED',
      sessionId: session.id,
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    await db.insert(sensorEvents).values({
      eventId: `RESTART-1-${Date.now()}`,
      bootId: 'BOOT-NP',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 3004,
      eventType: 'DEVICE_RESTART',
      eventMode: 'PRODUCTION',
      assignmentStatus: 'ASSIGNED',
      sessionId: session.id,
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    await db.insert(sensorEvents).values({
      eventId: `TEST-1-${Date.now()}`,
      bootId: 'BOOT-NP',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 3005,
      eventType: 'DETECTION',
      eventMode: 'TEST',
      assignmentStatus: 'ASSIGNED',
      sessionId: session.id,
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    await db.insert(sensorEvents).values({
      eventId: `MAINT-1-${Date.now()}`,
      bootId: 'BOOT-NP',
      deviceId: testDeviceId,
      lineId: testLine1Id,
      sequence: 3006,
      eventType: 'DETECTION',
      eventMode: 'MAINTENANCE',
      assignmentStatus: 'ASSIGNED',
      sessionId: session.id,
      deviceTime: new Date(),
      receivedAt: new Date(),
      rawPayload: {},
    });

    const reqDetail = createReq(`/api/receivings/${rec.id}`, adminCookie);
    const resDetail = await getReceivingDetailHandler(reqDetail, {
      params: Promise.resolve({ id: rec.id }),
    });
    expect(resDetail.status).toBe(200);

    const jsonDetail = await resDetail.json();
    // Actual count must strictly be 2 (only production detections)
    expect(jsonDetail.receiving.actualCount).toBe(2);
  });

  it('should exclude CANCELLED receivings from Admin Dashboard totalManifestToday and include reviewRequiredCount', async () => {
    const todayStr = getTodayStringInSiteTimezone();

    // Create a CANCELLED receiving for today with 9999 manifest count
    await db.insert(receivings).values({
      receivingNumber: `ADM-CAN-${Date.now()}`,
      deliveryNoteNumber: `SJ-ADM-CAN-${Date.now()}`,
      receivingDate: todayStr,
      manifestCount: 9999,
      lineId: testLine1Id,
      status: 'CANCELLED',
      licensePlateSnapshot: 'B 7777 ADM',
      driverNameSnapshot: 'Admin Can Driver',
      supplierNameSnapshot: 'Admin Can Supplier',
      createdBy: adminUserId,
    });

    // Create a receiving with reconciliationStatus REVIEW_REQUIRED
    await db.insert(receivings).values({
      receivingNumber: `ADM-REV-${Date.now()}`,
      deliveryNoteNumber: `SJ-ADM-REV-${Date.now()}`,
      receivingDate: todayStr,
      manifestCount: 500,
      lineId: testLine1Id,
      status: 'COMPLETED',
      reconciliationStatus: 'REVIEW_REQUIRED',
      licensePlateSnapshot: 'B 6666 REV',
      driverNameSnapshot: 'Review Driver',
      supplierNameSnapshot: 'Review Supplier',
      createdBy: adminUserId,
    });

    const reqAdmin = createReq('/api/dashboard/admin', adminCookie);
    const resAdmin = await getAdminDashboardHandler(reqAdmin);
    expect(resAdmin.status).toBe(200);

    const jsonAdmin = await resAdmin.json();

    expect(jsonAdmin).toHaveProperty('totalManifestToday');
    expect(jsonAdmin).toHaveProperty('reviewRequiredCount');
    expect(jsonAdmin.reviewRequiredCount).toBeGreaterThanOrEqual(1);

    // Get all non-cancelled receivings today from DB manually to cross-check
    const receivingsToday = await db
      .select()
      .from(receivings)
      .where(eq(receivings.receivingDate, todayStr));
    const nonCancelledManifest = receivingsToday
      .filter((r) => r.status !== 'CANCELLED')
      .reduce((sum, r) => sum + r.manifestCount, 0);

    expect(jsonAdmin.totalManifestToday).toBe(nonCancelledManifest);
  });

  it('should scope Operator Dashboard waiting queue and detection stats to the selected line', async () => {
    const todayStr = getTodayStringInSiteTimezone();

    // Insert a WAITING receiving specifically for Line 1
    const [recLine1] = await db
      .insert(receivings)
      .values({
        receivingNumber: `OP-L1-${Date.now()}`,
        deliveryNoteNumber: `SJ-OP-L1-${Date.now()}`,
        receivingDate: todayStr,
        manifestCount: 100,
        lineId: testLine1Id,
        status: 'WAITING',
        licensePlateSnapshot: 'B 1111 OP1',
        driverNameSnapshot: 'Op1 Driver',
        supplierNameSnapshot: 'Op1 Supplier',
        createdBy: adminUserId,
      })
      .returning();

    // Insert a WAITING receiving specifically for Line 2
    const [recLine2] = await db
      .insert(receivings)
      .values({
        receivingNumber: `OP-L2-${Date.now()}`,
        deliveryNoteNumber: `SJ-OP-L2-${Date.now()}`,
        receivingDate: todayStr,
        manifestCount: 200,
        lineId: testLine2Id,
        status: 'WAITING',
        licensePlateSnapshot: 'B 2222 OP2',
        driverNameSnapshot: 'Op2 Driver',
        supplierNameSnapshot: 'Op2 Supplier',
        createdBy: adminUserId,
      })
      .returning();

    // Request Operator Dashboard for Line 1
    const reqOp = createReq(`/api/dashboard/operator?line_id=${testLine1Id}`, operatorCookie);
    const resOp = await getOperatorDashboardHandler(reqOp);
    expect(resOp.status).toBe(200);

    const jsonOp = await resOp.json();
    const queueIds = jsonOp.waitingQueue.map((item: any) => item.id);

    expect(queueIds).toContain(recLine1.id);
    expect(queueIds).not.toContain(recLine2.id);
  });

  it('should derive actual count only from COMPLETED sessions in Reports API', async () => {
    const todayStr = getTodayStringInSiteTimezone();

    // Create a COMPLETED receiving
    const [recComp] = await db
      .insert(receivings)
      .values({
        receivingNumber: `RPT-COMP-${Date.now()}`,
        deliveryNoteNumber: `SJ-RPT-COMP-${Date.now()}`,
        receivingDate: todayStr,
        manifestCount: 1000,
        lineId: testLine1Id,
        status: 'COMPLETED',
        reconciliationStatus: 'MATCHED',
        licensePlateSnapshot: 'B 5555 RPT',
        driverNameSnapshot: 'Report Driver',
        supplierNameSnapshot: 'Report Supplier',
        createdBy: adminUserId,
      })
      .returning();

    // Completed Session
    const [sessionComp] = await db
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

    // 10 events for completed session
    for (let i = 1; i <= 10; i++) {
      await db.insert(sensorEvents).values({
        eventId: `RPT-EV-${i}-${Date.now()}`,
        bootId: 'BOOT-RPT',
        deviceId: testDeviceId,
        lineId: testLine1Id,
        sequence: 4000 + i,
        eventType: 'DETECTION',
        eventMode: 'PRODUCTION',
        assignmentStatus: 'ASSIGNED',
        sessionId: sessionComp.id,
        deviceTime: new Date(),
        receivedAt: new Date(),
        rawPayload: {},
      });
    }

    const reqRpt = createReq(
      `/api/reports?date_from=${todayStr}&date_to=${todayStr}&line_id=${testLine1Id}`,
      adminCookie
    );
    const resRpt = await getReportsHandler(reqRpt);
    expect(resRpt.status).toBe(200);

    const jsonRpt = await resRpt.json();
    const rptItem = jsonRpt.list.find((r: any) => r.id === recComp.id);

    expect(rptItem).toBeDefined();
    expect(rptItem.actualCount).toBe(10);
  });
});
