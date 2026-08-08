/**
 * auth.ts
 *
 * Database-aware authentication helpers for API route handlers (Node.js runtime).
 * DO NOT import this file from middleware.ts — use session-token.ts instead.
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Permission, getPermissionsForRoles } from './permissions';
import { unauthorizedError, forbiddenError } from './errors';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  SessionPayload,
  signSessionToken,
  verifySessionToken,
  getSessionSecret,
} from './session-token';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Re-export token helpers and constants so existing callers don't need changes.
export { SESSION_COOKIE_NAME, SESSION_MAX_AGE, signSessionToken, verifySessionToken, getSessionSecret };
export type { SessionPayload };

export type UserRole = 'ADMIN' | 'OPERATOR';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  status: string;
  assignedLineId?: string | null;
  roles: string[];
  permissions: Permission[];
}

/**
 * Reload user state from the database on every protected request.
 * Roles in the token payload are NEVER trusted for authorization.
 * Returns null if user is inactive, deleted, or token is invalid.
 */
export async function getSessionFromToken(token: string): Promise<SessionUser | null> {
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // Only accept tokens whose userId is a proper UUID.
  // Older tokens with non-UUID user IDs (e.g. 'admin-id') are rejected.
  const isUuid = z.string().uuid().safeParse(payload.userId).success;
  if (!isUuid) return null;

  try {
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (!userRecord || userRecord.status !== 'ACTIVE') {
      return null;
    }

    const activeRoles = userRecord.userRoles.map((ur) => ur.role.code);
    const permissions = getPermissionsForRoles(activeRoles);

    return {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      status: userRecord.status,
      assignedLineId: userRecord.assignedLineId,
      roles: activeRoles,
      permissions,
    };
  } catch (err) {
    console.error('Error reloading session user from DB:', err);
    return null;
  }
}

export async function getAuthSession(req?: Request | NextRequest): Promise<SessionUser | null> {
  let token: string | undefined;

  if (req) {
    if ('cookies' in req && typeof (req as NextRequest).cookies?.get === 'function') {
      token = (req as NextRequest).cookies.get(SESSION_COOKIE_NAME)?.value;
    }
    if (!token) {
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const match = cookieHeader.split(';').find((c) => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
        if (match) {
          token = match.split('=')[1]?.trim();
        }
      }
    }
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      token = undefined;
    }
  }

  if (!token) return null;
  return await getSessionFromToken(token);
}

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function requireAuth(
  req: Request
): Promise<{ user: SessionUser | null; errorResponse: NextResponse | null }> {
  const user = await getAuthSession(req);
  if (!user) {
    return { user: null, errorResponse: unauthorizedError() };
  }
  return { user, errorResponse: null };
}

export async function requirePermission(
  req: Request,
  permission: Permission
): Promise<{ user: SessionUser | null; errorResponse: NextResponse | null }> {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return { user: null, errorResponse };

  if (!user!.permissions.includes(permission)) {
    return { user: null, errorResponse: forbiddenError() };
  }

  return { user, errorResponse: null };
}

/**
 * Guard that requires the user to have a specific role (DB authoritative).
 * @param role - 'ADMIN' | 'OPERATOR'
 */
export async function requireRole(
  req: Request,
  role: UserRole
): Promise<{ user: SessionUser | null; errorResponse: NextResponse | null }> {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return { user: null, errorResponse };

  if (!user!.roles.includes(role)) {
    return { user: null, errorResponse: forbiddenError('Akses ditolak. Peran tidak sesuai.') };
  }

  return { user, errorResponse: null };
}

/**
 * Returns true if the user has OPERATOR role but NOT ADMIN role.
 * A user with both roles is treated as ADMIN per product spec.
 */
export function isOperatorOnly(user: SessionUser): boolean {
  return user.roles.includes('OPERATOR') && !user.roles.includes('ADMIN');
}

/**
 * Guard for Operator line access.
 * Returns a forbiddenError response if the operator is not assigned to the
 * requested line, or has no assigned line at all.
 * Returns null if access is permitted.
 */
export function checkOperatorLineAccess(
  user: SessionUser,
  requestedLineId: string | null | undefined
): NextResponse | null {
  if (!isOperatorOnly(user)) return null; // Admin or multi-role: skip restriction

  if (!user.assignedLineId) {
    return forbiddenError('Operator belum ditugaskan pada jalur (Line) mana pun.');
  }

  if (requestedLineId && requestedLineId !== user.assignedLineId) {
    return forbiddenError('Akses ditolak. Anda tidak memiliki akses ke jalur (Line) ini.');
  }

  return null;
}
