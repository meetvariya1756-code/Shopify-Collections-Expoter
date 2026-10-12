import { generateExcelWorkbook } from '../../../../lib/excel.js';
import { requireAuth, recordActivity } from '../../../../lib/auth.js';
import prisma from '../../../../lib/prisma.js';

export async function POST(request) {
  try {
    const { sessionUser, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    const { collections, storeInfo } = await request.json();

    if (!collections || !Array.isArray(collections)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collections array is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const buffer = generateExcelWorkbook(collections, storeInfo || {});

    const storeName = storeInfo?.name
      ? storeInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : storeInfo?.domain?.split('.')[0] || 'shopify';
    const filename = `shopify-collections-${storeName}-${Date.now()}.xlsx`;

    const shopDomain = storeInfo?.domain || storeInfo?.name || sessionUser.shop || 'unknown';

    // Persist into ExportHistory and upsert collections into Collection table
    try {
      await prisma.exportHistory.create({
        data: {
          shop: shopDomain,
          fileName: filename,
          totalCollections: collections.length,
          fileSize: buffer.length,
          exportedBy: sessionUser.username || sessionUser.displayName || 'user'
        }
      });

      for (const col of collections) {
        const handle = col.handle || col.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'untitled';
        await prisma.collection.upsert({
          where: {
            shop_handle: {
              shop: shopDomain,
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
            shop: shopDomain,
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
    } catch (dbErr) {
      console.error('[EXPORT_DB_SAVE_ERROR] Failed to save export history to database:', dbErr);
    }

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    await recordActivity({
      userId: sessionUser.id,
      username: sessionUser.username,
      action: 'EXPORT',
      details: `Exported ${collections.length} collection(s) to Excel for store "${storeInfo?.name || storeInfo?.domain || 'unknown'}".`,
      ipAddress: clientIp
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
