import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      conversationId,
      sender = 'customer', // 'customer' | 'admin' | 'bot' | 'system'
      senderName,
      messageType = 'text', // 'text' | 'audio' | 'image' | 'video' | 'file' | 'system'
      content,
      fileUrl,
      fileName,
      fileSize,
      fileMime
    } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required.' }, { status: 400 });
    }

    if (!content && !fileUrl) {
      return NextResponse.json({ error: 'Message content or file is required.' }, { status: 400 });
    }

    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found or has been resolved.' }, { status: 404 });
    }

    // Create the message
    const message = await prisma.supportMessage.create({
      data: {
        conversationId,
        sender,
        senderName: senderName || (sender === 'customer' ? conversation.customerName || 'Customer' : 'Support Team'),
        messageType,
        content: content || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize ? Number(fileSize) : null,
        fileMime: fileMime || null
      }
    });

    // Update conversation metadata
    const snippet = content
      ? content.slice(0, 100)
      : messageType === 'audio'
      ? '🎤 Audio message'
      : messageType === 'image'
      ? '📷 Image attachment'
      : messageType === 'video'
      ? '🎥 Video attachment'
      : '📎 File attachment';

    const isCustomer = sender === 'customer';
    await prisma.supportConversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: snippet,
        lastMessageAt: new Date(),
        unreadAdminCount: isCustomer ? { increment: 1 } : conversation.unreadAdminCount,
        unreadCustomerCount: !isCustomer ? { increment: 1 } : conversation.unreadCustomerCount,
        // If customer sends new message on a pending/closed, keep active
        status: conversation.status === 'Closed' ? 'Pending' : conversation.status
      }
    });

    // If customer sent message and haven't requested human yet, check for automated helpful reply
    if (isCustomer && !conversation.humanRequested && messageType === 'text') {
      const lower = (content || '').toLowerCase();
      let botReply = null;

      if (lower.includes('export') || lower.includes('download')) {
        botReply = "💡 **Tip for Collections Export:** Head over to the 'Collections & Export' tab, select the collections you wish to export, and click 'Export to Excel'. Your .xlsx file will download with all metadata!";
      } else if (lower.includes('import') || lower.includes('upload') || lower.includes('excel')) {
        botReply = "💡 **Tip for Excel Import:** Visit the 'Excel Import' tab, drag & drop your modified .xlsx file, choose your match strategy (By Handle or Title), and click 'Start Migration Pipeline'!";
      } else if (lower.includes('call') || lower.includes('phone')) {
        botReply = "📞 Would you like our support team to call you? Click the **'Request Call'** button above to submit your phone number and preferred time!";
      } else if (lower.includes('human') || lower.includes('agent') || lower.includes('person') || lower.includes('talk')) {
        botReply = "🙋 Looking to speak with a human support agent? Click the **'Connect with Human'** button in the header, and an agent will join shortly!";
      }

      if (botReply) {
        setTimeout(async () => {
          try {
            await prisma.supportMessage.create({
              data: {
                conversationId,
                sender: 'bot',
                senderName: 'Collections Exporter Assistant',
                messageType: 'text',
                content: botReply
              }
            });
          } catch (_) {}
        }, 800);
      }
    }

    return NextResponse.json({ success: true, message });
  } catch (err) {
    console.error('Error posting chat message:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required.' }, { status: 400 });
    }

    const messages = await prisma.supportMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ success: true, messages });
  } catch (err) {
    console.error('Error fetching messages:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
