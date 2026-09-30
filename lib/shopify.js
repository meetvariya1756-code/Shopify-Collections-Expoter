import axios from 'axios';

const API_VERSION = '2024-01';

/**
 * Helper to normalize store URL format
 * e.g., "my-store", "my-store.myshopify.com", "https://my-store.myshopify.com" -> "my-store.myshopify.com"
 */
export function normalizeShopUrl(url) {
  if (!url) return '';
  let cleaned = String(url).trim().toLowerCase();

  // If user pasted Shopify admin URL: https://admin.shopify.com/store/my-store-name
  const adminMatch = cleaned.match(/admin\.shopify\.com\/store\/([a-z0-9-_]+)/i);
  if (adminMatch && adminMatch[1]) {
    return `${adminMatch[1]}.myshopify.com`;
  }

  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//, '');
  // Remove trailing path or query
  cleaned = cleaned.replace(/\/.*$/, '');
  // Replace spaces or underscores with hyphens
  cleaned = cleaned.replace(/[\s_]+/g, '-');

  // If already contains .myshopify.com or a domain with dot e.g. store.myshopify.com
  if (!cleaned.includes('.myshopify.com') && !cleaned.includes('.')) {
    cleaned = `${cleaned}.myshopify.com`;
  }
  return cleaned;
}

/**
 * Creates an Axios instance with rate-limit and error retry handling
 */
