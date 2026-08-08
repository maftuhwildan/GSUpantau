/**
 * session-token.ts
 *
 * Edge-safe module: HMAC sign/verify for session tokens.
 * MUST NOT import from @/db, drizzle-orm, pg, or @electric-sql/pglite.
 * Used by both middleware (Edge Runtime) and auth.ts (Node.js runtime).
 */

export const SESSION_COOKIE_NAME = 'gsu_session';
export const SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

/**
 * Get (or derive) the session secret.
 * In production, SESSION_SECRET env var is mandatory.
 * This is validated lazily so that unit tests that do not hit production paths
 * can still import the module without setting the env var.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }
  return secret || 'dev-secret-poultry-counter-key-2026';
}

/** Shape of the JWT-like payload stored inside the signed token. */
export interface SessionPayload {
  /** Database UUID of the user — always a proper UUID in tokens issued after Batch 11. */
  userId: string;
  email: string;
  name: string;
  /** Roles stored here are navigation hints only; backend always re-reads DB. */
  roles: string[];
  expiresAt: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

async function getCryptoKey(): Promise<CryptoKey> {
  const secretKey = getSessionSecret();
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): ArrayBuffer {
  const view = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    view[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return view.buffer;
}

// ─── Public API ─────────────────────────────────────────────────────────────

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
