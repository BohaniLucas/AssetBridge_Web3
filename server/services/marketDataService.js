/**
 * Canonical Market Data Service for AssetBridge
 *
 * Implements truthful market data integration:
 * 1. Finnhub: US Equities quotes, official company logos via /stock/profile2, symbol search, and daily candles.
 * 2. Binance Spot: Documented public Spot REST (/ticker/24hr) & Spot WebSocket (/ws), Spot Klines (/klines) for honest charts.
 * 3. Open Exchange Rates: Daily reference rates (open.er-api.com). Labeled strictly as daily reference rates with attribution.
 *
 * Requirements:
 * - No fabricated prices, random curves, or invented movement metrics.
 * - Dynamic logos fetched via official APIs / CDNs.
 * - Bounded backoff WebSocket for Binance Spot with status reporting.
 * - Zero exposure of API keys to clients, logs, or error responses.
 */

import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: './server/.env' });

// Supported Equities (tracked via Finnhub)
const DEFAULT_EQUITY_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'NFLX'];

// Supported Crypto Spot Pairs (tracked via Binance Spot)
const DEFAULT_CRYPTO_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];

// Supported Reference FX Currencies (tracked via open.er-api.com)
const DEFAULT_FX_PAIRS = [
  { code: 'KES', name: 'Kenyan Shilling', countryCode: 'ke' },
  { code: 'ZAR', name: 'South African Rand', countryCode: 'za' },
  { code: 'NGN', name: 'Nigerian Naira', countryCode: 'ng' },
  { code: 'GHS', name: 'Ghanaian Cedi', countryCode: 'gh' },
  { code: 'UGX', name: 'Ugandan Shilling', countryCode: 'ug' },
  { code: 'EUR', name: 'Euro', countryCode: 'eu' },
  { code: 'GBP', name: 'British Pound Sterling', countryCode: 'gb' },
];

class MarketDataService {
  constructor() {
    this.finnhubApiKey = process.env.FINNHUB_API_KEY || process.env.FINHUB_API_KEY || '';
    this.openErApiUrl = process.env.OPEN_ER_API_BASE_URL || 'https://open.er-api.com/v6/latest/USD';
    this.binanceApiUrl = (process.env.BINANCE_API_BASE_URL || 'https://api.binance.com/api/v3').replace(/\/$/, '');
    this.binanceWsUrl = process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws';

    // In-memory cache stores
    this.equitiesCache = { timestamp: 0, ttlMs: 30 * 1000, data: new Map() };
    this.equityProfiles = new Map(); // sym -> { name, logo, marketCap, industry }
    this.cryptoCache = { timestamp: 0, ttlMs: 5 * 1000, data: new Map() };
    this.forexCache = { timestamp: 0, ttlMs: 6 * 3600 * 1000, data: null }; // 6 hours TTL for daily feed
    this.snapshotHistory = new Map(); // id -> Array<{ timestamp, price }>

    // Binance WebSocket state
    this.ws = null;
    this.wsStatus = 'disconnected'; // 'connected' | 'connecting' | 'reconnecting' | 'disconnected'
    this.wsReconnectAttempts = 0;
    this.wsLastTickTime = null;
    this.wsReconnectTimer = null;

    // Start background Binance WS connection unless running in automated test runner
    const isTestRunner =
      process.env.NODE_ENV === 'test' ||
      Boolean(process.env.NODE_TEST_CONTEXT) ||
      process.argv.includes('--test') ||
      process.execArgv.includes('--test');
    if (!isTestRunner) {
      this.initBinanceWebSocket();
    }
  }

  /**
   * Safe getter to check if Finnhub API is configured without exposing key
   */
  hasFinnhubKey() {
    return (
      typeof this.finnhubApiKey === 'string' &&
      this.finnhubApiKey.length > 5 &&
      !this.finnhubApiKey.includes('your-finnhub')
    );
  }

  // ============================================================================
  // 1. BINANCE SPOT WEBSOCKET & REST (CRYPTO)
  // ============================================================================

