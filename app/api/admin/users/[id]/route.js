import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser, recordActivity } from '@/lib/auth';

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

// PATCH /api/admin/users/[id] - update user profile/role/status
export async function PATCH(request, { params }) {
  try {
    const { sessionUser, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { displayName, role, status } = body;

    const targetUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found.' },
        { status: 404 }
      );
    }

    // Safety check: Cannot demote or disable yourself
    if (targetUser.id === sessionUser.id) {
      if (status && status !== 'active') {
        return NextResponse.json(
          { success: false, error: 'You cannot disable your own administrator account.' },
          { status: 400 }
        );
      }
      if (role && role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'You cannot remove admin privileges from your own account.' },
          { status: 400 }
        );
      }
    }

    const updateData = {};
    if (displayName && displayName.trim()) {
      updateData.displayName = displayName.trim();
    }
    if (role && (role === 'user' || role === 'admin')) {
      updateData.role = role;
    }
    if (status && (status === 'active' || status === 'disabled')) {
      updateData.status = status;
      // If setting back to active, clear any lockout
      if (status === 'active') {
        updateData.failedLoginAttempts = 0;
        updateData.lockedUntil = null;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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
      action: 'USER_UPDATE',
      details: `Updated account "${updatedUser.username}": ${JSON.stringify(updateData)}`,
      ipAddress: clientIp
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'User updated successfully.'
    });
  } catch (err) {
    console.error('Error updating user:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update user.' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - delete user
export async function DELETE(request, { params }) {
  try {
    const { sessionUser, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const { id } = params;

    const targetUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found.' },
        { status: 404 }
      );
    }

    // Safety check: Cannot delete yourself
    if (targetUser.id === sessionUser.id) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete your own administrator account.' },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id }
    });

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    await recordActivity({
      userId: sessionUser.id,
      username: sessionUser.username,
      action: 'USER_DELETE',
      details: `Deleted account "${targetUser.username}" (${targetUser.displayName}).`,
      ipAddress: clientIp
    });

    return NextResponse.json({
      success: true,
      message: `User "${targetUser.username}" deleted successfully.`
    });
  } catch (err) {
    console.error('Error deleting user:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to delete user.' },
      { status: 500 }
    );
  }
}
