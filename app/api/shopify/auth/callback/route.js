import { NextResponse } from 'next/server';
import axios from 'axios';
import { normalizeShopUrl } from '@/lib/shopify';

export const dynamic = 'force-dynamic';

const CLIENT_ID = '';
const CLIENT_SECRET = '';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const shop = searchParams.get('shop') || '';

  if (!code) {
    return NextResponse.redirect(new URL('/?error=missing_code', request.url));
  }

  try {
    const normalizedShop = normalizeShopUrl(shop);

    // Exchange authorization code for permanent access token
    const tokenRes = await axios.post(
      `https://${normalizedShop}/admin/oauth/access_token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 20000
      }
    );

    const accessToken = tokenRes.data?.access_token;

    if (accessToken) {
      // Redirect back to home with the token so frontend can auto-connect
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('shop', normalizedShop);
      redirectUrl.searchParams.set('token', accessToken);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.redirect(new URL('/?error=token_failed', request.url));
  } catch (err) {
    console.error('OAuth exchange error:', err.response?.data || err.message);
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(err.message)}`, request.url));
  }
}
