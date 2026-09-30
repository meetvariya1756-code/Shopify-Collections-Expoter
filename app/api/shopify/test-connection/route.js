import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/shopify';

export async function POST(request) {
  try {
    const { shopUrl, accessToken } = await request.json();

    if (!shopUrl || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'Shop URL and Access Token are required.' },
        { status: 400 }
      );
    }

    const result = await testConnection(shopUrl, accessToken);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
