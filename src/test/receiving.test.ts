import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '../db/seed';
import { db } from '../db';
import { users, receivings, manifestRevisions, auditLogs } from '../db/schema';
import { signSessionToken, SESSION_COOKIE_NAME } from '../lib/auth';
import { eq } from 'drizzle-orm';
import { GET as getReceivingsHandler, POST as createReceivingHandler } from '../app/api/receivings/route';
import { GET as getReceivingDetailHandler, PATCH as updateReceivingHandler } from '../app/api/receivings/[id]/route';
import { POST as publishReceivingHandler } from '../app/api/receivings/[id]/publish/route';
import { POST as cancelReceivingHandler } from '../app/api/receivings/[id]/cancel/route';

describe('Receiving Management (Batch 4)', () => {
  let adminToken: string;
  let operatorToken: string;
  let adminUserId: string;
  let operatorUserId: string;

  beforeAll(async () => {
    await runSeed();

    const [admin] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));
    const [operator] = await db.select().from(users).where(eq(users.email, 'operator@local.test'));

    adminUserId = admin.id;
    operatorUserId = operator.id;

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

  describe('Receiving Creation (Draft)', () => {
    it('should allow Admin to create a draft receiving', async () => {
      const payload = {
        receiving_date: '2026-08-07',
        delivery_note_number: 'SJ-TEST-001',
        license_plate_snapshot: 'B 1234 TEST',
        driver_name_snapshot: 'Driver Test',
        supplier_name_snapshot: 'Supplier Test',
        manifest_count: 4500,
        notes: 'Test draft receiving',
      };

      const req = new NextRequest('http://localhost:3000/api/receivings', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const res = await createReceivingHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.receiving).toBeDefined();
      expect(json.receiving.status).toBe('DRAFT');
      expect(json.receiving.deliveryNoteNumber).toBe('SJ-TEST-001');
      expect(json.receiving.manifestCount).toBe(4500);

      // Verify audit log
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, json.receiving.id));

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('RECEIVING_CREATE');
    });

    it('should reject creation with invalid/negative manifest count', async () => {
      const payload = {
        receiving_date: '2026-08-07',
        delivery_note_number: 'SJ-INVALID-001',
        license_plate_snapshot: 'B 9999 BAD',
        driver_name_snapshot: 'Bad Driver',
        supplier_name_snapshot: 'Bad Supplier',
        manifest_count: -100,
      };

      const req = new NextRequest('http://localhost:3000/api/receivings', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const res = await createReceivingHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Publish Receiving Action', () => {
    it('should allow Admin to publish DRAFT receiving to WAITING', async () => {
      // First create draft
      const createReq = new NextRequest('http://localhost:3000/api/receivings', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          receiving_date: '2026-08-07',
          delivery_note_number: 'SJ-PUB-001',
          license_plate_snapshot: 'B 7777 PUB',
          driver_name_snapshot: 'Publish Driver',
          supplier_name_snapshot: 'Publish Supplier',
          manifest_count: 3000,
        }),
      });

      const createRes = await createReceivingHandler(createReq);
      const createJson = await createRes.json();
      const receivingId = createJson.receiving.id;

      // Publish
      const params = Promise.resolve({ id: receivingId });
      const pubReq = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}/publish`, {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
      });

      const pubRes = await publishReceivingHandler(pubReq, { params });
      expect(pubRes.status).toBe(200);

      const pubJson = await pubRes.json();
      expect(pubJson.receiving.status).toBe('WAITING');
      expect(pubJson.receiving.publishedAt).not.toBeNull();

      // Verify audit log
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, receivingId));

      const publishLog = logs.find((l) => l.action === 'RECEIVING_PUBLISH');
      expect(publishLog).toBeDefined();
    });
  });

  describe('Manifest Revision on WAITING Receiving', () => {
    it('should require reason when changing manifest count of WAITING receiving', async () => {
      // Find a WAITING receiving from seed
      const [waitingRec] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.status, 'WAITING'));

      expect(waitingRec).toBeDefined();

      const params = Promise.resolve({ id: waitingRec.id });
      const patchReqNoReason = new NextRequest(`http://localhost:3000/api/receivings/${waitingRec.id}`, {
        method: 'PATCH',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          manifest_count: waitingRec.manifestCount + 500,
        }),
      });

      const resNoReason = await updateReceivingHandler(patchReqNoReason, { params });
      expect(resNoReason.status).toBe(400);

      const jsonNoReason = await resNoReason.json();
      expect(jsonNoReason.error.code).toBe('VALIDATION_ERROR');

      // Now supply reason
      const patchReqWithReason = new NextRequest(`http://localhost:3000/api/receivings/${waitingRec.id}`, {
        method: 'PATCH',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          manifest_count: waitingRec.manifestCount + 500,
          reason: 'Koreksi fisik surat jalan dari supplier',
        }),
      });

      const resWithReason = await updateReceivingHandler(patchReqWithReason, { params });
      expect(resWithReason.status).toBe(200);

      const jsonWithReason = await resWithReason.json();
      expect(jsonWithReason.receiving.manifestCount).toBe(waitingRec.manifestCount + 500);

      // Check manifest_revisions table record
      const revisions = await db
        .select()
        .from(manifestRevisions)
        .where(eq(manifestRevisions.receivingId, waitingRec.id));

      expect(revisions.length).toBeGreaterThan(0);
      expect(revisions[0].oldManifestCount).toBe(waitingRec.manifestCount);
      expect(revisions[0].newManifestCount).toBe(waitingRec.manifestCount + 500);
      expect(revisions[0].reason).toBe('Koreksi fisik surat jalan dari supplier');
      expect(revisions[0].changedBy).toBe(adminUserId);
    });
  });

  describe('Cancel Action', () => {
    it('should require reason and cancel a WAITING receiving', async () => {
      // Create draft and publish to waiting
      const createReq = new NextRequest('http://localhost:3000/api/receivings', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          receiving_date: '2026-08-07',
          delivery_note_number: 'SJ-CANCEL-001',
          license_plate_snapshot: 'B 8888 CAN',
          driver_name_snapshot: 'Cancel Driver',
          supplier_name_snapshot: 'Cancel Supplier',
          manifest_count: 2000,
        }),
      });

      const createRes = await createReceivingHandler(createReq);
      const createJson = await createRes.json();
      const receivingId = createJson.receiving.id;

      const params = Promise.resolve({ id: receivingId });

      // Cancel without reason
      const cancelReqNoReason = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}/cancel`, {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reason: '' }),
      });

      const resNoReason = await cancelReceivingHandler(cancelReqNoReason, { params });
      expect(resNoReason.status).toBe(400);

      // Cancel with reason
      const cancelReqWithReason = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}/cancel`, {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Truck pengiriman mengalami lakalantas' }),
      });

      const resWithReason = await cancelReceivingHandler(cancelReqWithReason, { params });
      expect(resWithReason.status).toBe(200);

      const jsonWithReason = await resWithReason.json();
      expect(jsonWithReason.receiving.status).toBe('CANCELLED');

      // Audit log check
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, receivingId));

      const cancelLog = logs.find((l) => l.action === 'RECEIVING_CANCEL');
      expect(cancelLog).toBeDefined();
      expect(cancelLog?.reason).toBe('Truck pengiriman mengalami lakalantas');
    });
  });

  describe('Operator Authorization Restrictions', () => {
    it('should allow Operator to view receivings list', async () => {
      const req = new NextRequest('http://localhost:3000/api/receivings', {
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${operatorToken}`,
        },
      });

      const res = await getReceivingsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.receivings).toBeDefined();
      expect(Array.isArray(json.receivings)).toBe(true);
    });

    it('should block Operator from creating receiving with 403 FORBIDDEN', async () => {
      const req = new NextRequest('http://localhost:3000/api/receivings', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${operatorToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          receiving_date: '2026-08-07',
          delivery_note_number: 'SJ-OP-FORBIDDEN',
          license_plate_snapshot: 'B 0000 FOR',
          driver_name_snapshot: 'Forbidden',
          supplier_name_snapshot: 'Forbidden',
          manifest_count: 1000,
        }),
      });

      const res = await createReceivingHandler(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('should block Operator from publishing receiving with 403 FORBIDDEN', async () => {
      const [draftRec] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.status, 'DRAFT'));

      if (draftRec) {
        const params = Promise.resolve({ id: draftRec.id });
        const req = new NextRequest(`http://localhost:3000/api/receivings/${draftRec.id}/publish`, {
          method: 'POST',
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${operatorToken}`,
          },
        });

        const res = await publishReceivingHandler(req, { params });
        expect(res.status).toBe(403);
      }
    });

    it('should block Operator from updating receiving with 403 FORBIDDEN', async () => {
      const [waitingRec] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.status, 'WAITING'));

      if (waitingRec) {
        const params = Promise.resolve({ id: waitingRec.id });
        const req = new NextRequest(`http://localhost:3000/api/receivings/${waitingRec.id}`, {
          method: 'PATCH',
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${operatorToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ notes: 'Operator edit attempt' }),
        });

        const res = await updateReceivingHandler(req, { params });
        expect(res.status).toBe(403);
      }
    });
  });
});
