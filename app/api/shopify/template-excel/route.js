import { generateTemplateWorkbook } from '@/lib/excel';
import { requireAuth } from '@/lib/auth';

export async function GET(request) {
  try {
    const { errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    const buffer = generateTemplateWorkbook();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="shopify-collections-template.xlsx"',
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
