import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      shop,
      customerEmail,
      customerName = 'Shopify Merchant',
      supportType = 'chat', // 'chat' | 'call'
      customerPhone,
      callTopic,
      callPreferredTime,
      requestHuman = false,
      initialMessage
    } = body;

    if (!shop || !customerEmail) {
      return NextResponse.json(
        { error: 'Shop domain and customer email are required.' },
        { status: 400 }
      );
    }

    // Check if there's already an active (Pending or In Progress) conversation
    let conversation = await prisma.supportConversation.findFirst({
      where: {
        shop,
        customerEmail,
        status: { in: ['Pending', 'In Progress'] }
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        attachments: true
      }
    });

    if (!conversation) {
      // Create new conversation
      conversation = await prisma.supportConversation.create({
        data: {
          shop,
          customerEmail,
          customerName,
          customerPhone: customerPhone || null,
          supportType,
          callRequested: supportType === 'call' || !!customerPhone,
          callTopic: callTopic || null,
          callPreferredTime: callPreferredTime || null,
          humanRequested: Boolean(requestHuman),
          status: 'Pending',
          lastMessage: initialMessage || (supportType === 'call' ? '📞 Call Support Requested' : 'Session Started'),
          unreadAdminCount: 1,
          unreadCustomerCount: 0
        },
        include: {
          messages: true,
          attachments: true
        }
      });

      // Add welcoming message
      if (supportType === 'call') {
        await prisma.supportMessage.create({
          data: {
            conversationId: conversation.id,
            sender: 'system',
            senderName: 'Collections Exporter Bot',
            messageType: 'system',
            content: `📞 Call Support requested by ${customerName} (${customerEmail}). Phone: ${customerPhone || 'N/A'}. Preferred Time: ${callPreferredTime || 'ASAP'}. Topic: ${callTopic || 'General Inquiry'}.`
          }
        });
      } else {
        await prisma.supportMessage.create({
          data: {
            conversationId: conversation.id,
            sender: 'bot',
            senderName: 'Collections Exporter Bot',
            messageType: 'text',
            content: `👋 Hello ${customerName}! Welcome to Collections Exporter Support. How can we help you today? You can send messages, emojis, voice notes, and media files. Or click "Connect with Human" anytime!`
          }
        });
      }

      // If customer included an initial message
      if (initialMessage && initialMessage.trim()) {
        await prisma.supportMessage.create({
          data: {
            conversationId: conversation.id,
            sender: 'customer',
            senderName: customerName,
            messageType: 'text',
            content: initialMessage.trim()
          }
        });
      }

      // Re-fetch conversation with all messages
      conversation = await prisma.supportConversation.findUnique({
        where: { id: conversation.id },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          attachments: true
        }
      });
    } else {
      // Update fields if call was requested on existing session
      const updateData = {};
      if (supportType === 'call') {
        updateData.callRequested = true;
        updateData.supportType = 'call';
        if (customerPhone) updateData.customerPhone = customerPhone;
        if (callTopic) updateData.callTopic = callTopic;
        if (callPreferredTime) updateData.callPreferredTime = callPreferredTime;
      }
      if (requestHuman) {
        updateData.humanRequested = true;
      }

      if (Object.keys(updateData).length > 0) {
        conversation = await prisma.supportConversation.update({
          where: { id: conversation.id },
          data: updateData,
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
            attachments: true
          }
        });
      }
    }

    return NextResponse.json({ success: true, conversation });
  } catch (err) {
    console.error('Error handling chat session:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const shop = searchParams.get('shop');
    const email = searchParams.get('email');

    if (id) {
      const conversation = await prisma.supportConversation.findUnique({
        where: { id },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          attachments: true
        }
      });
      return NextResponse.json({ success: true, conversation });
    }

    if (shop && email) {
      const conversation = await prisma.supportConversation.findFirst({
        where: {
          shop,
          customerEmail: email,
          status: { in: ['Pending', 'In Progress'] }
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          attachments: true
        }
      });
      return NextResponse.json({ success: true, conversation });
    }

    return NextResponse.json({ error: 'Missing conversation identifier' }, { status: 400 });
  } catch (err) {
    console.error('Error fetching chat session:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
