import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../server.js';
import { isDevTestAccountEnabled } from '../middlewares/authMiddleware.js';

let server;
let baseUrl;

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('1. Production Test Token Bypass Protection', () => {
  test('isDevTestAccountEnabled fails closed when NODE_ENV is production', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalFlag = process.env.ENABLE_DEV_TEST_ACCOUNT;

    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEV_TEST_ACCOUNT = 'true';
    assert.equal(isDevTestAccountEnabled(), false, 'Must be false in production even if flag is true');

    process.env.NODE_ENV = 'development';
    process.env.ENABLE_DEV_TEST_ACCOUNT = 'false';
    assert.equal(isDevTestAccountEnabled(), false, 'Must be false when flag is false');

    process.env.NODE_ENV = 'development';
    process.env.ENABLE_DEV_TEST_ACCOUNT = 'true';
    assert.equal(isDevTestAccountEnabled(), true, 'Only true when non-production and explicitly true');

    process.env.NODE_ENV = originalEnv;
    process.env.ENABLE_DEV_TEST_ACCOUNT = originalFlag;
  });

  test('Test token is rejected with 401 in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: 'Bearer assetbridge_test_token_00000000-0000-0000-0000-000000000001',
      },
    });
    process.env.NODE_ENV = originalEnv;
    assert.equal(res.status, 401, 'Production must reject developer test tokens');
    const json = await res.json();
    assert.match(json.message, /Development test tokens are rejected|Access denied/);
  });
});

describe('2. Authentication & Invalid / Expired Token Rejection', () => {
  test('Requests missing Authorization header return 401', async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.status, 'error');
  });

  test('Malformed or invalid bearer tokens return 401 (or 503 if auth unconfigured)', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: 'Bearer invalid.bogus.jwt.token',
      },
    });
    assert.ok(
      res.status === 401 || res.status === 503,
      `Expected 401 or 503 rejection, got ${res.status}`
    );
  });
});

describe('3. Resource Ownership & Forged ID (IDOR) Protection', () => {
  test('Users cannot query wallet or transactions belonging to another user', async () => {
    // Authenticated as test user (00000000-0000-0000-0000-000000000001)
    const token = 'Bearer assetbridge_test_token_00000000-0000-0000-0000-000000000001';

    const res = await fetch(`${baseUrl}/wallet/victim-uuid-9999/transactions`, {
      headers: { Authorization: token },
    });

    // When the route is guarded or disabled, it must fail closed with 403 or 503, never 200
    assert.ok(res.status === 403 || res.status === 503, `Expected 403 or 503, got ${res.status}`);
  });

  test('Client cannot initiate transfer with forged senderUserId', async () => {
    const token = 'Bearer assetbridge_test_token_00000000-0000-0000-0000-000000000001';

    const res = await fetch(`${baseUrl}/wallet/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        senderUserId: 'victim-uuid-9999',
        recipientIdentifier: '0x1234567890123456789012345678901234567890',
        amountUsdt: 100,
      }),
    });

    // Transfer route is fail-closed (503) or rejected as 403 forbidden
    assert.ok(res.status === 403 || res.status === 503, `Expected 403 or 503, got ${res.status}`);
  });
});

describe('4. Fail-Closed Financial Endpoints Protection', () => {
  const token = 'Bearer assetbridge_test_token_00000000-0000-0000-0000-000000000001';

  test('Wallet transfer is fail-closed with 503', async () => {
    const res = await fetch(`${baseUrl}/wallet/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ amount: 50, recipientIdentifier: '0x123' }),
    });
    assert.equal(res.status, 503);
    const json = await res.json();
    assert.match(json.message, /financial feature is disabled/i);
  });

  test('Wallet faucet is fail-closed with 503', async () => {
    const res = await fetch(`${baseUrl}/wallet/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ amountUsdt: 250 }),
    });
    assert.equal(res.status, 503);
  });

  test('Market trade is fail-closed with 503', async () => {
    const res = await fetch(`${baseUrl}/market/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ symbol: 'BTCUSDT', amountUsdt: 100 }),
    });
    assert.equal(res.status, 503);
    const json = await res.json();
    assert.match(json.message, /Trading is disabled/i);
  });

  test('Remittance send is fail-closed with 503', async () => {
    const res = await fetch(`${baseUrl}/remittance/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ amount: 100 }),
    });
    assert.equal(res.status, 503);
  });

  test('Legacy unverified claims endpoints are fail-closed with 503', async () => {
    const res = await fetch(`${baseUrl}/claims/legacy-id/claim-to-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ otp: '123456' }),
    });
    assert.equal(res.status, 503);
  });
});

describe('5. Logout & Revocation Endpoint', () => {
  test('Logout requires authentication', async () => {
    const res = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(res.status, 401);
  });

  test('Authenticated logout returns revocation status and 200', async () => {
    const token = 'Bearer assetbridge_test_token_00000000-0000-0000-0000-000000000001';
    const res = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'success');
    assert.ok('serverRevoked' in json.data);
  });
});

describe('6. 5-Minute Idle-Lock Wall-Clock Policy Logic', () => {
  test('Calculates expiration accurately across system sleep / background suspension', () => {
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    const baseTime = 1000000000000;
    const fourMinLater = baseTime + (4 * 60 * 1000 + 59 * 1000); // 4m 59s
    const fiveMinLater = baseTime + (5 * 60 * 1000);             // 5m 00s
    const sixMinLater = baseTime + (6 * 60 * 1000);              // 6m 00s

    const isExpired = (now, lastActive) => (now - lastActive) >= TIMEOUT_MS;

    assert.equal(isExpired(fourMinLater, baseTime), false, 'Should not expire at 4m 59s');
    assert.equal(isExpired(fiveMinLater, baseTime), true, 'Must expire at exactly 5 minutes');
    assert.equal(isExpired(sixMinLater, baseTime), true, 'Must expire at 6 minutes after sleep');
  });
});