export function getShopifyClient(shopUrl, accessToken) {
  const normalizedUrl = normalizeShopUrl(shopUrl);
  const client = axios.create({
    baseURL: `https://${normalizedUrl}/admin/api/${API_VERSION}`,
    headers: {
      'X-Shopify-Access-Token': accessToken.trim(),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 30000
  });

  // Interceptor for rate limiting (429) and network retries
  client.interceptors.response.use(
    response => response,
    async error => {
      const config = error.config;
      if (!config) return Promise.reject(error);

      config._retryCount = config._retryCount || 0;

      if (error.response && error.response.status === 429 && config._retryCount < 5) {
        config._retryCount += 1;
        const retryAfter = error.response.headers['retry-after']
          ? parseFloat(error.response.headers['retry-after']) * 1000
          : Math.pow(2, config._retryCount) * 1000;

        console.log(`[Shopify API] Rate limited (429). Retrying in ${retryAfter}ms (Attempt ${config._retryCount})...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        return client(config);
      }

      return Promise.reject(error);
    }
  );

  return { client, shopUrl: normalizedUrl };
}

/**
 * Test credentials and fetch basic shop details
 */
export async function testConnection(shopUrl, accessToken) {
  try {
    const { client, shopUrl: domain } = getShopifyClient(shopUrl, accessToken);
    const response = await client.get('/shop.json');
    const shop = response.data.shop;
    return {
      success: true,
      shop: {
        id: shop.id,
        name: shop.name,
        email: shop.email,
        domain: shop.domain,
        myshopifyDomain: domain,
        currency: shop.currency,
        plan_name: shop.plan_name,
        country: shop.country_name,
        timezone: shop.iana_timezone
      }
    };
  } catch (err) {
    let message = err.message;
    if (err.response) {
      if (err.response.status === 401 || err.response.status === 403) {
        message = 'Invalid API Access Token or insufficient permissions. Ensure read_products & write_products scopes are granted.';
      } else if (err.response.status === 404) {
        message = 'Store URL not found. Please verify the myshopify domain name.';
      } else if (err.response.data && err.response.data.errors) {
        message = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors);
      }
    }
    return { success: false, error: message };
  }
}

/**
 * Helper to parse pagination Link header
 */
function getNextPageUrl(linkHeader) {
  if (!linkHeader) return null;
  const links = linkHeader.split(',');
  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch all Smart (Automated) Collections
 */
async function fetchSmartCollections(client, onProgress) {
  let collections = [];
  let url = '/smart_collections.json?limit=250';
  let page = 1;

  console.log('[Shopify API] ⏳ Fetching Smart (Automated) Collections...');

  while (url) {
    const response = await client.get(url);
    const batch = response.data.smart_collections || [];
    collections = collections.concat(batch);

    const msg = `[Shopify API] 📦 Fetched page ${page} of Smart Collections (${collections.length} loaded)...`;
    console.log(msg);
    if (onProgress) onProgress(msg);

    const nextUrl = getNextPageUrl(response.headers['link']);
    if (nextUrl) {
      const parsed = new URL(nextUrl);
      url = `${parsed.pathname.replace(`/admin/api/${API_VERSION}`, '')}${parsed.search}`;
      page++;
    } else {
      url = null;
    }
  }

  console.log(`[Shopify API] ✅ Completed fetching ${collections.length} Smart Collections.`);
  return collections.map(c => ({ ...c, collection_type: 'smart', type_display: 'Automated (Smart)' }));
}

/**
 * Fetch all Custom (Manual) Collections
 */
async function fetchCustomCollections(client, onProgress) {
  let collections = [];
  let url = '/custom_collections.json?limit=250';
  let page = 1;

  console.log('[Shopify API] ⏳ Fetching Custom (Manual) Collections...');

  while (url) {
    const response = await client.get(url);
    const batch = response.data.custom_collections || [];
    collections = collections.concat(batch);

    const msg = `[Shopify API] 📦 Fetched page ${page} of Custom Collections (${collections.length} loaded)...`;
    console.log(msg);
    if (onProgress) onProgress(msg);

    const nextUrl = getNextPageUrl(response.headers['link']);
    if (nextUrl) {
      const parsed = new URL(nextUrl);
      url = `${parsed.pathname.replace(`/admin/api/${API_VERSION}`, '')}${parsed.search}`;
      page++;
    } else {
      url = null;
    }
  }

  console.log(`[Shopify API] ✅ Completed fetching ${collections.length} Custom Collections.`);
  return collections.map(c => ({ ...c, collection_type: 'custom', type_display: 'Manual (Custom)' }));
}

/**
 * Fetch products associated with a collection to collect tags and product handles
 */
async function fetchProductsForCollection(client, collectionId, limit = 100) {
  try {
    const response = await client.get(
      `/collections/${collectionId}/products.json?limit=${limit}&fields=id,title,handle,tags,product_type,vendor`
    );
    const products = response.data.products || [];

    const tagSet = new Set();
    const productHandles = [];

    products.forEach(p => {
      productHandles.push({
        id: p.id,
        title: p.title,
        handle: p.handle,
        tags: p.tags ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      });
      if (p.tags) {
        p.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });

    return { product_count: products.length, product_tags: Array.from(tagSet), sample_products: productHandles };
  } catch {
    return { product_count: 0, product_tags: [], sample_products: [] };
  }
}

/**
 * Fetch all collections with enriched tags, rules, and product data
 */
export async function fetchAllCollections(shopUrl, accessToken, options = {}, onProgress = () => {}) {
  const { client, shopUrl: domain } = getShopifyClient(shopUrl, accessToken);

  console.log(`[Shopify API] 🚀 Starting complete export discovery for: ${domain}`);
  onProgress('Connecting to Shopify store and initiating collection discovery...');

  const [smartCollections, customCollections] = await Promise.all([
    fetchSmartCollections(client, onProgress),
    fetchCustomCollections(client, onProgress)
  ]);

  const allRaw = [...smartCollections, ...customCollections];
  const summaryMsg = `[Shopify API] 📊 Discovered ${allRaw.length} total collections (${smartCollections.length} automated, ${customCollections.length} manual).`;
  console.log(summaryMsg);
  onProgress(summaryMsg);

  const enrichedCollections = allRaw.map(item => {
    const ruleTags = [];
    if (item.rules && Array.isArray(item.rules)) {
      item.rules.forEach(r => {
        if (r.column === 'tag' && r.condition) ruleTags.push(r.condition);
      });
    }

    return {
      id: item.id,
      title: item.title,
      handle: item.handle,
      body_html: item.body_html || '',
      collection_type: item.collection_type,
      type_display: item.type_display,
      sort_order: item.sort_order || 'best-selling',
      template_suffix: item.template_suffix || null,
      published_scope: item.published_scope || 'web',
      image: item.image ? { src: item.image.src, alt: item.image.alt || '' } : null,
      rules: item.rules || [],
      disjunctive: item.disjunctive !== undefined ? item.disjunctive : true,
      product_count: item.products_count || 0,
      product_tags: ruleTags,
      rule_tags: ruleTags,
      sample_products: [],
      updated_at: item.updated_at
    };
  });

  console.log(`[Shopify API] 🎉 Successfully prepared ${enrichedCollections.length} collections for instant export!`);
  onProgress(`Successfully loaded ${enrichedCollections.length} collections with full metadata!`);

  return {
    shop: domain,
    shopDomain: domain,
    total: enrichedCollections.length,
    smart_count: smartCollections.length,
    custom_count: customCollections.length,
    collections: enrichedCollections
  };
}

/**
 * Find product in target store by handle
 */
async function findProductByHandle(client, handle) {
  try {
    const response = await client.get(`/products.json?handle=${encodeURIComponent(handle)}&fields=id,title,handle`);
    const products = response.data.products || [];
    return products.length > 0 ? products[0] : null;
  } catch {
    return null;
  }
}

/**
 * Build an in-memory index of all existing collections in the destination store
 * to detect duplicates instantly by handle OR title without excessive API calls.
 */
export async function buildTargetStoreCollectionsIndex(client) {
  try {
    const [smartCollections, customCollections] = await Promise.all([
      fetchSmartCollections(client),
      fetchCustomCollections(client)
    ]);

    const handleMap = new Map();
    const titleMap = new Map();

    const record = (col, type) => {
      const entry = { exists: true, type, collection: col };
      if (col.handle) {
        const normHandle = String(col.handle).toLowerCase().trim();
        handleMap.set(normHandle, entry);
      }
      if (col.title) {
        const normTitle = String(col.title).toLowerCase().trim();
        titleMap.set(normTitle, entry);
      }
    };

    smartCollections.forEach(c => record(c, 'smart'));
    customCollections.forEach(c => record(c, 'custom'));

    return {
      total: smartCollections.length + customCollections.length,
      find(handle, title) {
        const normHandle = (handle || '').toLowerCase().trim();
        const normTitle = (title || '').toLowerCase().trim();
        if (normHandle && handleMap.has(normHandle)) {
          return handleMap.get(normHandle);
        }
        if (normTitle && titleMap.has(normTitle)) {
          return titleMap.get(normTitle);
        }
        return { exists: false };
      },
      record
    };
  } catch (err) {
    console.warn('[Shopify API] Failed to build pre-import collection index, falling back to per-item check:', err.message);
    return null;
  }
}

/**
 * Check if a collection already exists in target store by handle or title
 */
async function findExistingCollection(client, handle, title = '', storeIndex = null) {
  if (storeIndex && typeof storeIndex.find === 'function') {
    return storeIndex.find(handle, title);
  }

  try {
    if (handle) {
      const smartRes = await client.get(`/smart_collections.json?handle=${encodeURIComponent(handle)}`);
      if (smartRes.data.smart_collections?.length > 0) {
        return { exists: true, type: 'smart', collection: smartRes.data.smart_collections[0] };
      }
      const customRes = await client.get(`/custom_collections.json?handle=${encodeURIComponent(handle)}`);
      if (customRes.data.custom_collections?.length > 0) {
        return { exists: true, type: 'custom', collection: customRes.data.custom_collections[0] };
      }
    }
    if (title) {
      const smartTitleRes = await client.get(`/smart_collections.json?title=${encodeURIComponent(title)}`);
      if (smartTitleRes.data.smart_collections?.length > 0) {
        return { exists: true, type: 'smart', collection: smartTitleRes.data.smart_collections[0] };
      }
      const customTitleRes = await client.get(`/custom_collections.json?title=${encodeURIComponent(title)}`);
      if (customTitleRes.data.custom_collections?.length > 0) {
        return { exists: true, type: 'custom', collection: customTitleRes.data.custom_collections[0] };
      }
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
}

/**
 * Update an existing collection in destination store
 */
async function updateExistingCollection(client, existing, collectionData, transferImages) {
  const updatePayload = {
    title: collectionData.title,
    body_html: collectionData.body_html || '',
    sort_order: collectionData.sort_order || 'best-selling',
    template_suffix: collectionData.template_suffix || null
  };

  if (transferImages && collectionData.image?.src) {
    updatePayload.image = { src: collectionData.image.src, alt: collectionData.image.alt || collectionData.title };
  }

  if (existing.type === 'smart') {
    if (collectionData.rules?.length > 0) {
      updatePayload.rules = collectionData.rules.map(r => ({ column: r.column, relation: r.relation, condition: r.condition }));
      updatePayload.disjunctive = collectionData.disjunctive !== undefined ? collectionData.disjunctive : true;
    }
    const response = await client.put(`/smart_collections/${existing.collection.id}.json`, { smart_collection: updatePayload });
    return {
      status: 'updated', type: 'smart',
      collectionId: existing.collection.id,
      title: response.data.smart_collection.title,
      handle: response.data.smart_collection.handle,
      message: `Updated existing automated collection.`
    };
  } else {
    const response = await client.put(`/custom_collections/${existing.collection.id}.json`, { custom_collection: updatePayload });
    return {
      status: 'updated', type: 'custom',
      collectionId: existing.collection.id,
      title: response.data.custom_collection.title,
      handle: response.data.custom_collection.handle,
      message: `Updated existing manual collection.`
    };
  }
}

/**
 * Create or import a single collection into destination store
 */
export async function importSingleCollection(client, collectionData, options = {}, storeIndex = null) {
  const {
    conflictStrategy = 'skip',
    transferImages = true,
    mapProducts = true
  } = options;

  let targetHandle = collectionData.handle;
  const existing = await findExistingCollection(client, targetHandle, collectionData.title, storeIndex);

  if (existing.exists) {
    if (conflictStrategy === 'skip') {
      return {
        status: 'skipped',
        title: collectionData.title,
        handle: collectionData.handle,
        message: `Collection "${collectionData.title}" already exists on target store (Handle: /${existing.collection?.handle || targetHandle}). Skipped to prevent duplicates.`,
        collectionId: existing.collection?.id
      };
    } else if (conflictStrategy === 'create_new') {
      targetHandle = `${targetHandle}-imported-${Date.now().toString().slice(-4)}`;
    } else if (conflictStrategy === 'overwrite') {
      return await updateExistingCollection(client, existing, collectionData, transferImages);
    }
  }

  const basePayload = {
    title: collectionData.title,
    handle: targetHandle,
    body_html: collectionData.body_html || '',
    sort_order: collectionData.sort_order || 'best-selling',
    template_suffix: collectionData.template_suffix || null,
    published: true
  };

  if (transferImages && collectionData.image?.src) {
    basePayload.image = { src: collectionData.image.src, alt: collectionData.image.alt || collectionData.title };
  }

  const isSmart = collectionData.collection_type === 'smart' || collectionData.rules?.length > 0;
  const cleanedRules = (collectionData.rules || []).map(r => ({
    column: r.column, relation: r.relation, condition: r.condition
  }));

  const createCollectionPayload = (includeImg) => {
    const payload = { ...basePayload };
    if (!includeImg) delete payload.image;
    if (isSmart) {
      return {
        url: '/smart_collections.json',
        data: {
          smart_collection: {
            ...payload,
            rules: cleanedRules,
            disjunctive: collectionData.disjunctive !== undefined ? collectionData.disjunctive : true
          }
        },
        key: 'smart_collection'
      };
    } else {
      return {
        url: '/custom_collections.json',
        data: { custom_collection: payload },
        key: 'custom_collection'
      };
    }
  };

  let response;
  try {
    const req = createCollectionPayload(true);
    response = await client.post(req.url, req.data);
  } catch (err) {
    const errText = JSON.stringify(err.response?.data || '');
    if (basePayload.image && (errText.includes('Image') || errText.includes('image') || errText.includes('download') || errText.includes('not found'))) {
      console.log(`[Shopify API] Image URL failed for "${collectionData.title}". Retrying without image...`);
      const reqFallback = createCollectionPayload(false);
      response = await client.post(reqFallback.url, reqFallback.data);
    } else {
      throw err;
    }
  }

  if (isSmart) {
    const created = response.data.smart_collection;
    storeIndex?.record?.(created, 'smart');
    return {
      status: 'created', type: 'smart',
      collectionId: created.id, title: created.title, handle: created.handle,
      ruleCount: cleanedRules.length,
      message: `Created automated collection with ${cleanedRules.length} rule(s). Product tag matching active.`
    };
  } else {
    const created = response.data.custom_collection;
    storeIndex?.record?.(created, 'custom');
    let linkedProducts = 0;

    if (mapProducts && Array.isArray(collectionData.sample_products)) {
      for (const prod of collectionData.sample_products) {
        if (prod.handle) {
          const found = await findProductByHandle(client, prod.handle);
          if (found) {
            try {
              await client.post('/collects.json', { collect: { collection_id: created.id, product_id: found.id } });
              linkedProducts++;
              await new Promise(r => setTimeout(r, 60));
            } catch { /* ignore duplicate collects */ }
          }
        }
      }
    }

    return {
      status: 'created', type: 'custom',
      collectionId: created.id, title: created.title, handle: created.handle,
      linkedProducts,
      message: `Created manual collection. Linked ${linkedProducts} matching product(s).`
    };
  }
}

/**
 * Import a list of collections with progress callbacks
 */
export async function importCollectionsBatch(shopUrl, accessToken, collections, options = {}, onProgress = () => {}) {
  const { client } = getShopifyClient(shopUrl, accessToken);

  const results = { total: collections.length, created: 0, updated: 0, skipped: 0, failed: 0, details: [] };

  onProgress({
    index: 0, total: collections.length, percent: 0,
    currentTitle: 'Scanning Destination Store', status: 'processing',
    message: 'Analyzing target store for existing collections to prevent duplicate entries...'
  });

  // Pre-load all existing collections from target store for fast, 100% accurate duplicate detection
  const storeIndex = await buildTargetStoreCollectionsIndex(client);

  if (storeIndex) {
    onProgress({
      index: 0, total: collections.length, percent: 0,
      currentTitle: 'Destination Store Scanned', status: 'processing',
      message: `Found ${storeIndex.total} existing collections on destination store. Commencing migration...`
    });
  }

  for (let i = 0; i < collections.length; i++) {
    const col = collections[i];
    onProgress({
      index: i + 1, total: collections.length,
      percent: Math.round((i / collections.length) * 100),
      currentTitle: col.title, status: 'processing',
      message: `Processing [${i + 1}/${collections.length}] "${col.title}"...`
    });

    try {
      const result = await importSingleCollection(client, col, options, storeIndex);
      if (result.status === 'created') results.created++;
      else if (result.status === 'updated') results.updated++;
      else if (result.status === 'skipped') results.skipped++;

      results.details.push({ title: col.title, handle: col.handle, ...result });
      onProgress({
        index: i + 1, total: collections.length,
        percent: Math.round(((i + 1) / collections.length) * 100),
        currentTitle: col.title, status: result.status, message: result.message
      });

      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      results.failed++;
      let errMsg = err.message;
      if (err.response?.data?.errors) {
        errMsg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors);
      }
      results.details.push({ title: col.title, handle: col.handle, status: 'failed', error: errMsg, message: `Failed: ${errMsg}` });
      onProgress({
        index: i + 1, total: collections.length,
        percent: Math.round(((i + 1) / collections.length) * 100),
        currentTitle: col.title, status: 'failed',
        message: `Error importing "${col.title}": ${errMsg}`
      });
    }
  }

  return results;
}

/**
 * Delete a single collection from Shopify store by ID and type
 */
export async function deleteSingleCollection(client, collectionId, collectionType) {
  const isSmart = collectionType === 'smart';
  const endpoint = isSmart
    ? `/smart_collections/${collectionId}.json`
    : `/custom_collections/${collectionId}.json`;

  try {
    await client.delete(endpoint);
    return { success: true, id: collectionId, status: 'deleted' };
  } catch (err) {
    // If collection deletion returned 404, attempt fallback endpoint
    if (err.response?.status === 404) {
      const fallbackEndpoint = isSmart
        ? `/custom_collections/${collectionId}.json`
        : `/smart_collections/${collectionId}.json`;
      try {
        await client.delete(fallbackEndpoint);
        return { success: true, id: collectionId, status: 'deleted' };
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
    throw err;
  }
}

/**
 * Delete collections in batch from Shopify store with progress tracking
 * mode: 'all' | 'smart' | 'manual' | 'custom' | 'selected'
 */
export async function deleteCollectionsBatch(shopUrl, accessToken, { mode = 'all', collectionIds = [] }, onProgress = () => {}) {
  const { client } = getShopifyClient(shopUrl, accessToken);

  onProgress({
    index: 0,
    total: 0,
    percent: 0,
    currentTitle: 'Scanning Destination Store',
    status: 'processing',
    message: 'Scanning destination store for collections to delete...'
  });

  let targetCollections = [];

  if (mode === 'selected' && collectionIds && collectionIds.length > 0) {
    if (typeof collectionIds[0] === 'object') {
      targetCollections = collectionIds;
    } else {
      const [smarts, customs] = await Promise.all([
        fetchSmartCollections(client),
        fetchCustomCollections(client)
      ]);
      const all = [...smarts, ...customs];
      const idSet = new Set(collectionIds.map(String));
      targetCollections = all.filter(c => idSet.has(String(c.id)));
    }
  } else {
    let smarts = [];
    let customs = [];

    if (mode === 'all' || mode === 'smart') {
      smarts = await fetchSmartCollections(client);
    }
    if (mode === 'all' || mode === 'manual' || mode === 'custom') {
      customs = await fetchCustomCollections(client);
    }

    targetCollections = [...smarts, ...customs];
  }

  const total = targetCollections.length;
  const results = {
    total,
    deleted: 0,
    failed: 0,
    details: []
  };

  if (total === 0) {
    onProgress({
      index: 0,
      total: 0,
      percent: 100,
      currentTitle: 'Done',
      status: 'completed',
      message: 'No collections found on destination store matching the deletion criteria.'
    });
    return results;
  }

  onProgress({
    index: 0,
    total,
    percent: 0,
    currentTitle: 'Starting Deletion',
    status: 'processing',
    message: `Found ${total} collection(s) to delete. Starting deletion...`
  });

  for (let i = 0; i < total; i++) {
    const col = targetCollections[i];
    const colTitle = col.title || `Collection #${col.id}`;
    const colType = col.collection_type || (col.rules ? 'smart' : 'custom');

    onProgress({
      index: i + 1,
      total,
      percent: Math.round((i / total) * 100),
      currentTitle: colTitle,
      status: 'processing',
      message: `Deleting [${i + 1}/${total}] "${colTitle}" (${colType})...`
    });

    try {
      await deleteSingleCollection(client, col.id, colType);
      results.deleted++;
      results.details.push({ id: col.id, title: colTitle, type: colType, status: 'deleted' });

      onProgress({
        index: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        currentTitle: colTitle,
        status: 'deleted',
        message: `Deleted "${colTitle}"`
      });

      await new Promise(r => setTimeout(r, 120));
    } catch (err) {
      results.failed++;
      let errMsg = err.message;
      if (err.response?.data?.errors) {
        errMsg = typeof err.response.data.errors === 'string'
          ? err.response.data.errors
          : JSON.stringify(err.response.data.errors);
      }

      results.details.push({
        id: col.id,
        title: colTitle,
        type: colType,
        status: 'failed',
        error: errMsg
      });

      onProgress({
        index: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        currentTitle: colTitle,
        status: 'failed',
        message: `Failed to delete "${colTitle}": ${errMsg}`
      });
    }
  }

  return results;
}
