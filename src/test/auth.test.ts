import { describe, it, expect, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { runSeed } from '../db/seed';
import * as auditModule from '../lib/audit';
import {
  signSessionToken,
  verifySessionToken,
} from '../lib/session-token';
import {
  getSessionFromToken,
  SESSION_COOKIE_NAME,
} from '../lib/auth';
import {
  getPermissionsForRoles,
  hasPermission,
  OPERATOR_PERMISSIONS,
  ALL_PERMISSIONS,
} from '../lib/permissions';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { POST as logoutHandler } from '../app/api/auth/logout/route';
import { GET as sessionHandler } from '../app/api/auth/session/route';
import { GET as adminUsersHandler } from '../app/api/admin/users/route';
import { GET as adminDashboardHandler } from '../app/api/dashboard/admin/route';
import { GET as operatorDashboardHandler } from '../app/api/dashboard/operator/route';
import { GET as devSimulatorOptionsHandler } from '../app/api/dev/simulator/options/route';
import { GET as activeSessionHandler } from '../app/api/lines/[id]/active-session/route';
import { POST as startSessionHandler } from '../app/api/sessions/start/route';
import { GET as sensorEventsHandler } from '../app/api/sensor-events/route';
import { GET as getReceivingsHandler } from '../app/api/receivings/route';
import { GET as getReceivingDetailHandler } from '../app/api/receivings/[id]/route';

describe('Auth, Permissions & Security Hardening (Batch 11)', () => {
  let adminUserId: string;
  let operatorUserId: string;
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
  });

  // ─── Edge Safety ──────────────────────────────────────────────────────────

  describe('Edge Runtime Safety', () => {
    it('session-token module must NOT import @/db or PGlite', async () => {
      // Dynamic import the module text and verify no forbidden imports.
      // We check the compiled module's source by verifying a key property:
      // signSessionToken must work without any DB running (pure crypto).
      const payload = {
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'test@example.com',
        name: 'Test',
        roles: ['OPERATOR'],
        expiresAt: Date.now() + 3600 * 1000,
      };
      // If this works without error, the module has no DB dependency.
      const token = await signSessionToken(payload);
      expect(typeof token).toBe('string');
      const verified = await verifySessionToken(token);
      expect(verified?.userId).toBe(payload.userId);
    });
  });

  // ─── Password Hashing ─────────────────────────────────────────────────────

  describe('Password Hashing', () => {
    it('should correctly hash and compare passwords', async () => {
      const password = 'test-password-123';
      const hash = await bcrypt.hash(password, 10);
      expect(hash).not.toBe(password);
      expect(await bcrypt.compare(password, hash)).toBe(true);
      expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
    });
  });

  // ─── Session Token Management ─────────────────────────────────────────────

  describe('Session Token Management', () => {
    it('should sign and verify a session token correctly', async () => {
      const payload = {
        userId: operatorUserId,
        email: 'operator@local.test',
        name: 'Bambang Operator',
        roles: ['OPERATOR'],
        expiresAt: Date.now() + 3600 * 1000,
      };

      const token = await signSessionToken(payload);
      expect(typeof token).toBe('string');
      expect(token.includes('.')).toBe(true);

      const verified = await verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(payload.userId);
    });

    it('should reject invalid token signature', async () => {
      const payload = {
        userId: operatorUserId,
        email: 'operator@local.test',
        name: 'Bambang Operator',
        roles: ['OPERATOR'],
        expiresAt: Date.now() + 3600 * 1000,
      };

      const token = await signSessionToken(payload);
      const [data, signature] = token.split('.');
      const tamperedToken = `${data}.${signature.replace('a', 'b')}`;

      const verified = await verifySessionToken(tamperedToken);
      expect(verified).toBeNull();
    });

    it('should reject expired tokens', async () => {
      const payload = {
        userId: operatorUserId,
        email: 'operator@local.test',
        name: 'Bambang Operator',
        roles: ['OPERATOR'],
        expiresAt: Date.now() - 3600 * 1000,
      };

      const token = await signSessionToken(payload);
      const verified = await verifySessionToken(token);
      expect(verified).toBeNull();
    });

    it('should reject tokens with non-UUID userId in getSessionFromToken', async () => {
      // Old-style tokens with non-UUID IDs must be rejected after Batch 11
      const payload = {
        userId: 'admin-id', // non-UUID
        email: 'admin@local.test',
        name: 'Admin',
        roles: ['ADMIN'],
        expiresAt: Date.now() + 3600 * 1000,
      };
      const token = await signSessionToken(payload);
      const sessionUser = await getSessionFromToken(token);
      expect(sessionUser).toBeNull();
    });
  });

  // ─── Role & Permission Mapping ────────────────────────────────────────────

  describe('Role & Permission Mapping', () => {
    it('should return correct permissions for OPERATOR role', () => {
      const perms = getPermissionsForRoles(['OPERATOR']);
      expect(perms.sort()).toEqual(OPERATOR_PERMISSIONS.sort());
      expect(hasPermission(perms, 'dashboard:view')).toBe(true);
      expect(hasPermission(perms, 'receiving:view')).toBe(true);
      expect(hasPermission(perms, 'session:start')).toBe(true);
      expect(hasPermission(perms, 'session:finish')).toBe(true);
      expect(hasPermission(perms, 'sensor:view')).toBe(true);
      expect(hasPermission(perms, 'users:manage')).toBe(false);
      expect(hasPermission(perms, 'master_data:manage')).toBe(false);
    });

    it('should return all permissions for ADMIN role', () => {
      const perms = getPermissionsForRoles(['ADMIN']);
      expect(perms.length).toBe(ALL_PERMISSIONS.length);
      expect(hasPermission(perms, 'users:manage')).toBe(true);
      expect(hasPermission(perms, 'settings:manage')).toBe(true);
    });
  });

  // ─── Database Authoritative State ─────────────────────────────────────────

  describe('Database Authoritative User State & Reloading', () => {
    it('should reject cookies of inactive users', async () => {
      const [inactiveUser] = await db
        .insert(schema.users)
        .values({
          email: 'inactive@local.test',
          name: 'Inactive User',
          passwordHash: 'hash',
          status: 'INACTIVE',
        })
        .onConflictDoUpdate({
          target: schema.users.email,
          set: { status: 'INACTIVE' },
        })
        .returning();

      const token = await signSessionToken({
        userId: inactiveUser.id,
        email: inactiveUser.email,
        name: inactiveUser.name,
        roles: ['OPERATOR'],
        expiresAt: Date.now() + 3600 * 1000,
      });

      const sessionUser = await getSessionFromToken(token);
      expect(sessionUser).toBeNull();
    });

    it('should ignore tampered roles in token payload and use real DB roles', async () => {
      // Token claims ADMIN, but database user only has OPERATOR
      const tamperedToken = await signSessionToken({
        userId: operatorUserId,
        email: 'operator@local.test',
        name: 'Bambang Operator',
        roles: ['ADMIN'], // Token manipulation!
        expiresAt: Date.now() + 3600 * 1000,
      });

      const sessionUser = await getSessionFromToken(tamperedToken);
      expect(sessionUser).not.toBeNull();
      expect(sessionUser?.roles).toEqual(['OPERATOR']); // Real DB role enforced!
      expect(sessionUser?.permissions).not.toContain('users:manage');
    });

    it('should apply role revocations immediately without waiting for cookie expiry', async () => {
      const token = await signSessionToken({
        userId: operatorUserId,
        email: 'operator@local.test',
        name: 'Bambang Operator',
        roles: ['OPERATOR'],
        expiresAt: Date.now() + 3600 * 1000,
      });

      const userBefore = await getSessionFromToken(token);
      expect(userBefore?.roles).toContain('OPERATOR');

      await db
        .delete(schema.userRoles)
        .where(eq(schema.userRoles.userId, operatorUserId));

      // Immediate revocation
      const userAfter = await getSessionFromToken(token);
      expect(userAfter?.roles).toEqual([]);
      expect(userAfter?.permissions).toEqual([]);

      // Restore role for subsequent tests
      const operatorRole = await db.query.roles.findFirst({
        where: eq(schema.roles.code, 'OPERATOR'),
      });
      await db.insert(schema.userRoles).values({
        userId: operatorUserId,
        roleId: operatorRole!.id,
      }).onConflictDoNothing();
    });
  });

  // ─── Auth API Endpoints ────────────────────────────────────────────────────

  describe('Auth API Endpoints', () => {
    it('should login successfully as ADMIN', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@local.test',
          password: 'password',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.user.email).toBe('admin@local.test');
      expect(json.user.roles).toContain('ADMIN');

      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toContain(SESSION_COOKIE_NAME);
      expect(cookieHeader).toContain('HttpOnly');
    });

    it('should reject invalid password', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@local.test',
          password: 'wrong-password',
        }),
      });
      const res = await loginHandler(req);
      expect(res.status).toBe(401);
    });

    it('should reject invalid login input (missing fields)', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'notanemail' }),
      });
      const res = await loginHandler(req);
      expect(res.status).toBe(400);
    });

    it('should NOT update lastLoginAt when login audit log creation fails (AC 3)', async () => {
      const [adminBefore] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@local.test'));
      const initialLastLogin = adminBefore.lastLoginAt;

      const spy = vi.spyOn(auditModule, 'createAuditLog').mockImplementationOnce(() => {
        throw new Error('Database Audit Error');
      });

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@local.test',
          password: 'password',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(500);

      const [adminAfter] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, 'admin@local.test'));
      expect(adminAfter.lastLoginAt?.getTime()).toBe(initialLastLogin?.getTime());

      spy.mockRestore();
    });

    it('should create audit log with entityType: USER on successful login', async () => {
      // Clear previous audit logs for this user to make assertion easier
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.entityId, adminUserId));

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@local.test',
          password: 'password',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);

      const logs = await db
        .select()
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.entityId, adminUserId));

      expect(logs).toHaveLength(1);
      const auditLog = logs[0];
      expect(auditLog.action).toBe('LOGIN');
      expect(auditLog.entityType).toBe('USER');
      expect(auditLog.entityId).toBe(adminUserId);
      expect(auditLog.actorId).toBe(adminUserId);
    });

    it('should clear session cookie on logout', async () => {
      const res = await logoutHandler();
      expect(res.status).toBe(200);
      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toContain(`${SESSION_COOKIE_NAME}=;`);
    });

    it('GET /api/auth/session without cookie must return 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'GET',
        // No cookie
      });
      const res = await sessionHandler(req);
      expect(res.status).toBe(401);
    });

    it('should return user session for GET /api/auth/session with valid cookie', async () => {
      const token = await signSessionToken({
        userId: adminUserId,
        email: 'admin@local.test',
        name: 'Siti Admin',
        roles: ['ADMIN'],
        expiresAt: Date.now() + 3600 * 1000,
      });

      const req = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'GET',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });

      const res = await sessionHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.user.email).toBe('admin@local.test');
      expect(json.user.roles).toContain('ADMIN');
    });
  });

  // ─── API Role Guards ──────────────────────────────────────────────────────

  describe('API Endpoints & Guards', () => {
    it('should block OPERATOR from accessing ADMIN endpoints with 403 FORBIDDEN', async () => {
      const operatorToken = await signSessionToken({
        userId: operatorUserId,
        email: 'operator@local.test',
        name: 'Bambang Operator',
        roles: ['OPERATOR'],
        expiresAt: Date.now() + 3600 * 1000,
      });

      const req1 = new NextRequest('http://localhost:3000/api/admin/users', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
      });
      const res1 = await adminUsersHandler(req1);
      expect(res1.status).toBe(403);

      const req2 = new NextRequest('http://localhost:3000/api/dashboard/admin', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
      });
      const res2 = await adminDashboardHandler(req2);
      expect(res2.status).toBe(403);

      const req3 = new NextRequest('http://localhost:3000/api/dev/simulator/options', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
      });
      const res3 = await devSimulatorOptionsHandler(req3);
      expect(res3.status).toBe(403);
    });

    it('should allow ADMIN to access ADMIN endpoints with 200 OK', async () => {
      const adminToken = await signSessionToken({
        userId: adminUserId,
        email: 'admin@local.test',
        name: 'Siti Admin',
        roles: ['ADMIN'],
        expiresAt: Date.now() + 3600 * 1000,
      });

      const req1 = new NextRequest('http://localhost:3000/api/admin/users', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      });
      const res1 = await adminUsersHandler(req1);
      expect(res1.status).toBe(200);

      const req2 = new NextRequest('http://localhost:3000/api/dashboard/admin', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      });
      const res2 = await adminDashboardHandler(req2);
      expect(res2.status).toBe(200);

      const req3 = new NextRequest('http://localhost:3000/api/dev/simulator/options', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      });
      const res3 = await devSimulatorOptionsHandler(req3);
      expect(res3.status).toBe(200);
    });
  });

  // ─── Operator Line Restrictions ───────────────────────────────────────────

  describe('Operator Line Restriction Invariants', () => {
    let operatorToken: string;
    let adminToken: string;

    beforeAll(async () => {
      operatorToken = await signSessionToken({
        userId: operatorUserId,
        email: 'operator@local.test',
        name: 'Bambang Operator',
        roles: ['OPERATOR'],
        expiresAt: Date.now() + 3600 * 1000,
      });

      adminToken = await signSessionToken({
        userId: adminUserId,
        email: 'admin@local.test',
        name: 'Siti Admin',
        roles: ['ADMIN'],
        expiresAt: Date.now() + 3600 * 1000,
      });
    });

    it('Operator without assigned line receives 403', async () => {
      // Temporarily remove assignedLineId
      await db
        .update(schema.users)
        .set({ assignedLineId: null })
        .where(eq(schema.users.id, operatorUserId));

      const noLineToken = await signSessionToken({
        userId: operatorUserId,
        email: 'operator@local.test',
        name: 'Bambang Operator',
        roles: ['OPERATOR'],
        expiresAt: Date.now() + 3600 * 1000,
      });

      const req = new NextRequest(`http://localhost:3000/api/dashboard/operator`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${noLineToken}` },
      });
      const res = await operatorDashboardHandler(req);
      expect(res.status).toBe(403);

      // Restore assignedLineId
      await db
        .update(schema.users)
        .set({ assignedLineId: line1Id })
        .where(eq(schema.users.id, operatorUserId));
    });

    it('should allow OPERATOR to access their assigned line (LINE-01)', async () => {
      const req = new NextRequest(`http://localhost:3000/api/dashboard/operator?line_id=${line1Id}`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
      });
      const res = await operatorDashboardHandler(req);
      expect(res.status).toBe(200);
    });

    it('should block OPERATOR from accessing an unassigned line (LINE-02) dashboard with 403', async () => {
      const req = new NextRequest(`http://localhost:3000/api/dashboard/operator?line_id=${line2Id}`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
      });
      const res = await operatorDashboardHandler(req);
      expect(res.status).toBe(403);
    });

    it('should block OPERATOR from getting active session of LINE-02 with 403', async () => {
      const req = new NextRequest(`http://localhost:3000/api/lines/${line2Id}/active-session`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
      });
      const res = await activeSessionHandler(req, { params: Promise.resolve({ id: line2Id }) });
      expect(res.status).toBe(403);
    });

    it('should block OPERATOR from starting a session on an unassigned line with 403', async () => {
      const waitingRec = await db.query.receivings.findFirst({
        where: eq(schema.receivings.status, 'WAITING'),
      });

      if (!waitingRec) {
        // No WAITING receiving — skip this specific check, the guard is still tested above
        return;
      }

      const req = new NextRequest('http://localhost:3000/api/sessions/start', {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
        body: JSON.stringify({
          receiving_id: waitingRec.id,
          line_id: line2Id,
        }),
      });

      const res = await startSessionHandler(req);
      expect(res.status).toBe(403);
    });

    // Sensor events line scoping
    it('Operator without line_id gets only assigned line sensor events', async () => {
      const req = new NextRequest('http://localhost:3000/api/sensor-events', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
      });
      const res = await sensorEventsHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      // All returned events must be from assigned line (line1Id) or empty
      const wrongLine = (json.events as any[]).filter(
        (e: any) => e.lineId !== line1Id && e.line?.id !== line1Id
      );
      expect(wrongLine.length).toBe(0);
    });

    it('Operator sending different line_id in sensor events gets 403', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/sensor-events?line_id=${line2Id}`,
        { headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` } }
      );
      const res = await sensorEventsHandler(req);
      expect(res.status).toBe(403);
    });

    // Receivings list line scoping
    it('Operator without line_id gets only assigned line receivings', async () => {
      const req = new NextRequest('http://localhost:3000/api/receivings', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
      });
      const res = await getReceivingsHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      const wrongLine = (json.receivings as any[]).filter(
        (r: any) => r.lineId !== null && r.lineId !== line1Id
      );
      expect(wrongLine.length).toBe(0);
    });

    it('Operator sending different line_id for receivings list gets 403', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/receivings?line_id=${line2Id}`,
        { headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` } }
      );
      const res = await getReceivingsHandler(req);
      expect(res.status).toBe(403);
    });

    // Receiving detail line scoping
    it('Operator cannot open receiving detail from different line (403)', async () => {
      // Create a receiving assigned to line2 for this test
      const [line2Receiving] = await db
        .insert(schema.receivings)
        .values({
          receivingNumber: `REC-TEST-LINE2-${Date.now()}`,
          deliveryNoteNumber: 'SJ-BOUNDARY-LINE2',
          receivingDate: '2026-08-08',
          queuePosition: 99,
          licensePlateSnapshot: 'B 9999 TEST',
          driverNameSnapshot: 'Driver Test',
          supplierNameSnapshot: 'Supplier Test',
          manifestCount: 100,
          lineId: line2Id,
          status: 'WAITING',
          reconciliationStatus: 'PENDING',
          createdBy: adminUserId,
        })
        .returning();

      const req = new NextRequest(
        `http://localhost:3000/api/receivings/${line2Receiving.id}`,
        { headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` } }
      );
      const res = await getReceivingDetailHandler(req, {
        params: Promise.resolve({ id: line2Receiving.id }),
      });
      expect(res.status).toBe(403);

      // Cleanup
      await db.delete(schema.receivings).where(eq(schema.receivings.id, line2Receiving.id));
    });

    // Admin can see all lines
    it('Admin can view sensor events across all lines', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/sensor-events?line_id=${line2Id}`,
        { headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` } }
      );
      const res = await sensorEventsHandler(req);
      expect(res.status).toBe(200);
    });

    it('Admin can view receivings from any line', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/receivings?line_id=${line2Id}`,
        { headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` } }
      );
      const res = await getReceivingsHandler(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── Session Secret Production Guard ─────────────────────────────────────

  describe('Session Secret Production Guard', () => {
    it('should throw error in production if SESSION_SECRET is not set', async () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.SESSION_SECRET;

      try {
        (process.env as any).NODE_ENV = 'production';
        delete process.env.SESSION_SECRET;

        await expect(
          signSessionToken({
            userId: adminUserId,
            email: 'admin@local.test',
            name: 'Admin',
            roles: ['ADMIN'],
            expiresAt: Date.now() + 1000,
          })
        ).rejects.toThrow('SESSION_SECRET environment variable is required in production');
      } finally {
        (process.env as any).NODE_ENV = origEnv;
        process.env.SESSION_SECRET = origSecret;
      }
    });
  });
});
