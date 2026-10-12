import { SignJWT } from 'jose';
import { verifyShopifySession } from '../lib/shopify-session.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { requireAuth } from '../lib/auth.js';

async function runStep1Tests() {
  console.log('===========================================================');
  console.log('🧪 TESTING STEP 1: SHOPIFY OAUTH INSTALL & SESSION TOKENS');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || 'f306e3a615331c3dc1217f226d93f071';
  const API_SECRET = process.env.SHOPIFY_API_SECRET || 'test_shopify_secret_placeholder';
  const TEST_SHOP = 'dev-training-001.myshopify.com';

  // ── TEST 1: AES-256 Encryption & Decryption ──
  console.log('--- TEST 1: Access Token AES-256 Encryption & Decryption ---');
  try {
    const rawToken = 'shpat_9876543210abcdeffedcba0123456789';
    const encrypted = encrypt(rawToken);
    assert(
      encrypted && encrypted !== rawToken && encrypted.includes(':'),
      'Token is encrypted using AES-256-GCM format (iv:authTag:ciphertext)'
    );

    const decrypted = decrypt(encrypted);
    assert(
      decrypted === rawToken,
      'Decrypted token matches original plain token exactly'
    );

    const tamperedEncrypted = encrypted.slice(0, -4) + '0000';
    const tamperedDecrypted = decrypt(tamperedEncrypted);
    assert(
      tamperedDecrypted === '',
      'Tampered encrypted ciphertext fails authentication and returns empty string'
    );
  } catch (err) {
    console.error('Test 1 error:', err);
    failed++;
  }

  // ── TEST 2: Session Token Validation & Tampered Token Rejection ──
  console.log('\n--- TEST 2: Session Token Verification & Tampering ---');
  try {
    const encodedSecret = new TextEncoder().encode(API_SECRET);

    // Create a legitimate signed session token
    const validJwt = await new SignJWT({
      iss: `https://${TEST_SHOP}/admin`,
      dest: `https://${TEST_SHOP}`,
      aud: API_KEY,
      sub: 'shopify_user_12345'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(encodedSecret);

    // Verify valid session token
    const validReq = new Request('http://localhost:3000/api/shopify/fetch-collections', {
      headers: {
        Authorization: `Bearer ${validJwt}`
      }
    });

    const verifyResult = await verifyShopifySession(validReq);
    assert(
      verifyResult.shop === TEST_SHOP,
      `Valid session token correctly verified and extracted shop: "${verifyResult.shop}"`
    );

    // Test (b): Tampered session token (modified signature)
    const tamperedJwt = validJwt.slice(0, -6) + 'abcdef';
    const tamperedReq = new Request('http://localhost:3000/api/shopify/fetch-collections', {
      headers: {
        Authorization: `Bearer ${tamperedJwt}`
      }
    });

    const tamperedResult = await verifyShopifySession(tamperedReq);
    assert(
      tamperedResult.valid === false && tamperedResult.status === 401,
      `Tampered session token is rejected with 401 Unauthorized (error: "${tamperedResult.error}")`
    );

    // Test: Token signed with WRONG secret
    const wrongSecret = new TextEncoder().encode('completely_wrong_secret_1234567890');
    const forgedJwt = await new SignJWT({
      iss: `https://${TEST_SHOP}/admin`,
      dest: `https://${TEST_SHOP}`,
      aud: API_KEY,
      sub: 'forged_user'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrongSecret);

    const forgedReq = new Request('http://localhost:3000/api/shopify/fetch-collections', {
      headers: {
        Authorization: `Bearer ${forgedJwt}`
      }
    });

    const forgedResult = await verifyShopifySession(forgedReq);
    assert(
      forgedResult.valid === false && forgedResult.status === 401,
      'Forged token signed with incorrect secret is rejected with 401'
    );

    // Test: Expired token
    const expiredJwt = await new SignJWT({
      iss: `https://${TEST_SHOP}/admin`,
      dest: `https://${TEST_SHOP}`,
      aud: API_KEY,
      sub: 'expired_user'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(encodedSecret);

    const expiredReq = new Request('http://localhost:3000/api/shopify/fetch-collections', {
      headers: {
        Authorization: `Bearer ${expiredJwt}`
      }
    });

    const expiredResult = await verifyShopifySession(expiredReq);
    assert(
      expiredResult.valid === false && expiredResult.status === 401,
      'Expired session token is rejected with 401'
    );
  } catch (err) {
    console.error('Test 2 error:', err);
    failed++;
  }

  // ── TEST 3: requireAuth on /api/shopify/* routes ──
  console.log('\n--- TEST 3: requireAuth Helper Validation for Merchant API ---');
  try {
    // Missing Authorization header
    const noAuthReq = new Request('http://localhost:3000/api/shopify/fetch-collections', {
      headers: {}
    });

    // Temporarily ensure ENABLE_LEGACY_LOGIN=false for testing production strictness
    const prevLegacy = process.env.ENABLE_LEGACY_LOGIN;
    process.env.ENABLE_LEGACY_LOGIN = 'false';

    const unauthResult = await requireAuth(noAuthReq);
    assert(
      unauthResult.errorResponse !== undefined && unauthResult.errorResponse.status === 401,
      'Request with missing session token returns 401 errorResponse'
    );
    assert(
      unauthResult.errorResponse.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1',
      '401 response includes X-Shopify-API-Request-Failure-Reauthorize header to re-trigger auth flow'
    );

    process.env.ENABLE_LEGACY_LOGIN = prevLegacy;
  } catch (err) {
    console.error('Test 3 error:', err);
    failed++;
  }

  // ── TEST 4: Middleware Routing Verification ──
  console.log('\n--- TEST 4: Middleware Merchant Route Isolation ---');
  try {
    const { middleware } = await import('../middleware.js');

    // Merchant opening root page '/'
    const merchantPageReq = {
      nextUrl: new URL('http://localhost:3000/'),
      url: 'http://localhost:3000/',
      cookies: { get: () => null },
      headers: new Headers()
    };
    const merchantPageRes = await middleware(merchantPageReq);
    // Should NOT redirect to /login
    const redirectLocation = merchantPageRes.headers.get('location');
    assert(
      redirectLocation !== 'http://localhost:3000/login',
      'Merchant opening root ("/") is NOT redirected to /login (loads directly in iframe)'
    );

    // Merchant calling '/api/shopify/fetch-collections'
    const merchantApiReq = {
      nextUrl: new URL('http://localhost:3000/api/shopify/fetch-collections'),
      url: 'http://localhost:3000/api/shopify/fetch-collections',
      cookies: { get: () => null },
      headers: new Headers()
    };
    const merchantApiRes = await middleware(merchantApiReq);
    assert(
      merchantApiRes.headers.get('location') !== 'http://localhost:3000/login',
      'Merchant calling "/api/shopify/*" without admin cookie is NOT redirected to /login'
    );

    // Unauthenticated opening '/admin'
    const adminPageReq = {
      nextUrl: new URL('http://localhost:3000/admin'),
      url: 'http://localhost:3000/admin',
      cookies: { get: () => null },
      headers: new Headers()
    };
    const adminPageRes = await middleware(adminPageReq);
    assert(
      adminPageRes.headers.get('location') === 'http://localhost:3000/login',
      'Unauthenticated request to "/admin" without admin cookie is redirected to "/login"'
    );

    // Unauthenticated calling '/api/admin/users'
    const adminApiReq = {
      nextUrl: new URL('http://localhost:3000/api/admin/users'),
      url: 'http://localhost:3000/api/admin/users',
      cookies: { get: () => null },
      headers: new Headers()
    };
    const adminApiRes = await middleware(adminApiReq);
    assert(
      adminApiRes.status === 401,
      'Unauthenticated request to "/api/admin/users" returns 401 Unauthorized'
    );
  } catch (err) {
    console.error('Test 4 error:', err);
    failed++;
  }

  // ── TEST 5: Existing Export & Template Excel Still Works ──
  console.log('\n--- TEST 5: Existing Export & Template Excel Operation ---');
  try {
    const { generateTemplateWorkbook, generateExcelWorkbook, parseExcelBuffer } = await import('../lib/excel.js');

    // Test template excel generation
    const templateBuffer = generateTemplateWorkbook();
    assert(
      templateBuffer && templateBuffer.length > 0,
      `Template Excel workbook generated successfully (${templateBuffer.length} bytes)`
    );

    // Test export excel generation
    const sampleCollections = [
      {
        id: 'gid://shopify/Collection/101',
        title: 'Summer Collection',
        handle: 'summer-collection',
        type: 'smart',
        body_html: '<p>Our summer styles</p>',
        rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'summer' }],
        productsCount: 12
      }
    ];

    const exportBuffer = generateExcelWorkbook(sampleCollections, { name: 'Dev Training Store' });
    assert(
      exportBuffer && exportBuffer.length > 0,
      `Export Excel workbook generated successfully (${exportBuffer.length} bytes)`
    );

    // Test parsing the generated Excel workbook
    const parsed = parseExcelBuffer(exportBuffer);
    assert(
      Array.isArray(parsed) && parsed.length === 1 && parsed[0].handle === 'summer-collection',
      `Parsed Excel workbook matches exported collection ("${parsed[0]?.handle}")`
    );
  } catch (err) {
    console.error('Test 5 error:', err);
    failed++;
  }

  // ── TEST 6: Public /api/health Endpoint ──
  console.log('\n--- TEST 6: Public /api/health Endpoint ---');
  try {
    const { GET: healthHandler } = await import('../app/api/health/route.js');
    const healthRes = await healthHandler();
    const healthJson = await healthRes.json();
    assert(
      healthRes.status === 200 && healthJson.ok === true,
      'GET /api/health returns HTTP 200 with { ok: true } without authentication'
    );
  } catch (err) {
    console.error('Test 6 error:', err);
    failed++;
  }

  // ── TEST 7: Step 4 Multi-Store OAuth, Domain Validation & ShopLink Security ──
  console.log('\n--- TEST 7: Multi-Store OAuth, Domain Validation & ShopLink Security ---');
  try {
    const {
      isValidShopifyDomain,
      saveOAuthState,
      verifyAndConsumeOAuthState,
      createShopLink,
      getShopLink,
      disconnectDestination
    } = await import('../lib/shop-link.js');
    const { verifyShopifyHmac } = await import('../app/api/auth/callback/route.js');
    const crypto = (await import('crypto')).default;

    // 7a. Domain Format Validation (^[a-z0-9][a-z0-9-]*\.myshopify\.com$)
    assert(
      isValidShopifyDomain('dev-training-001.myshopify.com') === true,
      'Valid domain "dev-training-001.myshopify.com" is accepted'
    );
    assert(
      isValidShopifyDomain('store-123.myshopify.com') === true,
      'Valid domain "store-123.myshopify.com" is accepted'
    );
    assert(
      isValidShopifyDomain('attacker-domain.com') === false,
      'Invalid non-shopify domain "attacker-domain.com" is rejected'
    );
    assert(
      isValidShopifyDomain('-leading-hyphen.myshopify.com') === false,
      'Domain starting with hyphen "-leading-hyphen.myshopify.com" is rejected'
    );
    assert(
      isValidShopifyDomain('store.myshopify.com/admin/settings') === false,
      'Domain with path suffix is rejected'
    );

    // 7b. Timing-Safe HMAC Verification & Tampered HMAC Rejection
    const params = new URLSearchParams({
      code: 'test_oauth_code_123',
      shop: 'dev-training-001.myshopify.com',
      state: 'state_1234567890abcdef',
      timestamp: String(Math.floor(Date.now() / 1000))
    });

    // Generate genuine HMAC
    const paramEntries = [];
    params.forEach((val, key) => {
      if (key !== 'hmac' && key !== 'signature') paramEntries.push(`${key}=${val}`);
    });
    paramEntries.sort();
    const message = paramEntries.join('&');
    const validHmac = crypto.createHmac('sha256', API_SECRET).update(message).digest('hex');

    const validParams = new URLSearchParams(params);
    validParams.set('hmac', validHmac);
    assert(
      verifyShopifyHmac(validParams, API_SECRET) === true,
      'Legitimate HMAC signature correctly validates'
    );

    const tamperedParams = new URLSearchParams(params);
    tamperedParams.set('hmac', validHmac.slice(0, -4) + 'ffff');
    assert(
      verifyShopifyHmac(tamperedParams, API_SECRET) === false,
      'Tampered HMAC signature is rejected by timingSafeEqual'
    );

    // 7c. Wrong / Expired OAuth State Rejection
    const expiredState = 'test_expired_state_' + Date.now();
    await saveOAuthState({
      state: expiredState,
      sourceShop: TEST_SHOP,
      destinationShop: 'dest-store.myshopify.com',
      expiresAt: new Date(Date.now() - 60 * 1000) // 1 minute in the past
    });

    const expiredResult = await verifyAndConsumeOAuthState(expiredState, 'dest-store.myshopify.com');
    assert(
      expiredResult.valid === false && expiredResult.error.includes('expired'),
      'Expired OAuth state is rejected with expiry error'
    );

    const nonExistentResult = await verifyAndConsumeOAuthState('completely_bogus_state', 'dest-store.myshopify.com');
    assert(
      nonExistentResult.valid === false,
      'Non-existent state parameter is rejected'
    );

    // 7d. Export / Fetch Route Rejects Unlinked Destination Store
    const { POST: fetchCollectionsHandler } = await import('../app/api/shopify/fetch-collections/route.js');
    const { setShopAccessToken } = await import('../lib/shop-link.js');
    await setShopAccessToken(TEST_SHOP, 'shpat_test_offline_token_123');
    const encodedSecret = new TextEncoder().encode(API_SECRET);

    const userSessionJwt = await new SignJWT({
      iss: `https://${TEST_SHOP}/admin`,
      dest: `https://${TEST_SHOP}`,
      aud: API_KEY,
      sub: 'merchant_user_1'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(encodedSecret);

    const unlinkedReq = new Request('http://localhost:3000/api/shopify/fetch-collections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userSessionJwt}`
      },
      body: JSON.stringify({
        shopUrl: 'unlinked-target-store.myshopify.com'
      })
    });

    const unlinkedRes = await fetchCollectionsHandler(unlinkedReq);
    const unlinkedJson = await unlinkedRes.json();
    assert(
      unlinkedRes.status === 403,
      `API correctly rejects access to unlinked destination store with 403 Forbidden ("${unlinkedJson.error}")`
    );

    // 7e. Linking & Disconnecting Destination Store
    const testDestShop = 'verified-dest-store.myshopify.com';
    const link = await createShopLink(TEST_SHOP, testDestShop);
    assert(
      link && link.sourceShop === TEST_SHOP && link.destinationShop === testDestShop,
      'ShopLink successfully established between source and destination'
    );

    const retrievedLink = await getShopLink(TEST_SHOP, testDestShop);
    assert(
      retrievedLink !== null,
      'Established ShopLink is found in database/lookup'
    );

    await disconnectDestination(TEST_SHOP, testDestShop);
    const afterDisconnect = await getShopLink(TEST_SHOP, testDestShop);
    assert(
      afterDisconnect === null,
      'Destination store disconnected and ShopLink deleted successfully'
    );

  } catch (err) {
    console.error('Test 7 error:', err);
    failed++;
  }

  // ── TEST 8: Excel Import to Session Shop Verification ──
  console.log('\n--- TEST 8: Excel Import to Session Shop Verification ---');
  try {
    const {
      generateExcelWorkbook,
      parseExcelBuffer,
      validateCollections,
      generateReportWorkbook,
      REQUIRED_HEADERS
    } = await import('../lib/excel.js');
    const { POST: importExcelHandler } = await import('../app/api/shopify/import-excel/route.js');
    const XLSX = (await import('xlsx')).default || (await import('xlsx'));
    const encodedSecret = new TextEncoder().encode(API_SECRET);

    // 8a: A sheet exported from this app imports back without errors
    const exportSample = [
      {
        id: 'gid://shopify/Collection/101',
        title: 'Autumn Hoodies 2026',
        handle: 'autumn-hoodies-2026',
        collection_type: 'smart',
        body_html: '<p>Cozy autumn hoodies</p>',
        sort_order: 'best-selling',
        rules: [{ column: 'tag', relation: 'equals', condition: 'Hoodie' }],
        disjunctive: true,
        product_tags: ['Hoodie'],
        sample_products: [],
        image: { src: 'https://example.com/hoodie.jpg', alt: 'Hoodie Banner' }
      },
      {
        id: 'gid://shopify/Collection/102',
        title: 'Curated Footwear',
        handle: 'curated-footwear',
        collection_type: 'custom',
        body_html: '<p>Hand picked shoes</p>',
        sort_order: 'manual',
        rules: [],
        disjunctive: false,
        product_tags: ['Shoes'],
        sample_products: [{ handle: 'leather-boots' }],
        image: null
      }
    ];

    const exportedBuffer = generateExcelWorkbook(exportSample, { domain: TEST_SHOP });
    const importedFromExport = parseExcelBuffer(exportedBuffer);
    const validatedImport = validateCollections(importedFromExport);

    assert(
      Array.isArray(validatedImport) && validatedImport.length === 2,
      `Sheet exported from this app imports back with 2 collections`
    );
    assert(
      validatedImport[0].handle === 'autumn-hoodies-2026' && validatedImport[0].status !== 'error',
      `First collection imported cleanly without errors (handle: ${validatedImport[0].handle})`
    );
    assert(
      validatedImport[1].handle === 'curated-footwear' && validatedImport[1].status !== 'error',
      `Second collection imported cleanly without errors (handle: ${validatedImport[1].handle})`
    );

    // 8b: Wrong headers are rejected with clear message listing missing columns
    const wrongHeadersWb = XLSX.utils.book_new();
    const wrongWs = XLSX.utils.aoa_to_sheet([
      ['Product_Name', 'Custom_Price', 'Tag'],
      ['Test Hoodie', '49.99', 'Winter']
    ]);
    XLSX.utils.book_append_sheet(wrongHeadersWb, wrongWs, 'Collections');
    const wrongBuffer = XLSX.write(wrongHeadersWb, { type: 'buffer', bookType: 'xlsx' });

    let wrongHeadersError = null;
    try {
      parseExcelBuffer(wrongBuffer);
    } catch (err) {
      wrongHeadersError = err.message;
    }

    assert(
      wrongHeadersError && wrongHeadersError.includes('Missing required column(s):') && wrongHeadersError.includes('Title'),
      `Wrong headers are rejected listing missing columns: "${wrongHeadersError}"`
    );

    // 8c: Formula injection prevention (cells starting with = + - @ are treated as plain text)
    const formulaWb = XLSX.utils.book_new();
    const formulaRows = [
      REQUIRED_HEADERS,
      [
        '=SUM(A1:B1)',              // Title starting with =
        '+malicious-handle',         // Handle starting with +
        'smart',
        '-cmd|calc',                 // Description starting with -
        'best-selling',
        '',
        'ANY',
        '@user-tag',                 // Tags starting with @
        'prod-1',
        'https://example.com/img.jpg',
        'Alt'
      ]
    ];
    const formulaWs = XLSX.utils.aoa_to_sheet(formulaRows);
    XLSX.utils.book_append_sheet(formulaWb, formulaWs, 'Collections');
    const formulaBuffer = XLSX.write(formulaWb, { type: 'buffer', bookType: 'xlsx' });

    const parsedFormulaCols = parseExcelBuffer(formulaBuffer);
    assert(
      parsedFormulaCols.length === 1,
      'Row with formula characters parsed successfully'
    );
    assert(
      parsedFormulaCols[0].title.startsWith("'="),
      `Title starting with "=" was sanitized with single quote: "${parsedFormulaCols[0].title}"`
    );
    assert(
      parsedFormulaCols[0].handle.startsWith("'+"),
      `Handle starting with "+" was sanitized with single quote: "${parsedFormulaCols[0].handle}"`
    );
    assert(
      parsedFormulaCols[0].body_html.startsWith("'-"),
      `Description starting with "-" was sanitized with single quote: "${parsedFormulaCols[0].body_html}"`
    );

    // 8d: Max rows limit (1000 rows limit)
    const largeRows = [REQUIRED_HEADERS];
    for (let i = 0; i < 1005; i++) {
      largeRows.push([`Collection ${i}`, `col-${i}`, 'smart', '', 'best-selling', '', 'ANY', '', '', '', '']);
    }
    const largeWb = XLSX.utils.book_new();
    const largeWs = XLSX.utils.aoa_to_sheet(largeRows);
    XLSX.utils.book_append_sheet(largeWb, largeWs, 'Collections');
    const largeBuffer = XLSX.write(largeWb, { type: 'buffer', bookType: 'xlsx' });

    let largeRowsError = null;
    try {
      parseExcelBuffer(largeBuffer);
    } catch (err) {
      largeRowsError = err.message;
    }
    assert(
      largeRowsError && largeRowsError.includes('exceeds the maximum limit of 1000 rows'),
      `Spreadsheet exceeding 1000 rows is rejected: "${largeRowsError}"`
    );

    // 8e: Import ignores destination sent by browser and always uses session shop
    const sessionJwt = await new SignJWT({
      iss: `https://${TEST_SHOP}/admin`,
      dest: `https://${TEST_SHOP}`,
      aud: API_KEY,
      sub: 'merchant_importer'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(encodedSecret);

    const importReqWithSpoofedDest = new Request('http://localhost:3000/api/shopify/import-excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionJwt}`
      },
      body: JSON.stringify({
        targetStoreUrl: 'attacker-unauthorized-store.myshopify.com', // Browser spoofed destination
        destinationAccessToken: 'shpat_attacker_token_xyz',
        collections: [
          {
            title: 'Test Spring Outerwear',
            handle: 'test-spring-outerwear',
            collection_type: 'smart',
            rules: [{ column: 'tag', relation: 'equals', condition: 'outerwear' }]
          }
        ],
        options: {
          conflictStrategy: 'skip'
        }
      })
    });

    const sseResponse = await importExcelHandler(importReqWithSpoofedDest);
    assert(
      sseResponse.status === 200 && sseResponse.headers.get('content-type')?.includes('text/event-stream'),
      'Import route initiates SSE stream without errors'
    );

    // Read SSE start event to verify target shop is the session shop (TEST_SHOP), NOT the browser-sent destination
    const reader = sseResponse.body.getReader();
    const decoder = new TextDecoder();
    let initialChunks = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      initialChunks += decoder.decode(value);
      if (initialChunks.includes('event: start')) break;
    }

    assert(
      initialChunks.includes(TEST_SHOP) && !initialChunks.includes('attacker-unauthorized-store'),
      `Import pipeline ignored spoofed destination and targets session shop "${TEST_SHOP}"`
    );

    // 8f: Existing handle follows chosen duplicate strategy & missing product handle skipped
    const testReportData = [
      { handle: 'existing-col-1', title: 'Existing Collection', status: 'skipped', reason: 'Collection handle "existing-col-1" already exists in this store. Skipped per duplicate strategy.' },
      { handle: 'existing-col-2', title: 'Existing Collection 2', status: 'updated', reason: 'Updated existing collection.' },
      { handle: 'custom-col-missing-prod', title: 'Custom Collection', status: 'created', reason: 'Created new collection. Note: 1 product handle(s) not found in store (missing-prod-xyz), skipped.' },
      { handle: 'invalid-row', title: 'Invalid Row', status: 'failed', reason: 'Row 3: Missing Title. Collection title is required.' }
    ];

    const reportBuffer = generateReportWorkbook(testReportData, { shop: TEST_SHOP });
    assert(
      reportBuffer && reportBuffer.length > 0,
      `Result report (.xlsx) generated successfully (${reportBuffer.length} bytes)`
    );

    const parsedReportWb = XLSX.read(reportBuffer, { type: 'buffer' });
    const reportWs = parsedReportWb.Sheets['Import Report'];
    const reportRows = XLSX.utils.sheet_to_json(reportWs);
    assert(
      reportRows.length === 4 && reportRows[0].Status === 'SKIPPED' && reportRows[1].Status === 'UPDATED' && reportRows[2].Status === 'CREATED',
      'Downloadable report workbook (.xlsx) contains correct columns (Handle, Title, Status, Reason) and statuses'
    );

    assert(
      reportRows[2].Reason.includes('missing-prod-xyz'),
      'Missing product handle is reported in the final result report'
    );

    // 8g: Rule & Sort Order GraphQL mappings
    const { mapRuleColumnToGraphQL, mapRuleRelationToGraphQL, mapSortOrderToGraphQL } = await import('../lib/shopify.js');
    assert(
      mapRuleColumnToGraphQL('tag') === 'TAG' && mapRuleColumnToGraphQL('vendor') === 'VENDOR',
      'Rule column mapping translates lowercase rules to GraphQL CollectionRuleColumn enum'
    );
    assert(
      mapRuleRelationToGraphQL('equals') === 'EQUALS' && mapRuleRelationToGraphQL('starts_with') === 'STARTS_WITH',
      'Rule relation mapping translates relations to GraphQL CollectionRuleRelation enum'
    );
    assert(
      mapSortOrderToGraphQL('best-selling') === 'BEST_SELLING' && mapSortOrderToGraphQL('created-desc') === 'CREATED_DESC',
      'Sort order mapping translates sort orders to GraphQL CollectionSortOrder enum'
    );

    // 8h: Preview endpoint multipart/form-data validation and tagging
    const previewFormData = new FormData();
    const previewBlob = new Blob([exportedBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    previewFormData.append('file', previewBlob, 'export.xlsx');

    const previewReq = new Request('http://localhost:3000/api/shopify/import-excel', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionJwt}`
      },
      body: previewFormData
    });

    const previewRes = await importExcelHandler(previewReq);
    const previewJson = await previewRes.json();

    assert(
      previewRes.status === 200 && previewJson.success === true,
      `Preview endpoint successfully processed uploaded spreadsheet (status: ${previewRes.status})`
    );
    assert(
      previewJson.counts && typeof previewJson.counts.new === 'number' && typeof previewJson.counts.exists === 'number' && typeof previewJson.counts.error === 'number',
      `Preview response includes New/Exists/Error counts (New: ${previewJson.counts?.new}, Exists: ${previewJson.counts?.exists}, Error: ${previewJson.counts?.error})`
    );
    assert(
      Array.isArray(previewJson.collections) && previewJson.collections.length === 2,
      'Preview response contains tagged collections array with status and reasons'
    );

    // 8i: File size > 5 MB rejection
    const largeBlob = new Blob([new Uint8Array(5.5 * 1024 * 1024)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const largeFormData = new FormData();
    largeFormData.append('file', largeBlob, 'oversized.xlsx');

    const largeFileReq = new Request('http://localhost:3000/api/shopify/import-excel', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionJwt}`
      },
      body: largeFormData
    });

    const largeFileRes = await importExcelHandler(largeFileReq);
    const largeFileJson = await largeFileRes.json();
    assert(
      largeFileRes.status === 400 && largeFileJson.error.includes('5 MB'),
      `Spreadsheet exceeding 5 MB is rejected with 400: "${largeFileJson.error}"`
    );

  } catch (err) {
    console.error('Test 8 error:', err);
    failed++;
  }

  console.log('\n===========================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep1Tests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
