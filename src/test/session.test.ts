import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '../db/seed';
import { db } from '../db';
import { users, receivings, receivingSessions, lines, devices, sensorEvents, auditLogs, reconciliationReviews } from '../db/schema';
import { signSessionToken, SESSION_COOKIE_NAME } from '../lib/auth';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { POST as startSessionHandler } from '../app/api/sessions/start/route';
import { POST as finishSessionHandler } from '../app/api/sessions/[id]/finish/route';
import { POST as cancelSessionHandler } from '../app/api/sessions/[id]/cancel/route';
import { POST as deviceEventsHandler } from '../app/api/device/events/route';
import { GET as getActiveSessionHandler } from '../app/api/lines/[id]/active-session/route';
import { wsBroadcaster } from '../lib/ws';

describe('Session Start & Finish (Batch 5)', () => {
  let adminToken: string;
  let operatorToken: string;
  let adminUserId: string;
  let operatorUserId: string;
  let line1Id: string;
  let line2Id: string;
  let device1Id: string;

  beforeAll(async () => {
    await runSeed();

    const [admin] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));
    const [operator] = await db.select().from(users).where(eq(users.email, 'operator@local.test'));
    const allLines = await db.select().from(lines);
    const [dev1] = await db.select().from(devices);

    adminUserId = admin.id;
    operatorUserId = operator.id;
    line1Id = allLines[0].id;
    line2Id = allLines[1].id;
    device1Id = dev1.id;

    adminToken = await signSessionToken({
      userId: admin.id,
      email: admin.email,
      name: admin.name,
      roles: ['ADMIN'],
      expiresAt: Date.now() + 3600 * 1000,
    });

    operatorToken = await signSessionToken({
      userId: operator.id,
      email: operator.email,
      name: operator.name,
      roles: ['OPERATOR'],
      expiresAt: Date.now() + 3600 * 1000,
    });
  });

  describe('Session Start Flow', () => {
    it('should allow Operator or Admin to start a WAITING receiving', async () => {
      // Find a WAITING receiving
      const [waitingRec] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.status, 'WAITING'));

      expect(waitingRec).toBeDefined();

      // Set any active session on line1Id to COMPLETED first to ensure clean test state
      await db
        .update(receivingSessions)
        .set({ status: 'COMPLETED' })
        .where(eq(receivingSessions.lineId, line1Id));

      const req = new NextRequest('http://localhost:3000/api/sessions/start', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${operatorToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          receiving_id: waitingRec.id,
          line_id: line1Id,
        }),
      });

      const res = await startSessionHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.session).toBeDefined();
      expect(json.session.status).toBe('COUNTING');
      expect(json.session.receiving_id).toBe(waitingRec.id);
      expect(json.session.line_id).toBe(line1Id);

      // Verify receiving status updated to COUNTING
      const [updatedRec] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.id, waitingRec.id));

      expect(updatedRec.status).toBe('COUNTING');

      // Verify audit log
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, json.session.id));

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('SESSION_START');
    });

    it('should prevent starting a second session on the same line (One Active Session Per Line)', async () => {
      // Find another WAITING receiving
      const waitingList = await db
        .select()
        .from(receivings)
        .where(eq(receivings.status, 'WAITING'));

      if (waitingList.length > 0) {
        const secondWaiting = waitingList[0];

        // Keep this legacy invariant test focused on the active-line conflict,
        // not the newer receiving-line mismatch rule.
        await db
          .update(receivings)
          .set({ lineId: line1Id })
          .where(eq(receivings.id, secondWaiting.id));

        const req = new NextRequest('http://localhost:3000/api/sessions/start', {
          method: 'POST',
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            receiving_id: secondWaiting.id,
            line_id: line1Id, // Line 1 already has an active session from previous test
          }),
        });

        const res = await startSessionHandler(req);
        expect(res.status).toBe(409);

        const json = await res.json();
        expect(json.error.code).toBe('SESSION_ALREADY_ACTIVE');
      }
    });

    it('should reject starting a DRAFT or COMPLETED receiving', async () => {
      const [draftRec] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.status, 'DRAFT'));

      if (draftRec) {
        const req = new NextRequest('http://localhost:3000/api/sessions/start', {
          method: 'POST',
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            receiving_id: draftRec.id,
            line_id: line2Id,
          }),
        });

        const res = await startSessionHandler(req);
        expect(res.status).toBe(400);

        const json = await res.json();
        expect(json.error.code).toBe('INVALID_STATUS');
      }
    });
  });

  describe('Active Session Info API', () => {
    it('should return active session data for a line', async () => {
      const params = Promise.resolve({ id: line1Id });
      const req = new NextRequest(`http://localhost:3000/api/lines/${line1Id}/active-session`, {
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${operatorToken}`,
        },
      });

      const res = await getActiveSessionHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.activeSession).not.toBeNull();
      expect(json.activeSession.status).toBe('COUNTING');
      expect(json.activeSession.actualCount).toBeDefined();
    });
  });

  describe('Session Finish Flow', () => {
    it('should require confirmation = true to finish a session', async () => {
      const [activeSession] = await db
        .select()
        .from(receivingSessions)
        .where(eq(receivingSessions.status, 'COUNTING'));

      expect(activeSession).toBeDefined();

      const params = Promise.resolve({ id: activeSession.id });
      const req = new NextRequest(`http://localhost:3000/api/sessions/${activeSession.id}/finish`, {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${operatorToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ confirmation: false }),
      });

      const res = await finishSessionHandler(req, { params });
      expect(res.status).toBe(400);
    });

    it('should successfully finish session and calculate derived actual count', async () => {
      const [activeSession] = await db
        .select()
        .from(receivingSessions)
        .where(eq(receivingSessions.status, 'COUNTING'));

      expect(activeSession).toBeDefined();

      // Insert mock assigned sensor events for this session
      await db.insert(sensorEvents).values([
        {
          eventId: `TEST-EV-001-${Date.now()}`,
          bootId: 'test-session-finish-boot',
          deviceId: device1Id,
          lineId: activeSession.lineId,
          sequence: 900001,
          eventType: 'DETECTION',
          eventMode: 'PRODUCTION',
          assignmentStatus: 'ASSIGNED',
          sessionId: activeSession.id,
          deviceTime: new Date(),
          rawPayload: { test: true },
        },
        {
          eventId: `TEST-EV-002-${Date.now()}`,
          bootId: 'test-session-finish-boot',
          deviceId: device1Id,
          lineId: activeSession.lineId,
          sequence: 900002,
          eventType: 'DETECTION',
          eventMode: 'PRODUCTION',
          assignmentStatus: 'ASSIGNED',
          sessionId: activeSession.id,
          deviceTime: new Date(),
          rawPayload: { test: true },
        },
      ]);

      const params = Promise.resolve({ id: activeSession.id });
      const req = new NextRequest(`http://localhost:3000/api/sessions/${activeSession.id}/finish`, {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${operatorToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ confirmation: true }),
      });

      const res = await finishSessionHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.session.status).toBe('COMPLETED');
      expect(json.session.actual_count).toBeGreaterThanOrEqual(2);
      expect(json.session.difference_count).toBeDefined();

      // Verify receiving status is COMPLETED
      const [finishedRec] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.id, activeSession.receivingId));

      expect(finishedRec.status).toBe('COMPLETED');
      expect(finishedRec.reconciliationStatus).toBe(
        json.session.difference_count === 0 ? 'MATCHED' : 'REVIEW_REQUIRED'
      );

      // Verify audit log for SESSION_FINISH
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, activeSession.id));

      const finishLog = logs.find((l) => l.action === 'SESSION_FINISH');
      expect(finishLog).toBeDefined();
    });
  });

  describe('Session Cancel Flow', () => {
    it('should allow Admin to cancel an active session with reason', async () => {
      // Start another session first
      const waitingList = await db
        .select()
        .from(receivings)
        .where(eq(receivings.status, 'WAITING'));

      if (waitingList.length > 0) {
        const targetRec = waitingList[0];

        // Keep this legacy cancel-flow fixture aligned with the requested line.
        await db
          .update(receivings)
          .set({ lineId: line2Id })
          .where(eq(receivings.id, targetRec.id));

        // Complete any existing line 2 sessions
        await db
          .update(receivingSessions)
          .set({ status: 'COMPLETED' })
          .where(eq(receivingSessions.lineId, line2Id));

        const startReq = new NextRequest('http://localhost:3000/api/sessions/start', {
          method: 'POST',
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            receiving_id: targetRec.id,
            line_id: line2Id,
          }),
        });

        const startRes = await startSessionHandler(startReq);
        const startJson = await startRes.json();
        const sessionId = startJson.session.id;

        // Now cancel session
        const params = Promise.resolve({ id: sessionId });
        const cancelReq = new NextRequest(`http://localhost:3000/api/sessions/${sessionId}/cancel`, {
          method: 'POST',
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ reason: 'Salah penempatan jalur oleh operator' }),
        });

        const cancelRes = await cancelSessionHandler(cancelReq, { params });
        expect(cancelRes.status).toBe(200);

        const cancelJson = await cancelRes.json();
        expect(cancelJson.session.status).toBe('CANCELLED');
        expect(cancelJson.session.cancellation_reason).toBe('Salah penempatan jalur oleh operator');

        // Receiving should revert to WAITING
        const [revertedRec] = await db
          .select()
          .from(receivings)
          .where(eq(receivings.id, targetRec.id));

        expect(revertedRec.status).toBe('WAITING');
      }
    });
  });

  describe('Batch 9 concurrency and counting boundaries', () => {
    const sessionHeaders = (token: string) => ({
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
      'content-type': 'application/json',
    });

    async function createLine(status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' = 'ACTIVE') {
      const suffix = `${Date.now()}-${Math.random()}`;
      const [line] = await db.insert(lines).values({
        lineCode: `LINE-B9-${suffix}`,
        name: `Jalur Batch 9 ${suffix}`,
        status,
      }).returning();
      return line;
    }

    async function createReceiving(status: 'WAITING' | 'COUNTING', lineId: string | null) {
      const suffix = `${Date.now()}-${Math.random()}`;
      const [receiving] = await db.insert(receivings).values({
        receivingNumber: `REC-B9-${suffix}`,
        deliveryNoteNumber: `SJ-B9-${suffix}`,
        receivingDate: '2026-08-08',
        licensePlateSnapshot: 'B 9009 TST',
        driverNameSnapshot: 'Driver Batch 9',
        supplierNameSnapshot: 'Supplier Batch 9',
        manifestCount: 10,
        lineId,
        status,
        createdBy: adminUserId,
      }).returning();
      return receiving;
    }

    it('rejects a requested line that differs from the receiving line', async () => {
      const receiving = await createReceiving('WAITING', line1Id);
      const req = new NextRequest('http://localhost:3000/api/sessions/start', {
        method: 'POST',
        headers: sessionHeaders(adminToken),
        body: JSON.stringify({ receiving_id: receiving.id, line_id: line2Id }),
      });

      const res = await startSessionHandler(req);
      expect(res.status).toBe(409);
      expect((await res.json()).error.code).toBe('CONFLICT');
    });

    it.each(['INACTIVE', 'MAINTENANCE'] as const)(
      'rejects starting on a %s line',
      async (status) => {
        const line = await createLine(status);
        const receiving = await createReceiving('WAITING', line.id);
        const req = new NextRequest('http://localhost:3000/api/sessions/start', {
          method: 'POST',
          headers: sessionHeaders(adminToken),
          body: JSON.stringify({ receiving_id: receiving.id, line_id: line.id }),
        });

        const res = await startSessionHandler(req);
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('INVALID_STATUS');
      }
    );

    it('allows only one concurrent start for one receiving across two lines', async () => {
      const lineA = await createLine();
      const lineB = await createLine();
      const receiving = await createReceiving('WAITING', null);

      const makeRequest = (lineId: string) => new NextRequest('http://localhost:3000/api/sessions/start', {
        method: 'POST',
        headers: sessionHeaders(adminToken),
        body: JSON.stringify({ receiving_id: receiving.id, line_id: lineId }),
      });

      const responses = await Promise.all([
        startSessionHandler(makeRequest(lineA.id)),
        startSessionHandler(makeRequest(lineB.id)),
      ]);

      expect(responses.filter((res) => res.status === 201)).toHaveLength(1);
      expect(responses.filter((res) => res.status === 409)).toHaveLength(1);

      const activeSessions = await db
        .select()
        .from(receivingSessions)
        .where(
          and(
            eq(receivingSessions.receivingId, receiving.id),
            eq(receivingSessions.status, 'COUNTING')
          )
        );
      expect(activeSessions).toHaveLength(1);
    });

    it('allows only one concurrent finish and creates one reconciliation', async () => {
      const line = await createLine();
      const receiving = await createReceiving('COUNTING', line.id);
      const [session] = await db.insert(receivingSessions).values({
        receivingId: receiving.id,
        lineId: line.id,
        status: 'COUNTING',
        startedBy: adminUserId,
      }).returning();

      const makeRequest = () => new NextRequest(`http://localhost:3000/api/sessions/${session.id}/finish`, {
        method: 'POST',
        headers: sessionHeaders(adminToken),
        body: JSON.stringify({ confirmation: true }),
      });
      const params = Promise.resolve({ id: session.id });

      const responses = await Promise.all([
        finishSessionHandler(makeRequest(), { params }),
        finishSessionHandler(makeRequest(), { params }),
      ]);

      expect(responses.filter((res) => res.status === 200)).toHaveLength(1);
      expect(responses.filter((res) => res.status === 400 || res.status === 409)).toHaveLength(1);

      const reviews = await db
        .select()
        .from(reconciliationReviews)
        .where(eq(reconciliationReviews.sessionId, session.id));
      const finishLogs = (await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, session.id)))
        .filter((log) => log.action === 'SESSION_FINISH');
      expect(reviews).toHaveLength(1);
      expect(finishLogs).toHaveLength(1);
    });

    it('allows only one winner between concurrent finish and cancel', async () => {
      const line = await createLine();
      const receiving = await createReceiving('COUNTING', line.id);
      const [session] = await db.insert(receivingSessions).values({
        receivingId: receiving.id,
        lineId: line.id,
        status: 'COUNTING',
        startedBy: adminUserId,
      }).returning();
      const params = Promise.resolve({ id: session.id });

      const finishReq = new NextRequest(`http://localhost:3000/api/sessions/${session.id}/finish`, {
        method: 'POST',
        headers: sessionHeaders(adminToken),
        body: JSON.stringify({ confirmation: true }),
      });
      const cancelReq = new NextRequest(`http://localhost:3000/api/sessions/${session.id}/cancel`, {
        method: 'POST',
        headers: sessionHeaders(adminToken),
        body: JSON.stringify({ reason: 'Uji request bersamaan' }),
      });

      const responses = await Promise.all([
        finishSessionHandler(finishReq, { params }),
        cancelSessionHandler(cancelReq, { params }),
      ]);
      expect(responses.filter((res) => res.status === 200)).toHaveLength(1);

      const [savedSession] = await db
        .select()
        .from(receivingSessions)
        .where(eq(receivingSessions.id, session.id));
      expect(['COMPLETED', 'CANCELLED']).toContain(savedSession.status);

      const transitionLogs = (await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, session.id)))
        .filter((log) => log.action === 'SESSION_FINISH' || log.action === 'SESSION_CANCEL');
      expect(transitionLogs).toHaveLength(1);
    });

    it('serializes event ingestion with finish so the final count cannot miss an assigned event', async () => {
      const line = await createLine();
      const receiving = await createReceiving('COUNTING', line.id);
      const [session] = await db.insert(receivingSessions).values({
        receivingId: receiving.id,
        lineId: line.id,
        status: 'COUNTING',
        startedBy: adminUserId,
      }).returning();
      const deviceSecret = 'batch-9-device-secret';
      const [device] = await db.insert(devices).values({
        deviceCode: `ESP32-B9-${Date.now()}-${Math.random()}`,
        lineId: line.id,
        name: 'Perangkat Batch 9',
        credentialHash: await bcrypt.hash(deviceSecret, 4),
        status: 'ONLINE',
      }).returning();
      const eventId = `EVENT-B9-${Date.now()}-${Math.random()}`;
      const params = Promise.resolve({ id: session.id });

      const eventReq = new NextRequest('http://localhost:3000/api/device/events', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${deviceSecret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          device_id: device.deviceCode,
          line_id: line.lineCode,
          events: [{
            event_id: eventId,
            boot_id: `BOOT-B9-${Date.now()}`,
            sequence: 0,
            event_type: 'DETECTION',
            device_time: new Date().toISOString(),
            event_mode: 'PRODUCTION',
          }],
        }),
      });
      const finishReq = new NextRequest(`http://localhost:3000/api/sessions/${session.id}/finish`, {
        method: 'POST',
        headers: sessionHeaders(adminToken),
        body: JSON.stringify({ confirmation: true }),
      });

      const [eventRes, finishRes] = await Promise.all([
        deviceEventsHandler(eventReq),
        finishSessionHandler(finishReq, { params }),
      ]);
      expect(eventRes.status).toBe(200);
      expect(finishRes.status).toBe(200);

      const [savedEvent] = await db
        .select()
        .from(sensorEvents)
        .where(eq(sensorEvents.eventId, eventId));
      const [review] = await db
        .select()
        .from(reconciliationReviews)
        .where(eq(reconciliationReviews.sessionId, session.id));

      if (savedEvent.assignmentStatus === 'ASSIGNED') {
        expect(savedEvent.sessionId).toBe(session.id);
        expect(review.differenceCount).toBe(1 - receiving.manifestCount);
      } else {
        expect(savedEvent.assignmentStatus).toBe('UNASSIGNED');
        expect(savedEvent.sessionId).toBeNull();
        expect(review.differenceCount).toBe(0 - receiving.manifestCount);
      }
    });

    it('does not broadcast a finish event when the transaction rolls back', async () => {
      const line = await createLine();
      // Deliberately inconsistent state forces the guarded receiving update to
      // fail after the session update, proving the whole transaction rolls back.
      const receiving = await createReceiving('WAITING', line.id);
      const [session] = await db.insert(receivingSessions).values({
        receivingId: receiving.id,
        lineId: line.id,
        status: 'COUNTING',
        startedBy: adminUserId,
      }).returning();
      const receivedMessages: string[] = [];
      const unsubscribe = wsBroadcaster.subscribe((message) => receivedMessages.push(message.type));

      const req = new NextRequest(`http://localhost:3000/api/sessions/${session.id}/finish`, {
        method: 'POST',
        headers: sessionHeaders(adminToken),
        body: JSON.stringify({ confirmation: true }),
      });
      const res = await finishSessionHandler(req, { params: Promise.resolve({ id: session.id }) });
      unsubscribe();

      expect(res.status).toBe(409);
      expect(receivedMessages).not.toContain('session.finished');
      const [savedSession] = await db
        .select()
        .from(receivingSessions)
        .where(eq(receivingSessions.id, session.id));
      expect(savedSession.status).toBe('COUNTING');
    });
  });
});
