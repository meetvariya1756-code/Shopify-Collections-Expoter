import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const body = await request.json();
    const { conversationId, phone, preferredTime, topic } = body;

    if (!conversationId || !phone) {
      return NextResponse.json(
        { error: 'Conversation ID and phone number are required.' },
        { status: 400 }
      );
    }

    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    // Update conversation
    const updated = await prisma.supportConversation.update({
      where: { id: conversationId },
      data: {
        callRequested: true,
        supportType: 'call',
        customerPhone: phone,
        callPreferredTime: preferredTime || 'ASAP',
        callTopic: topic || 'General Support',
        status: 'Pending',
        lastMessage: `📞 Call Request: ${phone}`,
        lastMessageAt: new Date(),
        unreadAdminCount: { increment: 1 }
      }
    });

    // Create system notification message
    await prisma.supportMessage.create({
      data: {
        conversationId,
        sender: 'system',
        senderName: 'Collections Exporter System',
        messageType: 'system',
        content: `📞 **Call Support Requested**\n- Phone: **${phone}**\n- Preferred Time: **${preferredTime || 'As soon as possible'}**\n- Topic: **${topic || 'General Inquiry'}**`
      }
    });

    return NextResponse.json({ success: true, conversation: updated });
  } catch (err) {
    console.error('Error requesting call support:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
