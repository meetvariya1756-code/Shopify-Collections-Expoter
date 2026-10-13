import { NextResponse } from 'next/server.js';
import prisma from '../../../../lib/prisma.js';
import { getSessionUser, createSessionToken } from '../../../../lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shopify/active-store
 * Returns active store info for direct localhost browser navigation
 * In development mode, also establishes a session cookie for seamless testing
 */
export async function GET(request) {
  try {
    const isLegacyAllowed = process.env.ENABLE_LEGACY_LOGIN === 'true';
    const sessionData = await getSessionUser(request);

    const dbShop = await prisma.shop.findFirst({
      where: { uninstalledAt: null },
      orderBy: { installedAt: 'desc' }
    });

    if (!dbShop) {
      return NextResponse.json({ success: false, error: 'No active store found in database.' }, { status: 404 });
    }

    const shopDomain = dbShop.shop;
    const storeInfo = {
      shopUrl: shopDomain,
      domain: shopDomain,
      name: shopDomain.replace('.myshopify.com', '')
    };

    const response = NextResponse.json({
      success: true,
      store: storeInfo
    });

    // If running in development and no session cookie is yet set, establish dev session cookie
    if (isLegacyAllowed && (!sessionData || !sessionData.user)) {
      const activeUser = await prisma.user.findFirst({
        where: { status: 'active' },
        orderBy: { role: 'asc' }
      });
      if (activeUser) {
        const token = await createSessionToken(activeUser);
        response.cookies.set({
          name: 'session_token',
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 8 * 60 * 60
        });
      }
    }

    return response;
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
