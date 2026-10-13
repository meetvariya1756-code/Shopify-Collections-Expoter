import fs from 'fs';
import path from 'path';

/**
 * Permanently removes all files and the directory for a given conversation ID.
 */
export async function deleteConversationFiles(conversationId) {
  if (!conversationId) return false;

  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat', conversationId);

    if (fs.existsSync(uploadDir)) {
      // Recursively remove directory and all files inside
      fs.rmSync(uploadDir, { recursive: true, force: true });
      return true;
    }
    return true;
  } catch (err) {
    console.error(`Failed to delete files for conversation ${conversationId}:`, err);
    return false;
  }
}
