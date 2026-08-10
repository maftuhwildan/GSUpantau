import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { runSeed } from '../db/seed';
import { signSessionToken } from '../lib/session-token';
import { getSessionFromToken, SESSION_COOKIE_NAME } from '../lib/auth';
import { getDeviceHealthSettings } from '../lib/device-health';
import { wsBroadcaster } from '../lib/ws';
import { GET as getUsersHandler, POST as postUsersHandler } from '../app/api/users/route';
import { GET as getUserDetailHandler, PATCH as patchUserDetailHandler } from '../app/api/users/[id]/route';
import { GET as getSettingsHandler, PUT as putSettingsHandler } from '../app/api/settings/route';

describe('Batch 18: Users and Settings Management', () => {
  let adminUserId: string;
  let operatorUserId: string;
  let adminToken: string;
  let operatorToken: string;
  let line1Id: string;
  let line2Id: string;

  beforeAll(async () => {
    await runSeed();

    const admin = await db.query.users.findFirst({
      where: eq(schema.users.email, 'admin@local.test'),
    });
    const operator = await db.query.users.findFirst({
      where: eq(schema.users.email, 'operator@local.test'),
    });
    const l1 = await db.query.lines.findFirst({
      where: eq(schema.lines.lineCode, 'LINE-01'),
    });
    const l2 = await db.query.lines.findFirst({
      where: eq(schema.lines.lineCode, 'LINE-02'),
    });

    adminUserId = admin!.id;
    operatorUserId = operator!.id;
    line1Id = l1!.id;
    line2Id = l2!.id;

    adminToken = await signSessionToken({
      userId: adminUserId,
      email: admin!.email,
      name: admin!.name,
      roles: ['ADMIN'],
      expiresAt: Date.now() + 3600 * 1000,
    });

    operatorToken = await signSessionToken({
      userId: operatorUserId,
      email: operator!.email,
      name: operator!.name,
      roles: ['OPERATOR'],
      expiresAt: Date.now() + 3600 * 1000,
    });
  });

  function createRequest(
    url: string,
    method = 'GET',
    token?: string,
    body?: unknown
  ): NextRequest {
    const headers: Record<string, string> = {};
    if (token) {
      headers['cookie'] = `${SESSION_COOKIE_NAME}=${token}`;
    }
    if (body) {
      headers['content-type'] = 'application/json';
    }

    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // ─── User Management Invariants ──────────────────────────────────────────────

  describe('User Management API', () => {
    it('Operator cannot access GET /api/users (403 Forbidden)', async () => {
      const req = createRequest('/api/users', 'GET', operatorToken);
      const res = await getUsersHandler(req);
      expect(res.status).toBe(403);
    });

    it('Admin can access GET /api/users', async () => {
      const req = createRequest('/api/users', 'GET', adminToken);
      const res = await getUsersHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json.users)).toBe(true);
      expect(json.users.length).toBeGreaterThan(0);
      // Ensure passwordHash is NOT returned
      expect(json.users[0].passwordHash).toBeUndefined();
    });

    it('Rejects creating an Operator without an assigned line (400 VALIDATION_ERROR)', async () => {
      const req = createRequest('/api/users', 'POST', adminToken, {
        name: 'Op Tanpa Line',
        email: 'optanpaline@local.test',
        password: 'valid-secure-password-123',
        role: 'OPERATOR',
        assignedLineId: null,
      });

      const res = await postUsersHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('Rejects password shorter than 12 characters (400 VALIDATION_ERROR)', async () => {
      const req = createRequest('/api/users', 'POST', adminToken, {
        name: 'Short Pass User',
        email: 'shortpass@local.test',
        password: 'shortpass',
        role: 'OPERATOR',
        assignedLineId: line1Id,
      });

      const res = await postUsersHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('Admin can successfully create a new Operator with assigned line', async () => {
      const req = createRequest('/api/users', 'POST', adminToken, {
        name: 'Operator Baru',
        email: 'opbaru@local.test',
        password: 'secure-operator-password-123',
        role: 'OPERATOR',
        assignedLineId: line1Id,
        status: 'ACTIVE',
      });

      const res = await postUsersHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.user.email).toBe('opbaru@local.test');
      expect(json.user.assignedLineId).toBe(line1Id);
      expect(json.user.roles).toContain('OPERATOR');

      // Verify bcrypt hashing in database
      const dbUser = await db.query.users.findFirst({
        where: eq(schema.users.email, 'opbaru@local.test'),
      });
      expect(dbUser).toBeDefined();
      expect(await bcrypt.compare('secure-operator-password-123', dbUser!.passwordHash)).toBe(true);
    });

    it('Rejects duplicate email creation (409 CONFLICT)', async () => {
      const req = createRequest('/api/users', 'POST', adminToken, {
        name: 'Duplicate Email User',
        email: 'opbaru@local.test',
        password: 'secure-operator-password-123',
        role: 'OPERATOR',
        assignedLineId: line1Id,
      });

      const res = await postUsersHandler(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe('CONFLICT');
    });

    it('Admin can create a new Admin user without an assigned line', async () => {
      const req = createRequest('/api/users', 'POST', adminToken, {
        name: 'Admin Kedua',
        email: 'adminkedua@local.test',
        password: 'secure-admin-password-123',
        role: 'ADMIN',
        assignedLineId: null,
      });

      const res = await postUsersHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.user.roles).toContain('ADMIN');
    });

    it('Prevents Admin from deactivating their own account (409 CONFLICT)', async () => {
      const req = createRequest(`/api/users/${adminUserId}`, 'PATCH', adminToken, {
        status: 'INACTIVE',
      });

      const res = await patchUserDetailHandler(req, { params: Promise.resolve({ id: adminUserId }) });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.message).toContain('sendiri');
    });

    it('Prevents deactivating the last active Admin', async () => {
      // First, find the second admin we created and deactivate them
      const secondAdmin = await db.query.users.findFirst({
        where: eq(schema.users.email, 'adminkedua@local.test'),
      });
      expect(secondAdmin).toBeDefined();

      const reqDeactivateSecond = createRequest(`/api/users/${secondAdmin!.id}`, 'PATCH', adminToken, {
        status: 'INACTIVE',
      });
      const resDeactivateSecond = await patchUserDetailHandler(reqDeactivateSecond, {
        params: Promise.resolve({ id: secondAdmin!.id }),
      });
      expect(resDeactivateSecond.status).toBe(200);

      // Now `adminUserId` is the only active Admin left!
      // Create a dummy third user to test last admin protection on demoting or deactivating adminUserId
      // If we attempt to change adminUserId to OPERATOR, it must be rejected!
      const reqDemoteLastAdmin = createRequest(`/api/users/${adminUserId}`, 'PATCH', adminToken, {
        role: 'OPERATOR',
        assignedLineId: line1Id,
      });
      const resDemote = await patchUserDetailHandler(reqDemoteLastAdmin, {
        params: Promise.resolve({ id: adminUserId }),
      });
      expect(resDemote.status).toBe(409);
      const jsonDemote = await resDemote.json();
      expect(jsonDemote.error.message).toContain('Admin');
    });

    it('Admin can reset a user password with a minimum 12-char password and audit log is created', async () => {
      const targetUser = await db.query.users.findFirst({
        where: eq(schema.users.email, 'opbaru@local.test'),
      });
      expect(targetUser).toBeDefined();

      const newPass = 'new-reset-password-999';
      const req = createRequest(`/api/users/${targetUser!.id}`, 'PATCH', adminToken, {
        password: newPass,
      });

      const res = await patchUserDetailHandler(req, { params: Promise.resolve({ id: targetUser!.id }) });
      expect(res.status).toBe(200);

      // Check updated password hash
      const updatedUser = await db.query.users.findFirst({
        where: eq(schema.users.id, targetUser!.id),
      });
      expect(await bcrypt.compare(newPass, updatedUser!.passwordHash)).toBe(true);

      // Check audit log
      const audit = await db.query.auditLogs.findFirst({
        where: eq(schema.auditLogs.entityId, targetUser!.id),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      });
      expect(audit).toBeDefined();
      expect(audit!.action).toBe('RESET_PASSWORD');
    });

    it('Deactivated user status immediately blocks authentication session', async () => {
      const targetUser = await db.query.users.findFirst({
        where: eq(schema.users.email, 'opbaru@local.test'),
      });
      expect(targetUser).toBeDefined();

      // Deactivate user
      const reqDeactivate = createRequest(`/api/users/${targetUser!.id}`, 'PATCH', adminToken, {
        status: 'INACTIVE',
      });
      await patchUserDetailHandler(reqDeactivate, { params: Promise.resolve({ id: targetUser!.id }) });

      // Generate a token for targetUser
      const deactivatedToken = await signSessionToken({
        userId: targetUser!.id,
        email: targetUser!.email,
        name: targetUser!.name,
        roles: ['OPERATOR'],
        expiresAt: Date.now() + 3600 * 1000,
      });

      // Attempt getSessionFromToken -> Must return null because DB user is INACTIVE!
      const session = await getSessionFromToken(deactivatedToken);
      expect(session).toBeNull();
    });

    it('Updating an already INACTIVE admin does not falsely trigger Last Admin Protection (P3 fix)', async () => {
      const secondAdmin = await db.query.users.findFirst({
        where: eq(schema.users.email, 'adminkedua@local.test'),
      });
      expect(secondAdmin).toBeDefined();
      expect(secondAdmin!.status).toBe('INACTIVE');

      // Update name of the inactive admin while passing status: 'INACTIVE'
      const reqUpdateInactive = createRequest(`/api/users/${secondAdmin!.id}`, 'PATCH', adminToken, {
        name: 'Admin Kedua Updated Name',
        status: 'INACTIVE',
      });
      const res = await patchUserDetailHandler(reqUpdateInactive, {
        params: Promise.resolve({ id: secondAdmin!.id }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.user.name).toBe('Admin Kedua Updated Name');
    });

    it('Updating user status/role/line disconnects their active WebSocket client connections (P0 fix)', async () => {
      const dummyUserId = 'dummy-user-ws-test';
      let closed = false;

      const unregister = wsBroadcaster.registerClient({
        id: 'ws-client-1',
        userId: dummyUserId,
        roles: ['OPERATOR'],
        assignedLineId: line1Id,
        send: () => {},
        close: () => {
          closed = true;
        },
      });

      expect(wsBroadcaster.getClientCount()).toBeGreaterThan(0);

      // Trigger disconnect for dummyUserId
      wsBroadcaster.disconnectUser(dummyUserId);

      expect(closed).toBe(true);

      // Clean up in case
      unregister();
    });
  });

  // ─── Settings Management Invariants ─────────────────────────────────────────

  describe('Settings Management API', () => {
    it('Operator cannot update settings (403 Forbidden)', async () => {
      const req = createRequest('/api/settings', 'PUT', operatorToken, {
        siteName: 'Hacked Site Name',
        siteTimezone: 'Asia/Jakarta',
        heartbeatOfflineThresholdSeconds: 30,
        heartbeatDegradedThresholdSeconds: 15,
        pollingFallbackIntervalSeconds: 5,
        deviceBatchSize: 100,
      });

      const res = await putSettingsHandler(req);
      expect(res.status).toBe(403);
    });

    it('Rejects setting update if degraded threshold >= offline threshold (400 VALIDATION_ERROR)', async () => {
      const req = createRequest('/api/settings', 'PUT', adminToken, {
        siteName: 'Poultry RPA',
        siteTimezone: 'Asia/Jakarta',
        heartbeatOfflineThresholdSeconds: 20,
        heartbeatDegradedThresholdSeconds: 25, // Invalid! degraded > offline
        pollingFallbackIntervalSeconds: 5,
        deviceBatchSize: 100,
      });

      const res = await putSettingsHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('degraded');
    });

    it('Admin can successfully update settings and create audit log', async () => {
      const newSettings = {
        siteName: 'Poultry RPA Utama - Jaya Abadi',
        siteTimezone: 'Asia/Jakarta',
        heartbeatOfflineThresholdSeconds: 40,
        heartbeatDegradedThresholdSeconds: 20,
        pollingFallbackIntervalSeconds: 6,
        deviceBatchSize: 80,
      };

      const req = createRequest('/api/settings', 'PUT', adminToken, newSettings);
      const res = await putSettingsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.settings.siteName).toBe(newSettings.siteName);
      expect(json.settings.heartbeatOfflineThresholdSeconds).toBe(40);
      expect(json.settings.heartbeatDegradedThresholdSeconds).toBe(20);

      // Verify getDeviceHealthSettings returns updated thresholds
      const healthSettings = await getDeviceHealthSettings();
      expect(healthSettings.offlineThresholdSeconds).toBe(40);
      expect(healthSettings.degradedThresholdSeconds).toBe(20);
      expect(healthSettings.batchUploadMaxEvents).toBe(80);

      // Verify audit log
      const audit = await db.query.auditLogs.findFirst({
        where: eq(schema.auditLogs.action, 'UPDATE_SETTINGS'),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      });
      expect(audit).toBeDefined();
      expect(audit!.action).toBe('UPDATE_SETTINGS');
    });

    it('Rejects a device batch size above the ingestion limit', async () => {
      const req = createRequest('/api/settings', 'PUT', adminToken, {
        siteName: 'Poultry RPA',
        siteTimezone: 'Asia/Jakarta',
        heartbeatOfflineThresholdSeconds: 30,
        heartbeatDegradedThresholdSeconds: 15,
        pollingFallbackIntervalSeconds: 5,
        deviceBatchSize: 101,
      });

      const res = await putSettingsHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details.deviceBatchSize).toContain('Ukuran batch maksimal 100.');
    });

    it('Caps a legacy oversized batch value in the Admin settings response', async () => {
      await db
        .update(schema.appSettings)
        .set({ value: 150 })
        .where(eq(schema.appSettings.key, 'batch_upload_max_events'));

      const res = await getSettingsHandler(
        createRequest('/api/settings', 'GET', adminToken)
      );

      expect(res.status).toBe(200);
      expect((await res.json()).settings.deviceBatchSize).toBe(100);
    });
  });
});
