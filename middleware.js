import { NextResponse } from 'next/server.js';
import { jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = 'session_token';
const DEFAULT_SECRET = 'collections-exporter-secret-key-super-secure-2026-shopify-session';

function getJwtSecret() {
  const secret = process.env.AUTH_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret);
}

// Routes that are publicly accessible without admin credentials
const PUBLIC_PATHS = [
  '/login',
  '/api/health',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/auth',
  '/api/auth/callback',
  '/api/shopify/auth/callback',
  '/api/webhooks',
  '/api/chat'
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // 1. Bypass static files, Next.js internal assets, uploads, and favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/uploads') ||
    pathname === '/favicon.ico' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next();
  }

  // 2. Extract and verify legacy admin session token if cookie is present
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let sessionPayload = null;

  if (token) {
    try {
      const secret = getJwtSecret();
      const { payload } = await jwtVerify(token, secret);
      sessionPayload = payload;
    } catch (err) {
      sessionPayload = null;
    }
  }

  const isPublicPath = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

  // 3. Handle /login page
  if (pathname === '/login') {
    if (sessionPayload && sessionPayload.userId && sessionPayload.status === 'active') {
      const targetUrl = sessionPayload.role === 'admin' ? '/admin' : '/';
      return NextResponse.redirect(new URL(targetUrl, request.url));
    }
    return NextResponse.next();
  }

  // 4. Allow public endpoints (OAuth begin/callback, auth session endpoints)
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 5. Protected Admin Routes (/admin and /api/admin/*)
  // Require valid administrator credentials session
  const isAdminRoute =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/api/admin');

  if (isAdminRoute) {
    if (!sessionPayload || !sessionPayload.userId) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Admin session missing or expired.' },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    if (sessionPayload.status === 'disabled') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Account has been disabled.' },
          { status: 403 }
        );
      }
      const loginUrl = new URL('/login?error=disabled', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    if (sessionPayload.role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Administrator privileges required.' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Attach admin headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', String(sessionPayload.userId));
    requestHeaders.set('x-user-role', String(sessionPayload.role));
    requestHeaders.set('x-user-username', String(sessionPayload.username));

    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  }

  // 6. Merchant Routes (the 4-tab app at / and API endpoints at /api/shopify/*)
  // Merchants must NEVER see a credentials login screen.
  // /api/shopify/* will validate the Shopify session token (Authorization: Bearer <token>) inside route handlers.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
