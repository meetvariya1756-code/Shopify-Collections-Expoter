import { NextResponse } from 'next/server.js';
import { fetchAllCollections } from '../../../../lib/shopify.js';
import { requireAuth } from '../../../../lib/auth.js';
import prisma from '../../../../lib/prisma.js';
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

    // Sync fetched collections into database Collection table
    if (result?.collections && Array.isArray(result.collections) && result.collections.length > 0) {
      try {
        for (const col of result.collections) {
          const handle = col.handle || col.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'untitled';
          await prisma.collection.upsert({
            where: {
              shop_handle: {
                shop: requestedShop,
                handle
              }
            },
            update: {
              shopifyId: col.id ? String(col.id) : undefined,
              title: col.title || '',
              type: (col.collection_type === 'custom' || col.type === 'manual') ? 'custom' : 'smart',
              descriptionHtml: col.body_html || col.description || '',
              sortOrder: col.sort_order || 'best-selling',
              rules: col.rules ? col.rules : undefined,
              disjunctive: Boolean(col.disjunctive),
              productCount: typeof col.products_count === 'number' ? col.products_count : (typeof col.productsCount === 'number' ? col.productsCount : 0),
              imageUrl: col.image?.src || (typeof col.imageUrl === 'string' ? col.imageUrl : null),
              imageAlt: col.image?.alt || (typeof col.imageAlt === 'string' ? col.imageAlt : null)
            },
            create: {
              shop: requestedShop,
              shopifyId: col.id ? String(col.id) : undefined,
              title: col.title || '',
              handle,
              type: (col.collection_type === 'custom' || col.type === 'manual') ? 'custom' : 'smart',
              descriptionHtml: col.body_html || col.description || '',
              sortOrder: col.sort_order || 'best-selling',
              rules: col.rules ? col.rules : undefined,
              disjunctive: Boolean(col.disjunctive),
              productCount: typeof col.products_count === 'number' ? col.products_count : (typeof col.productsCount === 'number' ? col.productsCount : 0),
              imageUrl: col.image?.src || (typeof col.imageUrl === 'string' ? col.imageUrl : null),
              imageAlt: col.image?.alt || (typeof col.imageAlt === 'string' ? col.imageAlt : null)
            }
          });
        }
      } catch (dbSyncErr) {
        console.error('[FETCH_COLLECTIONS_DB_SYNC_ERROR] Could not sync collections to database:', dbSyncErr);
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('[FETCH_COLLECTIONS_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
