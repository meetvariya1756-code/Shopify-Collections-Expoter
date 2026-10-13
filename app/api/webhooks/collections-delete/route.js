import { NextResponse } from 'next/server.js';
import crypto from 'crypto';
import prisma from '../../../../lib/prisma.js';

export const dynamic = 'force-dynamic';

/**
 * Verify Shopify Webhook HMAC-SHA256 signature
 */
function verifyWebhookHmac(rawBody, hmacHeader, secret) {
  if (!hmacHeader || !secret) return false;
  try {
    const generated = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64');
    const a = Buffer.from(generated);
    const b = Buffer.from(hmacHeader);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

/**
 * POST /api/webhooks/collections-delete
 * Handles Shopify collections/delete webhook events and removes the collection from PostgreSQL
 */
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const hmac = request.headers.get('x-shopify-hmac-sha256');
    const shop = request.headers.get('x-shopify-shop-domain');
    const topic = request.headers.get('x-shopify-topic');

    const apiSecret = process.env.SHOPIFY_API_SECRET;

    // Verify HMAC signature
    if (!verifyWebhookHmac(rawBody, hmac, apiSecret)) {
      console.warn(`[WEBHOOK_COLLECTIONS_DELETE] Rejected invalid HMAC signature from ${shop}`);
      return new NextResponse('Unauthorized: Invalid HMAC', { status: 401 });
    }

    if (!shop) {
      return new NextResponse('Bad Request: Missing shop domain header', { status: 400 });
    }

    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      console.warn('[WEBHOOK_COLLECTIONS_DELETE] Failed to parse JSON payload:', parseErr.message);
      return new NextResponse('Bad Request: Invalid JSON', { status: 400 });
    }

    const rawId = payload.id;
    if (!rawId) {
      console.warn('[WEBHOOK_COLLECTIONS_DELETE] Payload missing collection id');
      return NextResponse.json({ success: true, message: 'No ID in payload, ignored' });
    }

    const numericId = String(rawId).replace(/\D/g, '');
    const graphqlId = `gid://shopify/Collection/${numericId}`;

    const deleteConditions = [
      { shopifyId: numericId },
      { shopifyId: graphqlId }
    ];

    if (payload.handle) {
      deleteConditions.push({ handle: payload.handle });
    }

    // Delete matching collection from PostgreSQL
    let rowsDeleted = 0;
    try {
      if (prisma && prisma.collection) {
        const res = await prisma.collection.deleteMany({
          where: { shop, OR: deleteConditions }
        });
        rowsDeleted = res.count;
      } else {
        const handleVal = payload.handle || '';
        rowsDeleted = await prisma.$executeRawUnsafe(
          `DELETE FROM public."Collection" WHERE shop = $1 AND ("shopifyId" = $2 OR "shopifyId" = $3 OR (handle = $4 AND $4 != ''));`,
          shop,
          numericId,
          graphqlId,
          handleVal
        );
      }
    } catch (delErr) {
      console.warn('[WEBHOOK_COLLECTIONS_DELETE] Delete error:', delErr.message);
    }

    console.log(`[WEBHOOK_COLLECTIONS_DELETE] Deleted collection #${numericId} from shop "${shop}". Rows affected: ${rowsDeleted}`);

    // Log event in ActivityLog
    try {
      await prisma.activityLog.create({
        data: {
          username: shop,
          action: 'WEBHOOK_COLLECTION_DELETED',
          details: `Shopify Admin deleted collection #${numericId} (${payload.title || 'untitled'}). Removed ${rowsDeleted} record(s) from database.`,
          ipAddress: 'shopify-webhook'
        }
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      shop,
      deletedCollectionId: numericId,
      dbRowsDeleted: rowsDeleted
    });
  } catch (err) {
    console.error('[WEBHOOK_COLLECTIONS_DELETE_ERROR]', err);
    return new NextResponse(err.message || 'Internal Server Error', { status: 500 });
  }
}
