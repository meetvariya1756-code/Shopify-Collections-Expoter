import {
  deleteCollectionsBatch,
  deleteCollectionsByHandlesGraphQL
} from '../../../../lib/shopify.js';
import { requireAuth, recordActivity } from '../../../../lib/auth.js';
import {
  normalizeShopifyDomain,
  getShopLink,
  getShopAccessToken
} from '../../../../lib/shop-link.js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shopify/delete-collections
 *
 * Delete collections from the session store (or linked destination store) with real-time SSE progress.
 * Body can contain:
 * - { handles: string[] } → deletes ONLY the collections listed in the uploaded sheet from the session store
 * - { targetStoreUrl, mode, collectionIds } → legacy / multi-store deletion mode
 */
export async function POST(request) {
  try {
    const { sessionUser, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    const sourceShop = sessionUser?.shop;
    const body = await request.json();
    const { handles, targetStoreUrl, mode = 'all', collectionIds = [] } = body;

    let targetShop = sessionUser.shop;
    let targetAccessToken = sessionUser.accessToken;

    // If destination store is explicitly requested via legacy multi-store flow
    if (targetStoreUrl && targetStoreUrl !== sourceShop) {
      const cleanTargetShop = normalizeShopifyDomain(targetStoreUrl);
      const link = await getShopLink(sourceShop, cleanTargetShop);
      if (!link) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Forbidden: Store "${cleanTargetShop}" is not linked to your shop.`
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const destToken = await getShopAccessToken(cleanTargetShop);
      if (!destToken) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Access token not found for store "${cleanTargetShop}".`
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      targetShop = cleanTargetShop;
      targetAccessToken = destToken;
    }

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // If handles are passed (Delete collections listed in uploaded sheet)
    const isHandleMode = Array.isArray(handles) && handles.length > 0;

    await recordActivity({
      userId: (sessionUser.role === 'admin') ? sessionUser.id : null,
      username: sessionUser.shop,
      action: 'COLLECTIONS_DELETE',
      details: isHandleMode
        ? `Initiated deletion of ${handles.length} sheet collection(s) in session store "${targetShop}".`
        : `Initiated deletion (${mode}) in store "${targetShop}".`,
      ipAddress: clientIp
    });

    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event, data) => {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        sendEvent('start', {
          message: isHandleMode
            ? `Initiating deletion of ${handles.length} collections listed in uploaded sheet from ${targetShop}...`
            : `Initiating deletion pipeline (${mode} collections)...`,
          total: isHandleMode ? handles.length : 0
        });

        try {
          let results;
          if (isHandleMode) {
            results = await deleteCollectionsByHandlesGraphQL(
              targetShop,
              targetAccessToken,
              handles,
              (progress) => sendEvent('progress', progress)
            );
          } else {
            results = await deleteCollectionsBatch(
              targetShop,
              targetAccessToken,
              { mode, collectionIds },
              (progress) => sendEvent('progress', progress)
            );
          }

          sendEvent('complete', {
            message: `Deletion finished. Removed ${results.deleted} of ${results.total} collections (Failed: ${results.failed}).`,
            results
          });
        } catch (err) {
          sendEvent('error', { message: err.message });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
