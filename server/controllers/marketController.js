import { marketDataService } from '../services/marketDataService.js';
import { marketNewsService } from '../services/marketNewsService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

const MARKET_NEWS_CATEGORIES = new Set(['all', 'crypto', 'markets']);

export const getMarketNews = async (req, res) => {
  const category = String(req.query.category || 'all').toLowerCase();
  if (!MARKET_NEWS_CATEGORIES.has(category)) {
    return errorResponse(res, 'Unsupported news category.', 400);
  }

  try {
    const data = await marketNewsService.getLatest({
      category,
      refresh: req.query.refresh === 'true',
    });
    return successResponse(res, data, 'Latest market and crypto news');
  } catch (err) {
    const statusCode = /not configured/i.test(err?.message || '') ? 503 : 502;
    return errorResponse(res, err?.message || 'Crypto news is temporarily unavailable.', statusCode);
  }
};

/**
 * Returns all canonical market assets, optionally filtered or ranked by category
 */
export const getAllMarkets = async (req, res) => {
  try {
    const { category } = req.query;
    let assets = await marketDataService.getAllAssets();

    // Honest Category Filtering / Ranking
    if (category) {
      const cat = category.toLowerCase();
      if (cat === 'stocks' || cat === 'equities') {
        assets = assets.filter((a) => a.assetClass === 'equity');
      } else if (cat === 'crypto') {
        assets = assets.filter((a) => a.assetClass === 'crypto');
      } else if (cat === 'forex') {
        assets = assets.filter((a) => a.assetClass === 'forex');
      } else if (cat === 'gainers' || cat === 'top_gainers') {
        // Only rank assets with genuine 24h change percentage
        assets = assets
          .filter((a) => a.changePercent24h !== null && Number.isFinite(a.changePercent24h))
          .sort((a, b) => b.changePercent24h - a.changePercent24h);
      } else if (cat === 'losers' || cat === 'top_losers') {
        assets = assets
          .filter((a) => a.changePercent24h !== null && Number.isFinite(a.changePercent24h))
          .sort((a, b) => a.changePercent24h - b.changePercent24h);
      } else if (cat === 'active' || cat === 'most_active') {
        assets = assets
          .filter((a) => a.volume24h !== null && Number.isFinite(a.volume24h))
          .sort((a, b) => b.volume24h - a.volume24h);
      }
    }

    return successResponse(
      res,
      {
        assets,
        count: assets.length,
        status: marketDataService.getStatus(),
        timestamp: new Date().toISOString(),
      },
      'Consolidated authentic market feeds'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

/**
 * Returns single asset details by ID or symbol
 */
export const getAssetDetail = async (req, res) => {
  try {
    const { idOrSymbol } = req.params;
    const asset = await marketDataService.getAssetById(idOrSymbol);
    if (!asset) {
      return errorResponse(res, `Asset '${idOrSymbol}' was not found in supported provider catalogs.`, 404);
    }
    return successResponse(res, asset, 'Asset market details retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

/**
 * Returns authentic historical candles or snapshots for charts
 */
export const getAssetHistory = async (req, res) => {
  try {
    const { idOrSymbol } = req.params;
    const { range = '24h' } = req.query;
    const history = await marketDataService.getAssetHistory(idOrSymbol, range);
    return successResponse(res, history, 'Historical market series retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

/**
 * Search assets across provider catalogs by symbol or company/coin name
 */
export const searchMarkets = async (req, res) => {
  try {
    const { q } = req.query;
    const results = await marketDataService.searchAssets(q || '');
    return successResponse(
      res,
      {
        query: q || '',
        count: results.length,
        results,
      },
      'Market search results'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

/**
 * Returns provider connection health, freshness, and license disclosures
 */
export const getMarketStatus = (req, res) => {
  try {
    const status = marketDataService.getStatus();
    return successResponse(res, status, 'Market data connection and provider statuses');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

// Legacy compatibility endpoints
export const getForex = async (req, res) => {
  try {
    const forex = await marketDataService.fetchForexReference();
    return successResponse(res, forex, 'Daily forex reference rates from open.er-api.com');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getEquities = async (req, res) => {
  try {
    const equities = await marketDataService.fetchAllEquities();
    return successResponse(res, equities, 'Live equities from Finnhub');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getCrypto = async (req, res) => {
  try {
    const all = await marketDataService.getAllAssets();
    const crypto = all.filter((a) => a.assetClass === 'crypto');
    return successResponse(res, crypto, 'Spot crypto tickers from Binance Spot');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const generateTradeQuote = (req, res) =>
  errorResponse(
    res,
    'Trading is disabled until quotes and settlement are verified by the connected network. No trade was executed.',
    503
  );

export const executeTrade = (req, res) =>
  errorResponse(
    res,
    'Trading is disabled until quotes and settlement are verified by the connected network. No trade was executed.',
    503
  );
