import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendChatTranscriptEmail } from '@/lib/email';
import { deleteConversationFiles } from '@/lib/chat-cleanup';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const filter = searchParams.get('filter') || 'all'; // 'all' | 'call' | 'human' | 'unread'
    const search = searchParams.get('search') || '';

    // Build where clause
    const where = {};

    if (status !== 'all') {
      where.status = status;
    }

    if (filter === 'call') {
      where.callRequested = true;
    } else if (filter === 'human') {
      where.humanRequested = true;
    } else if (filter === 'unread') {
      where.unreadAdminCount = { gt: 0 };
    }

    if (search.trim()) {
      where.OR = [
        { shop: { contains: search.trim(), mode: 'insensitive' } },
        { customerEmail: { contains: search.trim(), mode: 'insensitive' } },
        { customerName: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const conversations = await prisma.supportConversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        attachments: true
      }
    });

    // Compute live metric summary counts for alerts
    const allActive = await prisma.supportConversation.findMany({
      select: {
        id: true,
        status: true,
        callRequested: true,
        humanRequested: true,
        unreadAdminCount: true
      }
    });

    const summary = {
      total: allActive.length,
      pendingCount: allActive.filter((c) => c.status === 'Pending').length,
      inProgressCount: allActive.filter((c) => c.status === 'In Progress').length,
      callRequestsCount: allActive.filter((c) => c.callRequested).length,
      humanRequestsCount: allActive.filter((c) => c.humanRequested).length,
      totalUnread: allActive.reduce((acc, c) => acc + (c.unreadAdminCount || 0), 0)
    };

    return NextResponse.json({
      success: true,
      conversations,
      summary
    });
  } catch (err) {
    console.error('Error fetching admin chats:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { conversationId, status, markAsRead } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required.' }, { status: 400 });
    }

    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        attachments: true
      }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    // If marking as read
    if (markAsRead) {
      await prisma.supportConversation.update({
        where: { id: conversationId },
        data: { unreadAdminCount: 0 }
      });
    }

    // If status is being updated to RESOLVED:
    if (status === 'Resolved') {
      const customerEmail = conversation.customerEmail;
      if (!customerEmail) {
        return NextResponse.json(
          { error: 'Cannot resolve chat: No customer email associated with this conversation.' },
          { status: 400 }
        );
      }

      // 1. Send complete conversation history email to customer
      let emailResult;
      try {
        emailResult = await sendChatTranscriptEmail({
          to: customerEmail,
          shop: conversation.shop,
          customerName: conversation.customerName || 'Merchant',
          conversation,
          messages: conversation.messages,
          attachments: conversation.attachments
        });
      } catch (emailErr) {
        console.error('Failed to send resolution email:', emailErr);
        return NextResponse.json(
          {
            error: `Failed to deliver chat transcript to ${customerEmail}: ${emailErr.message}. Conversation was NOT deleted.`
          },
          { status: 502 }
        );
      }

      // 2. Verified delivery - now permanently purge conversation data and files
      try {
        await deleteConversationFiles(conversationId);
      } catch (fileErr) {
        console.warn('Warning deleting conversation files:', fileErr);
      }

      // 3. Delete from database
      await prisma.supportConversation.delete({
        where: { id: conversationId }
      });

      return NextResponse.json({
        success: true,
        resolvedAndDeleted: true,
        emailSentTo: customerEmail,
        previewUrl: emailResult?.previewUrl || null,
        message: `Transcript successfully emailed to ${customerEmail}. Conversation history and files have been permanently cleared.`
      });
    }

    // Other status updates (Pending, In Progress, Closed)
    const updateData = {};
    if (status) {
      updateData.status = status;
    }
    if (markAsRead) {
      updateData.unreadAdminCount = 0;
    }

    const updated = await prisma.supportConversation.update({
      where: { id: conversationId },
      data: updateData,
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        attachments: true
      }
    });

    return NextResponse.json({ success: true, conversation: updated });
  } catch (err) {
    console.error('Error updating admin chat:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Conversation ID is required.' }, { status: 400 });
    }

    const existing = await prisma.supportConversation.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    // Permanently clean up files from disk
    await deleteConversationFiles(id);

    // Delete from database
    await prisma.supportConversation.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      deleted: true,
      message: 'Conversation and all associated files permanently deleted.'
    });
  } catch (err) {
    console.error('Error deleting chat:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
