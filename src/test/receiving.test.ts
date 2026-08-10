import { describe, it, expect, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '../db/seed';
import { db } from '../db';
import { users, receivings, manifestRevisions, auditLogs } from '../db/schema';
import { signSessionToken, SESSION_COOKIE_NAME } from '../lib/auth';
import { eq } from 'drizzle-orm';
import * as auditModule from '../lib/audit';
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

  describe('Batch 12 Transactional Audit Logs & Rollbacks', () => {
    it('should rollback receiving creation if audit log creation fails', async () => {
      const deliveryNoteNumber = `SJ-FAIL-AUDIT-${Date.now()}`;
      const spy = vi.spyOn(auditModule, 'createAuditLog').mockImplementationOnce(() => {
        throw new Error('Database Audit Error');
      });

      const payload = {
        receiving_date: '2026-08-07',
        delivery_note_number: deliveryNoteNumber,
        license_plate_snapshot: 'B 1111 FAIL',
        driver_name_snapshot: 'Fail Driver',
        supplier_name_snapshot: 'Fail Supplier',
        manifest_count: 5000,
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
      expect(res.status).toBe(500);

      // Verify receiving was rolled back and not persisted
      const found = await db
        .select()
        .from(receivings)
        .where(eq(receivings.deliveryNoteNumber, deliveryNoteNumber));
      expect(found.length).toBe(0);

      spy.mockRestore();
    });

    it('should rollback manifest revision and receiving update atomically if audit log creation fails', async () => {
      const [waitingRec] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.status, 'WAITING'));

      expect(waitingRec).toBeDefined();
      const initialManifest = waitingRec.manifestCount;

      const spy = vi.spyOn(auditModule, 'createAuditLog').mockImplementationOnce(() => {
        throw new Error('Database Audit Error');
      });

      const params = Promise.resolve({ id: waitingRec.id });
      const patchReq = new NextRequest(`http://localhost:3000/api/receivings/${waitingRec.id}`, {
        method: 'PATCH',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          manifest_count: initialManifest + 999,
          reason: 'Koreksi yang seharusnya rollback jika audit gagal',
        }),
      });

      const res = await updateReceivingHandler(patchReq, { params });
      expect(res.status).toBe(500);

      // Verify manifest count was not updated
      const [recheckedRec] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.id, waitingRec.id));
      expect(recheckedRec.manifestCount).toBe(initialManifest);

      // Verify no manifest revision entry was saved for this change
      const revisions = await db
        .select()
        .from(manifestRevisions)
        .where(eq(manifestRevisions.receivingId, waitingRec.id));
      const failedRevision = revisions.find((r) => r.newManifestCount === initialManifest + 999);
      expect(failedRevision).toBeUndefined();

      spy.mockRestore();
    });

    it('should rollback publish action if audit log creation fails', async () => {
      // Create draft receiving
      const createReq = new NextRequest('http://localhost:3000/api/receivings', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          receiving_date: '2026-08-07',
          delivery_note_number: `SJ-PUB-FAIL-${Date.now()}`,
          license_plate_snapshot: 'B 2222 FAIL',
          driver_name_snapshot: 'Pub Fail Driver',
          supplier_name_snapshot: 'Pub Fail Supplier',
          manifest_count: 1500,
        }),
      });

      const createRes = await createReceivingHandler(createReq);
      const createJson = await createRes.json();
      const receivingId = createJson.receiving.id;

      const spy = vi.spyOn(auditModule, 'createAuditLog').mockImplementationOnce(() => {
        throw new Error('Database Audit Error');
      });

      const params = Promise.resolve({ id: receivingId });
      const pubReq = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}/publish`, {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
      });

      const pubRes = await publishReceivingHandler(pubReq, { params });
      expect(pubRes.status).toBe(500);

      // Verify status remains DRAFT
      const [recheckedRec] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.id, receivingId));
      expect(recheckedRec.status).toBe('DRAFT');

      spy.mockRestore();
    });

    it('should rollback cancel action if audit log creation fails', async () => {
      // Create draft receiving
      const createReq = new NextRequest('http://localhost:3000/api/receivings', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          receiving_date: '2026-08-07',
          delivery_note_number: `SJ-CAN-FAIL-${Date.now()}`,
          license_plate_snapshot: 'B 3333 FAIL',
          driver_name_snapshot: 'Cancel Fail Driver',
          supplier_name_snapshot: 'Cancel Fail Supplier',
          manifest_count: 2500,
        }),
      });

      const createRes = await createReceivingHandler(createReq);
      const createJson = await createRes.json();
      const receivingId = createJson.receiving.id;

      const spy = vi.spyOn(auditModule, 'createAuditLog').mockImplementationOnce(() => {
        throw new Error('Database Audit Error');
      });

      const params = Promise.resolve({ id: receivingId });
      const cancelReq = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}/cancel`, {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Pembatalan yang harus rollback' }),
      });

      const cancelRes = await cancelReceivingHandler(cancelReq, { params });
      expect(cancelRes.status).toBe(500);

      // Verify status remains DRAFT
      const [recheckedRec] = await db
        .select()
        .from(receivings)
        .where(eq(receivings.id, receivingId));
      expect(recheckedRec.status).toBe('DRAFT');

      spy.mockRestore();
    });

    it('should safely handle concurrent publish actions on the same receiving', async () => {
      const createReq = new NextRequest('http://localhost:3000/api/receivings', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          receiving_date: '2026-08-07',
          delivery_note_number: `SJ-PUB-CONCURRENT-${Date.now()}`,
          license_plate_snapshot: 'B 2222 FAIL',
          driver_name_snapshot: 'Pub Fail Driver',
          supplier_name_snapshot: 'Pub Fail Supplier',
          manifest_count: 1500,
        }),
      });
      const createRes = await createReceivingHandler(createReq);
      const receivingId = (await createRes.json()).receiving.id;

      // Two concurrent publishes
      const req1 = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}/publish`, {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      });
      const req2 = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}/publish`, {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      });

      const params = Promise.resolve({ id: receivingId });
      const [res1, res2] = await Promise.all([
        publishReceivingHandler(req1, { params }),
        publishReceivingHandler(req2, { params }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(400); // One fails due to INVALID_STATUS

      // Verify status is WAITING
      const [finalRec] = await db.select().from(receivings).where(eq(receivings.id, receivingId));
      expect(finalRec.status).toBe('WAITING');

      // Verify only one audit log
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, receivingId));
      const publishLogs = logs.filter(l => l.action === 'RECEIVING_PUBLISH');
      expect(publishLogs.length).toBe(1);
    });

    it('should safely handle concurrent cancel actions on the same receiving', async () => {
      const createReq = new NextRequest('http://localhost:3000/api/receivings', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          receiving_date: '2026-08-07',
          delivery_note_number: `SJ-CAN-CONCURRENT-${Date.now()}`,
          license_plate_snapshot: 'B 3333 FAIL',
          driver_name_snapshot: 'Cancel Fail Driver',
          supplier_name_snapshot: 'Cancel Fail Supplier',
          manifest_count: 2500,
        }),
      });
      const createRes = await createReceivingHandler(createReq);
      const receivingId = (await createRes.json()).receiving.id;

      // Two concurrent cancels
      const req1 = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}/cancel`, {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancel 1' }),
      });
      const req2 = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}/cancel`, {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancel 2' }),
      });

      const params = Promise.resolve({ id: receivingId });
      const [res1, res2] = await Promise.all([
        cancelReceivingHandler(req1, { params }),
        cancelReceivingHandler(req2, { params }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(400); // One fails due to INVALID_STATUS

      // Verify status is CANCELLED
      const [finalRec] = await db.select().from(receivings).where(eq(receivings.id, receivingId));
      expect(finalRec.status).toBe('CANCELLED');

      // Verify only one audit log
      const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, receivingId));
      const cancelLogs = logs.filter(l => l.action === 'RECEIVING_CANCEL');
      expect(cancelLogs.length).toBe(1);
    });

    it('should safely handle concurrent manifest revisions on the same receiving', async () => {
      // Setup: Create and Publish
      const createReq = new NextRequest('http://localhost:3000/api/receivings', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          receiving_date: '2026-08-07',
          delivery_note_number: `SJ-UPDATE-CONCURRENT-${Date.now()}`,
          license_plate_snapshot: 'B 4444 UPDATE',
          driver_name_snapshot: 'Driver',
          supplier_name_snapshot: 'Supplier',
          manifest_count: 1000,
        }),
      });
      const createRes = await createReceivingHandler(createReq);
      const receivingId = (await createRes.json()).receiving.id;

      const pubReq = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}/publish`, {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      });
      await publishReceivingHandler(pubReq, { params: Promise.resolve({ id: receivingId }) });

      // Two concurrent updates to manifest_count
      const req1 = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}`, {
        method: 'PATCH',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ manifest_count: 1100, reason: 'Revision 1' }),
      });
      const req2 = new NextRequest(`http://localhost:3000/api/receivings/${receivingId}`, {
        method: 'PATCH',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ manifest_count: 1200, reason: 'Revision 2' }),
      });

      const params = Promise.resolve({ id: receivingId });
      const [res1, res2] = await Promise.all([
        updateReceivingHandler(req1, { params }),
        updateReceivingHandler(req2, { params }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const [finalRec] = await db.select().from(receivings).where(eq(receivings.id, receivingId));
      expect([1100, 1200].includes(finalRec.manifestCount)).toBe(true);

      // Check manifest_revisions
      const revisions = await db.select().from(manifestRevisions).where(eq(manifestRevisions.receivingId, receivingId));
      expect(revisions.length).toBe(2);

      // We don't know which one executed first, but one must have old=1000 and new=the other's old
      const rev1 = revisions.find(r => r.oldManifestCount === 1000);
      expect(rev1).toBeDefined();

      const rev2 = revisions.find(r => r.oldManifestCount === rev1!.newManifestCount);
      expect(rev2).toBeDefined();
    });
  });
});
