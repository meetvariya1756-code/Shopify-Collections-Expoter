import { generateExcelWorkbook } from '@/lib/excel';

export async function POST(request) {
  try {
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