  initBinanceWebSocket() {
    // Avoid running multiple sockets
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.wsStatus = this.wsReconnectAttempts === 0 ? 'connecting' : 'reconnecting';
      // Stream 24hr miniTicker for all spot USDT pairs
      const streams = DEFAULT_CRYPTO_SYMBOLS.map((s) => `${s.toLowerCase()}@ticker`).join('/');
      const streamUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

      this.ws = new WebSocket(streamUrl);

      this.ws.on('open', () => {
        this.wsStatus = 'connected';
        this.wsReconnectAttempts = 0;
        this.wsLastTickTime = new Date().toISOString();
      });

      this.ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          const payload = parsed.data || parsed;
          if (payload && payload.s && payload.c) {
            const sym = payload.s;
            const price = parseFloat(payload.c);
            const changePercent = parseFloat(payload.P || payload.p || 0);
            const high = parseFloat(payload.h || 0);
            const low = parseFloat(payload.l || 0);
            const volume = parseFloat(payload.v || 0);
            const quoteVolume = parseFloat(payload.q || 0);
            const eventTime = payload.E ? new Date(payload.E).toISOString() : new Date().toISOString();

            this.updateCryptoRecord(sym, {
              price,
              changePercent24h: changePercent,
              high24h: high,
              low24h: low,
              volume24h: volume,
              quoteVolume24h: quoteVolume,
              providerUpdateTime: eventTime,
            });
            this.wsLastTickTime = new Date().toISOString();
          }
        } catch {
          // Ignore malformed tick
        }
      });

      this.ws.on('error', () => {
        this.wsStatus = 'disconnected';
      });

      this.ws.on('close', () => {
        this.wsStatus = 'disconnected';
        this.scheduleWsReconnect();
      });
    } catch {
      this.wsStatus = 'disconnected';
      this.scheduleWsReconnect();
    }
  }

  scheduleWsReconnect() {
    if (this.wsReconnectTimer) return;
    this.wsReconnectAttempts += 1;
    // Bounded exponential backoff: 2s, 4s, 8s, 16s, max 30s + jitter
    const delay = Math.min(30000, Math.pow(2, this.wsReconnectAttempts) * 1000) + Math.random() * 1000;
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.initBinanceWebSocket();
    }, delay);
  }

  updateCryptoRecord(sym, { price, changePercent24h, high24h, low24h, volume24h, quoteVolume24h, providerUpdateTime }) {
    const base = sym.replace('USDT', '');
    const canonicalId = `binance_${sym}`;
    const logoUrl = `https://assets.coincap.io/assets/icons/${base.toLowerCase()}@2x.png`;

    const record = {
      id: canonicalId,
      symbol: `${base}/USDT`,
      baseSymbol: base,
      quoteCurrency: 'USDT',
      name: this.getCryptoName(base),
      assetClass: 'crypto',
      price,
      change24h: null,
      changePercent24h,
      high24h,
      low24h,
      volume24h: quoteVolume24h || volume24h,
      volumeCurrency: 'USDT',
      logoUrl,
      source: 'Binance Spot',
      providerUpdateTime,
      serverReceiveTime: new Date().toISOString(),
      freshness: 'live',
      rateType: 'live_tick',
      marketCap: null,
      description: `Spot USDT market pair on Binance. Real-time market tick feed.`,
    };

    this.cryptoCache.data.set(sym, record);
    this.recordSnapshot(canonicalId, price);
  }

  async fetchBinanceSpotRest() {
    try {
      const symbolsParam = JSON.stringify(DEFAULT_CRYPTO_SYMBOLS);
      const url = `${this.binanceApiUrl}/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`;
      const res = await fetch(url);
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items)) {
          const nowIso = new Date().toISOString();
          for (const item of items) {
            this.updateCryptoRecord(item.symbol, {
              price: parseFloat(item.lastPrice),
              changePercent24h: parseFloat(item.priceChangePercent),
              high24h: parseFloat(item.highPrice),
              low24h: parseFloat(item.lowPrice),
              volume24h: parseFloat(item.volume),
              quoteVolume24h: parseFloat(item.quoteVolume),
              providerUpdateTime: item.closeTime ? new Date(item.closeTime).toISOString() : nowIso,
            });
          }
          this.cryptoCache.timestamp = Date.now();
        }
      }
    } catch {
      // Handled via cache
    }
  }

  // ============================================================================
  // 2. FINNHUB REST (US EQUITIES)
  // ============================================================================

  async fetchEquityProfile(symbol) {
    if (this.equityProfiles.has(symbol)) {
      return this.equityProfiles.get(symbol);
    }
    if (!this.hasFinnhubKey()) {
      return { name: symbol, logo: null, marketCap: null, industry: null };
    }

    try {
      const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${this.finnhubApiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const profile = {
          name: json.name || symbol,
          logo: json.logo || null,
          marketCap: json.marketCapitalization ? json.marketCapitalization * 1e6 : null,
          industry: json.finnhubIndustry || null,
        };
        this.equityProfiles.set(symbol, profile);
        return profile;
      }
    } catch {
      // Fall through
    }
    return { name: symbol, logo: null, marketCap: null, industry: null };
  }

  async fetchFinnhubQuote(symbol) {
    if (!this.hasFinnhubKey()) {
      return null;
    }

    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.finnhubApiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const q = await res.json();
        if (q && q.c && q.c > 0) {
          const profile = await this.fetchEquityProfile(symbol);
          const canonicalId = `finnhub_${symbol}`;
          const nowIso = new Date().toISOString();
          const providerTime = q.t ? new Date(q.t * 1000).toISOString() : nowIso;

          const record = {
            id: canonicalId,
            symbol,
            baseSymbol: symbol,
            quoteCurrency: 'USD',
            name: profile.name,
            assetClass: 'equity',
            price: q.c,
            change24h: q.d !== null && q.d !== undefined ? parseFloat(q.d.toFixed(2)) : null,
            changePercent24h: q.dp !== null && q.dp !== undefined ? parseFloat(q.dp.toFixed(2)) : null,
            high24h: q.h || null,
            low24h: q.l || null,
            volume24h: null,
            volumeCurrency: 'USD',
            logoUrl: profile.logo,
            source: 'Finnhub',
            providerUpdateTime: providerTime,
            serverReceiveTime: nowIso,
            freshness: 'live',
            rateType: 'realtime_market',
            marketCap: profile.marketCap,
            description: profile.industry ? `US Listed Common Equity · ${profile.industry}` : 'US Listed Common Equity',
          };

          this.equitiesCache.data.set(symbol, record);
          this.recordSnapshot(canonicalId, q.c);
          return record;
        }
      }
    } catch {
      // Handled via cache
    }
    return null;
  }

  async fetchAllEquities() {
    const now = Date.now();
    if (this.equitiesCache.data.size > 0 && now - this.equitiesCache.timestamp < this.equitiesCache.ttlMs) {
      return Array.from(this.equitiesCache.data.values());
    }

    if (this.hasFinnhubKey()) {
      await Promise.all(DEFAULT_EQUITY_SYMBOLS.map((sym) => this.fetchFinnhubQuote(sym)));
      this.equitiesCache.timestamp = now;
    }

    return Array.from(this.equitiesCache.data.values());
  }

  // ============================================================================
  // 3. OPEN EXCHANGE RATES (FOREX REFERENCE RATES)
  // ============================================================================

  async fetchForexReference() {
    const now = Date.now();
    if (this.forexCache.data && now - this.forexCache.timestamp < this.forexCache.ttlMs) {
      return this.forexCache.data;
    }

    try {
      const res = await fetch(this.openErApiUrl);
      if (res.ok) {
        const json = await res.json();
        if (json && json.rates) {
          const providerUpdateTime = json.time_last_update_utc || new Date().toISOString();
          const list = [];

          for (const item of DEFAULT_FX_PAIRS) {
            const rate = json.rates[item.code];
            if (rate && rate > 0) {
              const canonicalId = `fx_USD_${item.code}`;
              const logoUrl = `https://flagcdn.com/w80/${item.countryCode}.png`;

              const record = {
                id: canonicalId,
                symbol: `USD/${item.code}`,
                baseSymbol: item.code,
                quoteCurrency: item.code,
                name: item.name,
                assetClass: 'forex',
                price: parseFloat(rate.toFixed(4)),
                change24h: null, // OpenER is daily reference, no 24h tick change published
                changePercent24h: null, // Never invent an FX movement metric!
                high24h: null,
                low24h: null,
                volume24h: null,
                volumeCurrency: null,
                logoUrl,
                source: 'Open Exchange Rates',
                providerUpdateTime,
                serverReceiveTime: new Date().toISOString(),
                freshness: 'live',
                rateType: 'daily_reference',
                marketCap: null,
                description: `Daily benchmark reference rate (1 USD = ${rate.toFixed(2)} ${item.code}). Informational rate published daily at ~00:00 UTC. Non-tradeable reference data.`,
              };

              list.push(record);
              this.recordSnapshot(canonicalId, rate);
            }
          }

          this.forexCache.data = list;
          this.forexCache.timestamp = now;
          return list;
        }
      }
    } catch {
      // Handled via cached records
    }

    return this.forexCache.data || [];
  }

  // ============================================================================
  // 4. SNAPSHOTS & HISTORY
  // ============================================================================

  recordSnapshot(canonicalId, price) {
    if (!Number.isFinite(price) || price <= 0) return;
    if (!this.snapshotHistory.has(canonicalId)) {
      this.snapshotHistory.set(canonicalId, []);
    }
    const series = this.snapshotHistory.get(canonicalId);
    const now = Date.now();

    // Limit snapshots to 1 per 30s per asset to conserve memory
    const last = series[series.length - 1];
    if (!last || now - last.timestamp >= 30000) {
      series.push({ timestamp: now, price });
      // Keep up to 1000 rolling snapshots
      if (series.length > 1000) series.shift();
    }
  }

  async getAssetHistory(idOrSymbol, range = '24h') {
    const asset = await this.getAssetById(idOrSymbol);
    if (!asset) {
      return { success: false, historyAvailable: false, reason: 'Asset not found in catalog.' };
    }

    // A. CRYPTO: Fetch genuine Binance Spot Klines
    if (asset.assetClass === 'crypto') {
      const sym = asset.id.replace('binance_', '');
      let interval = '15m';
      let limit = 96; // 96 * 15m = 24h

      if (range === '7d') {
        interval = '1h';
        limit = 168;
      } else if (range === '30d') {
        interval = '1d';
        limit = 30;
      } else if (range === '1y') {
        interval = '1w';
        limit = 52;
      }

      try {
        const url = `${this.binanceApiUrl}/klines?symbol=${sym}&interval=${interval}&limit=${limit}`;
        const res = await fetch(url);
        if (res.ok) {
          const klines = await res.json();
          if (Array.isArray(klines) && klines.length > 0) {
            const points = klines.map((k) => ({
              timestamp: k[0],
              date: new Date(k[0]).toISOString(),
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              price: parseFloat(k[4]), // Close price
              volume: parseFloat(k[5]),
            }));

            return {
              success: true,
              historyAvailable: true,
              source: 'Binance Spot Klines',
              assetId: asset.id,
              symbol: asset.symbol,
              range,
              interval,
              points,
            };
          }
        }
      } catch {
        // Fall back to memory snapshots if provider request failed
      }
    }

    // B. EQUITIES: Fetch genuine Finnhub Stock Candles
    if (asset.assetClass === 'equity' && this.hasFinnhubKey()) {
      const sym = asset.baseSymbol;
      const nowSec = Math.floor(Date.now() / 1000);
      let fromSec = nowSec - 30 * 86400; // default 30d
      let resolution = 'D';

      if (range === '24h' || range === '7d') {
        // Finnhub Free tier restricts intraday (1, 5, 15, 60). We check if daily is requested or if snapshots are present.
        const snapshots = this.snapshotHistory.get(asset.id) || [];
        if (snapshots.length >= 2) {
          return {
            success: true,
            historyAvailable: true,
            source: 'Genuine Backend Server Snapshots',
            assetId: asset.id,
            symbol: asset.symbol,
            range,
            points: snapshots.map((s) => ({
              timestamp: s.timestamp,
              date: new Date(s.timestamp).toISOString(),
              price: s.price,
            })),
          };
        }
        return {
          success: true,
          historyAvailable: false,
          reason: 'Intraday 24h tick charts require Finnhub Premium. Daily history (30D, 1Y) is available.',
          assetId: asset.id,
          symbol: asset.symbol,
          range,
          points: [],
        };
      } else if (range === '30d') {
        fromSec = nowSec - 30 * 86400;
        resolution = 'D';
      } else if (range === '1y') {
        fromSec = nowSec - 365 * 86400;
        resolution = 'W';
      }

      try {
        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=${resolution}&from=${fromSec}&to=${nowSec}&token=${this.finnhubApiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.s === 'ok' && Array.isArray(json.t) && json.t.length > 0) {
            const points = json.t.map((t, idx) => ({
              timestamp: t * 1000,
              date: new Date(t * 1000).toISOString(),
              open: json.o?.[idx] || json.c[idx],
              high: json.h?.[idx] || json.c[idx],
              low: json.l?.[idx] || json.c[idx],
              price: json.c[idx],
              volume: json.v?.[idx] || null,
            }));

            return {
              success: true,
              historyAvailable: true,
              source: 'Finnhub Daily Candles',
              assetId: asset.id,
              symbol: asset.symbol,
              range,
              resolution,
              points,
            };
          }
        }
      } catch {
        // Fall through
      }
    }

    // C. FOREX: Open Exchange Rates is a single daily reference rate
    if (asset.assetClass === 'forex') {
      const snapshots = this.snapshotHistory.get(asset.id) || [];
      if (snapshots.length >= 2) {
        return {
          success: true,
          historyAvailable: true,
          source: 'Open Exchange Rates Daily Snapshots',
          assetId: asset.id,
          symbol: asset.symbol,
          range,
          points: snapshots.map((s) => ({
            timestamp: s.timestamp,
            date: new Date(s.timestamp).toISOString(),
            price: s.price,
          })),
        };
      }

      return {
        success: true,
        historyAvailable: false,
        reason: 'Daily reference rate only. Historical FX series requires an institutional FX provider subscription.',
        assetId: asset.id,
        symbol: asset.symbol,
        range,
        points: [],
      };
    }

    return {
      success: true,
      historyAvailable: false,
      reason: 'Historical chart series is not provided by this endpoint.',
      assetId: asset.id,
      symbol: asset.symbol,
      range,
      points: [],
    };
  }

  // ============================================================================
  // 5. PUBLIC ACCESSORS & SEARCH
  // ============================================================================

  async getAllAssets() {
    // Refresh crypto if empty or WS not connected
    if (this.cryptoCache.data.size === 0 || this.wsStatus !== 'connected') {
      await this.fetchBinanceSpotRest();
    }

    const [equities, forex] = await Promise.all([
      this.fetchAllEquities(),
      this.fetchForexReference(),
    ]);

    const crypto = Array.from(this.cryptoCache.data.values());

    return [...crypto, ...equities, ...forex];
  }

  async getAssetById(idOrSymbol) {
    const assets = await this.getAllAssets();
    const clean = idOrSymbol.toLowerCase().replace('/', '');
    return assets.find(
      (a) =>
        a.id.toLowerCase() === clean ||
        a.symbol.toLowerCase() === clean ||
        a.symbol.toLowerCase().replace('/', '') === clean ||
        a.baseSymbol.toLowerCase() === clean
    );
  }

  async searchAssets(query) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return this.getAllAssets();
    }

    const q = query.trim().toLowerCase();
    const assets = await this.getAllAssets();

    // Local matches
    const matches = assets.filter(
      (a) =>
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.baseSymbol.toLowerCase().includes(q)
    );

    // If query looks like an unlisted US stock and Finnhub key is present, query Finnhub search
    if (matches.length === 0 && this.hasFinnhubKey() && q.length >= 2) {
      try {
        const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${this.finnhubApiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.result) && json.result.length > 0) {
            const firstStock = json.result.find((r) => r.type === 'Common Stock' && !r.symbol.includes('.'));
            if (firstStock) {
              const quote = await this.fetchFinnhubQuote(firstStock.symbol);
              if (quote) matches.push(quote);
            }
          }
        }
      } catch {
        // Fall through
      }
    }

    return matches;
  }

  getStatus() {
    return {
      binanceWebSocket: {
        status: this.wsStatus,
        lastTickTime: this.wsLastTickTime,
        reconnectAttempts: this.wsReconnectAttempts,
      },
      finnhub: {
        isConfigured: this.hasFinnhubKey(),
        trackedEquities: this.equitiesCache.data.size,
        cacheTtlSeconds: this.equitiesCache.ttlMs / 1000,
      },
      forex: {
        provider: 'Open Exchange Rates (open.er-api.com)',
        rateType: 'daily_reference',
        attribution: 'Exchange rate data provided for informational reference under Open Exchange Rates daily reference license.',
        trackedCurrencies: this.forexCache.data ? this.forexCache.data.length : 0,
        lastUpdate: this.forexCache.data?.[0]?.providerUpdateTime || null,
      },
      timestamp: new Date().toISOString(),
    };
  }

  getCryptoName(sym) {
    const names = {
      BTC: 'Bitcoin',
      ETH: 'Ethereum',
      SOL: 'Solana',
      BNB: 'BNB',
      XRP: 'XRP',
      DOGE: 'Dogecoin',
      ADA: 'Cardano',
      AVAX: 'Avalanche',
    };
    return names[sym] || `${sym} Token`;
  }
}

export const marketDataService = new MarketDataService();
export default marketDataService;
