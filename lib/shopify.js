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
  const cleanUrl = normalizeShopUrl(shopUrl);
  const cleanToken = String(accessToken || '').trim();
  const { client, shopUrl: domain } = getShopifyClient(cleanUrl, cleanToken);

  // Endpoints to test in sequence
  const testEndpoints = [
    { url: '/shop.json', parser: res => res.data?.shop },
    { url: '/custom_collections.json?limit=1', parser: () => null },
    { url: '/smart_collections.json?limit=1', parser: () => null },
    { url: '/products.json?limit=1', parser: () => null }
  ];

  let lastError = null;

  for (const ep of testEndpoints) {
    try {
      const response = await client.get(ep.url);
      const shopObj = ep.parser(response);

      return {
        success: true,
        shop: {
          id: shopObj?.id || domain,
          name: shopObj?.name || domain.replace('.myshopify.com', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          email: shopObj?.email || '',
          domain: shopObj?.domain || domain,
          myshopifyDomain: domain,
          currency: shopObj?.currency || 'USD',
          plan_name: shopObj?.plan_name || 'Active',
          country: shopObj?.country_name || '',
          timezone: shopObj?.iana_timezone || ''
        }
      };
    } catch (err) {
      lastError = err;
    }
  }

  // If all attempts failed, inspect the failure
  let rawShopifyError = '';
  if (lastError?.response?.data?.errors) {
    rawShopifyError = typeof lastError.response.data.errors === 'string'
      ? lastError.response.data.errors
      : JSON.stringify(lastError.response.data.errors);
  }

  let message = lastError?.message || 'Connection failed.';

  if (lastError?.response) {
    const status = lastError.response.status;
    if (status === 401) {
      message = `Invalid API Access Token (${rawShopifyError || 'Unrecognized login'}). Ensure you clicked "Install app" in Shopify Admin and copied the Admin API Access Token (shpat_...).`;
    } else if (status === 403) {
      message = `Insufficient permissions (403). Ensure read_products & write_products scopes are checked in Shopify Admin.`;
    } else if (status === 404) {
      message = `Store domain not found (${domain}). Please check the .myshopify.com domain in Shopify Admin → Settings → Domains.`;
    } else if (rawShopifyError) {
      message = rawShopifyError;
    }
  }

  return { success: false, error: message };
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
export async function fetchAllCollections(shopUrl, accessToken, options = {}, onProgress = () => { }) {
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
export async function importCollectionsBatch(shopUrl, accessToken, collections, options = {}, onProgress = () => { }) {
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
export async function deleteCollectionsBatch(shopUrl, accessToken, { mode = 'all', collectionIds = [] }, onProgress = () => { }) {
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

// ══════════════════════════════════════════════════════════════════════════════
// SHOPIFY ADMIN GRAPHQL API ENGINE (COLLECTIONS IMPORT & MANAGEMENT)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Map rule column string to GraphQL CollectionRuleColumn enum
 */
export function mapRuleColumnToGraphQL(col) {
  if (!col) return 'TAG';
  const c = String(col).toUpperCase().trim();
  const mapping = {
    'TAG': 'TAG',
    'TITLE': 'TITLE',
    'TYPE': 'TYPE',
    'VENDOR': 'VENDOR',
    'VARIANT_PRICE': 'VARIANT_PRICE',
    'PRICE': 'VARIANT_PRICE',
    'VARIANT_COMPARE_AT_PRICE': 'VARIANT_COMPARE_AT_PRICE',
    'COMPARE_AT_PRICE': 'VARIANT_COMPARE_AT_PRICE',
    'VARIANT_WEIGHT': 'VARIANT_WEIGHT',
    'WEIGHT': 'VARIANT_WEIGHT',
    'VARIANT_INVENTORY': 'VARIANT_INVENTORY',
    'INVENTORY_STOCK': 'VARIANT_INVENTORY',
    'VARIANT_TITLE': 'VARIANT_TITLE'
  };
  return mapping[c] || 'TAG';
}

/**
 * Map rule relation string to GraphQL CollectionRuleRelation enum
 */
export function mapRuleRelationToGraphQL(rel) {
  if (!rel) return 'EQUALS';
  const r = String(rel).toUpperCase().trim();
  const mapping = {
    'EQUALS': 'EQUALS',
    'NOT_EQUALS': 'NOT_EQUALS',
    'STARTS_WITH': 'STARTS_WITH',
    'ENDS_WITH': 'ENDS_WITH',
    'CONTAINS': 'CONTAINS',
    'NOT_CONTAINS': 'NOT_CONTAINS',
    'GREATER_THAN': 'GREATER_THAN',
    'LESS_THAN': 'LESS_THAN'
  };
  return mapping[r] || 'EQUALS';
}

/**
 * Map sort order string to GraphQL CollectionSortOrder enum
 */
export function mapSortOrderToGraphQL(order) {
  if (!order) return 'BEST_SELLING';
  const o = String(order).toUpperCase().replace(/[-_]/g, '_').trim();
  const mapping = {
    'BEST_SELLING': 'BEST_SELLING',
    'ALPHA_ASC': 'ALPHA_ASC',
    'ALPHA_DESC': 'ALPHA_DESC',
    'PRICE_DESC': 'PRICE_DESC',
    'PRICE_ASC': 'PRICE_ASC',
    'CREATED_DESC': 'CREATED_DESC',
    'CREATED': 'CREATED',
    'MANUAL': 'MANUAL'
  };
  return mapping[o] || 'BEST_SELLING';
}

/**
 * Execute GraphQL query / mutation with rate limit handling, cost throttling, and exponential backoff
 */
export async function shopifyGraphQL(shopUrl, accessToken, query, variables = {}, retryCount = 0) {
  const cleanUrl = normalizeShopUrl(shopUrl);
  const endpoint = `https://${cleanUrl}/admin/api/${API_VERSION}/graphql.json`;

  try {
    const response = await axios.post(
      endpoint,
      { query, variables },
      {
        headers: {
          'X-Shopify-Access-Token': accessToken.trim(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 35000
      }
    );

    const resData = response.data;

    // Check throttle cost status
    if (resData?.extensions?.cost?.throttleStatus) {
      const { currentlyAvailable, restoreRate } = resData.extensions.cost.throttleStatus;
      if (currentlyAvailable < 50 && restoreRate > 0) {
        const waitMs = Math.ceil(((50 - currentlyAvailable) / restoreRate) * 1000);
        console.log(`[Shopify GraphQL] Cost throttle approaching limit (available: ${currentlyAvailable}). Waiting ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }

    // Check for GraphQL errors (e.g. THROTTLED)
    if (resData?.errors && Array.isArray(resData.errors)) {
      const throttledError = resData.errors.find(
        e => e.extensions?.code === 'THROTTLED' || String(e.message).toLowerCase().includes('throttled')
      );
      if (throttledError && retryCount < 5) {
        const backoff = Math.min(10000, Math.pow(2, retryCount) * 1000);
        console.log(`[Shopify GraphQL] Throttled by Shopify. Retrying in ${backoff}ms (attempt ${retryCount + 1})...`);
        await new Promise(r => setTimeout(r, backoff));
        return shopifyGraphQL(shopUrl, accessToken, query, variables, retryCount + 1);
      }
    }

    return resData;
  } catch (err) {
    if (err.response && err.response.status === 429 && retryCount < 5) {
      const retryHeader = err.response.headers['retry-after'];
      const backoff = retryHeader ? parseFloat(retryHeader) * 1000 : Math.min(10000, Math.pow(2, retryCount) * 1000);
      console.log(`[Shopify GraphQL] HTTP 429 rate limited. Retrying in ${backoff}ms (attempt ${retryCount + 1})...`);
      await new Promise(r => setTimeout(r, backoff));
      return shopifyGraphQL(shopUrl, accessToken, query, variables, retryCount + 1);
    }
    throw err;
  }
}

/**
 * Fetch all existing collection handles of the store via GraphQL
 * Returns a Map: lowercase handle -> { id, handle, title, isSmart }
 */
export async function fetchExistingCollectionHandlesGraphQL(shopUrl, accessToken) {
  const handleMap = new Map();
  let hasNextPage = true;
  let endCursor = null;

  const query = `
    query getCollections($first: Int!, $after: String) {
      collections(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            handle
            title
            ruleSet {
              appliedDisjunctively
            }
          }
        }
      }
    }
  `;

  try {
    while (hasNextPage) {
      const res = await shopifyGraphQL(shopUrl, accessToken, query, {
        first: 250,
        after: endCursor
      });

      const collData = res?.data?.collections;
      if (!collData) break;

      const edges = collData.edges || [];
      for (const edge of edges) {
        const node = edge.node;
        if (node?.handle) {
          const normHandle = String(node.handle).toLowerCase().trim();
          handleMap.set(normHandle, {
            id: node.id,
            handle: node.handle,
            title: node.title,
            isSmart: Boolean(node.ruleSet)
          });
        }
      }

      hasNextPage = collData.pageInfo?.hasNextPage || false;
      endCursor = collData.pageInfo?.endCursor || null;
    }
  } catch (err) {
    console.warn(`[Shopify GraphQL] fetchExistingCollectionHandlesGraphQL warning: ${err.message}`);
  }

  return handleMap;
}

/**
 * Find product by handle in the store via GraphQL
 */
export async function findProductByHandleGraphQL(shopUrl, accessToken, handle) {
  if (!handle) return null;
  const cleanHandle = String(handle).trim();

  const query = `
    query getProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        id
        handle
        title
      }
    }
  `;

  try {
    const res = await shopifyGraphQL(shopUrl, accessToken, query, { handle: cleanHandle });
    return res?.data?.productByHandle || null;
  } catch {
    return null;
  }
}

/**
 * Helper to validate if a string is a valid HTTPS URL
 */
export function isValidHttpsUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalize an image URL:
 * - trim spaces
 * - force https
 * - handle protocol-relative URLs (//cdn.shopify.com/...)
 * - encode special characters in pathname without double-encoding existing percent-encoded characters
 */
export function normalizeImageUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return '';
  let cleaned = urlString.trim();
  if (!cleaned) return '';

  // Handle protocol-relative URLs and force https
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  } else if (cleaned.startsWith('http://')) {
    cleaned = 'https://' + cleaned.slice(7);
  } else if (cleaned.startsWith('https://')) {
    // already https
  } else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(cleaned)) {
    // URL without protocol (e.g. cdn.shopify.com/...), assume https
    cleaned = 'https://' + cleaned;
  }

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      parsed.protocol = 'https:';
    }
    const decodedPath = decodeURI(parsed.pathname);
    parsed.pathname = encodeURI(decodedPath);
    return parsed.toString();
  } catch {
    return encodeURI(cleaned);
  }
}

/**
 * Strip query string (?v=...) and hash from an image URL
 */
export function stripUrlQuery(urlString) {
  if (!urlString || typeof urlString !== 'string') return '';
  try {
    const parsed = new URL(urlString);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return urlString.split('?')[0].split('#')[0];
  }
}

/**
 * Download image bytes on the server:
 * - Checks content-type is an image
 * - Checks size < 20 MB
 * - Timeout: 15 seconds
 * - Detects 404/403 dead URLs
 */
export async function downloadImageForStaging(imageUrl) {
  try {
    const res = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 20 * 1024 * 1024,
      validateStatus: () => true, // capture all HTTP status codes (404, 403, 500, etc.)
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    const status = res.status;
    const contentType = (res.headers['content-type'] || '').toLowerCase();

    if (status === 404 || status === 403) {
      return {
        ok: false,
        status,
        contentType,
        deadUrl: true,
        error: `source image not found (HTTP ${status})`
      };
    }

    if (status < 200 || status >= 300) {
      return {
        ok: false,
        status,
        contentType,
        error: `source image returned HTTP ${status}`
      };
    }

    if (!contentType.includes('image/')) {
      return {
        ok: false,
        status,
        contentType,
        error: `Content-type is not an image (${contentType || 'unknown'})`
      };
    }

    const bytes = Buffer.isBuffer(res.data) ? res.data : Buffer.from(res.data);
    if (bytes.length > 20 * 1024 * 1024) {
      return {
        ok: false,
        status,
        contentType,
        size: bytes.length,
        error: `Image size exceeds 20 MB limit`
      };
    }

    return {
      ok: true,
      status,
      contentType,
      size: bytes.length,
      bytes
    };
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return {
        ok: false,
        status: 408,
        contentType: '',
        error: 'Image download timed out after 15s'
      };
    }
    const errStatus = err.response?.status || null;
    if (errStatus === 404 || errStatus === 403) {
      return {
        ok: false,
        status: errStatus,
        contentType: err.response?.headers?.['content-type'] || '',
        deadUrl: true,
        error: `source image not found (HTTP ${errStatus})`
      };
    }
    return {
      ok: false,
      status: errStatus,
      contentType: err.response?.headers?.['content-type'] || '',
      error: err.message
    };
  }
}

/**
 * Create a staged upload in Shopify (resource IMAGE), upload the image bytes,
 * and return the resourceUrl to attach to the collection.
 */
export async function executeStagedUpload(shopUrl, accessToken, imageBytes, contentType, filename = 'collection-image.jpg') {
  const mimeType = (contentType || 'image/jpeg').split(';')[0].trim();
  const cleanFilename = String(filename || 'collection-image.jpg').split('?')[0].split('/').pop() || 'collection-image.jpg';

  const mutation = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input = [
    {
      resource: 'IMAGE',
      filename: cleanFilename,
      mimeType,
      httpMethod: 'POST'
    }
  ];

  const res = await shopifyGraphQL(shopUrl, accessToken, mutation, { input });
  const stagedTargets = res?.data?.stagedUploadsCreate?.stagedTargets || [];
  const userErrors = res?.data?.stagedUploadsCreate?.userErrors || [];

  if (userErrors.length > 0 || stagedTargets.length === 0) {
    const msg = userErrors.map(e => e.message).join('; ') || 'No staged target returned by Shopify';
    throw new Error(`Shopify stagedUploadsCreate error: ${msg}`);
  }

  const target = stagedTargets[0];

  // Upload to target.url using FormData
  const formData = new FormData();
  if (Array.isArray(target.parameters)) {
    for (const p of target.parameters) {
      formData.append(p.name, p.value);
    }
  }

  const blob = new Blob([imageBytes], { type: mimeType });
  formData.append('file', blob, cleanFilename);

  const uploadRes = await fetch(target.url, {
    method: 'POST',
    body: formData
  });

  if (!uploadRes.ok && uploadRes.status !== 201 && uploadRes.status !== 204) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`Failed to upload image bytes to Shopify staged target (HTTP ${uploadRes.status}): ${errText.slice(0, 200)}`);
  }

  return target.resourceUrl;
}

/**
 * Attempt to set collection image following the strict fallback order:
 * Attempt a: Normalize URL (trim, https, //, encodeURI) -> collectionUpdate
 * Attempt b: Retry without query string (?v=...) -> collectionUpdate
 * Attempt c: Staged upload fallback (download bytes, size < 20MB, timeout 15s, stagedUploadsCreate IMAGE, upload bytes, collectionUpdate with resourceUrl)
 * Diagnostic: If URL is dead (404/403) or fails, log exact sheet URL, HTTP status, content-type, full Shopify userErrors (field, message, code).
 */
export async function setCollectionImageWithFallbacks(shopUrl, accessToken, collectionId, colData, initialUserErrors = []) {
  const rawImageUrl = String(colData.image_url || colData.image?.src || '').trim();
  const rawImageAlt = String(colData.image_alt || colData.image?.alt || colData.image?.altText || colData.title || '').trim();

  if (!rawImageUrl) {
    return { success: true, image: null };
  }

  const updateMutation = `
    mutation setCollectionImage($input: CollectionInput!) {
      collectionUpdate(input: $input) {
        collection {
          id
          handle
          title
          image {
            id
            url
            altText
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  let lastUserErrors = Array.isArray(initialUserErrors) ? [...initialUserErrors] : [];
  let httpStatus = null;
  let contentType = '';

  const logDiagnosis = (reason) => {
    const formattedErrors = (lastUserErrors.length > 0 ? lastUserErrors : [{ field: ['image'], message: reason }]).map(e => ({
      field: e.field || ['image'],
      message: e.message || reason,
      code: e.code || 'IMAGE_UPDATE_FAILED'
    }));
    console.log(`[Import Image Diagnosis] Failed image for collection "${colData.title}": sheet image_url="${rawImageUrl}", HTTP status=${httpStatus}, content-type="${contentType}", shopify userErrors=${JSON.stringify(formattedErrors)}`);
  };

  // Attempt a: Normalize the URL
  const normalizedUrl = normalizeImageUrl(rawImageUrl);
  console.log(`[Import Image] "${colData.title}": Attempt (a) normalized URL: "${normalizedUrl}"`);

  let resA = await shopifyGraphQL(shopUrl, accessToken, updateMutation, {
    input: {
      id: collectionId,
      image: {
        src: normalizedUrl,
        altText: rawImageAlt || colData.title || ''
      }
    }
  });

  let userErrorsA = resA?.data?.collectionUpdate?.userErrors || [];
  let collectionA = resA?.data?.collectionUpdate?.collection;

  if (userErrorsA.length === 0 && collectionA?.image) {
    console.log(`[Import Image] "${colData.title}": Attempt (a) normalized URL succeeded with image.`);
    return { success: true, image: collectionA.image, method: 'normalized_url' };
  }

  lastUserErrors = userErrorsA.length > 0 ? userErrorsA : lastUserErrors;
  console.log(`[Import Image] "${colData.title}": Attempt (a) failed. userErrors: ${JSON.stringify(userErrorsA)}`);

  // Attempt b: Retry with the same URL without the query string (?v=...)
  const strippedUrl = stripUrlQuery(normalizedUrl);
  if (strippedUrl && strippedUrl !== normalizedUrl) {
    console.log(`[Import Image] "${colData.title}": Attempt (b) trying stripped query URL: "${strippedUrl}"`);

    let resB = await shopifyGraphQL(shopUrl, accessToken, updateMutation, {
      input: {
        id: collectionId,
        image: {
          src: strippedUrl,
          altText: rawImageAlt || colData.title || ''
        }
      }
    });

    let userErrorsB = resB?.data?.collectionUpdate?.userErrors || [];
    let collectionB = resB?.data?.collectionUpdate?.collection;

    if (userErrorsB.length === 0 && collectionB?.image) {
      console.log(`[Import Image] "${colData.title}": Attempt (b) stripped query URL succeeded with image.`);
      return { success: true, image: collectionB.image, method: 'stripped_query_url' };
    }

    lastUserErrors = userErrorsB.length > 0 ? userErrorsB : lastUserErrors;
    console.log(`[Import Image] "${colData.title}": Attempt (b) failed. userErrors: ${JSON.stringify(userErrorsB)}`);
  }

  // Attempt c: Staged upload fallback
  console.log(`[Import Image] "${colData.title}": Attempt (c) starting staged upload fallback...`);
  let downloadResult = await downloadImageForStaging(normalizedUrl);
  if (!downloadResult.ok && !downloadResult.deadUrl && strippedUrl && strippedUrl !== normalizedUrl) {
    downloadResult = await downloadImageForStaging(strippedUrl);
  }

  httpStatus = downloadResult.status;
  contentType = downloadResult.contentType || '';

  if (downloadResult.deadUrl) {
    logDiagnosis(downloadResult.error);
    return {
      success: false,
      deadUrl: true,
      httpStatus,
      contentType,
      error: downloadResult.error // "source image not found (HTTP 404)" or 403
    };
  }

  if (!downloadResult.ok) {
    logDiagnosis(downloadResult.error);
    return {
      success: false,
      httpStatus,
      contentType,
      error: downloadResult.error
    };
  }

  try {
    const resourceUrl = await executeStagedUpload(
      shopUrl,
      accessToken,
      downloadResult.bytes,
      downloadResult.contentType,
      normalizedUrl
    );

    console.log(`[Import Image] "${colData.title}": Staged upload completed. Attaching resourceUrl to collection...`);

    let resC = await shopifyGraphQL(shopUrl, accessToken, updateMutation, {
      input: {
        id: collectionId,
        image: {
          src: resourceUrl,
          altText: rawImageAlt || colData.title || ''
        }
      }
    });

    let userErrorsC = resC?.data?.collectionUpdate?.userErrors || [];
    let collectionC = resC?.data?.collectionUpdate?.collection;

    if (userErrorsC.length === 0 && collectionC?.image) {
      console.log(`[Import Image] "${colData.title}": Attempt (c) staged upload succeeded! Image attached.`);
      return { success: true, image: collectionC.image, method: 'staged_upload' };
    }

    lastUserErrors = userErrorsC.length > 0 ? userErrorsC : lastUserErrors;
    const errMsg = lastUserErrors.map(e => e.message).join('; ') || 'Staged upload image attachment failed';
    logDiagnosis(errMsg);
    return {
      success: false,
      httpStatus,
      contentType,
      error: errMsg
    };
  } catch (err) {
    logDiagnosis(err.message);
    return {
      success: false,
      httpStatus,
      contentType,
      error: err.message
    };
  }
}

/**
 * Create collection via Shopify Admin GraphQL API (collectionCreate mutation)
 */
export async function createCollectionGraphQL(shopUrl, accessToken, colData, options = {}) {
  const isSmart = colData.collection_type === 'smart' || (colData.rules && colData.rules.length > 0);
  const input = {
    title: colData.title,
    handle: colData.handle,
    descriptionHtml: colData.body_html || '',
    sortOrder: mapSortOrderToGraphQL(colData.sort_order),
    templateSuffix: colData.template_suffix || null
  };

  const transferImages = options.transferImages !== false;
  const rawImageUrl = String(colData.image_url || colData.image?.src || '').trim();
  const rawImageAlt = String(colData.image_alt || colData.image?.alt || colData.image?.altText || colData.title || '').trim();

  let imageFailed = false;
  let imageError = null;

  if (transferImages && rawImageUrl) {
    const normalized = normalizeImageUrl(rawImageUrl);
    if (isValidHttpsUrl(normalized)) {
      input.image = {
        src: normalized,
        altText: rawImageAlt || colData.title || ''
      };
    } else {
      imageFailed = true;
      imageError = `Invalid image URL (must be a valid https URL): "${rawImageUrl}"`;
    }
  }

  // Log per-collection details (no tokens!)
  console.log(`[Import Image] "${colData.title || colData.handle}": sheet image_url="${rawImageUrl}", transferImages=${transferImages}, exact image input sent to Shopify=${JSON.stringify(input.image || null)}`);

  if (isSmart) {
    const rules = (colData.rules || []).map(r => ({
      column: mapRuleColumnToGraphQL(r.column),
      relation: mapRuleRelationToGraphQL(r.relation),
      condition: String(r.condition || '')
    }));
    input.ruleSet = {
      appliedDisjunctively: colData.disjunctive !== undefined ? Boolean(colData.disjunctive) : true,
      rules
    };
  }

  const skippedProducts = [];

  // For custom collections, resolve product IDs by handle
  if (!isSmart && options.mapProducts !== false && Array.isArray(colData.sample_products) && colData.sample_products.length > 0) {
    const productGids = [];
    for (const prod of colData.sample_products) {
      if (prod.handle) {
        const found = await findProductByHandleGraphQL(shopUrl, accessToken, prod.handle);
        if (found?.id) {
          productGids.push(found.id);
        } else {
          skippedProducts.push(prod.handle);
        }
      }
    }
    if (productGids.length > 0) {
      input.products = productGids;
    }
  }

  const mutation = `
    mutation createCollection($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection {
          id
          handle
          title
          image {
            id
            url
            altText
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  let res = await shopifyGraphQL(shopUrl, accessToken, mutation, { input });
  let userErrors = res?.data?.collectionCreate?.userErrors || [];
  let created = res?.data?.collectionCreate?.collection;

  // Log response per collection (no tokens!)
  console.log(`[Import Image] "${colData.title || colData.handle}": collectionCreate returned image=${JSON.stringify(created?.image || null)}, userErrors=${JSON.stringify(userErrors)}`);

  // If Shopify rejects the image in collectionCreate, still create the collection without image,
  // then set the image with fallback order (Attempt a -> Attempt b -> Attempt c)
  if (userErrors.length > 0 && input.image) {
    const imageErr = userErrors.find(e =>
      String(e.field || '').toLowerCase().includes('image') ||
      String(e.message || '').toLowerCase().includes('image')
    );

    if (imageErr) {
      console.log(`[Import Image] Shopify rejected image in collectionCreate for "${colData.title}". Creating collection without image first...`);
      const inputWithoutImage = { ...input };
      delete inputWithoutImage.image;

      res = await shopifyGraphQL(shopUrl, accessToken, mutation, { input: inputWithoutImage });
      userErrors = res?.data?.collectionCreate?.userErrors || [];
      created = res?.data?.collectionCreate?.collection;

      if (userErrors.length > 0 || !created) {
        const msg = userErrors.map(e => e.message).join('; ');
        throw new Error(`Shopify GraphQL collectionCreate error: ${msg}`);
      }

      console.log(`[Import Image] Collection "${colData.title}" created (${created.id}). Setting image with fallback order...`);
      const imgRes = await setCollectionImageWithFallbacks(shopUrl, accessToken, created.id, colData, [imageErr]);
      if (imgRes.success) {
        created.image = imgRes.image;
        imageFailed = false;
        imageError = null;
      } else {
        imageFailed = true;
        imageError = imgRes.error;
      }
    }
  }

  if (userErrors.length > 0) {
    const msg = userErrors.map(e => e.message).join('; ');
    throw new Error(`Shopify GraphQL collectionCreate error: ${msg}`);
  }

  if (!created) {
    throw new Error('Shopify GraphQL did not return created collection.');
  }

  return {
    status: 'created',
    id: created.id,
    handle: created.handle,
    title: created.title,
    image: created.image || null,
    imageFailed: Boolean(imageFailed),
    imageError: imageError || null,
    skippedProducts
  };
}

/**
 * Update existing collection via Shopify Admin GraphQL API (collectionUpdate mutation)
 */
export async function updateCollectionGraphQL(shopUrl, accessToken, existingId, colData, options = {}) {
  const isSmart = colData.collection_type === 'smart' || (colData.rules && colData.rules.length > 0);
  const input = {
    id: existingId,
    title: colData.title,
    descriptionHtml: colData.body_html || '',
    sortOrder: mapSortOrderToGraphQL(colData.sort_order),
    templateSuffix: colData.template_suffix || null
  };

  const transferImages = options.transferImages !== false;
  const rawImageUrl = String(colData.image_url || colData.image?.src || '').trim();
  const rawImageAlt = String(colData.image_alt || colData.image?.alt || colData.image?.altText || colData.title || '').trim();

  let imageFailed = false;
  let imageError = null;

  if (transferImages && rawImageUrl) {
    const normalized = normalizeImageUrl(rawImageUrl);
    if (isValidHttpsUrl(normalized)) {
      input.image = {
        src: normalized,
        altText: rawImageAlt || colData.title || ''
      };
    } else {
      imageFailed = true;
      imageError = `Invalid image URL (must be a valid https URL): "${rawImageUrl}"`;
    }
  }

  // Log per-collection details (no tokens!)
  console.log(`[Import Image] "${colData.title || colData.handle}": sheet image_url="${rawImageUrl}", transferImages=${transferImages}, exact image input sent to Shopify=${JSON.stringify(input.image || null)}`);

  if (isSmart) {
    const rules = (colData.rules || []).map(r => ({
      column: mapRuleColumnToGraphQL(r.column),
      relation: mapRuleRelationToGraphQL(r.relation),
      condition: String(r.condition || '')
    }));
    input.ruleSet = {
      appliedDisjunctively: colData.disjunctive !== undefined ? Boolean(colData.disjunctive) : true,
      rules
    };
  }

  const mutation = `
    mutation updateCollection($input: CollectionInput!) {
      collectionUpdate(input: $input) {
        collection {
          id
          handle
          title
          image {
            id
            url
            altText
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  let res = await shopifyGraphQL(shopUrl, accessToken, mutation, { input });
  let userErrors = res?.data?.collectionUpdate?.userErrors || [];
  let updated = res?.data?.collectionUpdate?.collection;

  // Log response per collection (no tokens!)
  console.log(`[Import Image] "${colData.title || colData.handle}": collectionUpdate returned image=${JSON.stringify(updated?.image || null)}, userErrors=${JSON.stringify(userErrors)}`);

  if (userErrors.length > 0 && input.image) {
    const imageErr = userErrors.find(e =>
      String(e.field || '').toLowerCase().includes('image') ||
      String(e.message || '').toLowerCase().includes('image')
    );

    if (imageErr) {
      console.log(`[Import Image] Shopify rejected image in collectionUpdate for "${colData.title}". Updating collection details without image first...`);
      const inputWithoutImage = { ...input };
      delete inputWithoutImage.image;
      res = await shopifyGraphQL(shopUrl, accessToken, mutation, { input: inputWithoutImage });
      userErrors = res?.data?.collectionUpdate?.userErrors || [];
      updated = res?.data?.collectionUpdate?.collection;

      console.log(`[Import Image] Collection "${colData.title}" updated (${existingId}). Setting image with fallback order...`);
      const imgRes = await setCollectionImageWithFallbacks(shopUrl, accessToken, existingId, colData, [imageErr]);
      if (imgRes.success) {
        if (updated) updated.image = imgRes.image;
        imageFailed = false;
        imageError = null;
      } else {
        imageFailed = true;
        imageError = imgRes.error;
      }
    }
  }

  if (userErrors.length > 0) {
    const msg = userErrors.map(e => e.message).join('; ');
    throw new Error(`Shopify GraphQL collectionUpdate error: ${msg}`);
  }

  const skippedProducts = [];

  // For custom collections, add matching products
  if (!isSmart && options.mapProducts !== false && Array.isArray(colData.sample_products) && colData.sample_products.length > 0) {
    const productGids = [];
    for (const prod of colData.sample_products) {
      if (prod.handle) {
        const found = await findProductByHandleGraphQL(shopUrl, accessToken, prod.handle);
        if (found?.id) {
          productGids.push(found.id);
        } else {
          skippedProducts.push(prod.handle);
        }
      }
    }

    if (productGids.length > 0) {
      const addProdMutation = `
        mutation addProducts($id: ID!, $productIds: [ID!]!) {
          collectionAddProducts(id: $id, productIds: $productIds) {
            collection { id }
            userErrors { message }
          }
        }
      `;
      try {
        await shopifyGraphQL(shopUrl, accessToken, addProdMutation, { id: existingId, productIds: productGids });
      } catch (err) {
        console.warn(`[Shopify GraphQL] collectionAddProducts warning: ${err.message}`);
      }
    }
  }

  return {
    status: 'updated',
    id: updated?.id || existingId,
    handle: updated?.handle || colData.handle,
    title: updated?.title || colData.title,
    image: updated?.image || null,
    imageFailed: Boolean(imageFailed),
    imageError: imageError || null,
    skippedProducts
  };
}

/**
 * Delete collections matching handles in the session store via GraphQL
 */
export async function deleteCollectionsByHandlesGraphQL(shopUrl, accessToken, handles = [], onProgress = () => {}) {
  const results = { total: handles.length, deleted: 0, failed: 0, details: [] };
  const existingMap = await fetchExistingCollectionHandlesGraphQL(shopUrl, accessToken);

  const deleteMutation = `
    mutation deleteCollection($input: CollectionDeleteInput!) {
      collectionDelete(input: $input) {
        deletedId
        userErrors {
          message
        }
      }
    }
  `;

  for (let i = 0; i < handles.length; i++) {
    const handle = String(handles[i]).toLowerCase().trim();
    const existing = existingMap.get(handle);

    if (!existing) {
      results.details.push({ handle, status: 'skipped', reason: 'Collection not found in store.' });
      continue;
    }

    onProgress({
      index: i + 1,
      total: handles.length,
      percent: Math.round(((i + 1) / handles.length) * 100),
      currentTitle: existing.title || handle,
      status: 'deleting',
      message: `Deleting [${i + 1}/${handles.length}] "${existing.title}"...`
    });

    try {
      const res = await shopifyGraphQL(shopUrl, accessToken, deleteMutation, {
        input: { id: existing.id }
      });
      const userErrors = res?.data?.collectionDelete?.userErrors || [];
      if (userErrors.length > 0) {
        throw new Error(userErrors.map(e => e.message).join('; '));
      }
      results.deleted++;
      results.details.push({ handle, title: existing.title, status: 'deleted', id: existing.id });
    } catch (err) {
      results.failed++;
      results.details.push({ handle, title: existing.title, status: 'failed', error: err.message });
    }

    await new Promise(r => setTimeout(r, 60));
  }

  return results;
}

/**
 * Import a batch of collections into the session shop using Shopify Admin GraphQL API
 * Handles throttling, backoff, smart rules, custom product handles linking, and duplicate strategy.
 */
export async function importSessionStoreBatchGraphQL(shopUrl, accessToken, collections, options = {}, onProgress = () => {}) {
  const {
    conflictStrategy = 'skip',
    transferImages = true,
    mapProducts = true
  } = options;

  const results = {
    total: collections.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    details: []
  };

  onProgress({
    index: 0,
    total: collections.length,
    percent: 0,
    currentTitle: 'Scanning Store',
    status: 'processing',
    message: 'Scanning store via GraphQL to index existing collection handles...'
  });

  // Pre-load existing collections via GraphQL for instant duplicate detection
  const existingMap = await fetchExistingCollectionHandlesGraphQL(shopUrl, accessToken);

  onProgress({
    index: 0,
    total: collections.length,
    percent: 0,
    currentTitle: 'Store Scanned',
    status: 'processing',
    message: `Identified ${existingMap.size} existing collections in this store. Commencing import...`
  });

  for (let i = 0; i < collections.length; i++) {
    const col = collections[i];

    // If row has error from preview validation, skip it entirely
    if (col.status === 'error' || col.errorReason) {
      results.failed++;
      results.details.push({
        handle: col.handle || '',
        title: col.title || '',
        status: 'failed',
        reason: col.errorReason || 'Row contains validation errors and was not imported.'
      });
      onProgress({
        index: i + 1,
        total: collections.length,
        percent: Math.round(((i + 1) / collections.length) * 100),
        currentTitle: col.title || `Row ${i + 1}`,
        status: 'failed',
        message: `Skipped row with error: ${col.errorReason || 'Validation error'}`
      });
      continue;
    }

    const normHandle = String(col.handle || '').toLowerCase().trim();
    const existing = existingMap.get(normHandle);

    onProgress({
      index: i + 1,
      total: collections.length,
      percent: Math.round((i / collections.length) * 100),
      currentTitle: col.title,
      status: 'processing',
      message: `Processing [${i + 1}/${collections.length}] "${col.title}"...`
    });

    try {
      if (existing) {
        if (conflictStrategy === 'skip') {
          results.skipped++;
          results.details.push({
            handle: col.handle,
            title: col.title,
            status: 'skipped',
            reason: `Collection handle "${col.handle}" already exists in this store. Skipped per duplicate strategy.`
          });

          onProgress({
            index: i + 1,
            total: collections.length,
            percent: Math.round(((i + 1) / collections.length) * 100),
            currentTitle: col.title,
            status: 'skipped',
            message: `Skipped "${col.title}" (handle exists).`
          });
          continue;
        } else if (conflictStrategy === 'overwrite') {
          // Update existing collection
          const updateRes = await updateCollectionGraphQL(shopUrl, accessToken, existing.id, col, {
            transferImages,
            mapProducts
          });

          results.updated++;
          let note = 'Updated existing collection.';
          if (updateRes.skippedProducts?.length > 0) {
            note += ` Note: ${updateRes.skippedProducts.length} missing product handle(s) skipped (${updateRes.skippedProducts.join(', ')}).`;
          }

          if (updateRes.imageFailed) {
            const failReason = `updated, image failed: ${updateRes.imageError}${updateRes.skippedProducts?.length > 0 ? ` (Note: ${updateRes.skippedProducts.length} product(s) skipped)` : ''}`;
            results.details.push({
              handle: col.handle,
              title: col.title,
              status: 'updated, image failed',
              reason: failReason
            });

            onProgress({
              index: i + 1,
              total: collections.length,
              percent: Math.round(((i + 1) / collections.length) * 100),
              currentTitle: col.title,
              status: 'updated, image failed',
              message: `Updated collection "${col.title}", but image failed: ${updateRes.imageError}`
            });
          } else {
            results.details.push({
              handle: col.handle,
              title: col.title,
              status: 'updated',
              reason: note
            });

            onProgress({
              index: i + 1,
              total: collections.length,
              percent: Math.round(((i + 1) / collections.length) * 100),
              currentTitle: col.title,
              status: 'updated',
              message: `Updated existing collection "${col.title}".`
            });
          }
          continue;
        }
      }

      // Create new collection
      const createRes = await createCollectionGraphQL(shopUrl, accessToken, col, {
        transferImages,
        mapProducts
      });

      results.created++;
      existingMap.set(normHandle, {
        id: createRes.id,
        handle: createRes.handle,
        title: createRes.title,
        isSmart: col.collection_type === 'smart' || (col.rules && col.rules.length > 0)
      });

      let note = 'Created new collection.';
      if (createRes.skippedProducts?.length > 0) {
        note += ` Note: ${createRes.skippedProducts.length} product handle(s) not found in store (${createRes.skippedProducts.join(', ')}), skipped.`;
      }

      if (createRes.imageFailed) {
        const failReason = `created, image failed: ${createRes.imageError}${createRes.skippedProducts?.length > 0 ? ` (Note: ${createRes.skippedProducts.length} product(s) skipped)` : ''}`;
        results.details.push({
          handle: col.handle,
          title: col.title,
          status: 'created, image failed',
          reason: failReason
        });

        onProgress({
          index: i + 1,
          total: collections.length,
          percent: Math.round(((i + 1) / collections.length) * 100),
          currentTitle: col.title,
          status: 'created, image failed',
          message: `Created collection "${col.title}", but image failed: ${createRes.imageError}`
        });
      } else {
        results.details.push({
          handle: col.handle,
          title: col.title,
          status: 'created',
          reason: note
        });

        onProgress({
          index: i + 1,
          total: collections.length,
          percent: Math.round(((i + 1) / collections.length) * 100),
          currentTitle: col.title,
          status: 'created',
          message: `Created collection "${col.title}".`
        });
      }

      await new Promise(r => setTimeout(r, 80));
    } catch (err) {
      results.failed++;
      const errMsg = err.message || 'Unknown GraphQL execution failure';
      results.details.push({
        handle: col.handle,
        title: col.title,
        status: 'failed',
        reason: `Failed: ${errMsg}`
      });

      onProgress({
        index: i + 1,
        total: collections.length,
        percent: Math.round(((i + 1) / collections.length) * 100),
        currentTitle: col.title,
        status: 'failed',
        message: `Error importing "${col.title}": ${errMsg}`
      });
    }
  }

  return results;
}
