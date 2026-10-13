import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import prisma from './prisma.js';
import { verifyShopifySession } from './shopify-session.js';

const DEFAULT_SECRET = 'collections-exporter-secret-key-super-secure-2026-shopify-session';
const SESSION_COOKIE_NAME = 'session_token';
const SESSION_DURATION_HOURS = 8;
const SESSION_DURATION_SECONDS = SESSION_DURATION_HOURS * 60 * 60; // 28800s

function getJwtSecret() {
  const secret = process.env.AUTH_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret);
}

/**
 * Hash a plain text password using bcrypt
 */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

/**
 * Compare plain text password against hash
 */
export async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Generate a signed JWT session token valid for 8 hours
 */
export async function createSessionToken(user) {
  const secret = getJwtSecret();
  const token = await new SignJWT({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
    .sign(secret);

  return token;
}

/**
 * Verify JWT session token. Returns payload or null.
 */
export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Record an activity entry in the database
 */
export async function recordActivity({ userId, username, action, details = '', ipAddress = '' }) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: userId || null,
        username: username || 'anonymous',
        action,
        details,
        ipAddress
      }
    });
  } catch (err) {
    console.error('Failed to record activity log:', err);
  }
}

/**
 * Ensure default admin exists based on environment variables
 */
export async function ensureAdminSeeded() {
  try {
    const adminCount = await prisma.user.count({
      where: { role: 'admin' }
    });

    if (adminCount === 0) {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'admin12345';
      const displayName = process.env.ADMIN_DISPLAY_NAME || 'System Administrator';

      const existingUser = await prisma.user.findUnique({
        where: { username }
      });

      if (!existingUser) {
        const passwordHash = await hashPassword(password);
        const admin = await prisma.user.create({
          data: {
            username,
            displayName,
            passwordHash,
            role: 'admin',
            status: 'active'
          }
        });

        await recordActivity({
          userId: admin.id,
          username: admin.username,
          action: 'SEED_ADMIN',
          details: 'Initial administrator account seeded from environment variables.'
        });

        console.log(`[AUTH] Seeded initial admin account: ${username}`);
      }
    }
  } catch (err) {
    console.error('[AUTH] Error during admin check/seeding:', err);
  }
}

/**
 * Extract token from Request (via cookie or Authorization header)
 */
export function extractTokenFromRequest(request) {
  // 1. Check cookies via request.cookies or header
  if (request.cookies && typeof request.cookies.get === 'function') {
    const cookie = request.cookies.get(SESSION_COOKIE_NAME);
    if (cookie?.value) return cookie.value;
  }

  const cookieHeader = request.headers?.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) {
      return decodeURIComponent(match.split('=')[1]);
    }
  }

  // 2. Check Authorization: Bearer <token>
  const authHeader = request.headers?.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Get the currently authenticated session and database user from a request
 */
export async function getSessionUser(request) {
  const token = extractTokenFromRequest(request);
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload || !payload.userId) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId }
  });

  if (!dbUser || dbUser.status !== 'active') {
    return null;
  }

  return {
    token,
    payload,
    user: {
      id: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.displayName,
      role: dbUser.role,
      status: dbUser.status,
      createdAt: dbUser.createdAt,
      lastLoginAt: dbUser.lastLoginAt
    }
  };
}

/**
 * Require valid active session for API routes.
 * Merchant routes (/api/shopify/*) are authenticated by the Shopify session token.
 * If ENABLE_LEGACY_LOGIN=true in dev, fallback to credentials session is allowed.
 */
export async function requireAuth(request) {
  const authHeader = request.headers.get('authorization') || '';

  // 1. Check Shopify session token in Authorization header
  if (authHeader.startsWith('Bearer ')) {
    const shopifySession = await verifyShopifySession(request);
    if (shopifySession.valid) {
      return {
        sessionUser: {
          id: shopifySession.shopRecord?.id || shopifySession.shop,
          username: shopifySession.shop,
          displayName: shopifySession.shop,
          role: 'merchant',
          shop: shopifySession.shop,
          accessToken: shopifySession.accessToken
        },
        shopifySession
      };
    } else {
      const reauthUrl = shopifySession.reauthorizeUrl || '/api/auth';
      return {
        errorResponse: new Response(
          JSON.stringify({
            success: false,
            error: shopifySession.error || 'Shopify session missing or invalid.',
            reauthorizeUrl: reauthUrl
          }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-API-Request-Failure-Reauthorize': '1',
              'X-Shopify-API-Request-Failure-Reauthorize-Url': reauthUrl
            }
          }
        )
      };
    }
  }

  // 2. Check if legacy login is explicitly enabled for development
  const isLegacyAllowed = process.env.ENABLE_LEGACY_LOGIN === 'true';
  if (isLegacyAllowed) {
    const sessionData = await getSessionUser(request);
    if (sessionData && sessionData.user) {
      if (sessionData.user.status !== 'active') {
        return {
          errorResponse: new Response(
            JSON.stringify({ success: false, error: 'Forbidden: Account is deactivated.' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          )
        };
      }
      if (!sessionData.user.shop || !sessionData.user.accessToken) {
        try {
          const defaultShop = await prisma.shop.findFirst({
            where: { uninstalledAt: null },
            orderBy: { installedAt: 'desc' }
          });
          if (defaultShop) {
            const { getShopAccessToken } = await import('./shop-link.js');
            const token = await getShopAccessToken(defaultShop.shop);
            sessionData.user.shop = defaultShop.shop;
            sessionData.user.accessToken = token;
          }
        } catch (_) {}
      }
      return { sessionUser: sessionData.user };
    }
  }

  // 3. Fallback: unauthenticated request
  return {
    errorResponse: new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized: Shopify session token required.'
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-API-Request-Failure-Reauthorize': '1',
          'X-Shopify-API-Request-Failure-Reauthorize-Url': '/api/auth'
        }
      }
    )
  };
}

export { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS };


