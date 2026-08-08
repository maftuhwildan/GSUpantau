/**
 * middleware.ts — Next.js Edge Middleware
 *
 * Runs in the Edge Runtime. MUST only import Edge-compatible modules.
 * Import from session-token.ts (no DB), NOT from auth.ts (imports @/db).
 *
 * Authorization strategy:
 * - Middleware uses token signature/expiry for coarse navigation redirects.
 * - Roles in the token are used as a navigation hint (redirect to /login,
 *   redirect non-admin away from /admin/*).
 * - API route handlers are the authoritative enforcement layer: they reload
 *   user status and roles from the database on every request.
 * - Server layouts / page guards should call protected API endpoints or use
 *   server-side DB auth helpers to confirm actual DB state.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/session-token';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, API routes, and Next.js internals to pass through.
  // API routes enforce their own DB-authoritative authentication.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  // verifySessionToken is Edge-safe: pure HMAC check, no DB access.
  const payload = token ? await verifySessionToken(token) : null;

  const isLoginPage = pathname === '/login';
  const isAdminPath = pathname.startsWith('/admin');
  const isDevPath = pathname.startsWith('/dev');
  const isOperatorPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/receiving-queue') ||
    pathname.startsWith('/active-session') ||
    pathname.startsWith('/sensor-activity');

  // 1. Unauthenticated → redirect to login
  if (!payload && (isAdminPath || isOperatorPath || isDevPath)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated user accessing /login → redirect home
  if (payload && isLoginPage) {
    const homeUrl = payload.roles.includes('ADMIN') ? '/admin/dashboard' : '/dashboard';
    return NextResponse.redirect(new URL(homeUrl, request.url));
  }

  // 3. Non-admin token accessing /admin/* or /dev/*
  //    (Navigation hint only — API routes enforce DB-authoritative roles.)
  if (payload && (isAdminPath || isDevPath) && !payload.roles.includes('ADMIN')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/dashboard/:path*',
    '/receiving-queue/:path*',
    '/active-session/:path*',
    '/sensor-activity/:path*',
    '/admin/:path*',
    '/dev/:path*',
  ],
};
