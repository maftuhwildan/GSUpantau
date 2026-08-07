import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromToken, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, api auth, next internal files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? await getSessionFromToken(token) : null;

  const isLoginPage = pathname === '/login';
  const isAdminPath = pathname.startsWith('/admin');
  const isOperatorPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/receiving-queue') ||
    pathname.startsWith('/active-session') ||
    pathname.startsWith('/sensor-activity');

  // 1. Unauthenticated user trying to access protected paths
  if (!user && (isAdminPath || isOperatorPath)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Logged in user accessing /login
  if (user && isLoginPage) {
    const homeUrl = user.roles.includes('ADMIN') ? '/admin/dashboard' : '/dashboard';
    return NextResponse.redirect(new URL(homeUrl, request.url));
  }

  // 3. Operator user trying to access /admin/*
  if (user && isAdminPath && !user.roles.includes('ADMIN')) {
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
  ],
};
