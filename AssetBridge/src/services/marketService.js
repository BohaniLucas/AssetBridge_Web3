import { TOKENS } from '../utils/constants';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class MarketService {
  constructor() {
    this.cachedTokens = [...TOKENS];
    this.lastFetched = 0;
  }

  /**
   * Returns assets with live price feeds from Finnhub, Binance, and open.er-api.com
   */
  async getLiveAssets() {
    const now = Date.now();
    if (now - this.lastFetched < 15000 && this.cachedTokens.length > 0) {
      return this.cachedTokens;
    }

    try {
      const res = await fetch(`${API_BASE}/market/all`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          this.mergeMarketData(json.data);
          this.lastFetched = now;
          return this.cachedTokens;
        }
      }
    } catch {
      await this.fetchDirectPublicFeeds();
    }

    this.lastFetched = now;
    return this.cachedTokens;
  }

  getAssets() {
    return this.cachedTokens;
  }

  async fetchDirectPublicFeeds() {
    try {
      const [fxRes] = await Promise.allSettled([
        fetch('https://open.er-api.com/v6/latest/USD'),
      ]);

      if (fxRes.status === 'fulfilled' && fxRes.value.ok) {
        const fxData = await fxRes.value.json();
        if (fxData.rates) {
          this.cachedTokens = this.cachedTokens.map((token) => {
            if (token.symbol === 'tKES' && fxData.rates.KES) {
              return { ...token, price: 1 / fxData.rates.KES, fxRatePerUsd: fxData.rates.KES };
            }
            if (token.symbol === 'tZAR' && fxData.rates.ZAR) {
              return { ...token, price: 1 / fxData.rates.ZAR, fxRatePerUsd: fxData.rates.ZAR };
            }
            if (token.symbol === 'tNGN' && fxData.rates.NGN) {
              return { ...token, price: 1 / fxData.rates.NGN, fxRatePerUsd: fxData.rates.NGN };
            }
            return token;
          });
        }
      }
    } catch {
      // Keep baseline
    }
  }

  mergeMarketData({ forex, equities }) {
    this.cachedTokens = this.cachedTokens.map((token) => {
      if (equities && Array.isArray(equities)) {
        const eqMatch = equities.find((e) => e.symbol === token.symbol);
        if (eqMatch) {
          return {
            ...token,
            price: eqMatch.price,
            change24h: eqMatch.change24h,
          };
        }
      }

      if (forex?.rates) {
        if (token.symbol === 'tKES' && forex.rates.KES) {
          return { ...token, price: 1 / forex.rates.KES, fxRatePerUsd: forex.rates.KES };
        }
        if (token.symbol === 'tZAR' && forex.rates.ZAR) {
          return { ...token, price: 1 / forex.rates.ZAR, fxRatePerUsd: forex.rates.ZAR };
        }
        if (token.symbol === 'tNGN' && forex.rates.NGN) {
          return { ...token, price: 1 / forex.rates.NGN, fxRatePerUsd: forex.rates.NGN };
        }
      }

      return token;
    });
  }

  async getQuote({ symbol, action, amountUsdt, tokenAmount }) {
    try {
      const res = await fetch(`${API_BASE}/market/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, action, amountUsdt, tokenAmount }),
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch {
      // offline fallback
    }

    const asset = this.cachedTokens.find((t) => t.symbol === symbol) || this.cachedTokens[1];
    const basePrice = asset.price;
    const effectivePrice = action === 'buy' ? basePrice * 1.0015 : basePrice * 0.9985;
    return {
      quoteId: `quote_${Date.now()}`,
      symbol,
      action,
      basePrice,
      effectivePrice,
      spreadPercent: 0.15,
      expiresAt: Date.now() + 30000,
    };
  }

  async executeTrade() {
    throw new Error('Trading is disabled until a real signed transaction and network-confirmed settlement are integrated. No trade was submitted.');
  }

  getSignedQuote(symbol) {
    const asset = this.cachedTokens.find((t) => t.symbol === symbol) || this.cachedTokens[1];
    const timestamp = Date.now();
    const expiresAt = timestamp + 30000;
    const spread = 0.0015;
    const executionPrice = Number((asset.price * (1 + spread)).toFixed(4));

    return {
      pair: `${asset.symbol}/USDT`,
      basePrice: asset.price,
      executionPrice,
      spreadPercent: '0.15%',
      timestamp,
      expiresAt,
      secondsRemaining: 30,
    };
  }
}

export const marketService = new MarketService();
