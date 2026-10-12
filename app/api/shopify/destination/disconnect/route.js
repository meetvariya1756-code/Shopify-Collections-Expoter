import { NextResponse } from 'next/server.js';
import { requireAuth } from '../../../../../lib/auth.js';
import { disconnectDestination, normalizeShopifyDomain } from '../../../../../lib/shop-link.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { sessionUser, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    const sourceShop = sessionUser?.shop;
    const body = await request.json().catch(() => ({}));
    const destinationShop = normalizeShopifyDomain(body.destinationShop || '');

    if (!sourceShop || !destinationShop) {
      return NextResponse.json(
        { success: false, error: 'Source shop and destination shop are required.' },
        { status: 400 }
      );
    }

    await disconnectDestination(sourceShop, destinationShop);

    return NextResponse.json({
      success: true,
      message: `Destination store ${destinationShop} disconnected successfully.`
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
