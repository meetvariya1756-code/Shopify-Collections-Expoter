import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

export async function GET(request) {
  try {
    const { errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const [totalUsers, activeUsers, disabledUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { status: 'disabled' } })
    ]);

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const loginsLast24h = await prisma.activityLog.count({
      where: {
        action: 'LOGIN',
        createdAt: { gte: last24h }
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        disabledUsers,
        loginsLast24h
      }
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics.' },
      { status: 500 }
    );
  }
}
