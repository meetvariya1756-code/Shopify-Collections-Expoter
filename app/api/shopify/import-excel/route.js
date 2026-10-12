import { parseExcelBuffer, validateCollections } from '../../../../lib/excel.js';
import {
  fetchExistingCollectionHandlesGraphQL,
  importSessionStoreBatchGraphQL
} from '../../../../lib/shopify.js';
import { requireAuth, recordActivity } from '../../../../lib/auth.js';
import prisma from '../../../../lib/prisma.js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shopify/import-excel
 *
 * Target store is ALWAYS the session shop verified from Shopify session token.
 * Destination stores or tokens from the browser are completely ignored.
 *
 * Two modes depending on Content-Type:
 * 1. multipart/form-data  → parse uploaded .xlsx, tag rows (New, Already exists, Error), return preview counts
 * 2. application/json     → run SSE import into the session store via Shopify GraphQL API
 */
export async function POST(request) {
  const { sessionUser, errorResponse } = await requireAuth(request);
  if (errorResponse) return errorResponse;

  const targetShop = sessionUser.shop;
  const targetAccessToken = sessionUser.accessToken;

  if (!targetShop || !targetAccessToken) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Session shop access token is not available. Please reinstall or reauthorize the app.'
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const contentType = request.headers.get('content-type') || '';
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

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

      // 1. Max file size check (5 MB)
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
      if (file.size > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'File size exceeds the 5 MB limit. Please upload a smaller spreadsheet.'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const fileName = file.name?.toLowerCase() || '';
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unsupported file format. Please upload a valid Excel spreadsheet (.xlsx or .xls).'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Parse buffer with header validation, 1000 row limit, and formula injection prevention
      const rawCollections = parseExcelBuffer(buffer);
      const validated = validateCollections(rawCollections);

      // Fetch existing collection handles from the session shop using GraphQL
      let existingHandles = new Map();
      try {
        existingHandles = await fetchExistingCollectionHandlesGraphQL(targetShop, targetAccessToken);
      } catch (err) {
        console.warn('[IMPORT_PREVIEW] Unable to fetch existing collection handles via GraphQL:', err.message);
      }

      // Tag each collection as 'new', 'exists', or 'error'
      let newCount = 0;
      let existsCount = 0;
      let errorCount = 0;

      const collectionsWithStatus = validated.map((col) => {
        if (col.status === 'error' || col.errorReason) {
          errorCount++;
          return {
            ...col,
            status: 'error',
            reason: col.errorReason || 'Row contains validation errors and will not be imported.'
          };
        }

        const normHandle = String(col.handle || '').toLowerCase().trim();
        const existing = existingHandles.get(normHandle);

        if (existing) {
          existsCount++;
          return {
            ...col,
            status: 'exists',
            reason: `Handle /${existing.handle} already exists in this store (${existing.title}).`,
            existingId: existing.id
          };
        } else {
          newCount++;
          return {
            ...col,
            status: 'new',
            reason: 'New collection. Will be created.'
          };
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          shop: targetShop,
          count: collectionsWithStatus.length,
          counts: {
            new: newCount,
            exists: existsCount,
            error: errorCount
          },
          collections: collectionsWithStatus
        }),
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
    const { collections, options } = await request.json();

    if (!collections || !Array.isArray(collections) || collections.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collections list cannot be empty.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter out rows with Error (rows with Error are never imported)
    const importableCollections = collections.filter(c => c.status !== 'error' && !c.errorReason);

    if (importableCollections.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No valid collections to import. All rows contained errors.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await recordActivity({
      userId: (sessionUser.role === 'admin') ? sessionUser.id : null,
      username: sessionUser.shop,
      action: 'IMPORT',
      details: `Started Excel import of ${importableCollections.length} collection(s) into session store "${targetShop}".`,
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
          message: `Initiating import of ${importableCollections.length} collections into ${targetShop}...`,
          total: importableCollections.length,
          shop: targetShop
        });

        try {
          const results = await importSessionStoreBatchGraphQL(
            targetShop,
            targetAccessToken,
            importableCollections,
            options || {},
            (progress) => sendEvent('progress', progress)
          );

          // Log final stats in ActivityLog
          await recordActivity({
            userId: (sessionUser.role === 'admin') ? sessionUser.id : null,
            username: sessionUser.shop,
            action: 'IMPORT',
            details: `Completed Excel import into "${targetShop}": Created ${results.created}, Updated ${results.updated}, Skipped ${results.skipped}, Failed ${results.failed}.`,
            ipAddress: clientIp
          });

          // Save import history, item logs, and upsert collections into database
          try {
            const successCount = (results.created || 0) + (results.updated || 0);
            const errorCount = results.failed || 0;

            await prisma.importHistory.create({
              data: {
                shop: targetShop,
                fileName: options?.fileName || `import-${Date.now()}.xlsx`,
                totalRows: importableCollections.length,
                successCount,
                errorCount,
                status: errorCount === 0 ? 'COMPLETED' : (successCount > 0 ? 'PARTIAL' : 'FAILED'),
                importedBy: sessionUser.username || sessionUser.shop || 'user',
                items: {
                  create: (results.details || []).map((d) => ({
                    handle: d.handle || 'unknown',
                    title: d.title || 'Untitled',
                    status: (d.status === 'created' || d.status === 'updated') ? 'SUCCESS' : (d.status === 'skipped' ? 'SKIPPED' : 'FAILED'),
                    errorMessage: d.error || d.reason || null
                  }))
                }
              }
            });

            // Upsert imported collections into Collection master table
            for (const col of importableCollections) {
              const handle = col.handle || col.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'untitled';
              await prisma.collection.upsert({
                where: {
                  shop_handle: {
                    shop: targetShop,
                    handle
                  }
                },
                update: {
                  title: col.title || '',
                  type: (col.collection_type === 'custom' || col.type === 'custom' || col.type === 'manual') ? 'custom' : 'smart',
                  descriptionHtml: col.body_html || col.description_html || '',
                  sortOrder: col.sort_order || 'best-selling',
                  rules: col.rules || undefined,
                  disjunctive: Boolean(col.disjunctive),
                  imageUrl: col.image?.src || col.image_url || null,
                  imageAlt: col.image?.alt || col.image_alt || null
                },
                create: {
                  shop: targetShop,
                  title: col.title || '',
                  handle,
                  type: (col.collection_type === 'custom' || col.type === 'custom' || col.type === 'manual') ? 'custom' : 'smart',
                  descriptionHtml: col.body_html || col.description_html || '',
                  sortOrder: col.sort_order || 'best-selling',
                  rules: col.rules || undefined,
                  disjunctive: Boolean(col.disjunctive),
                  productCount: 0,
                  imageUrl: col.image?.src || col.image_url || null,
                  imageAlt: col.image?.alt || col.image_alt || null
                }
              });
            }
          } catch (dbErr) {
            console.error('[IMPORT_DB_SAVE_ERROR] Failed to save import history to database:', dbErr);
          }

          sendEvent('complete', {
            message: `Import completed into ${targetShop}! Created: ${results.created}, Updated: ${results.updated}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
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
