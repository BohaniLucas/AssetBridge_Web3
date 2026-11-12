import { API_BASE } from '../config/api';

export const TOKENS = [
  {
    symbol: 'tUSDT',
    name: 'Tether USD',
    type: 'stablecoin',
    price: 1.00,
    change24h: 0.00,
    balance: 1000.00,
    unit: '$',
    iconBg: '#E6F4EA',
    badgeColor: '#137333',
    issuer: 'Tether Operations Limited',
    backing: '100% US Treasury Bills, Cash Equivalents & Overnight Reverse Repos',
  },
  {
    symbol: 'tAAPL',
    name: 'Apple Inc. Token',
    type: 'equity',
    price: 236.40,
    change24h: 1.12,
    balance: 1.25,
    unit: 'sh',
    iconBg: '#E8F0FE',
    badgeColor: '#1A73E8',
    issuer: 'AssetBridge Securities Trust (Mauritius FSC)',
    backing: '1:1 Custodial Common Shares held at Apex Clearing (DTCC)',
  },
  {
    symbol: 'tTSLA',
    name: 'Tesla Inc. Token',
    type: 'equity',
    price: 328.50,
    change24h: 3.45,
    balance: 0.50,
    unit: 'sh',
    iconBg: '#FCE8E6',
    badgeColor: '#D93025',
    issuer: 'AssetBridge Securities Trust (Mauritius FSC)',
    backing: '1:1 Custodial Common Shares held at Apex Clearing (DTCC)',
  },
  {
    symbol: 'tNVDA',
    name: 'NVIDIA Corp. Token',
    type: 'equity',
    price: 147.60,
    change24h: 2.18,
    balance: 2.10,
    unit: 'sh',
    iconBg: '#E6F4EA',
    badgeColor: '#137333',
    issuer: 'AssetBridge Securities Trust (Mauritius FSC)',
    backing: '1:1 Custodial Common Shares held at Apex Clearing (DTCC)',
  },
  {
    symbol: 'tKES',
    name: 'Kenyan Shilling Token',
    type: 'currency',
    price: 0.0077,
    change24h: -0.15,
    balance: 45000,
    unit: 'KES',
    iconBg: '#FEF7E0',
    badgeColor: '#B06000',
    issuer: 'AssetBridge Currency Trust',
    backing: '100% Cash Reserves at KCB Bank Kenya & Safaricom Trust',
  },
  {
    symbol: 'tZAR',
    name: 'South African Rand Token',
    type: 'currency',
    price: 0.054,
    change24h: 0.42,
    balance: 12500,
    unit: 'ZAR',
    iconBg: '#F3E8FD',
    badgeColor: '#7B1FA2',
    issuer: 'AssetBridge Currency Trust',
    backing: '100% Cash Reserves at Standard Bank South Africa',
  },
  {
    symbol: 'tNGN',
    name: 'Nigerian Naira Token',
    type: 'currency',
    price: 0.00063,
    change24h: -0.85,
    balance: 250000,
    unit: 'NGN',
    iconBg: '#E6F4EA',
    badgeColor: '#0F9D58',
    issuer: 'AssetBridge Currency Trust',
    backing: '100% Central Bank of Nigeria Reserve Accounts',
  },
];

class MarketService {
  constructor() {
    this.cachedTokens = [...TOKENS];
    this.lastFetched = 0;
  }

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
      // Fallback local
    }

    this.lastFetched = now;
    return this.cachedTokens;
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

      if (forex && forex.rates) {
        if (token.symbol === 'tKES' && forex.rates.KES) {
          return { ...token, price: 1 / forex.rates.KES };
        }
        if (token.symbol === 'tZAR' && forex.rates.ZAR) {
          return { ...token, price: 1 / forex.rates.ZAR };
        }
        if (token.symbol === 'tNGN' && forex.rates.NGN) {
          return { ...token, price: 1 / forex.rates.NGN };
        }
      }

      return token;
    });
  }

  getAssets() {
    return this.cachedTokens;
  }

  getQuote({ symbol, action, amountUsdt, tokenAmount }) {
    const asset = this.cachedTokens.find((t) => t.symbol === symbol) || this.cachedTokens[1];
    const price = asset.price;
    const feeRate = 0.0015; // 0.15%

    if (action === 'buy') {
      const feeUsdt = amountUsdt * feeRate;
      const netUsdt = amountUsdt - feeUsdt;
      const tokensReceived = price > 0 ? netUsdt / price : 0;
      return {
        price,
        feeUsdt,
        tokensReceived,
        totalUsdt: amountUsdt,
      };
    } else {
      const grossUsdt = tokenAmount * price;
      const feeUsdt = grossUsdt * feeRate;
      const netUsdt = grossUsdt - feeUsdt;
      return {
        price,
        feeUsdt,
        netUsdt,
        tokensSold: tokenAmount,
      };
    }
  }
}

export const marketService = new MarketService();

