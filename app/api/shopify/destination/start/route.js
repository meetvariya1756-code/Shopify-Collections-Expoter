import { NextResponse } from 'next/server.js';
import crypto from 'crypto';
import { requireAuth } from '../../../../../lib/auth.js';
import {
  isValidShopifyDomain,
  normalizeShopifyDomain,
  saveOAuthState
} from '../../../../../lib/shop-link.js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shopify/destination/start
 *
 * 1. Requires valid Shopify session from source store
 * 2. Validates destination myshopify domain format ^[a-z0-9][a-z0-9-]*\.myshopify\.com$
 * 3. Creates a random state stored in DB with 10 min expiry
 * 4. Returns Shopify authorize URL for top-level redirect
 */
export async function POST(request) {
  try {
    const { sessionUser, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    const sourceShop = sessionUser?.shop;
    if (!sourceShop) {
      return NextResponse.json(
        { success: false, error: 'Shopify session required.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawDestination = body.destinationShop || body.destination || '';
    const destinationShop = normalizeShopifyDomain(rawDestination);

    if (!isValidShopifyDomain(destinationShop)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid destination domain. Must match format: store-name.myshopify.com'
        },
        { status: 400 }
      );
    }

    if (destinationShop === normalizeShopifyDomain(sourceShop)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Destination store cannot be the same as your source store.'
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error: missing NEXT_PUBLIC_SHOPIFY_API_KEY.' },
        { status: 500 }
      );
    }

    const scopes = process.env.SCOPES || 'read_products,write_products';
    const rawHost = process.env.HOST || new URL(request.url).origin;
    const redirectUri = `${rawHost.replace(/\/$/, '')}/api/auth/callback`;

    // Generate cryptographically secure random state (32 hex characters)
    const state = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Persist OAuth state to DB
    await saveOAuthState({
      state,
      sourceShop,
      destinationShop,
      expiresAt
    });

    const authorizeUrl = `https://${destinationShop}/admin/oauth/authorize?client_id=${apiKey}&scope=${encodeURIComponent(
      scopes
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return NextResponse.json({
      success: true,
      authorizeUrl,
      destinationShop,
      state
    });
  } catch (err) {
    console.error('[DESTINATION_START_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to start destination store authorization.' },
      { status: 500 }
    );
  }
}
