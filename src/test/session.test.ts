import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '../db/seed';
import { db } from '../db';
import { users, receivings, receivingSessions, lines, devices, sensorEvents, auditLogs } from '../db/schema';
import { signSessionToken, SESSION_COOKIE_NAME } from '../lib/auth';
import { eq } from 'drizzle-orm';
import { POST as startSessionHandler } from '../app/api/sessions/start/route';
import { POST as finishSessionHandler } from '../app/api/sessions/[id]/finish/route';
import { POST as cancelSessionHandler } from '../app/api/sessions/[id]/cancel/route';
import { GET as getActiveSessionHandler } from '../app/api/lines/[id]/active-session/route';

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
          deviceId: device1Id,
          lineId: activeSession.lineId,
          sequence: Math.floor(Math.random() * 100000),
          eventType: 'DETECTION',
          eventMode: 'PRODUCTION',
          assignmentStatus: 'ASSIGNED',
          sessionId: activeSession.id,
          deviceTime: new Date(),
          rawPayload: { test: true },
        },
        {
          eventId: `TEST-EV-002-${Date.now()}`,
          deviceId: device1Id,
          lineId: activeSession.lineId,
          sequence: Math.floor(Math.random() * 100000) + 1,
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
});
