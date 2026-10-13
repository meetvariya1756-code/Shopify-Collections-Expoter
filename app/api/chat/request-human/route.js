import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required.' }, { status: 400 });
    }

    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    const updated = await prisma.supportConversation.update({
      where: { id: conversationId },
      data: {
        humanRequested: true,
        status: 'Pending',
        lastMessage: '🙋 Connect with Human Requested',
        lastMessageAt: new Date(),
        unreadAdminCount: { increment: 1 }
      }
    });

    await prisma.supportMessage.create({
      data: {
        conversationId,
        sender: 'system',
        senderName: 'Collections Exporter System',
        messageType: 'system',
        content: '🙋 **Live Human Agent Requested**: Customer requested to chat with a human support agent. An admin has been notified.'
      }
    });

    return NextResponse.json({ success: true, conversation: updated });
  } catch (err) {
    console.error('Error requesting human support:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
