import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  load(url, context, nextLoad) {
    if (url.includes('node_modules/react-native/index.js')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export const Platform = { OS: 'android' };
          export const NativeModules = { SourceCode: { scriptURL: 'http://127.0.0.1:8081/index.bundle' } };
          export const AppState = { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
          export default { Platform, NativeModules, AppState };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const {
  portfolioService,
  setPortfolioStorageAdapter,
} = await import('../src/services/portfolioService.js');
const {
  mobileAuthService,
  setAuthStorageAdapter,
  setAuthFetchAdapter,
} = await import('../src/services/authService.js');

function createMockStorage() {
  const store = new Map();
  return {
    async getItemAsync(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async setItemAsync(key, val) {
      store.set(key, String(val));
    },
    async deleteItemAsync(key) {
      store.delete(key);
    },
    async isAvailableAsync() {
      return true;
    },
  };
}

test('Portfolio Service: Buy asset calculates units, cost basis, and tracks trade history', async () => {
  const mockStore = createMockStorage();
  setPortfolioStorageAdapter(mockStore);

  const userId = 'usr_test_123';
  const asset = {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 60000,
    category: 'crypto',
  };

  // Buy $600 USDT of BTC
  const buyRes = await portfolioService.buyAsset({
    userId,
    asset,
    amountUsdt: 600,
  });

  assert.equal(buyRes.success, true);
  assert.equal(buyRes.holding.symbol, 'BTC');
  assert.equal(buyRes.holding.quantity, 0.01);
  assert.equal(buyRes.holding.avgBuyPrice, 60000);
  assert.equal(buyRes.holding.totalCostBasis, 600);
  assert.equal(buyRes.trade.type, 'BUY');
  assert.equal(buyRes.trade.units, 0.01);
  assert.equal(buyRes.trade.amountUsdt, 600);

  // Buy more at a different price ($1200 USDT at $80,000)
  const buyRes2 = await portfolioService.buyAsset({
    userId,
    asset: { ...asset, price: 80000 },
    amountUsdt: 1200,
  });

  // New units = 1200 / 80000 = 0.015
  // Total units = 0.01 + 0.015 = 0.025
  // Total cost = 600 + 1200 = 1800
  // Avg buy price = 1800 / 0.025 = 72,000
  assert.equal(buyRes2.holding.quantity, 0.025);
  assert.equal(buyRes2.holding.totalCostBasis, 1800);
  assert.equal(buyRes2.holding.avgBuyPrice, 72000);
});

test('Portfolio Service: Sell asset validates balance, calculates USDT proceeds, and handles partial vs full sale', async () => {
  const mockStore = createMockStorage();
  setPortfolioStorageAdapter(mockStore);

  const userId = 'usr_seller_456';
  const asset = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 200,
    category: 'stocks',
  };

  // Buy 2 AAPL ($400 USDT)
  await portfolioService.buyAsset({
    userId,
    asset,
    amountUsdt: 400,
  });

  // Attempt to sell 3 AAPL (exceeds balance) -> should fail
  await assert.rejects(
    async () => {
      await portfolioService.sellAsset({
        userId,
        symbol: 'AAPL',
        quantity: 3,
        currentPrice: 220,
      });
    },
    /Insufficient balance/
  );

  // Partial sale: Sell 1 AAPL at $220
  const partialRes = await portfolioService.sellAsset({
    userId,
    symbol: 'AAPL',
    quantity: 1,
    currentPrice: 220,
  });

  assert.equal(partialRes.success, true);
  assert.equal(partialRes.proceedsUsdt, 220);
  assert.equal(partialRes.soldQuantity, 1);

  const pAfterPartial = await portfolioService.getPortfolio(userId);
  assert.equal(pAfterPartial.holdings.length, 1);
  assert.equal(pAfterPartial.holdings[0].quantity, 1);
  assert.equal(pAfterPartial.holdings[0].totalCostBasis, 200);

  // Full sale: Sell remaining 1 AAPL
  const fullRes = await portfolioService.sellAsset({
    userId,
    symbol: 'AAPL',
    quantity: 1,
    currentPrice: 230,
  });

  assert.equal(fullRes.success, true);
  assert.equal(fullRes.proceedsUsdt, 230);

  const pAfterFull = await portfolioService.getPortfolio(userId);
  assert.equal(pAfterFull.holdings.length, 0); // Holding completely removed
  assert.equal(pAfterFull.trades.length, 3); // 1 buy + 2 sells
});

test('Portfolio Service: Multi-user isolation', async () => {
  const mockStore = createMockStorage();
  setPortfolioStorageAdapter(mockStore);

  await portfolioService.buyAsset({
    userId: 'user_A',
    asset: { symbol: 'TSLA', name: 'Tesla', price: 250 },
    amountUsdt: 250,
  });

  const pA = await portfolioService.getPortfolio('user_A');
  const pB = await portfolioService.getPortfolio('user_B');

  assert.equal(pA.holdings.length, 1);
  assert.equal(pB.holdings.length, 0);
});

test('Auth Service: updateProfile sends PUT /auth/profile and updates saved session', async () => {
  const mockStore = createMockStorage();
  setAuthStorageAdapter(mockStore);

  // Pre-seed an authenticated session
  const initialSession = {
    token: 'test_jwt_token',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@assetbridge.africa',
      fullName: 'Old Name',
      role: 'USER',
    },
  };
  await mockStore.setItemAsync(
    'assetbridge_mobile_auth_session',
    JSON.stringify(initialSession)
  );

  let requestedMethod = '';
  let requestedPath = '';
  let requestedBody = null;

  setAuthFetchAdapter(async (url, init) => {
    requestedMethod = init.method;
    requestedPath = url;
    requestedBody = JSON.parse(init.body || '{}');

    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          user: {
            ...initialSession.user,
            fullName: requestedBody.fullName,
          },
        },
      }),
    };
  });

  const updatedUser = await mobileAuthService.updateProfile({
    fullName: 'Updated InterLink Name',
  });

  assert.equal(requestedMethod, 'PUT');
  assert.match(requestedPath, /\/auth\/profile/);
  assert.equal(updatedUser.fullName, 'Updated InterLink Name');

  // Verify stored session was updated
  const stored = JSON.parse(
    await mockStore.getItemAsync('assetbridge_mobile_auth_session')
  );
  assert.equal(stored.user.fullName, 'Updated InterLink Name');
});

test('Bank Deposit: Fiat to USDT conversion math and corridor reference rate', () => {
  const corridors = [
    { code: 'ZA-ZAR', rate: 18.35, symbol: 'R' },
    { code: 'KE-KES', rate: 130.50, symbol: 'KSh' },
    { code: 'NG-NGN', rate: 1450.00, symbol: '₦' },
    { code: 'GB-GBP', rate: 0.79, symbol: '£' },
    { code: 'EU-EUR', rate: 0.92, symbol: '€' },
  ];

  for (const c of corridors) {
    const depositFiat = 1000;
    const usdtExpected = (depositFiat / c.rate).toFixed(2);
    assert.ok(Number(usdtExpected) > 0);
  }

  // 1,000 ZAR @ 18.35 = 54.50 USDT
  const zarDeposit = 1000;
  const zarRate = 18.35;
  const zarUsdt = (zarDeposit / zarRate).toFixed(2);
  assert.equal(zarUsdt, '54.50');
});
