/**
 * InterLink Mobile Portfolio & Asset Holdings Service
 *
 * Tracks user-held assets (stocks, crypto, commodities, forex) bought via USDT.
 * Scoped securely per user. Persists across app sessions.
 */

let customStorageAdapter = null;
let secureStorePromise = null;

export function setPortfolioStorageAdapter(adapter) {
  customStorageAdapter = adapter;
}

async function getStorage() {
  if (customStorageAdapter) return customStorageAdapter;
  if (!secureStorePromise) {
    secureStorePromise = import('expo-secure-store').catch(() => null);
  }
  const store = await secureStorePromise;
  if (store && typeof store.getItemAsync === 'function') {
    return store;
  }
  // In-memory fallback
  if (!globalThis.__interlinkPortfolioMemory) {
    globalThis.__interlinkPortfolioMemory = new Map();
  }
  return {
    getItemAsync: async (key) => globalThis.__interlinkPortfolioMemory.get(key) || null,
    setItemAsync: async (key, val) => globalThis.__interlinkPortfolioMemory.set(key, String(val)),
    deleteItemAsync: async (key) => globalThis.__interlinkPortfolioMemory.delete(key),
  };
}

function portfolioKeyFor(userId) {
  const safeId = String(userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `interlink_portfolio_v1_${safeId}`;
}

export const portfolioService = {
  /**
   * Retrieves all holdings and trade history for the specified user.
   */
  async getPortfolio(userId) {
    if (!userId) return { holdings: [], trades: [] };
    try {
      const storage = await getStorage();
      const raw = await storage.getItemAsync(portfolioKeyFor(userId));
      if (!raw) return { holdings: [], trades: [] };
      const parsed = JSON.parse(raw);
      return {
        holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
        trades: Array.isArray(parsed.trades) ? parsed.trades : [],
      };
    } catch {
      return { holdings: [], trades: [] };
    }
  },

  /**
   * Purchases an asset using USDT.
   */
  async buyAsset({ userId, asset, amountUsdt }) {
    if (!userId) throw new Error('Sign in required to trade assets.');
    const numAmount = Number(amountUsdt);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      throw new Error('Enter a valid USDT purchase amount greater than zero.');
    }
    const price = Number(asset?.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Live price is unavailable for this asset.');
    }

    const units = numAmount / price;
    const nowIso = new Date().toISOString();
    const portfolio = await this.getPortfolio(userId);

    const existingIndex = portfolio.holdings.findIndex(
      (h) => h.symbol.toUpperCase() === asset.symbol.toUpperCase()
    );

    let updatedHolding;
    if (existingIndex >= 0) {
      const existing = portfolio.holdings[existingIndex];
      const newQty = existing.quantity + units;
      const newCost = (existing.totalCostBasis || 0) + numAmount;
      const newAvgPrice = newQty > 0 ? newCost / newQty : price;

      updatedHolding = {
        ...existing,
        name: asset.name || existing.name,
        quantity: newQty,
        avgBuyPrice: newAvgPrice,
        totalCostBasis: newCost,
        category: asset.category || existing.category || 'Asset',
        logo: asset.logo || existing.logo || null,
        lastPrice: price,
        updatedAt: nowIso,
      };
      portfolio.holdings[existingIndex] = updatedHolding;
    } else {
      updatedHolding = {
        id: `h_${asset.symbol}_${Date.now()}`,
        symbol: asset.symbol.toUpperCase(),
        name: asset.name || asset.symbol,
        quantity: units,
        avgBuyPrice: price,
        totalCostBasis: numAmount,
        category: asset.category || 'Asset',
        logo: asset.logo || null,
        lastPrice: price,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      portfolio.holdings.push(updatedHolding);
    }

    const tradeRecord = {
      id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'BUY',
      symbol: asset.symbol.toUpperCase(),
      name: asset.name || asset.symbol,
      amountUsdt: numAmount,
      units,
      price,
      timestamp: nowIso,
    };
    portfolio.trades.unshift(tradeRecord);
    if (portfolio.trades.length > 50) portfolio.trades = portfolio.trades.slice(0, 50);

    const storage = await getStorage();
    await storage.setItemAsync(portfolioKeyFor(userId), JSON.stringify(portfolio));

    return {
      success: true,
      holding: updatedHolding,
      trade: tradeRecord,
      portfolio,
    };
  },

  /**
   * Sells an asset, returning USDT proceeds.
   */
  async sellAsset({ userId, symbol, quantity, currentPrice }) {
    if (!userId) throw new Error('Sign in required to trade assets.');
    const numQty = Number(quantity);
    if (!Number.isFinite(numQty) || numQty <= 0) {
      throw new Error('Enter a valid quantity to sell.');
    }
    const price = Number(currentPrice);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Live price is unavailable for this asset.');
    }

    const portfolio = await this.getPortfolio(userId);
    const existingIndex = portfolio.holdings.findIndex(
      (h) => h.symbol.toUpperCase() === symbol.toUpperCase()
    );

    if (existingIndex < 0) {
      throw new Error(`You do not own any ${symbol}.`);
    }

    const existing = portfolio.holdings[existingIndex];
    if (numQty > existing.quantity + 0.0000001) {
      throw new Error(
        `Insufficient balance. You currently hold ${existing.quantity.toFixed(4)} ${symbol}.`
      );
    }

    const nowIso = new Date().toISOString();
    const actualSellQty = Math.min(numQty, existing.quantity);
    const proceedsUsdt = actualSellQty * price;
    const remainingQty = existing.quantity - actualSellQty;

    if (remainingQty <= 0.000001) {
      portfolio.holdings.splice(existingIndex, 1);
    } else {
      const remainingCostBasis = (existing.totalCostBasis / existing.quantity) * remainingQty;
      portfolio.holdings[existingIndex] = {
        ...existing,
        quantity: remainingQty,
        totalCostBasis: remainingCostBasis,
        lastPrice: price,
        updatedAt: nowIso,
      };
    }

    const tradeRecord = {
      id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'SELL',
      symbol: symbol.toUpperCase(),
      name: existing.name || symbol,
      amountUsdt: proceedsUsdt,
      units: actualSellQty,
      price,
      timestamp: nowIso,
    };
    portfolio.trades.unshift(tradeRecord);
    if (portfolio.trades.length > 50) portfolio.trades = portfolio.trades.slice(0, 50);

    const storage = await getStorage();
    await storage.setItemAsync(portfolioKeyFor(userId), JSON.stringify(portfolio));

    return {
      success: true,
      proceedsUsdt,
      soldQuantity: actualSellQty,
      trade: tradeRecord,
      portfolio,
    };
  },
};

export default portfolioService;

