import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  url.pathname = '/api/auth/callback';
  return NextResponse.redirect(url);
}
