import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser, hashPassword, recordActivity } from '@/lib/auth';

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

export async function POST(request, { params }) {
  try {
    const { sessionUser, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { newPassword } = body;

    const cleanPassword = (newPassword || '').trim();

    if (!cleanPassword || cleanPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found.' },
        { status: 404 }
      );
    }

    const passwordHash = await hashPassword(cleanPassword);

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    await recordActivity({
      userId: sessionUser.id,
      username: sessionUser.username,
      action: 'USER_PASSWORD_RESET',
      details: `Password reset for user "${targetUser.username}".`,
      ipAddress: clientIp
    });

    return NextResponse.json({
      success: true,
      message: `Password for "${targetUser.username}" was reset successfully.`
    });
  } catch (err) {
    console.error('Password reset error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to reset password.' },
      { status: 500 }
    );
  }
}
