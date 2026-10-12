import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser, hashPassword, recordActivity } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Verify admin access. Returns sessionData or NextResponse error.
 */
async function requireAdmin(request) {
  const sessionData = await getSessionUser(request);
  if (!sessionData || !sessionData.user) {
    return { errorResponse: NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 }) };
  }
  if (sessionData.user.role !== 'admin') {
    return { errorResponse: NextResponse.json({ success: false, error: 'Forbidden: Admin access required.' }, { status: 403 }) };
  }
  return { sessionUser: sessionData.user };
}

// GET /api/admin/users - list users with search and filter
export async function GET(request) {
  try {
    const { sessionUser, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const roleFilter = searchParams.get('role')?.trim() || '';
    const statusFilter = searchParams.get('status')?.trim() || '';

    const where = {};

    if (search) {
      where.OR = [
        { displayName: { contains: search } },
        { username: { contains: search } }
      ];
    }

    if (roleFilter && roleFilter !== 'all') {
      where.role = roleFilter;
    }

    if (statusFilter && statusFilter !== 'all') {
      where.status = statusFilter;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        username: true,
        role: true,
        status: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      users
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users.' },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - create new user
export async function POST(request) {
  try {
    const { sessionUser, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const body = await request.json().catch(() => ({}));
    const { displayName, username, password, role = 'user', status = 'active' } = body;

    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanDisplayName = (displayName || '').trim();
    const cleanPassword = (password || '').trim();

    if (!cleanUsername || !cleanDisplayName || !cleanPassword) {
      return NextResponse.json(
        { success: false, error: 'Display Name, Username, and Password are all required.' },
        { status: 400 }
      );
    }

    if (cleanPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Username "${cleanUsername}" is already taken.` },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(cleanPassword);
    const validRole = role === 'admin' ? 'admin' : 'user';
    const validStatus = status === 'disabled' ? 'disabled' : 'active';

    const newUser = await prisma.user.create({
      data: {
        displayName: cleanDisplayName,
        username: cleanUsername,
        passwordHash,
        role: validRole,
        status: validStatus
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    await recordActivity({
      userId: sessionUser.id,
      username: sessionUser.username,
      action: 'USER_CREATE',
      details: `Created new ${validRole} account "${newUser.username}" (${newUser.displayName}).`,
      ipAddress: clientIp
    });

    return NextResponse.json({
      success: true,
      user: newUser,
      message: 'User created successfully.'
    }, { status: 201 });
  } catch (err) {
    console.error('Error creating user:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create user.' },
      { status: 500 }
    );
  }
}
