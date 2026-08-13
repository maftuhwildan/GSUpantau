import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { runSeed } from '@/db/seed';
import { users, receivings } from '@/db/schema';
import { GET as getOperatorDashboard } from '@/app/api/dashboard/operator/route';
import { GET as getSensorEvents } from '@/app/api/sensor-events/route';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

function createReq(urlPath: string, cookieValue?: string) {
  const fullUrl = urlPath.startsWith('http') ? urlPath.replace(':3000', '') : `http://localhost${urlPath}`;
  const req = new NextRequest(fullUrl, {
    headers: cookieValue ? { cookie: cookieValue } : {},
  });
  return req;
}

describe('Operator UI Refinement & API Specification', () => {
  let operatorCookie: string;
  let adminCookie: string;
  let line1Id: string;
  let line2Id: string;

  beforeAll(async () => {
    await runSeed();

    const [opUser] = await db.select().from(users).where(eq(users.email, 'operator@local.test'));
    const [adminUser] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));
    const allLines = await db.query.lines.findMany();

    if (!opUser || !adminUser || allLines.length < 2) {
      throw new Error('Seed data required for testing operator UI refinement');
    }

    line1Id = allLines[0].id;
    line2Id = allLines[1].id;

    const opToken = await signSessionToken({
      userId: opUser.id,
      email: opUser.email,
      name: opUser.name,
      roles: ['OPERATOR'],
      expiresAt: Date.now() + 3600 * 1000,
    });
    operatorCookie = `${SESSION_COOKIE_NAME}=${opToken}`;

    const adminToken = await signSessionToken({
      userId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      roles: ['ADMIN'],
      expiresAt: Date.now() + 3600 * 1000,
    });
    adminCookie = `${SESSION_COOKIE_NAME}=${adminToken}`;
  });

  describe('GET /api/dashboard/operator', () => {
    it('scopes Operator to assigned line and returns 403 when requesting line2', async () => {
      const [opUser] = await db.select().from(users).where(eq(users.email, 'operator@local.test'));
      const assignedLineId = opUser?.assignedLineId || line1Id;
      const otherLineId = assignedLineId === line1Id ? line2Id : line1Id;

      const reqForbidden = createReq(`/api/dashboard/operator?line_id=${otherLineId}`, operatorCookie);
      const resForbidden = await getOperatorDashboard(reqForbidden);
      expect(resForbidden.status).toBe(403);
    });

    it('returns waitingQueueCount as total waiting count while waitingQueue is max 5 items', async () => {
      const [opUser] = await db.select().from(users).where(eq(users.email, 'operator@local.test'));
      const targetLineId = opUser?.assignedLineId || line1Id;

      // Insert 7 WAITING receivings for targetLineId
      for (let i = 1; i <= 7; i++) {
        await db.insert(receivings).values({
          receivingNumber: `RCV-TEST-WQ-${i}`,
          deliveryNoteNumber: `SJ-TEST-WQ-${i}`,
          receivingDate: '2026-08-13',
          manifestCount: 1000 + i,
          lineId: targetLineId,
          status: 'WAITING',
          licensePlateSnapshot: `B ${1000 + i} WQ`,
          supplierNameSnapshot: 'Farm Test',
          driverNameSnapshot: 'Driver Test',
          queuePosition: i + 10,
        });
      }

      const req = createReq(`/api/dashboard/operator?line_id=${targetLineId}`, operatorCookie);
      const res = await getOperatorDashboard(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.waitingQueue.length).toBeLessThanOrEqual(5);
      expect(json.waitingQueueCount).toBeGreaterThanOrEqual(7);
    });
  });

  describe('GET /api/sensor-events validation and filters', () => {
    it('returns HTTP 400 when invalid event_type is provided', async () => {
      const req = createReq('/api/sensor-events?event_type=INVALID_TYPE', adminCookie);
      const res = await getSensorEvents(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('event_type');
    });

    it('returns HTTP 400 when invalid assignment_status is provided', async () => {
      const req = createReq('/api/sensor-events?assignment_status=INVALID_STATUS', adminCookie);
      const res = await getSensorEvents(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('assignment_status');
    });

    it('filters correctly by valid event_type and assignment_status', async () => {
      const reqDetection = createReq('/api/sensor-events?event_type=DETECTION&assignment_status=ASSIGNED', adminCookie);
      const resDetection = await getSensorEvents(reqDetection);
      expect(resDetection.status).toBe(200);

      const json = await resDetection.json();
      expect(Array.isArray(json.events)).toBe(true);
      for (const evt of json.events) {
        expect(evt.eventType).toBe('DETECTION');
        expect(evt.assignmentStatus).toBe('ASSIGNED');
      }
    });

    it('prevents Operator from reading sensor events of another line', async () => {
      const [opUser] = await db.select().from(users).where(eq(users.email, 'operator@local.test'));
      const assignedLineId = opUser?.assignedLineId || line1Id;
      const otherLineId = assignedLineId === line1Id ? line2Id : line1Id;

      const req = createReq(`/api/sensor-events?line_id=${otherLineId}`, operatorCookie);
      const res = await getSensorEvents(req);
      expect(res.status).toBe(403);
    });
  });

  describe('UI Composition Invariants (Source Code Validation)', () => {
    it('Dashboard UI source calls StartCountingDialog and never direct start API', () => {
      const filePath = path.join(process.cwd(), 'src/app/(operator)/dashboard/page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('StartCountingDialog');
      expect(content).not.toMatch(/fetch\(.*\/api\/sessions\/start/);
    });

    it('Active Session UI source points empty state to /receiving-queue and renders LoadingState', () => {
      const filePath = path.join(process.cwd(), 'src/app/(operator)/active-session/page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('/receiving-queue');
      expect(content).not.toContain('/operator/receiving-queue');
      expect(content).toContain('LoadingState');
    });
  });
});
