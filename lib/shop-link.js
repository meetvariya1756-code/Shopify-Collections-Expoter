import prisma from './prisma.js';
import { decrypt } from './encryption.js';

export const SHOPIFY_DOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/**
 * Validate that a given string is a valid myshopify domain
 * Format: ^[a-z0-9][a-z0-9-]*\.myshopify\.com$
 */
export function isValidShopifyDomain(shop) {
  if (!shop || typeof shop !== 'string') return false;
  const clean = shop.toLowerCase().trim();
  return SHOPIFY_DOMAIN_REGEX.test(clean);
}

/**
 * Normalize a domain string
 */
export function normalizeShopifyDomain(shop) {
  if (!shop || typeof shop !== 'string') return '';
  return shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase().trim();
}

// In-memory fallback map for test environments or during initial migration
const fallbackShopLinks = new Map();
const fallbackOAuthStates = new Map();
const fallbackShopTokens = new Map();

/**
 * Store an OAuth state for destination store authorization
 */
export async function saveOAuthState({ state, sourceShop, destinationShop, expiresAt }) {
  const normSource = normalizeShopifyDomain(sourceShop);
  const normDest = normalizeShopifyDomain(destinationShop);

  try {
    const record = await prisma.oAuthState.create({
      data: {
        state,
        shop: normSource,
        destination: normDest,
        expiresAt
      }
    });
    return record;
  } catch (err) {
    // If DB table not ready or error, use fallback
    fallbackOAuthStates.set(state, {
      state,
      shop: normSource,
      destination: normDest,
      expiresAt: expiresAt instanceof Date ? expiresAt : new Date(expiresAt),
      createdAt: new Date()
    });
    return fallbackOAuthStates.get(state);
  }
}

/**
 * Verify and consume (delete) an OAuth state
 */
export async function verifyAndConsumeOAuthState(state, shop) {
  const normShop = normalizeShopifyDomain(shop);
  let record = null;

  try {
    record = await prisma.oAuthState.findUnique({
      where: { state }
    });
    if (record) {
      // Consume the state so it cannot be reused
      await prisma.oAuthState.delete({
        where: { state }
      }).catch(() => {});
    }
  } catch (err) {
    record = fallbackOAuthStates.get(state);
    if (record) fallbackOAuthStates.delete(state);
  }

  if (!record) {
    record = fallbackOAuthStates.get(state);
    if (record) fallbackOAuthStates.delete(state);
  }

  if (!record) {
    return { valid: false, error: 'State parameter not found or already consumed.' };
  }

  const now = new Date();
  if (new Date(record.expiresAt) < now) {
    return { valid: false, error: 'OAuth authorization state has expired.' };
  }

  if (record.destination !== normShop) {
    return {
      valid: false,
      error: `Destination mismatch: expected ${record.destination}, got ${normShop}.`
    };
  }

  return {
    valid: true,
    sourceShop: record.shop,
    destinationShop: record.destination
  };
}

/**
 * Create or update a ShopLink between source and destination
 */
export async function createShopLink(sourceShop, destinationShop) {
  const normSource = normalizeShopifyDomain(sourceShop);
  const normDest = normalizeShopifyDomain(destinationShop);

  try {
    const link = await prisma.shopLink.upsert({
      where: {
        sourceShop_destinationShop: {
          sourceShop: normSource,
          destinationShop: normDest
        }
      },
      update: {},
      create: {
        sourceShop: normSource,
        destinationShop: normDest
      }
    });
    return link;
  } catch (err) {
    const key = `${normSource}:${normDest}`;
    const fallbackLink = {
      id: `link-${Date.now()}`,
      sourceShop: normSource,
      destinationShop: normDest,
      createdAt: new Date()
    };
    fallbackShopLinks.set(key, fallbackLink);
    return fallbackLink;
  }
}

/**
 * Check if a valid ShopLink exists
 */
