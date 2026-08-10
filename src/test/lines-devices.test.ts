/**
 * lines-devices.test.ts
 *
 * Business invariant tests for Batch 17: Lines and Devices Management
 * Tests: line CRUD, device registration, credential rotation, safety guards.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { runSeed } from '../db/seed';
import { db } from '../db';
import {
  users,
  lines,
  devices,
  receivings,
  receivingSessions,
  auditLogs,
} from '../db/schema';
import { signSessionToken, SESSION_COOKIE_NAME } from '../lib/auth';
import { eq, and, desc } from 'drizzle-orm';

// Route handlers under test
import { GET as getLinesHandler, POST as createLineHandler } from '../app/api/lines/route';
import {
  GET as getLineHandler,
  PATCH as updateLineHandler,
} from '../app/api/lines/[id]/route';
import { GET as getDevicesHandler, POST as createDeviceHandler } from '../app/api/devices/route';
import {
  GET as getDeviceHandler,
  PATCH as updateDeviceHandler,
} from '../app/api/devices/[id]/route';
import { POST as rotateCredentialHandler } from '../app/api/devices/[id]/rotate-credential/route';
import { POST as startSessionHandler } from '../app/api/sessions/start/route';
import { POST as deviceHeartbeatHandler } from '../app/api/device/heartbeat/route';


// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(
  url: string,
  method: 'GET' | 'POST' | 'PATCH',
  token: string,
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Lines and Devices Management (Batch 17)', () => {
  let adminToken: string;
  let operatorToken: string;
  let adminUserId: string;

  // IDs created in tests for later reuse
  let lineId: string;
  let lineCode: string;
  let deviceId: string;
  let deviceSecret: string;

  beforeAll(async () => {
    await runSeed();

    const [admin] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));
    const [operator] = await db.select().from(users).where(eq(users.email, 'operator@local.test'));

    adminUserId = admin.id;

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

  // ─────────────────────────────────────────────────────────────────────────
  // LINES
  // ─────────────────────────────────────────────────────────────────────────

  describe('Lines', () => {
    describe('GET /api/lines', () => {
      it('admin can list lines', async () => {
        const req = makeRequest('http://localhost/api/lines', 'GET', adminToken);
        const res = await getLinesHandler(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(Array.isArray(json.lines)).toBe(true);
      });

      it('unauthenticated is rejected (401)', async () => {
        const req = new NextRequest('http://localhost/api/lines', { method: 'GET' });
        const res = await getLinesHandler(req);
        expect(res.status).toBe(401);
      });
    });

    describe('POST /api/lines', () => {
      it('operator is rejected (403)', async () => {
        const req = makeRequest('http://localhost/api/lines', 'POST', operatorToken, {
          lineCode: 'LINE-OPR',
          name: 'Coba Operator',
        });
        const res = await createLineHandler(req);
        expect(res.status).toBe(403);
      });

      it('unauthenticated is rejected (401)', async () => {
        const req = new NextRequest('http://localhost/api/lines', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lineCode: 'LINE-ANON', name: 'Anon' }),
        });
        const res = await createLineHandler(req);
        expect(res.status).toBe(401);
      });

      it('admin can create a line', async () => {
        const code = `LINE-B17-${Date.now()}`;
        const req = makeRequest('http://localhost/api/lines', 'POST', adminToken, {
          lineCode: code,
          name: 'Jalur Batch 17',
        });
        const res = await createLineHandler(req);
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.line).toBeDefined();
        expect(json.line.lineCode).toBe(code.toUpperCase().trim());
        expect(json.line.status).toBe('ACTIVE');
        lineId = json.line.id;
        lineCode = json.line.lineCode;
      });

      it('creates an audit log for line creation', async () => {
        expect(lineId).toBeDefined();
        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.entityId, lineId));
        expect(logs.length).toBeGreaterThanOrEqual(1);
        expect(logs[0].action).toBe('CREATE_LINE');
        expect(logs[0].entityType).toBe('line');
        expect(logs[0].actorId).toBe(adminUserId);
      });

      it('rejects duplicate lineCode (409)', async () => {
        const req = makeRequest('http://localhost/api/lines', 'POST', adminToken, {
          lineCode: lineCode,
          name: 'Duplikat',
        });
        const res = await createLineHandler(req);
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe('CONFLICT');
      });

      it('rejects missing lineCode (400)', async () => {
        const req = makeRequest('http://localhost/api/lines', 'POST', adminToken, {
          name: 'No Code',
        });
        const res = await createLineHandler(req);
        expect(res.status).toBe(400);
      });

      it('rejects missing name (400)', async () => {
        const req = makeRequest('http://localhost/api/lines', 'POST', adminToken, {
          lineCode: `LINE-NONAME-${Date.now()}`,
        });
        const res = await createLineHandler(req);
        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/lines/[id]', () => {
      it('admin can get a specific line', async () => {
        const req = makeRequest(`http://localhost/api/lines/${lineId}`, 'GET', adminToken);
        const res = await getLineHandler(req, { params: Promise.resolve({ id: lineId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.line.id).toBe(lineId);
      });

      it('returns 404 for non-existent line', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const req = makeRequest(`http://localhost/api/lines/${fakeId}`, 'GET', adminToken);
        const res = await getLineHandler(req, { params: Promise.resolve({ id: fakeId }) });
        expect(res.status).toBe(404);
      });

      it('operator is rejected (403)', async () => {
        const req = makeRequest(`http://localhost/api/lines/${lineId}`, 'GET', operatorToken);
        const res = await getLineHandler(req, { params: Promise.resolve({ id: lineId }) });
        expect(res.status).toBe(403);
      });
    });

    describe('PATCH /api/lines/[id]', () => {
      it('operator is rejected (403)', async () => {
        const req = makeRequest(`http://localhost/api/lines/${lineId}`, 'PATCH', operatorToken, {
          name: 'Coba Operator',
        });
        const res = await updateLineHandler(req, { params: Promise.resolve({ id: lineId }) });
        expect(res.status).toBe(403);
      });

      it('admin can update line name', async () => {
        const req = makeRequest(`http://localhost/api/lines/${lineId}`, 'PATCH', adminToken, {
          name: 'Jalur Diperbarui',
        });
        const res = await updateLineHandler(req, { params: Promise.resolve({ id: lineId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.line.name).toBe('Jalur Diperbarui');
      });

      it('admin can set line to MAINTENANCE', async () => {
        const req = makeRequest(`http://localhost/api/lines/${lineId}`, 'PATCH', adminToken, {
          status: 'MAINTENANCE',
        });
        const res = await updateLineHandler(req, { params: Promise.resolve({ id: lineId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.line.status).toBe('MAINTENANCE');

        // Restore to ACTIVE for subsequent tests
        await db
          .update(lines)
          .set({ status: 'ACTIVE', updatedAt: new Date() })
          .where(eq(lines.id, lineId));
      });

      it('creates an audit log on update', async () => {
        const req = makeRequest(`http://localhost/api/lines/${lineId}`, 'PATCH', adminToken, {
          name: 'Jalur Diupdate Log',
        });
        await updateLineHandler(req, { params: Promise.resolve({ id: lineId }) });

        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.entityId, lineId));
        const updateLogs = logs.filter((l) => l.action === 'UPDATE_LINE');
        expect(updateLogs.length).toBeGreaterThanOrEqual(1);
        expect(updateLogs[0].entityType).toBe('line');
      });

      it('rejects deactivation when counting session is active on line', async () => {
        // Create a fresh line
        const code = `LINE-GUARD-${Date.now()}`;
        const [guardLine] = await db
          .insert(lines)
          .values({ lineCode: code, name: 'Guard Line', status: 'ACTIVE' })
          .returning();

        // Get admin user for session
        const [admin] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));

        // Create an active counting session on that line
        const [receiving] = await db
          .insert(receivings)
          .values({
            receivingNumber: `RCV-GUARD-${Date.now()}`,
            deliveryNoteNumber: `SJ-GUARD-${Date.now()}`,
            receivingDate: '2026-08-10',
            licensePlateSnapshot: 'B 9999 GRD',
            driverNameSnapshot: 'Guard Driver',
            supplierNameSnapshot: 'Guard Supplier',
            manifestCount: 100,
            lineId: guardLine.id,
            status: 'COUNTING',
            createdBy: admin.id,
          })
          .returning();

        await db.insert(receivingSessions).values({
          receivingId: receiving.id,
          lineId: guardLine.id,
          status: 'COUNTING',
          startedBy: admin.id,
        });

        // Try to deactivate the line → should be rejected
        const req = makeRequest(
          `http://localhost/api/lines/${guardLine.id}`,
          'PATCH',
          adminToken,
          { status: 'INACTIVE' }
        );
        const res = await updateLineHandler(req, {
          params: Promise.resolve({ id: guardLine.id }),
        });
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe('CONFLICT');

        // Cleanup
        await db
          .update(receivingSessions)
          .set({ status: 'CANCELLED' })
          .where(eq(receivingSessions.lineId, guardLine.id));
        await db
          .update(receivings)
          .set({ status: 'CANCELLED' })
          .where(eq(receivings.id, receiving.id));
      });

      it('rejects maintenance switch when counting session is active', async () => {
        // Create another fresh line with active session
        const code = `LINE-MNT-${Date.now()}`;
        const [mntLine] = await db
          .insert(lines)
          .values({ lineCode: code, name: 'Maintenance Guard Line', status: 'ACTIVE' })
          .returning();

        const [admin] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));

        const [receiving] = await db
          .insert(receivings)
          .values({
            receivingNumber: `RCV-MNT-${Date.now()}`,
            deliveryNoteNumber: `SJ-MNT-${Date.now()}`,
            receivingDate: '2026-08-10',
            licensePlateSnapshot: 'B 8888 MNT',
            driverNameSnapshot: 'Mnt Driver',
            supplierNameSnapshot: 'Mnt Supplier',
            manifestCount: 50,
            lineId: mntLine.id,
            status: 'COUNTING',
            createdBy: admin.id,
          })
          .returning();

        await db.insert(receivingSessions).values({
          receivingId: receiving.id,
          lineId: mntLine.id,
          status: 'COUNTING',
          startedBy: admin.id,
        });

        const req = makeRequest(
          `http://localhost/api/lines/${mntLine.id}`,
          'PATCH',
          adminToken,
          { status: 'MAINTENANCE' }
        );
        const res = await updateLineHandler(req, {
          params: Promise.resolve({ id: mntLine.id }),
        });
        expect(res.status).toBe(409);

        // Cleanup
        await db
          .update(receivingSessions)
          .set({ status: 'CANCELLED' })
          .where(eq(receivingSessions.lineId, mntLine.id));
        await db
          .update(receivings)
          .set({ status: 'CANCELLED' })
          .where(eq(receivings.id, receiving.id));
      });

      it('allows deactivation when no active session exists', async () => {
        const code = `LINE-SAFE-${Date.now()}`;
        const [safeLine] = await db
          .insert(lines)
          .values({ lineCode: code, name: 'Safe Line', status: 'ACTIVE' })
          .returning();

        const req = makeRequest(
          `http://localhost/api/lines/${safeLine.id}`,
          'PATCH',
          adminToken,
          { status: 'INACTIVE' }
        );
        const res = await updateLineHandler(req, {
          params: Promise.resolve({ id: safeLine.id }),
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.line.status).toBe('INACTIVE');
      });

      it('stores audit reason when provided during line update', async () => {
        const req = makeRequest(`http://localhost/api/lines/${lineId}`, 'PATCH', adminToken, {
          name: 'Jalur Dengan Alasan',
          reason: 'Perbaikan sensor fisik',
        });
        const res = await updateLineHandler(req, { params: Promise.resolve({ id: lineId }) });
        expect(res.status).toBe(200);

        const logs = await db
          .select()
          .from(auditLogs)
          .where(and(eq(auditLogs.entityId, lineId), eq(auditLogs.action, 'UPDATE_LINE')))
          .orderBy(desc(auditLogs.createdAt));

        expect(logs[0].reason).toBe('Perbaikan sensor fisik');
      });

      it('handles concurrent line deactivation and session start safely without violating line status invariants', async () => {
        const code = `LINE-CONC-${Date.now()}`;
        const [concLine] = await db
          .insert(lines)
          .values({ lineCode: code, name: 'Conc Line', status: 'ACTIVE' })
          .returning();
        const [admin] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));
        const [receiving] = await db
          .insert(receivings)
          .values({
            receivingNumber: `RCV-CONC-${Date.now()}`,
            deliveryNoteNumber: `SJ-CONC-${Date.now()}`,
            receivingDate: '2026-08-10',
            licensePlateSnapshot: 'B 1111 CNC',
            driverNameSnapshot: 'Conc Driver',
            supplierNameSnapshot: 'Conc Supplier',
            manifestCount: 100,
            lineId: concLine.id,
            status: 'WAITING',
            createdBy: admin.id,
          })
          .returning();

        const patchReq = makeRequest(
          `http://localhost/api/lines/${concLine.id}`,
          'PATCH',
          adminToken,
          { status: 'INACTIVE' }
        );
        const startReq = makeRequest(
          'http://localhost/api/sessions/start',
          'POST',
          adminToken,
          { receiving_id: receiving.id, line_id: concLine.id }
        );

        const [patchRes, startRes] = await Promise.all([
          updateLineHandler(patchReq, { params: Promise.resolve({ id: concLine.id }) }),
          startSessionHandler(startReq),
        ]);

        const statuses = [patchRes.status, startRes.status];
        // Either patch succeeds (200) and start fails (400/409), or start succeeds (201) and patch fails (409)
        if (patchRes.status === 200) {
          expect([400, 409]).toContain(startRes.status);
        } else {
          expect(patchRes.status).toBe(409);
          expect(startRes.status).toBe(201);
        }
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DEVICES
  // ─────────────────────────────────────────────────────────────────────────

  describe('Devices', () => {
    describe('GET /api/devices', () => {
      it('admin can list devices', async () => {
        const req = makeRequest('http://localhost/api/devices', 'GET', adminToken);
        const res = await getDevicesHandler(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(Array.isArray(json.devices)).toBe(true);
      });

      it('operator is rejected (403)', async () => {
        const req = makeRequest('http://localhost/api/devices', 'GET', operatorToken);
        const res = await getDevicesHandler(req);
        expect(res.status).toBe(403);
      });

      it('credential_hash is never exposed in list response', async () => {
        const req = makeRequest('http://localhost/api/devices', 'GET', adminToken);
        const res = await getDevicesHandler(req);
        const json = await res.json();
        for (const device of json.devices) {
          expect(device).not.toHaveProperty('credentialHash');
          expect(device).not.toHaveProperty('credential_hash');
        }
      });
    });

    describe('POST /api/devices', () => {
      it('operator is rejected (403)', async () => {
        const req = makeRequest('http://localhost/api/devices', 'POST', operatorToken, {
          deviceCode: 'ESP-OPR',
          lineId: lineId,
          name: 'Operator Device',
        });
        const res = await createDeviceHandler(req);
        expect(res.status).toBe(403);
      });

      it('rejects registration with non-existent lineId (404)', async () => {
        const req = makeRequest('http://localhost/api/devices', 'POST', adminToken, {
          deviceCode: `ESP-NO-LINE-${Date.now()}`,
          lineId: '00000000-0000-0000-0000-000000000000',
          name: 'Device No Line',
        });
        const res = await createDeviceHandler(req);
        expect(res.status).toBe(404);
      });

      it('admin can register a device and receives secret once', async () => {
        const code = `ESP-B17-${Date.now()}`;
        const req = makeRequest('http://localhost/api/devices', 'POST', adminToken, {
          deviceCode: code,
          lineId: lineId,
          name: 'Perangkat Batch 17',
        });
        const res = await createDeviceHandler(req);
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.device).toBeDefined();
        expect(json.device.deviceCode).toBe(code.toUpperCase().trim());
        expect(json.device.status).toBe('UNREGISTERED');
        expect(typeof json.secret).toBe('string');
        expect(json.secret.length).toBeGreaterThan(0);
        deviceId = json.device.id;
        deviceSecret = json.secret;
      });

      it('credential_hash is never exposed in create response', async () => {
        const code = `ESP-NO-HASH-${Date.now()}`;
        const req = makeRequest('http://localhost/api/devices', 'POST', adminToken, {
          deviceCode: code,
          lineId: lineId,
          name: 'Hash Test Device',
        });
        const res = await createDeviceHandler(req);
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.device).not.toHaveProperty('credentialHash');
        expect(json.device).not.toHaveProperty('credential_hash');
      });

      it('stored secret hash can be verified with the plaintext once returned', async () => {
        expect(deviceId).toBeDefined();
        expect(deviceSecret).toBeDefined();
        const [stored] = await db
          .select()
          .from(devices)
          .where(eq(devices.id, deviceId));
        expect(stored.credentialHash).toBeDefined();
        // Stored hash must match plaintext via bcrypt
        const isMatch = await bcrypt.compare(deviceSecret, stored.credentialHash);
        expect(isMatch).toBe(true);
      });

      it('creates an audit log for device registration (no credential_hash in log)', async () => {
        expect(deviceId).toBeDefined();
        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.entityId, deviceId));
        const registerLogs = logs.filter((l) => l.action === 'REGISTER_DEVICE');
        expect(registerLogs.length).toBeGreaterThanOrEqual(1);
        expect(registerLogs[0].entityType).toBe('device');
        expect(registerLogs[0].actorId).toBe(adminUserId);
        // Audit data must not contain credentialHash
        const afterStr = JSON.stringify(registerLogs[0].afterData);
        expect(afterStr).not.toContain('credentialHash');
        expect(afterStr).not.toContain('credential_hash');
      });

      it('rejects duplicate deviceCode (409)', async () => {
        expect(deviceId).toBeDefined();
        const [existing] = await db.select().from(devices).where(eq(devices.id, deviceId));
        const req = makeRequest('http://localhost/api/devices', 'POST', adminToken, {
          deviceCode: existing.deviceCode,
          lineId: lineId,
          name: 'Duplikat',
        });
        const res = await createDeviceHandler(req);
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe('CONFLICT');
      });

      it('rejects missing deviceCode (400)', async () => {
        const req = makeRequest('http://localhost/api/devices', 'POST', adminToken, {
          lineId: lineId,
          name: 'No Code Device',
        });
        const res = await createDeviceHandler(req);
        expect(res.status).toBe(400);
      });

      it('rejects missing lineId (400)', async () => {
        const req = makeRequest('http://localhost/api/devices', 'POST', adminToken, {
          deviceCode: `ESP-NO-LID-${Date.now()}`,
          name: 'No Line Device',
        });
        const res = await createDeviceHandler(req);
        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/devices/[id]', () => {
      it('admin can get a specific device', async () => {
        expect(deviceId).toBeDefined();
        const req = makeRequest(`http://localhost/api/devices/${deviceId}`, 'GET', adminToken);
        const res = await getDeviceHandler(req, { params: Promise.resolve({ id: deviceId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.device.id).toBe(deviceId);
      });

      it('credential_hash is not exposed in single device GET', async () => {
        const req = makeRequest(`http://localhost/api/devices/${deviceId}`, 'GET', adminToken);
        const res = await getDeviceHandler(req, { params: Promise.resolve({ id: deviceId }) });
        const json = await res.json();
        expect(json.device).not.toHaveProperty('credentialHash');
      });

      it('operator is rejected (403)', async () => {
        const req = makeRequest(`http://localhost/api/devices/${deviceId}`, 'GET', operatorToken);
        const res = await getDeviceHandler(req, { params: Promise.resolve({ id: deviceId }) });
        expect(res.status).toBe(403);
      });

      it('returns 404 for non-existent device', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const req = makeRequest(`http://localhost/api/devices/${fakeId}`, 'GET', adminToken);
        const res = await getDeviceHandler(req, { params: Promise.resolve({ id: fakeId }) });
        expect(res.status).toBe(404);
      });
    });

    describe('PATCH /api/devices/[id]', () => {
      it('operator is rejected (403)', async () => {
        const req = makeRequest(`http://localhost/api/devices/${deviceId}`, 'PATCH', operatorToken, {
          name: 'Coba Operator',
        });
        const res = await updateDeviceHandler(req, { params: Promise.resolve({ id: deviceId }) });
        expect(res.status).toBe(403);
      });

      it('admin can update device name', async () => {
        const req = makeRequest(`http://localhost/api/devices/${deviceId}`, 'PATCH', adminToken, {
          name: 'Perangkat Diperbarui',
        });
        const res = await updateDeviceHandler(req, { params: Promise.resolve({ id: deviceId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.device.name).toBe('Perangkat Diperbarui');
      });

      it('admin can set device to MAINTENANCE', async () => {
        const req = makeRequest(`http://localhost/api/devices/${deviceId}`, 'PATCH', adminToken, {
          status: 'MAINTENANCE',
        });
        const res = await updateDeviceHandler(req, { params: Promise.resolve({ id: deviceId }) });
        expect(res.status).toBe(200);
        const json = await res.json();
        // Effective status should remain MAINTENANCE regardless of heartbeat
        expect(json.device.status).toBe('MAINTENANCE');
      });

      it('creates an audit log on device update', async () => {
        await updateDeviceHandler(
          makeRequest(`http://localhost/api/devices/${deviceId}`, 'PATCH', adminToken, {
            name: 'Log Test Device',
          }),
          { params: Promise.resolve({ id: deviceId }) }
        );

        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.entityId, deviceId));
        const updateLogs = logs.filter((l) => l.action === 'UPDATE_DEVICE');
        expect(updateLogs.length).toBeGreaterThanOrEqual(1);
        // Audit log must not expose credential_hash
        for (const log of updateLogs) {
          expect(JSON.stringify(log.beforeData)).not.toContain('credentialHash');
          expect(JSON.stringify(log.afterData)).not.toContain('credentialHash');
        }
      });

      it('rejects line reassignment when current line has active counting session', async () => {
        // Create a new line and a device on that line
        const code = `LINE-REASN-${Date.now()}`;
        const [activeLine] = await db
          .insert(lines)
          .values({ lineCode: code, name: 'Active Counting Line', status: 'ACTIVE' })
          .returning();

        const [admin] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));

        // Create device on activeLine
        const [movableDevice] = await db
          .insert(devices)
          .values({
            deviceCode: `ESP-REASN-${Date.now()}`,
            lineId: activeLine.id,
            name: 'Movable Device',
            credentialHash: await bcrypt.hash('test-secret', 4),
            status: 'ONLINE',
          })
          .returning();

        // Set up active session on activeLine
        const [receiving] = await db
          .insert(receivings)
          .values({
            receivingNumber: `RCV-REASN-${Date.now()}`,
            deliveryNoteNumber: `SJ-REASN-${Date.now()}`,
            receivingDate: '2026-08-10',
            licensePlateSnapshot: 'B 7777 RSN',
            driverNameSnapshot: 'Reasn Driver',
            supplierNameSnapshot: 'Reasn Supplier',
            manifestCount: 100,
            lineId: activeLine.id,
            status: 'COUNTING',
            createdBy: admin.id,
          })
          .returning();

        await db.insert(receivingSessions).values({
          receivingId: receiving.id,
          lineId: activeLine.id,
          status: 'COUNTING',
          startedBy: admin.id,
        });

        // Create target line
        const targetCode = `LINE-TGTRSN-${Date.now()}`;
        const [targetLine] = await db
          .insert(lines)
          .values({ lineCode: targetCode, name: 'Target Line', status: 'ACTIVE' })
          .returning();

        // Attempt reassignment → must be rejected
        const req = makeRequest(
          `http://localhost/api/devices/${movableDevice.id}`,
          'PATCH',
          adminToken,
          { lineId: targetLine.id }
        );
        const res = await updateDeviceHandler(req, {
          params: Promise.resolve({ id: movableDevice.id }),
        });
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.code).toBe('CONFLICT');

        // Cleanup
        await db
          .update(receivingSessions)
          .set({ status: 'CANCELLED' })
          .where(eq(receivingSessions.lineId, activeLine.id));
        await db
          .update(receivings)
          .set({ status: 'CANCELLED' })
          .where(eq(receivings.id, receiving.id));
      });

      it('allows line reassignment when no active session exists', async () => {
        // Create two idle lines and a device on line1
        const code1 = `LINE-FREE1-${Date.now()}`;
        const code2 = `LINE-FREE2-${Date.now()}`;
        const [freeLine1] = await db
          .insert(lines)
          .values({ lineCode: code1, name: 'Free Line 1', status: 'ACTIVE' })
          .returning();
        const [freeLine2] = await db
          .insert(lines)
          .values({ lineCode: code2, name: 'Free Line 2', status: 'ACTIVE' })
          .returning();

        const [freeDevice] = await db
          .insert(devices)
          .values({
            deviceCode: `ESP-FREE-${Date.now()}`,
            lineId: freeLine1.id,
            name: 'Free Device',
            credentialHash: await bcrypt.hash('free-secret', 4),
            status: 'UNREGISTERED',
          })
          .returning();

        const req = makeRequest(
          `http://localhost/api/devices/${freeDevice.id}`,
          'PATCH',
          adminToken,
          { lineId: freeLine2.id }
        );
        const res = await updateDeviceHandler(req, {
          params: Promise.resolve({ id: freeDevice.id }),
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.device.lineId).toBe(freeLine2.id);
      });

      it('rejects update with invalid lineId format (400)', async () => {
        const req = makeRequest(
          `http://localhost/api/devices/${deviceId}`,
          'PATCH',
          adminToken,
          { lineId: 'not-a-uuid' }
        );
        const res = await updateDeviceHandler(req, {
          params: Promise.resolve({ id: deviceId }),
        });
        expect(res.status).toBe(400);
      });

      it('rejects reassignment to non-existent lineId (404)', async () => {
        const req = makeRequest(
          `http://localhost/api/devices/${deviceId}`,
          'PATCH',
          adminToken,
          { lineId: '00000000-0000-0000-0000-000000000099' }
        );
        const res = await updateDeviceHandler(req, {
          params: Promise.resolve({ id: deviceId }),
        });
        // Should be 404 since target line doesn't exist
        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/devices/[id]/rotate-credential', () => {
      it('operator is rejected (403)', async () => {
        const req = makeRequest(
          `http://localhost/api/devices/${deviceId}/rotate-credential`,
          'POST',
          operatorToken
        );
        const res = await rotateCredentialHandler(req, {
          params: Promise.resolve({ id: deviceId }),
        });
        expect(res.status).toBe(403);
      });

      it('admin can rotate credential and receives new secret once', async () => {
        expect(deviceId).toBeDefined();
        const req = makeRequest(
          `http://localhost/api/devices/${deviceId}/rotate-credential`,
          'POST',
          adminToken
        );
        const res = await rotateCredentialHandler(req, {
          params: Promise.resolve({ id: deviceId }),
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.device).toBeDefined();
        expect(typeof json.secret).toBe('string');
        expect(json.secret.length).toBeGreaterThan(0);

        // New secret must be different from the original one
        expect(json.secret).not.toBe(deviceSecret);

        // Store new secret for further validation
        deviceSecret = json.secret;
      });

      it('credential_hash is not exposed in rotate response', async () => {
        const req = makeRequest(
          `http://localhost/api/devices/${deviceId}/rotate-credential`,
          'POST',
          adminToken
        );
        const res = await rotateCredentialHandler(req, {
          params: Promise.resolve({ id: deviceId }),
        });
        const json = await res.json();
        expect(json.device).not.toHaveProperty('credentialHash');
        expect(json.device).not.toHaveProperty('credential_hash');
        deviceSecret = json.secret;
      });

      it('new hash in DB matches the newly returned plaintext', async () => {
        expect(deviceId).toBeDefined();
        const [stored] = await db.select().from(devices).where(eq(devices.id, deviceId));
        const isMatch = await bcrypt.compare(deviceSecret, stored.credentialHash);
        expect(isMatch).toBe(true);
      });

      it('creates an audit log for credential rotation', async () => {
        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.entityId, deviceId));
        const rotateLogs = logs.filter((l) => l.action === 'ROTATE_DEVICE_CREDENTIAL');
        expect(rotateLogs.length).toBeGreaterThanOrEqual(1);
        // Audit logs must not contain the hash
        for (const log of rotateLogs) {
          expect(JSON.stringify(log.beforeData)).not.toContain('credentialHash');
          expect(JSON.stringify(log.afterData)).not.toContain('credentialHash');
        }
      });

      it('authenticates with new secret on device heartbeat API and rejects old secret after rotation', async () => {
        expect(deviceId).toBeDefined();
        expect(deviceSecret).toBeDefined();

        // 1. Current valid secret should succeed on /api/device/heartbeat
        const validHbReq = new NextRequest('http://localhost/api/device/heartbeat', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${deviceSecret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            device_id: deviceId,
            line_id: lineId,
            firmware_version: '1.0.0',
            wifi_rssi: -60,
          }),
        });
        const validHbRes = await deviceHeartbeatHandler(validHbReq);
        expect(validHbRes.status).toBe(200);

        // 2. Rotate secret
        const oldSecret = deviceSecret;
        const rotateReq = makeRequest(
          `http://localhost/api/devices/${deviceId}/rotate-credential`,
          'POST',
          adminToken
        );
        const rotateRes = await rotateCredentialHandler(rotateReq, {
          params: Promise.resolve({ id: deviceId }),
        });
        expect(rotateRes.status).toBe(200);
        const rotateJson = await rotateRes.json();
        const newSecret = rotateJson.secret;
        expect(newSecret).not.toBe(oldSecret);

        // 3. Old secret must now fail with 401
        const oldHbReq = new NextRequest('http://localhost/api/device/heartbeat', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${oldSecret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            device_id: deviceId,
            line_id: lineId,
          }),
        });
        const oldHbRes = await deviceHeartbeatHandler(oldHbReq);
        expect(oldHbRes.status).toBe(401);

        // 4. New secret must succeed with 200
        const newHbReq = new NextRequest('http://localhost/api/device/heartbeat', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${newSecret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            device_id: deviceId,
            line_id: lineId,
          }),
        });
        const newHbRes = await deviceHeartbeatHandler(newHbReq);
        expect(newHbRes.status).toBe(200);
      });

      it('handles concurrent device move and session start on origin line safely', async () => {
        const codeOrigin = `LINE-DEVO-${Date.now()}`;
        const codeTarget = `LINE-DEVT-${Date.now()}`;
        const [originLine] = await db
          .insert(lines)
          .values({ lineCode: codeOrigin, name: 'Origin Line', status: 'ACTIVE' })
          .returning();
        const [targetLine] = await db
          .insert(lines)
          .values({ lineCode: codeTarget, name: 'Target Line', status: 'ACTIVE' })
          .returning();

        const [dev] = await db
          .insert(devices)
          .values({
            deviceCode: `ESP-CONC-${Date.now()}`,
            lineId: originLine.id,
            name: 'Conc Dev',
            credentialHash: await bcrypt.hash('secret', 4),
            status: 'ONLINE',
          })
          .returning();

        const [admin] = await db.select().from(users).where(eq(users.email, 'admin@local.test'));
        const [receiving] = await db
          .insert(receivings)
          .values({
            receivingNumber: `RCV-DEVCONC-${Date.now()}`,
            deliveryNoteNumber: `SJ-DEVCONC-${Date.now()}`,
            receivingDate: '2026-08-10',
            licensePlateSnapshot: 'B 2222 CNC',
            driverNameSnapshot: 'Driver',
            supplierNameSnapshot: 'Supplier',
            manifestCount: 100,
            lineId: originLine.id,
            status: 'WAITING',
            createdBy: admin.id,
          })
          .returning();

        const moveReq = makeRequest(
          `http://localhost/api/devices/${dev.id}`,
          'PATCH',
          adminToken,
          { lineId: targetLine.id }
        );
        const startReq = makeRequest(
          'http://localhost/api/sessions/start',
          'POST',
          adminToken,
          { receiving_id: receiving.id, line_id: originLine.id }
        );

        const [moveRes, startRes] = await Promise.all([
          updateDeviceHandler(moveReq, { params: Promise.resolve({ id: dev.id }) }),
          startSessionHandler(startReq),
        ]);

        // If move succeeds (200), start should also succeed (201). If move fails (409), start succeeds (201).
        expect(startRes.status).toBe(201);
        expect([200, 409]).toContain(moveRes.status);
      });

      it('returns 404 when rotating credential of non-existent device', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const req = makeRequest(
          `http://localhost/api/devices/${fakeId}/rotate-credential`,
          'POST',
          adminToken
        );
        const res = await rotateCredentialHandler(req, {
          params: Promise.resolve({ id: fakeId }),
        });
        expect(res.status).toBe(404);
      });
    });
  });
});

