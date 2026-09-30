import { deleteCollectionsBatch } from '@/lib/shopify';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shopify/delete-collections
 *
 * Delete collections from the destination store with real-time SSE progress.
 * Body: { targetStoreUrl, targetAccessToken, mode, collectionIds }
 * mode: 'all' | 'smart' | 'manual' | 'selected'
 */
export async function POST(request) {
  try {
    const { targetStoreUrl, targetAccessToken, mode = 'all', collectionIds = [] } = await request.json();

    if (!targetStoreUrl || !targetAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Destination Store URL and Access Token are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event, data) => {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        sendEvent('start', {
          message: `Initiating deletion pipeline (${mode} collections)...`,
          mode
        });

        try {
          const results = await deleteCollectionsBatch(
            targetStoreUrl,
            targetAccessToken,
            { mode, collectionIds },
            (progress) => sendEvent('progress', progress)
          );

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
        'Connection': 'keep-alive'
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
