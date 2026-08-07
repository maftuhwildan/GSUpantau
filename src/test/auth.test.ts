import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { runSeed } from '../db/seed';
import {
  signSessionToken,
  verifySessionToken,
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

describe('Auth & Permissions (Batch 3)', () => {
  beforeAll(async () => {
    // Seed database with test users
    await runSeed();
  });

  describe('Password Hashing', () => {
    it('should correctly hash and compare passwords', async () => {
      const password = 'test-password-123';
      const hash = await bcrypt.hash(password, 10);
      expect(hash).not.toBe(password);
      expect(await bcrypt.compare(password, hash)).toBe(true);
      expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
    });
  });

  describe('Session Token Management', () => {
    it('should sign and verify a session token correctly', async () => {
      const payload = {
        userId: 'test-user-id',
        email: 'test@local.test',
        name: 'Test User',
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
        userId: 'test-user-id',
        email: 'test@local.test',
        name: 'Test User',
        roles: ['OPERATOR'],
        expiresAt: Date.now() + 3600 * 1000,
      };

      const token = await signSessionToken(payload);
      const [data, signature] = token.split('.');
      
      // Tamper with the signature
      const tamperedToken = `${data}.${signature.replace('a', 'b')}`;
      
      const verified = await verifySessionToken(tamperedToken);
      expect(verified).toBeNull();
    });

    it('should reject expired tokens', async () => {
      const payload = {
        userId: 'test-user-id',
        email: 'test@local.test',
        name: 'Test User',
        roles: ['OPERATOR'],
        expiresAt: Date.now() - 3600 * 1000, // Expired 1 hour ago
      };

      const token = await signSessionToken(payload);
      const verified = await verifySessionToken(token);
      
      expect(verified).toBeNull();
    });
  });

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

  describe('API Endpoint /api/auth/login', () => {
    it('should login successfully as ADMIN with valid credentials', async () => {
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
      expect(json.user).toBeDefined();
      expect(json.user.email).toBe('admin@local.test');
      expect(json.user.roles).toContain('ADMIN');
      expect(json.user.permissions).toContain('users:manage');

      // Check cookie header
      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toContain(SESSION_COOKIE_NAME);
      expect(cookieHeader).toContain('HttpOnly');
    });

    it('should login successfully as OPERATOR with valid credentials', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'operator@local.test',
          password: 'password',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.user.email).toBe('operator@local.test');
      expect(json.user.roles).toContain('OPERATOR');
      expect(json.user.permissions).not.toContain('users:manage');
    });

    it('should reject invalid password with 401 error shape', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@local.test',
          password: 'wrongpassword',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid email input with 400 error shape', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email-format',
          password: 'password',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('API Endpoint /api/auth/logout', () => {
    it('should clear session cookie on logout', async () => {
      const res = await logoutHandler();
      expect(res.status).toBe(200);
      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toContain(`${SESSION_COOKIE_NAME}=;`);
    });
  });

  describe('API Endpoint /api/auth/session', () => {
    it('should return 401 for request without session cookie', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'GET',
      });

      const res = await sessionHandler(req);
      expect(res.status).toBe(401);
    });

    it('should return user session for request with valid cookie header', async () => {
      const token = await signSessionToken({
        userId: 'admin-id-123',
        email: 'admin@local.test',
        name: 'Siti Admin',
        roles: ['ADMIN'],
        expiresAt: Date.now() + 3600 * 1000,
      });

      const req = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await sessionHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.user.email).toBe('admin@local.test');
      expect(json.user.roles).toContain('ADMIN');
    });
  });

  describe('Backend Authorization Protection', () => {
    it('should block OPERATOR from accessing ADMIN-only API endpoint with 403 FORBIDDEN', async () => {
      const operatorToken = await signSessionToken({
        userId: 'op-id-123',
        email: 'operator@local.test',
        name: 'Bambang Operator',
        roles: ['OPERATOR'],
        expiresAt: Date.now() + 3600 * 1000,
      });

      const req = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${operatorToken}`,
        },
      });

      const res = await adminUsersHandler(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('should allow ADMIN to access ADMIN-only API endpoint with 200 OK', async () => {
      const adminToken = await signSessionToken({
        userId: 'admin-id-123',
        email: 'admin@local.test',
        name: 'Siti Admin',
        roles: ['ADMIN'],
        expiresAt: Date.now() + 3600 * 1000,
      });

      const req = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
      });

      const res = await adminUsersHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.users).toBeDefined();
      expect(Array.isArray(json.users)).toBe(true);
    });
  });
});
