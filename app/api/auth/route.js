import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawShop = searchParams.get('shop') || '';
  const shop = rawShop.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase().trim();

  if (!shop || !shop.includes('.myshopify.com')) {
    return NextResponse.json(
      { error: 'Valid shop parameter required (e.g. your-store.myshopify.com).' },
      { status: 400 }
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const scopes = process.env.SCOPES || 'read_products,write_products';
  const rawHost = process.env.HOST || new URL(request.url).origin;
  const redirectUri = `${rawHost.replace(/\/$/, '')}/api/auth/callback`;
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${encodeURIComponent(
    scopes
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  const response = NextResponse.redirect(authUrl);
  // Store state in cookie for validation in callback
  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300,
    path: '/'
  });

  return response;
}
