import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const sessionData = await getSessionUser(request);

    if (!sessionData || !sessionData.user) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: sessionData.user
    });
  } catch (err) {
    console.error('Session check error:', err);
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 500 }
    );
  }
}