export async function getShopLink(sourceShop, destinationShop) {
  const normSource = normalizeShopifyDomain(sourceShop);
  const normDest = normalizeShopifyDomain(destinationShop);

  try {
    const link = await prisma.shopLink.findUnique({
      where: {
        sourceShop_destinationShop: {
          sourceShop: normSource,
          destinationShop: normDest
        }
      }
    });
    if (link) return link;
  } catch (err) {
    // Fallback lookup
  }

  const key = `${normSource}:${normDest}`;
  return fallbackShopLinks.get(key) || null;
}

/**
 * Get all destination links for a source store
 */
export async function getLinkedDestinations(sourceShop) {
  const normSource = normalizeShopifyDomain(sourceShop);

  try {
    const links = await prisma.shopLink.findMany({
      where: { sourceShop: normSource }
    });
    if (links && links.length > 0) return links;
  } catch (err) {}

  const results = [];
  for (const [key, val] of fallbackShopLinks.entries()) {
    if (val.sourceShop === normSource) {
      results.push(val);
    }
  }
  return results;
}

/**
 * Disconnect destination store (delete ShopLink).
 * Keep Shop token if that store installed the app itself.
 */
export async function disconnectDestination(sourceShop, destinationShop) {
  const normSource = normalizeShopifyDomain(sourceShop);
  const normDest = normalizeShopifyDomain(destinationShop);

  try {
    await prisma.shopLink.deleteMany({
      where: {
        sourceShop: normSource,
        destinationShop: normDest
      }
    });
  } catch (err) {}

  const key = `${normSource}:${normDest}`;
  fallbackShopLinks.delete(key);

  // Check if destination store installed the app itself:
  // If destination shop also has its own installation record with uninstalledAt === null,
  // or if other stores link to it as source, keep the Shop token.
  try {
    const isOtherSource = await prisma.shopLink.findFirst({
      where: { sourceShop: normDest }
    });

    const hasOtherLinks = await prisma.shopLink.findFirst({
      where: { destinationShop: normDest }
    });

    // Check if the store installed itself directly
    const shopRecord = await prisma.shop.findUnique({
      where: { shop: normDest }
    });

    if (!isOtherSource && !hasOtherLinks && shopRecord) {
      // If never used as a source and no other links exist, we can remove the token
      // Only delete if it did NOT install the app itself directly:
      // (If it installed the app directly, shopRecord.installedAt is set and uninstalledAt is null)
      if (shopRecord.uninstalledAt !== null) {
        await prisma.shop.delete({
          where: { shop: normDest }
        }).catch(() => {});
      }
    }
  } catch (err) {}

  return { success: true };
}

/**
 * Store access token for any shop (with in-memory fallback for test/dev)
 */
export async function setShopAccessToken(shop, accessToken) {
  const normShop = normalizeShopifyDomain(shop);
  if (!normShop || !accessToken) return;

  fallbackShopTokens.set(normShop, accessToken);

  try {
    const { encrypt } = await import('./encryption.js');
    const encryptedToken = encrypt(accessToken);
    await prisma.shop.upsert({
      where: { shop: normShop },
      update: { accessToken: encryptedToken, uninstalledAt: null },
      create: { shop: normShop, accessToken: encryptedToken, installedAt: new Date() }
    });
  } catch (err) {}
}

/**
 * Retrieve decrypted access token for any shop from Shop table
 */
export async function getShopAccessToken(shop) {
  const normShop = normalizeShopifyDomain(shop);
  if (!normShop) return null;

  try {
    const shopRecord = await prisma.shop.findUnique({
      where: { shop: normShop }
    });

    if (shopRecord && shopRecord.accessToken) {
      const decrypted = decrypt(shopRecord.accessToken);
      if (decrypted) return decrypted;
    }
  } catch (err) {
    console.error(`[SHOP_TOKEN] Failed to load token for ${normShop}:`, err.message);
  }

  return fallbackShopTokens.get(normShop) || null;
}
