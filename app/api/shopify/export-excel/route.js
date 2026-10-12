import { generateExcelWorkbook } from '@/lib/excel';
import { requireAuth, recordActivity } from '@/lib/auth';

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
