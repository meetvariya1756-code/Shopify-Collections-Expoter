import { NextResponse } from 'next/server';
import {
  getSessionUser,
  recordActivity,
  SESSION_COOKIE_NAME
} from '@/lib/auth';

export async function POST(request) {
  try {
    const sessionData = await getSessionUser(request);

    if (sessionData?.user) {
      const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      await recordActivity({
        userId: sessionData.user.id,
        username: sessionData.user.username,
        action: 'LOGOUT',
        details: 'User logged out.',
        ipAddress: clientIp
      });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully.'
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 0
    });

    return response;
  } catch (err) {
    console.error('Logout error:', err);
    return NextResponse.json({ success: true });
  }
}
