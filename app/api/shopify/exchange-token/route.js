import { NextResponse } from 'next/server';
import axios from 'axios';
import { normalizeShopUrl } from '@/lib/shopify';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { shopUrl, clientId, clientSecret, code } = body;

    if (!shopUrl || !clientId || !clientSecret || !code) {
      return NextResponse.json(
        { error: 'Missing required parameters (shopUrl, clientId, clientSecret, code)' },
        { status: 400 }
      );
    }

    const normalizedShop = normalizeShopUrl(shopUrl);

    // Exchange temporary OAuth code for permanent access token
    const tokenRes = await axios.post(
      `https://${normalizedShop}/admin/oauth/access_token`,
      {
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        code: code.trim()
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
    const scope = tokenRes.data?.scope;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to retrieve access token from Shopify' },
        { status: 500 }
      );
    }

    // Verify connection and get shop info
    const shopRes = await axios.get(
      `https://${normalizedShop}/admin/api/2024-01/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    return NextResponse.json({
      success: true,
      accessToken,
      scope,
      shop: shopRes.data?.shop || { name: normalizedShop, myshopify_domain: normalizedShop }
    });
  } catch (error) {
    const errorMsg =
      error.response?.data?.error_description ||
      error.response?.data?.error ||
      error.message ||
      'Token exchange failed';

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
