import axios from 'axios';
import {
  isValidHttpsUrl,
  normalizeImageUrl,
  stripUrlQuery,
  downloadImageForStaging,
  setCollectionImageWithFallbacks,
  createCollectionGraphQL,
  updateCollectionGraphQL,
  importSessionStoreBatchGraphQL
} from '../lib/shopify.js';
import { parseExcelBuffer, validateCollections, generateExcelWorkbook, generateReportWorkbook } from '../lib/excel.js';
import * as XLSX from 'xlsx';

// Mock Shopify GraphQL client environment for testing
const MOCK_SHOP = 'test-store.myshopify.com';
const MOCK_TOKEN = 'shpat_mock_token_12345';

async function runImageImportTests() {
  console.log('===========================================================');
  console.log('🧪 TESTING: COLLECTION IMAGE IMPORT FIX');
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

  // ── TEST 1: URL Normalization, Query Stripping, and HTTPS Validation ──
  console.log('--- TEST 1: URL Normalization & Validation ---');
  // HTTPS URL Validation
  assert(isValidHttpsUrl('https://cdn.shopify.com/s/files/1/summer.jpg') === true, 'Valid Shopify CDN HTTPS URL is accepted');
  assert(isValidHttpsUrl('https://images.unsplash.com/photo-1234?auto=format') === true, 'Valid HTTPS URL with query params is accepted');
  assert(isValidHttpsUrl('http://insecure.com/pic.jpg') === false, 'HTTP non-secure URL is rejected by isValidHttpsUrl');
  assert(isValidHttpsUrl('ftp://example.com/pic.jpg') === false, 'FTP URL is rejected by isValidHttpsUrl');
  assert(isValidHttpsUrl('not-a-url') === false, 'Malformed URL string is rejected');
  assert(isValidHttpsUrl('') === false, 'Empty URL string is rejected');
  assert(isValidHttpsUrl(null) === false, 'Null URL is rejected');

  // Protocol-relative and force HTTPS normalization
  assert(
    normalizeImageUrl('//cdn.shopify.com/s/files/1/0000/0001/summer.jpg') === 'https://cdn.shopify.com/s/files/1/0000/0001/summer.jpg',
    'Protocol-relative //cdn.shopify.com is normalized to https://'
  );
  assert(
    normalizeImageUrl('http://cdn.shopify.com/s/files/1/banner.jpg') === 'https://cdn.shopify.com/s/files/1/banner.jpg',
    'http:// is forced to https://'
  );
  assert(
    normalizeImageUrl('  https://cdn.shopify.com/s/files/1/woman t-shirt.jpg?v=12345  ') === 'https://cdn.shopify.com/s/files/1/woman%20t-shirt.jpg?v=12345',
    'Trims spaces and encodes spaces in URL path'
  );
  assert(
    normalizeImageUrl('//cdn.shopify.com/s/files/1/woman%20t-shirt.jpg') === 'https://cdn.shopify.com/s/files/1/woman%20t-shirt.jpg',
    'Does not double-encode already encoded characters'
  );

  // Query stripping (?v=...)
  assert(
    stripUrlQuery('https://cdn.shopify.com/s/files/1/summer.jpg?v=1712345678') === 'https://cdn.shopify.com/s/files/1/summer.jpg',
    'Query string (?v=...) is stripped cleanly'
  );
  assert(
    stripUrlQuery('https://cdn.shopify.com/s/files/1/summer.jpg?v=1&width=600#hash') === 'https://cdn.shopify.com/s/files/1/summer.jpg',
    'Multiple query params and hash are stripped'
  );

  // Save original axios and fetch methods
  const originalAxiosPost = axios.post;
  const originalAxiosGet = axios.get;
  const originalFetch = global.fetch;

  // ── TEST 2: Row with image_url sends image input ──
  console.log('\n--- TEST 2: Row with image_url sends image input ---');
  {
    let capturedCreateInput = null;

    axios.post = async (url, data, config) => {
      if (data.query.includes('collectionCreate')) {
        capturedCreateInput = data.variables.input;
        return {
          status: 200,
          data: {
            data: {
              collectionCreate: {
                collection: {
                  id: 'gid://shopify/Collection/101',
                  handle: 'summer-tees',
                  title: 'Summer Tees',
                  image: { id: 'gid://shopify/CollectionImage/1', url: capturedCreateInput.image?.src, altText: capturedCreateInput.image?.altText }
                },
                userErrors: []
              }
            }
          }
        };
      }
      return { status: 200, data: {} };
    };

    try {
      const colData = {
        title: 'Summer Tees',
        handle: 'summer-tees',
        image_url: 'https://cdn.shopify.com/s/files/1/0000/0001/summer.jpg',
        image_alt: 'Summer Tees Banner'
      };

      const result = await createCollectionGraphQL(MOCK_SHOP, MOCK_TOKEN, colData, { transferImages: true });

      assert(capturedCreateInput !== null, 'collectionCreate GraphQL was invoked');
      assert(
        capturedCreateInput.image &&
        capturedCreateInput.image.src === 'https://cdn.shopify.com/s/files/1/0000/0001/summer.jpg' &&
        capturedCreateInput.image.altText === 'Summer Tees Banner',
        `image input was correctly sent with src and altText: ${JSON.stringify(capturedCreateInput.image)}`
      );
      assert(result.status === 'created' && result.imageFailed === false, 'Collection created successfully with image');
    } finally {
      axios.post = originalAxiosPost;
    }
  }

  // ── TEST 3: Row without image_url still works (creates collection without image) ──
  console.log('\n--- TEST 3: Row without image_url creates collection without image ---');
  {
    let capturedCreateInput = null;

    axios.post = async (url, data, config) => {
      if (data.query.includes('collectionCreate')) {
        capturedCreateInput = data.variables.input;
        return {
          status: 200,
          data: {
            data: {
              collectionCreate: {
                collection: {
                  id: 'gid://shopify/Collection/102',
                  handle: 'plain-collection',
                  title: 'Plain Collection',
                  image: null
                },
                userErrors: []
              }
            }
          }
        };
      }
      return { status: 200, data: {} };
    };

    try {
      const colData = {
        title: 'Plain Collection',
        handle: 'plain-collection',
        image_url: '',
        image: null
      };

      const result = await createCollectionGraphQL(MOCK_SHOP, MOCK_TOKEN, colData, { transferImages: true });

      assert(capturedCreateInput !== null, 'collectionCreate GraphQL was invoked');
      assert(capturedCreateInput.image === undefined, 'No image input was sent when image_url is missing');
      assert(result.status === 'created' && result.imageFailed === false, 'Collection created successfully without image');
    } finally {
      axios.post = originalAxiosPost;
    }
  }

  // ── TEST 4: Protocol-relative URL is normalized and sent as https ──
  console.log('\n--- TEST 4: Protocol-relative URL is normalized ---');
  {
    let capturedCreateInput = null;

    axios.post = async (url, data, config) => {
      if (data.query.includes('collectionCreate')) {
        capturedCreateInput = data.variables.input;
        return {
          status: 200,
          data: {
            data: {
              collectionCreate: {
                collection: {
                  id: 'gid://shopify/Collection/103',
                  handle: 'woman-t-shirt',
                  title: 'woman t-shirt',
                  image: { id: 'gid://shopify/CollectionImage/3', url: capturedCreateInput.image?.src }
                },
                userErrors: []
              }
            }
          }
        };
      }
      return { status: 200, data: {} };
    };

    try {
      const colData = {
        title: 'woman t-shirt',
        handle: 'woman-t-shirt',
        image_url: '//cdn.shopify.com/s/files/1/0000/0001/woman t-shirt.jpg'
      };

      const result = await createCollectionGraphQL(MOCK_SHOP, MOCK_TOKEN, colData, { transferImages: true });

      assert(capturedCreateInput !== null, 'collectionCreate GraphQL was called');
      assert(
        capturedCreateInput.image?.src === 'https://cdn.shopify.com/s/files/1/0000/0001/woman%20t-shirt.jpg',
        `Protocol-relative URL normalized with https and spaces encoded: ${capturedCreateInput.image?.src}`
      );
      assert(result.status === 'created' && result.imageFailed === false, 'Collection created with normalized protocol-relative URL');
    } finally {
      axios.post = originalAxiosPost;
    }
  }

  // ── TEST 5: URL with ?v= works via Attempt (b) fallback (stripping query string) ──
  console.log('\n--- TEST 5: URL with ?v= works via Attempt (b) fallback ---');
  {
    let createCallCount = 0;
    let updateAttempts = [];

    axios.post = async (url, data, config) => {
      if (data.query.includes('collectionCreate')) {
        createCallCount++;
        // 1st attempt: simulate Shopify rejecting URL with ?v=...
        if (data.variables.input.image) {
          return {
            status: 200,
            data: {
              data: {
                collectionCreate: {
                  collection: null,
                  userErrors: [{ field: ['image'], message: 'Error updating collection with this image' }]
                }
              }
            }
          };
        }
        // 2nd attempt without image: creates collection cleanly
        return {
          status: 200,
          data: {
            data: {
              collectionCreate: {
                collection: {
                  id: 'gid://shopify/Collection/104',
                  handle: 'v-param-col',
                  title: 'V Param Col',
                  image: null
                },
                userErrors: []
              }
            }
          }
        };
      } else if (data.query.includes('collectionUpdate') || data.query.includes('setCollectionImage')) {
        const inputImg = data.variables.input.image?.src;
        updateAttempts.push(inputImg);

        // Attempt (a) with ?v= fails
        if (inputImg.includes('?v=')) {
          return {
            status: 200,
            data: {
              data: {
                collectionUpdate: {
                  collection: null,
                  userErrors: [{ field: ['image'], message: 'Error updating collection with this image' }]
                }
              }
            }
          };
        }

        // Attempt (b) without ?v= succeeds!
        return {
          status: 200,
          data: {
            data: {
              collectionUpdate: {
                collection: {
                  id: 'gid://shopify/Collection/104',
                  handle: 'v-param-col',
                  title: 'V Param Col',
                  image: { id: 'gid://shopify/CollectionImage/99', url: inputImg, altText: 'V Param Banner' }
                },
                userErrors: []
              }
            }
          }
        };
      }
      return { status: 200, data: {} };
    };

    try {
      const colData = {
        title: 'V Param Col',
        handle: 'v-param-col',
        image_url: 'https://cdn.shopify.com/s/files/1/0000/0001/banner.jpg?v=1712345678',
        image_alt: 'V Param Banner'
      };

      const result = await createCollectionGraphQL(MOCK_SHOP, MOCK_TOKEN, colData, { transferImages: true });

      assert(createCallCount === 2, 'collectionCreate created collection without image on initial rejection');
      assert(updateAttempts.length === 2, `collectionUpdate was attempted twice: Attempt (a) with query, Attempt (b) without query (count=${updateAttempts.length})`);
      assert(updateAttempts[0].includes('?v=1712345678'), 'Attempt (a) sent normalized URL with query parameter');
      assert(!updateAttempts[1].includes('?v='), 'Attempt (b) sent URL with query parameter stripped');
      assert(result.status === 'created' && result.imageFailed === false, 'Collection created and image attached via query-strip fallback');
      assert(result.image?.url === 'https://cdn.shopify.com/s/files/1/0000/0001/banner.jpg', 'Image attached has stripped URL');
    } finally {
      axios.post = originalAxiosPost;
    }
  }

  // ── TEST 6: Staged Upload Fallback (Attempt c) attaches image when direct URL fails ──
  console.log('\n--- TEST 6: Staged upload fallback (Attempt c) ---');
  {
    let stagedUploadCalled = false;
    let stagedTargetUploaded = false;
    let finalUpdateSrc = '';

    // Mock axios.post for Shopify GraphQL
    axios.post = async (url, data, config) => {
      if (data.query.includes('collectionCreate')) {
        if (data.variables.input.image) {
          return {
            status: 200,
            data: {
              data: {
                collectionCreate: {
                  collection: null,
                  userErrors: [{ field: ['image'], message: 'Error updating collection with this image' }]
                }
              }
            }
          };
        }
        return {
          status: 200,
          data: {
            data: {
              collectionCreate: {
                collection: { id: 'gid://shopify/Collection/105', handle: 'staged-col', title: 'Staged Col', image: null },
                userErrors: []
              }
            }
          }
        };
      } else if (data.query.includes('stagedUploadsCreate')) {
        stagedUploadCalled = true;
        return {
          status: 200,
          data: {
            data: {
              stagedUploadsCreate: {
                stagedTargets: [
                  {
                    url: 'https://shopify-staged-uploads.example.com/upload',
                    resourceUrl: 'https://cdn.shopify.com/s/files/1/staged-image.jpg',
                    parameters: [{ name: 'key', value: 'uploads/123/img.jpg' }]
                  }
                ],
                userErrors: []
              }
            }
          }
        };
      } else if (data.query.includes('collectionUpdate') || data.query.includes('setCollectionImage')) {
        const src = data.variables.input.image?.src;
        // Attempt (a) and (b) fail
        if (!src.includes('staged-image.jpg')) {
          return {
            status: 200,
            data: {
              data: {
                collectionUpdate: {
                  collection: null,
                  userErrors: [{ field: ['image'], message: 'Error updating collection with this image' }]
                }
              }
            }
          };
        }
        // Attempt (c) with staged resourceUrl succeeds!
        finalUpdateSrc = src;
        return {
          status: 200,
          data: {
            data: {
              collectionUpdate: {
                collection: {
                  id: 'gid://shopify/Collection/105',
                  handle: 'staged-col',
                  title: 'Staged Col',
                  image: { id: 'gid://shopify/CollectionImage/77', url: src }
                },
                userErrors: []
              }
            }
          }
        };
      }
      return { status: 200, data: {} };
    };

    // Mock axios.get for image downloading
    axios.get = async (url, config) => {
      return {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
        data: Buffer.from('mock-jpeg-bytes-content')
      };
    };

    // Mock fetch for staged upload multipart POST
    global.fetch = async (url, opts) => {
      if (url.includes('shopify-staged-uploads')) {
        stagedTargetUploaded = true;
        return { ok: true, status: 201, text: async () => 'OK' };
      }
      return originalFetch(url, opts);
    };

    try {
      const colData = {
        title: 'Staged Col',
        handle: 'staged-col',
        image_url: 'https://external-host.com/photo.jpg'
      };

      const result = await createCollectionGraphQL(MOCK_SHOP, MOCK_TOKEN, colData, { transferImages: true });

      assert(stagedUploadCalled === true, 'stagedUploadsCreate GraphQL mutation was called');
      assert(stagedTargetUploaded === true, 'Image bytes were uploaded to Shopify staged target URL');
      assert(finalUpdateSrc === 'https://cdn.shopify.com/s/files/1/staged-image.jpg', 'collectionUpdate attached the staged resourceUrl');
      assert(result.status === 'created' && result.imageFailed === false, 'Collection created and image attached via Staged Upload');
    } finally {
      axios.post = originalAxiosPost;
      axios.get = originalAxiosGet;
      global.fetch = originalFetch;
    }
  }

  // ── TEST 7: 404 URL is reported without failing the import ──
  console.log('\n--- TEST 7: 404 URL is reported without failing import ---');
  {
    axios.post = async (url, data, config) => {
      if (data.query.includes('collectionCreate')) {
        if (data.variables.input.image) {
          return {
            status: 200,
            data: {
              data: {
                collectionCreate: {
                  collection: null,
                  userErrors: [{ field: ['image'], message: 'Error updating collection with this image' }]
                }
              }
            }
          };
        }
        return {
          status: 200,
          data: {
            data: {
              collectionCreate: {
                collection: { id: 'gid://shopify/Collection/106', handle: 'dead-image-col', title: 'Dead Image Col', image: null },
                userErrors: []
              }
            }
          }
        };
      } else if (data.query.includes('collectionUpdate') || data.query.includes('setCollectionImage')) {
        return {
          status: 200,
          data: {
            data: {
              collectionUpdate: {
                collection: null,
                userErrors: [{ field: ['image'], message: 'Error updating collection with this image' }]
              }
            }
          }
        };
      }
      return { status: 200, data: {} };
    };

    // Mock axios.get to return 404
    axios.get = async (url) => {
      return {
        status: 404,
        headers: { 'content-type': 'text/html' },
        data: Buffer.from('404 Not Found')
      };
    };

    try {
      const colData = {
        title: 'Dead Image Col',
        handle: 'dead-image-col',
        image_url: 'https://broken-domain.com/nonexistent.jpg'
      };

      const result = await createCollectionGraphQL(MOCK_SHOP, MOCK_TOKEN, colData, { transferImages: true });

      assert(result.status === 'created', 'Collection itself was created successfully despite dead image');
      assert(result.imageFailed === true, 'imageFailed flag is true');
      assert(
        result.imageError === 'source image not found (HTTP 404)',
        `imageError accurately reports 404: "${result.imageError}"`
      );
    } finally {
      axios.post = originalAxiosPost;
      axios.get = originalAxiosGet;
    }
  }

  // ── TEST 8: Batch Import and Report Generation with 404 dead image ──
  console.log('\n--- TEST 8: Batch Import & Report with 404 Dead Image ---');
  {
    axios.post = async (url, data, config) => {
      if (data.query.includes('getCollections')) {
        return {
          status: 200,
          data: {
            data: {
              collections: {
                edges: [],
                pageInfo: { hasNextPage: false }
              }
            }
          }
        };
      }
      if (data.query.includes('collectionCreate')) {
        const title = data.variables.input.title;
        if (title === 'Valid Col') {
          return {
            status: 200,
            data: {
              data: {
                collectionCreate: {
                  collection: { id: 'gid://1', handle: 'valid-col', title, image: { id: 'gid://img1', url: 'https://cdn.shopify.com/img.jpg' } },
                  userErrors: []
                }
              }
            }
          };
        } else if (title === 'No Image Col') {
          return {
            status: 200,
            data: {
              data: {
                collectionCreate: {
                  collection: { id: 'gid://2', handle: 'no-img-col', title, image: null },
                  userErrors: []
                }
              }
            }
          };
        } else if (title === 'Dead Image Col') {
          if (data.variables.input.image) {
            return {
              status: 200,
              data: {
                data: {
                  collectionCreate: {
                    collection: null,
                    userErrors: [{ field: ['image'], message: 'Error updating collection with this image' }]
                  }
                }
              }
            };
          }
          return {
            status: 200,
            data: {
              data: {
                collectionCreate: {
                  collection: { id: 'gid://3', handle: 'dead-col', title, image: null },
                  userErrors: []
                }
              }
            }
          };
        }
      } else if (data.query.includes('collectionUpdate') || data.query.includes('setCollectionImage')) {
        return {
          status: 200,
          data: {
            data: {
              collectionUpdate: {
                collection: null,
                userErrors: [{ field: ['image'], message: 'Error updating collection with this image' }]
              }
            }
          }
        };
      }
      return { status: 200, data: {} };
    };

    axios.get = async (url) => {
      return {
        status: 404,
        headers: { 'content-type': 'text/html' },
        data: Buffer.from('404 Not Found')
      };
    };

    try {
      const batchCollections = [
        { title: 'Valid Col', handle: 'valid-col', image_url: 'https://cdn.shopify.com/img.jpg' },
        { title: 'No Image Col', handle: 'no-img-col', image_url: '' },
        { title: 'Dead Image Col', handle: 'dead-col', image_url: 'https://broken-domain.com/404.jpg' }
      ];

      const batchResults = await importSessionStoreBatchGraphQL(MOCK_SHOP, MOCK_TOKEN, batchCollections, { transferImages: true });

      assert(batchResults.total === 3, 'Total collections processed: 3');
      assert(batchResults.created === 3, `All 3 collections created in store: created=${batchResults.created}`);
      assert(batchResults.failed === 0, `0 whole import failures: failed=${batchResults.failed}`);

      const details = batchResults.details;
      assert(details[0].status === 'created', 'Row 1 status is created');
      assert(details[1].status === 'created', 'Row 2 status is created');
      assert(details[2].status === 'created, image failed', `Row 3 status marked as "created, image failed" (got: "${details[2].status}")`);
      assert(
        details[2].reason === 'created, image failed: source image not found (HTTP 404)',
        `Row 3 reason marked as "created, image failed: source image not found (HTTP 404)" (got: "${details[2].reason}")`
      );

      // Verify downloadable Excel report
      const reportBuffer = generateReportWorkbook(details, { shop: MOCK_SHOP });
      const parsedReportWb = XLSX.read(reportBuffer, { type: 'buffer' });
      const reportWs = parsedReportWb.Sheets['Import Report'];
      const reportRows = XLSX.utils.sheet_to_json(reportWs);

      assert(reportRows.length === 3, 'Downloadable report contains 3 rows');
      assert(reportRows[2].Status === 'CREATED, IMAGE FAILED', `Report row 3 status is "CREATED, IMAGE FAILED"`);
      assert(
        reportRows[2].Reason === 'created, image failed: source image not found (HTTP 404)',
        `Report row 3 reason is "created, image failed: source image not found (HTTP 404)" (got: "${reportRows[2].Reason}")`
      );
    } finally {
      axios.post = originalAxiosPost;
      axios.get = originalAxiosGet;
    }
  }

  // ── TEST 9: transferImages = false checkbox ignores image_url ──
  console.log('\n--- TEST 9: transferImages = false checkbox ignores image_url ---');
  {
    let capturedCreateInput = null;

    axios.post = async (url, data, config) => {
      if (data.query.includes('collectionCreate')) {
        capturedCreateInput = data.variables.input;
        return {
          status: 200,
          data: {
            data: {
              collectionCreate: {
                collection: { id: 'gid://109', handle: 'checkbox-off-col', title: 'Checkbox Off Col', image: null },
                userErrors: []
              }
            }
          }
        };
      }
      return { status: 200, data: {} };
    };

    try {
      const colData = {
        title: 'Checkbox Off Col',
        handle: 'checkbox-off-col',
        image_url: 'https://cdn.shopify.com/img.jpg'
      };

      const result = await createCollectionGraphQL(MOCK_SHOP, MOCK_TOKEN, colData, { transferImages: false });
      assert(capturedCreateInput.image === undefined, 'image input not sent when transferImages is false');
      assert(result.status === 'created' && result.imageFailed === false, 'Collection created normally without image error');
    } finally {
      axios.post = originalAxiosPost;
    }
  }

  // ── TEST 10: Excel Parsing reads Image_URL and Image_Alt ──
  console.log('\n--- TEST 10: Excel Parsing reads Image_URL and Image_Alt ---');
  {
    const wb = generateExcelWorkbook([
      {
        title: 'Winter Parkas',
        handle: 'winter-parkas',
        collection_type: 'smart',
        image: { src: 'https://cdn.shopify.com/parka.jpg', alt: 'Parka Banner' },
        rules: [{ column: 'tag', relation: 'equals', condition: 'parka' }]
      }
    ], { domain: MOCK_SHOP });

    const parsedCols = parseExcelBuffer(wb);
    assert(parsedCols.length === 1, 'Parsed 1 collection from workbook');
    assert(parsedCols[0].image_url === 'https://cdn.shopify.com/parka.jpg', `Parsed image_url: "${parsedCols[0].image_url}"`);
    assert(parsedCols[0].image_alt === 'Parka Banner', `Parsed image_alt: "${parsedCols[0].image_alt}"`);
    assert(parsedCols[0].image?.src === 'https://cdn.shopify.com/parka.jpg', 'Parsed image.src object is populated');

    const validated = validateCollections(parsedCols);
    assert(validated[0].image_url === 'https://cdn.shopify.com/parka.jpg', 'validateCollections preserves image_url');
    assert(validated[0].image?.src === 'https://cdn.shopify.com/parka.jpg', 'validateCollections preserves image object');
  }

  console.log('\n===========================================================');
  console.log(`IMAGE IMPORT TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runImageImportTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
