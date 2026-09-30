import { NextResponse } from 'next/server';
import { fetchAllCollections } from '@/lib/shopify';

export async function POST(request) {
  try {
    const { shopUrl, accessToken, options } = await request.json();

    if (!shopUrl || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'Shop URL and Access Token are required.' },
        { status: 400 }
      );
    }

    const result = await fetchAllCollections(shopUrl, accessToken, options || {});
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
