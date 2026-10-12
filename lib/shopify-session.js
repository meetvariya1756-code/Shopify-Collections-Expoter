import { jwtVerify } from 'jose';
import prisma from './prisma.js';
import { encrypt, decrypt } from './encryption.js';

/**
 * Verify Shopify session token from Authorization: Bearer <token>
 * Validates JWT signature with SHOPIFY_API_SECRET.
 * Extracts shop, checks DB for offline accessToken, or performs Token Exchange if missing.
 *
 * @param {Request} request
 * @returns {Promise<{
 *   valid: boolean,
 *   shop?: string,
 *   accessToken?: string,
 *   payload?: object,
 *   shopRecord?: object,
 *   error?: string,
 *   status?: number,
 *   reauthorizeUrl?: string
 * }>}
 */
export async function verifyShopifySession(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      console.warn('[SHOPIFY_AUTH] Session verification failed: Missing session token in Authorization header.');
      return {
        valid: false,
        error: 'Missing session token in Authorization header.',
        status: 401,
        reauthorizeUrl: '/api/auth'
      };
    }

    const sessionToken = authHeader.substring(7).trim();
    if (!sessionToken) {
      console.warn('[SHOPIFY_AUTH] Session verification failed: Empty session token.');
      return {
        valid: false,
        error: 'Empty session token.',
        status: 401,
        reauthorizeUrl: '/api/auth'
      };
    }

    const secretKey = process.env.SHOPIFY_API_SECRET;
    if (!secretKey) {
      console.error('[SHOPIFY_AUTH] SHOPIFY_API_SECRET environment variable is missing.');
      return {
        valid: false,
        error: 'Server configuration error: missing SHOPIFY_API_SECRET.',
        status: 500
      };
    }

    // 1. Verify JWT signature using SHOPIFY_API_SECRET
    const encodedSecret = new TextEncoder().encode(secretKey);
    let payload;
    try {
      const verified = await jwtVerify(sessionToken, encodedSecret, {
        algorithms: ['HS256']
      });
      payload = verified.payload;
    } catch (jwtErr) {
      console.warn('[SHOPIFY_AUTH] Session token verification failed:', jwtErr.message);
      return {
        valid: false,
        error: 'Invalid or tampered Shopify session token.',
        status: 401,
        reauthorizeUrl: '/api/auth'
      };
    }

    // Verify audience (API Key) if defined
    const expectedApiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
    if (expectedApiKey && payload.aud && payload.aud !== expectedApiKey) {
      console.warn('[SHOPIFY_AUTH] Session token audience mismatch.');
      return {
        valid: false,
        error: 'Invalid session token audience.',
        status: 401,
        reauthorizeUrl: '/api/auth'
      };
    }

    // 2. Extract shop domain from dest or iss
    const dest = String(payload.dest || payload.iss || '');
    const cleanShop = dest
      .replace(/^https?:\/\//, '')
      .replace(/\/admin.*$/, '')
      .toLowerCase()
      .trim();

    if (!cleanShop || !cleanShop.includes('.myshopify.com')) {
      console.warn('[SHOPIFY_AUTH] Session verification failed: Session token does not contain a valid myshopify.com domain.');
      return {
        valid: false,
        error: 'Session token does not contain a valid myshopify.com domain.',
        status: 401
      };
    }

    // 3. Look up existing Shop record in database
    let shopRecord = null;
    try {
      shopRecord = await prisma.shop.findUnique({
        where: { shop: cleanShop }
      });
    } catch (dbErr) {
      console.error('[SHOPIFY_AUTH] Database lookup error:', dbErr.message);
    }

    if (shopRecord && shopRecord.accessToken) {
      const decryptedToken = decrypt(shopRecord.accessToken);
      if (decryptedToken) {
        console.log(`[SHOPIFY_AUTH] session valid for ${cleanShop}`);
        return {
          valid: true,
          shop: cleanShop,
          accessToken: decryptedToken,
          payload,
          shopRecord
        };
      }
    }

    const { getShopAccessToken } = await import('./shop-link.js');
    const fallbackToken = await getShopAccessToken(cleanShop);
    if (fallbackToken) {
      console.log(`[SHOPIFY_AUTH] session valid for ${cleanShop}`);
      return {
        valid: true,
        shop: cleanShop,
        accessToken: fallbackToken,
        payload
      };
    }

    // 4. Token Exchange: Exchange session token (id_token) for offline access token
    console.log(`[SHOPIFY_AUTH] Performing token exchange for shop: ${cleanShop}`);
    const tokenExchangeUrl = `https://${cleanShop}/admin/oauth/access_token`;

    try {
      const exchangeRes = await fetch(tokenExchangeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: expectedApiKey,
          client_secret: secretKey,
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: sessionToken,
          subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
          requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token'
        })
      });

      if (exchangeRes.ok) {
        const exchangeData = await exchangeRes.json();
        if (exchangeData.access_token) {
          const encryptedToken = encrypt(exchangeData.access_token);
          const scope = exchangeData.scope || process.env.SCOPES || 'read_products,write_products';

          shopRecord = await prisma.shop.upsert({
            where: { shop: cleanShop },
            update: {
              accessToken: encryptedToken,
              scope,
              uninstalledAt: null
            },
            create: {
              shop: cleanShop,
              accessToken: encryptedToken,
              scope,
              installedAt: new Date()
            }
          });

          console.log(`[SHOPIFY_AUTH] session valid for ${cleanShop}`);
          return {
            valid: true,
            shop: cleanShop,
            accessToken: exchangeData.access_token,
            payload,
            shopRecord
          };
        }
      }

      console.warn(
        `[SHOPIFY_AUTH] Token exchange failed with status ${exchangeRes.status} for ${cleanShop}`
      );
    } catch (exchangeErr) {
      console.error('[SHOPIFY_AUTH] Token exchange request error:', exchangeErr.message);
    }

    // 5. Fallback: If token exchange was not possible, trigger authorization code grant
    console.warn(`[SHOPIFY_AUTH] Session verification failed: Offline access token missing and token exchange not possible for ${cleanShop}. Reauthorization required.`);
    return {
      valid: false,
      shop: cleanShop,
      error: 'Token exchange not possible. Shopify authorization required.',
      status: 401,
      reauthorizeUrl: `/api/auth?shop=${cleanShop}`
    };
  } catch (err) {
    console.error('[SHOPIFY_AUTH] Unexpected session verification error:', err.message);
    return {
      valid: false,
      error: 'Internal error during session verification.',
      status: 500
    };
  }
}
