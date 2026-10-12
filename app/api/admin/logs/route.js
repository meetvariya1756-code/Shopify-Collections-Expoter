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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const actionFilter = searchParams.get('action')?.trim();

    const where = {};
    if (actionFilter && actionFilter !== 'all') {
      where.action = actionFilter;
    }

    const logs = await prisma.activityLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      logs
    });
  } catch (err) {
    console.error('Error fetching activity logs:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity logs.' },
      { status: 500 }
    );
  }
}
