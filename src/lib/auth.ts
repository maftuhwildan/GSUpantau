
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Permission, getPermissionsForRoles } from './permissions';
import { unauthorizedError, forbiddenError } from './errors';

export const SESSION_COOKIE_NAME = 'gsu_session';
export const SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

const SECRET_KEY = process.env.SESSION_SECRET || 'dev-secret-poultry-counter-key-2026';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  expiresAt: number;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: Permission[];
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

async function getCryptoKey() {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): ArrayBuffer {
  const view = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    view[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return view.buffer;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const jsonStr = JSON.stringify(payload);
  const encodedData = base64UrlEncode(jsonStr);
  const key = await getCryptoKey();
  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(encodedData)
  );
  const signature = bufferToHex(signatureBuffer);
  return `${encodedData}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token || !token.includes('.')) return null;

  const [encodedData, signature] = token.split('.');
  if (!encodedData || !signature) return null;

  try {
    const key = await getCryptoKey();
    const encoder = new TextEncoder();
    const signatureBuffer = hexToBuffer(signature);
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      encoder.encode(encodedData)
    );

    if (!isValid) return null;

    const payload: SessionPayload = JSON.parse(base64UrlDecode(encodedData));
    if (Date.now() > payload.expiresAt) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getSessionFromToken(token: string): Promise<SessionUser | null> {
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const permissions = getPermissionsForRoles(payload.roles);

  return {
    id: payload.userId,
    email: payload.email,
    name: payload.name,
    roles: payload.roles,
    permissions,
  };
}

export async function getAuthSession(req?: Request | NextRequest): Promise<SessionUser | null> {
  let token: string | undefined;

  if (req) {
    // Check Cookie header or cookies
    if ('cookies' in req && typeof req.cookies.get === 'function') {
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
      // If outside request context
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

export async function requireAuth(req: Request): Promise<{ user: SessionUser | null; errorResponse: NextResponse | null }> {
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
