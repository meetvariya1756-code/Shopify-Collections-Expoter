import { NextResponse } from 'next/server.js';
import { fetchAllCollections } from '../../../../lib/shopify.js';
import { requireAuth } from '../../../../lib/auth.js';
import {
  normalizeShopifyDomain,
  getShopLink,
  getShopAccessToken
} from '../../../../lib/shop-link.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { sessionUser, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    const sourceShop = sessionUser?.shop;
    const body = await request.json().catch(() => ({}));
    const requestedShop = body.shopUrl ? normalizeShopifyDomain(body.shopUrl) : sourceShop;
    const options = body.options || {};

    let targetToken = null;

    if (!requestedShop || requestedShop === sourceShop) {
      // 1. Fetching from Source Store (the merchant's own installed store)
      targetToken = await getShopAccessToken(sourceShop);
      if (!targetToken) {
        return NextResponse.json(
          {
            success: false,
            error: `Source store token not found for ${sourceShop}. Please reauthorize the app.`
          },
          { status: 401 }
        );
      }
    } else {
      // 2. Fetching from a Destination Store
      // Security check: Must have a verified ShopLink!
      const link = await getShopLink(sourceShop, requestedShop);
      if (!link) {
        return NextResponse.json(
          {
            success: false,
            error: `Unauthorized: Store "${requestedShop}" is not linked to your source store.`
          },
          { status: 403 }
        );
      }

      targetToken = await getShopAccessToken(requestedShop);
      if (!targetToken) {
        return NextResponse.json(
          {
            success: false,
            error: `Access token not found for destination store "${requestedShop}". Please reconnect.`
          },
          { status: 401 }
        );
      }
    }

    const result = await fetchAllCollections(requestedShop, targetToken, options);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('[FETCH_COLLECTIONS_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
