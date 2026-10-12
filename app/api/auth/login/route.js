import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  verifyPassword,
  createSessionToken,
  recordActivity,
  ensureAdminSeeded,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS
} from '@/lib/auth';

export async function POST(request) {
  try {
    await ensureAdminSeeded();

    const body = await request.json().catch(() => ({}));
    const { username, password } = body;

    const trimmedUsername = (username || '').trim();
    const cleanPassword = password || '';

    if (!trimmedUsername || !cleanPassword) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required.' },
        { status: 400 }
      );
    }

    // Find user (case insensitive match on username)
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: trimmedUsername
        }
      }
    });

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // Generic error response to prevent user enumeration
    const genericAuthError = 'Invalid username or password.';

    if (!user) {
      await recordActivity({
        username: trimmedUsername,
        action: 'LOGIN_FAILED',
        details: 'Failed login attempt: username not found.',
        ipAddress: clientIp
      });

      return NextResponse.json(
        { success: false, error: genericAuthError },
        { status: 401 }
      );
    }

    // Check account lockout (brute-force rate limit)
    const now = new Date();
    if (user.lockedUntil && new Date(user.lockedUntil) > now) {
      const remainingMs = new Date(user.lockedUntil).getTime() - now.getTime();
      const remainingMins = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));

      await recordActivity({
        userId: user.id,
        username: user.username,
        action: 'LOGIN_BLOCKED',
        details: `Login blocked: account locked for another ${remainingMins} min(s).`,
        ipAddress: clientIp
      });

      return NextResponse.json(
        {
          success: false,
          error: `Too many failed attempts. Account is locked. Please try again in ${remainingMins} minute${remainingMins > 1 ? 's' : ''}.`
        },
        { status: 429 }
      );
    }

    // Verify password
    const passwordValid = await verifyPassword(cleanPassword, user.passwordHash);

    if (!passwordValid) {
      const newFailedCount = (user.failedLoginAttempts || 0) + 1;
      let newLockedUntil = null;

      if (newFailedCount >= 5) {
        // Lock out for 15 minutes
        newLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedCount,
          lockedUntil: newLockedUntil
        }
      });

      await recordActivity({
        userId: user.id,
        username: user.username,
        action: newLockedUntil ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
        details: newLockedUntil
          ? `Account locked out for 15 minutes after ${newFailedCount} failed attempts.`
          : `Invalid password entered (attempt ${newFailedCount}/5).`,
        ipAddress: clientIp
      });

      if (newLockedUntil) {
        return NextResponse.json(
          {
            success: false,
            error: 'Too many failed attempts. Account locked for 15 minutes. Please try again later.'
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { success: false, error: genericAuthError },
        { status: 401 }
      );
    }

    // Check if user is disabled
    if (user.status !== 'active') {
      await recordActivity({
        userId: user.id,
        username: user.username,
        action: 'LOGIN_DISABLED',
        details: 'Login denied: account is disabled.',
        ipAddress: clientIp
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Your account has been disabled. Please contact an administrator.'
        },
        { status: 403 }
      );
    }

    // Reset failed attempts & update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now
      }
    });

    await recordActivity({
      userId: user.id,
      username: user.username,
      action: 'LOGIN',
      details: `Successful sign-in as role "${user.role}".`,
      ipAddress: clientIp
    });

    // Create session JWT token
    const token = await createSessionToken(user);

    const safeUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: now
    };

    const response = NextResponse.json({
      success: true,
      user: safeUser,
      token
    });

    const isProduction = process.env.NODE_ENV === 'production';
    const isHttps = request.headers.get('x-forwarded-proto') === 'https' ||
                    request.url.startsWith('https') ||
                    isProduction;

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS
    });

    return response;
  } catch (err) {
    console.error('[AUTH_LOGIN_ERROR] Real error during authentication:', err);
    const errorMessage = err?.message || '';
    const isDbTableMissing = errorMessage.includes('does not exist') || err?.code === 'P2021';
    const isDbConnError = errorMessage.includes('DATABASE_URL') || err?.code === 'P1001' || err?.code === 'P1003';

    let userFacingError = 'Internal server error during authentication.';
    if (isDbTableMissing) {
      userFacingError = 'Database tables not initialized. Please ensure "npx prisma db push" is run on Render.';
    } else if (isDbConnError) {
      userFacingError = 'Database connection error. Please verify DATABASE_URL in Render environment variables.';
    }

    return NextResponse.json(
      { success: false, error: userFacingError, details: process.env.NODE_ENV !== 'production' ? errorMessage : undefined },
      { status: 500 }
    );
  }
}
