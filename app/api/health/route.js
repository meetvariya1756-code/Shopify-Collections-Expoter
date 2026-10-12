import { NextResponse } from 'next/server.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rawCommit = (process.env.RENDER_GIT_COMMIT || '').trim();
  const commit = rawCommit ? rawCommit.slice(0, 7) : 'dev';
  return NextResponse.json({ ok: true, commit });
}
