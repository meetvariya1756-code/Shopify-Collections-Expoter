import { NextResponse } from 'next/server.js';
import crypto from 'crypto';
import prisma from '../../../../lib/prisma.js';
import { encrypt } from '../../../../lib/encryption.js';
import {
  isValidShopifyDomain,
  normalizeShopifyDomain,
  verifyAndConsumeOAuthState,
  createShopLink
} from '../../../../lib/shop-link.js';

export const dynamic = 'force-dynamic';

/**
 * Timing-safe HMAC verification for Shopify OAuth
 */
export function verifyShopifyHmac(searchParams, secret) {
  if (!secret) return false;
  const hmac = searchParams.get('hmac');
  if (!hmac) return false;

  const params = [];
  searchParams.forEach((val, key) => {
    if (key !== 'hmac' && key !== 'signature') {
      params.push(`${key}=${val}`);
    }
  });
  params.sort();
  const message = params.join('&');

  const generatedHmac = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  const hmacBuffer = Buffer.from(hmac, 'utf-8');
  const genBuffer = Buffer.from(generatedHmac, 'utf-8');

  if (hmacBuffer.length !== genBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hmacBuffer, genBuffer);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const rawShop = searchParams.get('shop') || '';
  const state = searchParams.get('state') || '';
  const shop = normalizeShopifyDomain(rawShop);

  // 1. Verify shop domain format (^[a-z0-9][a-z0-9-]*\.myshopify\.com$)
  if (!shop || !isValidShopifyDomain(shop)) {
    console.warn(`[SHOPIFY_OAUTH] Invalid shop domain rejected: "${rawShop}"`);
    return NextResponse.json(
      { success: false, error: 'Invalid myshopify.com domain format.' },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { success: false, error: 'Authorization code is missing.' },
      { status: 400 }
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiSecret) {
    console.error('[SHOPIFY_OAUTH] Missing SHOPIFY_API_SECRET in server environment');
    return NextResponse.json(
      { success: false, error: 'Server configuration error: missing SHOPIFY_API_SECRET.' },
      { status: 500 }
    );
  }

  // 2. Timing-safe HMAC Verification
  const isHmacValid = verifyShopifyHmac(searchParams, apiSecret);
  if (!isHmacValid) {
    console.warn('[SHOPIFY_OAUTH] Invalid or tampered HMAC signature in callback');
    return NextResponse.json(
      { success: false, error: 'Invalid HMAC signature.' },
      { status: 400 }
    );
  }

  // 3. Verify State & Expiry
  let sourceShop = null;
  let isDestinationLink = false;

  if (state) {
    const stateResult = await verifyAndConsumeOAuthState(state, shop);
    if (stateResult.valid) {
      sourceShop = stateResult.sourceShop;
      isDestinationLink = true;
    } else {
      // Check if state matched cookie fallback (for initial store installation)
      const cookieState = request.cookies.get('shopify_oauth_state')?.value;
      if (!cookieState || cookieState !== state) {
        console.warn(`[SHOPIFY_OAUTH] State verification failed: ${stateResult.error || 'invalid state'}`);
        return NextResponse.json(
          { success: false, error: stateResult.error || 'Invalid or expired OAuth state.' },
          { status: 400 }
        );
      }
    }
  }

  try {
    // 4. Exchange temporary authorization code for offline access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code
      })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`[SHOPIFY_OAUTH] Token exchange failed with status ${tokenRes.status}:`, errText);
      return NextResponse.json(
        { success: false, error: 'Shopify token exchange failed.' },
        { status: 400 }
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope || process.env.SCOPES || 'read_products,write_products';

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Missing access_token from Shopify response.' },
        { status: 400 }
      );
    }

    // 5. Encrypt token with AES-256 and upsert Shop record in DB
    const encryptedToken = encrypt(accessToken);

    await prisma.shop.upsert({
      where: { shop },
      update: {
        accessToken: encryptedToken,
        scope,
        uninstalledAt: null
      },
      create: {
        shop,
        accessToken: encryptedToken,
        scope,
        installedAt: new Date()
      }
    });

    console.log(`[SHOPIFY_OAUTH] Successfully obtained & encrypted token for shop: ${shop}`);

    // 6. If this was a destination store OAuth, establish the ShopLink
    if (isDestinationLink && sourceShop) {
      await createShopLink(sourceShop, shop);
      console.log(`[SHOPIFY_OAUTH] Created ShopLink: ${sourceShop} -> ${shop}`);
    }

    // 7. Redirect back to embedded app in Shopify Admin
    // Format: https://admin.shopify.com/store/<source>/apps/<app handle>
    const primaryShop = sourceShop || shop;
    const storeHandle = primaryShop.replace('.myshopify.com', '');
    const appHandle =
      process.env.SHOPIFY_APP_HANDLE ||
      process.env.NEXT_PUBLIC_SHOPIFY_APP_HANDLE ||
      'collections-exporter-5';

    const redirectUrl = `https://admin.shopify.com/store/${storeHandle}/apps/${appHandle}`;
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('[SHOPIFY_OAUTH] OAuth callback error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Internal error processing OAuth callback.' },
      { status: 500 }
    );
  }
}
