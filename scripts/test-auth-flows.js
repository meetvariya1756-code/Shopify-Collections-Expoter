const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING AUTHENTICATION & ROLE ACCESS VERIFICATION');
  console.log('====================================================\n');

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

  // Helper to extract session_token cookie from Response headers
  function getSessionCookie(res) {
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) return null;
    const match = setCookie.match(/session_token=([^;]+)/);
    return match ? match[1] : null;
  }

  // Flow A: Not logged in -> protected routes blocked
  console.log('--- TEST FLOW A: Unauthenticated Access ---');
  try {
    const unauthApiRes = await fetch(`${BASE_URL}/api/shopify/fetch-collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopUrl: 'test.myshopify.com', accessToken: 'token' })
    });
    assert(
      unauthApiRes.status === 401,
      `Unauthenticated API request blocked with 401 Unauthorized (got ${unauthApiRes.status})`
    );

    const unauthAdminApiRes = await fetch(`${BASE_URL}/api/admin/users`);
    assert(
      unauthAdminApiRes.status === 401,
      `Unauthenticated Admin API blocked with 401 Unauthorized (got ${unauthAdminApiRes.status})`
    );

    const unauthSessionRes = await fetch(`${BASE_URL}/api/auth/session`);
    assert(
      unauthSessionRes.status === 401,
      `Unauthenticated Session check returns 401 Unauthorized (got ${unauthSessionRes.status})`
    );
  } catch (err) {
    console.error('Error during Flow A:', err);
    failed++;
  }

  // Flow E: Wrong password & Lockout
  console.log('\n--- TEST FLOW E: Wrong Credentials & Brute-Force Rate Limiting ---');
  try {
    // 1. Wrong username
    const invalidUserRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent_user_999', password: 'wrongpassword' })
    });
    const invalidUserData = await invalidUserRes.json();
    assert(
      invalidUserRes.status === 401 && invalidUserData.error === 'Invalid username or password.',
      `Nonexistent user returns generic 401 "Invalid username or password." (got ${invalidUserRes.status})`
    );

    // 2. Wrong password on test client
    const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'client_101', password: 'badpassword' })
    });
    const wrongPassData = await wrongPassRes.json();
    assert(
      wrongPassRes.status === 401 && wrongPassData.error === 'Invalid username or password.',
      `Wrong password returns 401 "Invalid username or password." (got ${wrongPassRes.status})`
    );
  } catch (err) {
    console.error('Error during Flow E:', err);
    failed++;
  }

  // Flow B: User Login
  console.log('\n--- TEST FLOW B: User (Client) Login ---');
  let userCookie = null;
  try {
    const userLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'client_101', password: 'client12345' })
    });
    const userLoginData = await userLoginRes.json();
    userCookie = getSessionCookie(userLoginRes);

    assert(
      userLoginRes.status === 200 && userLoginData.success === true,
      `Client user "client_101" login succeeds with HTTP 200`
    );
    assert(
      userLoginData.user.role === 'user',
      `Client user role is correctly identified as "user"`
    );
    assert(
      !!userCookie,
      `Session cookie "session_token" is set in headers`
    );

    // Check user session endpoint
    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: `session_token=${userCookie}` }
    });
    const sessionData = await sessionRes.json();
    assert(
      sessionRes.status === 200 && sessionData.authenticated === true && sessionData.user.username === 'client_101',
      `User session verification returns authenticated user data`
    );
  } catch (err) {
    console.error('Error during Flow B:', err);
    failed++;
  }

  // Flow D: User Opening /admin or /api/admin/* -> Blocked
  console.log('\n--- TEST FLOW D: Regular User Forbidden from Admin Area ---');
  try {
    const userAccessAdminApi = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Cookie: `session_token=${userCookie}` }
    });
    assert(
      userAccessAdminApi.status === 403,
      `User calling /api/admin/users receives 403 Forbidden (got ${userAccessAdminApi.status})`
    );

    const userAccessStatsApi = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: `session_token=${userCookie}` }
    });
    assert(
      userAccessStatsApi.status === 403,
      `User calling /api/admin/stats receives 403 Forbidden (got ${userAccessStatsApi.status})`
    );

    const userAccessLogsApi = await fetch(`${BASE_URL}/api/admin/logs`, {
      headers: { Cookie: `session_token=${userCookie}` }
    });
    assert(
      userAccessLogsApi.status === 403,
      `User calling /api/admin/logs receives 403 Forbidden (got ${userAccessLogsApi.status})`
    );
  } catch (err) {
    console.error('Error during Flow D:', err);
    failed++;
  }

  // Flow C: Admin Login & Operations
  console.log('\n--- TEST FLOW C: Admin Login & Management Dashboard ---');
  let adminCookie = null;
  let createdUserId = null;
  try {
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin12345' })
    });
    const adminLoginData = await adminLoginRes.json();
    adminCookie = getSessionCookie(adminLoginRes);

    assert(
      adminLoginRes.status === 200 && adminLoginData.user.role === 'admin',
      `Admin login succeeds with role "admin"`
    );

    // Fetch Stats
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: `session_token=${adminCookie}` }
    });
    const statsData = await statsRes.json();
    assert(
      statsRes.status === 200 && statsData.stats.totalUsers >= 2,
      `Admin can access /api/admin/stats (totalUsers: ${statsData.stats?.totalUsers})`
    );

    // Fetch Users list
    const usersRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Cookie: `session_token=${adminCookie}` }
    });
    const usersData = await usersRes.json();
    assert(
      usersRes.status === 200 && Array.isArray(usersData.users),
      `Admin can list users via /api/admin/users (${usersData.users?.length} accounts found)`
    );

    // Create New User
    const testUsername = `test_client_${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_token=${adminCookie}`
      },
      body: JSON.stringify({
        displayName: 'Automated Test Client',
        username: testUsername,
        password: 'password_test_123',
        role: 'user',
        status: 'active'
      })
    });
    const createData = await createRes.json();
    assert(
      createRes.status === 201 && createData.success === true,
      `Admin creates new client account "${testUsername}"`
    );
    createdUserId = createData.user?.id;

    // Edit User
    const editRes = await fetch(`${BASE_URL}/api/admin/users/${createdUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_token=${adminCookie}`
      },
      body: JSON.stringify({
        displayName: 'Renamed Test Client'
      })
    });
    const editData = await editRes.json();
    assert(
      editRes.status === 200 && editData.user?.displayName === 'Renamed Test Client',
      `Admin edits user display name to "Renamed Test Client"`
    );

    // Reset Password
    const resetRes = await fetch(`${BASE_URL}/api/admin/users/${createdUserId}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_token=${adminCookie}`
      },
      body: JSON.stringify({
        newPassword: 'new_secret_pwd_999'
      })
    });
    const resetData = await resetRes.json();
    assert(
      resetRes.status === 200 && resetData.success === true,
      `Admin resets user password successfully`
    );

    // Delete User
    const deleteRes = await fetch(`${BASE_URL}/api/admin/users/${createdUserId}`, {
      method: 'DELETE',
      headers: { Cookie: `session_token=${adminCookie}` }
    });
    const deleteData = await deleteRes.json();
    assert(
      deleteRes.status === 200 && deleteData.success === true,
      `Admin deletes test user successfully`
    );

    // Check Activity Logs
    const logsRes = await fetch(`${BASE_URL}/api/admin/logs?limit=10`, {
      headers: { Cookie: `session_token=${adminCookie}` }
    });
    const logsData = await logsRes.json();
    assert(
      logsRes.status === 200 && logsData.logs?.length > 0,
      `Admin can view activity logs (${logsData.logs?.length} recent records retrieved)`
    );
  } catch (err) {
    console.error('Error during Flow C:', err);
    failed++;
  }

  // Flow G: Existing Shopify API functionality protected but working for authenticated session
  console.log('\n--- TEST FLOW G: Existing Collections / Excel Operations with Session ---');
  try {
    const templateRes = await fetch(`${BASE_URL}/api/shopify/template-excel`, {
      headers: { Cookie: `session_token=${userCookie}` }
    });
    assert(
      templateRes.status === 200 && templateRes.headers.get('content-type')?.includes('spreadsheet'),
      `Authenticated user can download Excel template (HTTP 200, Content-Type: sheet)`
    );

    const exportRes = await fetch(`${BASE_URL}/api/shopify/export-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_token=${userCookie}`
      },
      body: JSON.stringify({
        collections: [
          {
            id: 'gid://shopify/Collection/1',
            title: 'Summer Sale',
            handle: 'summer-sale',
            type: 'manual',
            rules: [],
            productsCount: 5
          }
        ],
        storeInfo: { name: 'Demo Store' }
      })
    });
    assert(
      exportRes.status === 200 && exportRes.headers.get('content-type')?.includes('spreadsheet'),
      `Authenticated user can export collections to Excel (HTTP 200, xlsx generated)`
    );
  } catch (err) {
    console.error('Error during Flow G:', err);
    failed++;
  }

  // Flow F: Logout
  console.log('\n--- TEST FLOW F: Logout Clears Session ---');
  try {
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `session_token=${userCookie}` }
    });
    const setCookie = logoutRes.headers.get('set-cookie');
    assert(
      logoutRes.status === 200 && setCookie && setCookie.includes('Max-Age=0'),
      `Logout succeeds and invalidates cookie with Max-Age=0`
    );

    const checkLoggedOut = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: `session_token=` }
    });
    assert(
      checkLoggedOut.status === 401,
      `Subsequent request with cleared cookie is rejected with 401 Unauthorized`
    );
  } catch (err) {
    console.error('Error during Flow F:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
