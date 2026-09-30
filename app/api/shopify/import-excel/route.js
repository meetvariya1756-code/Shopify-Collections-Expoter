import { parseExcelBuffer, validateCollections } from '@/lib/excel';
import { importCollectionsBatch } from '@/lib/shopify';

/**
 * POST /api/shopify/import-excel
 *
 * Two modes depending on Content-Type:
 * 1. multipart/form-data  → parse uploaded .xlsx, return preview
 * 2. application/json     → run SSE import into target store
 */
export async function POST(request) {
  const contentType = request.headers.get('content-type') || '';

  // ── Mode 1: File Upload Preview ──────────────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file) {
        return new Response(
          JSON.stringify({ success: false, error: 'No file uploaded.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const fileName = file.name?.toLowerCase() || '';
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unsupported file format. Please upload a .xlsx file.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const rawCollections = parseExcelBuffer(buffer);
      const validated = validateCollections(rawCollections);

      return new Response(
        JSON.stringify({ success: true, count: validated.length, collections: validated }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // ── Mode 2: SSE Import Stream ─────────────────────────────────────────────
  try {
    const { targetStoreUrl, targetAccessToken, collections, options } = await request.json();

    if (!targetStoreUrl || !targetAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Target Store URL and Access Token are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!collections || !Array.isArray(collections) || collections.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collections list cannot be empty.' }),
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
          message: 'Initiating collection import pipeline...',
          total: collections.length
        });

        try {
          const results = await importCollectionsBatch(
            targetStoreUrl,
            targetAccessToken,
            collections,
            options || {},
            (progress) => sendEvent('progress', progress)
          );

          sendEvent('complete', {
            message: `Import completed! Created: ${results.created}, Updated: ${results.updated}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
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
      status: 200,
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
