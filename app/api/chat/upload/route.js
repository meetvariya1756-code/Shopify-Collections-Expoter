import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const conversationId = formData.get('conversationId');

    if (!file || !conversationId) {
      return NextResponse.json(
        { error: 'File and conversationId are required.' },
        { status: 400 }
      );
    }

    const conversation = await prisma.supportConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or has expired.' },
        { status: 404 }
      );
    }

    // Determine target directory
    const targetDir = path.join(process.cwd(), 'public', 'uploads', 'chat', conversationId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Sanitize filename & avoid collisions
    const originalName = file.name || 'attachment';
    const ext = path.extname(originalName) || '';
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueFileName = `${Date.now()}_${baseName}${ext}`;
    const filePath = path.join(targetDir, uniqueFileName);

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/chat/${conversationId}/${uniqueFileName}`;
    const fileMime = file.type || 'application/octet-stream';
    const fileSize = buffer.length;

    // Save attachment in database
    const attachment = await prisma.supportAttachment.create({
      data: {
        conversationId,
        fileUrl,
        fileName: originalName,
        fileSize,
        fileMime,
        filePath
      }
    });

    return NextResponse.json({
      success: true,
      attachmentId: attachment.id,
      fileUrl,
      fileName: originalName,
      fileSize,
      fileMime
    });
  } catch (err) {
    console.error('Error in chat file upload:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
