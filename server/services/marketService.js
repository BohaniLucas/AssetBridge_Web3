import { generateSignedQuote } from '../utils/quoteSigner.js';

// Base testnet market assets as defined in the AssetBridge technical architecture
const INITIAL_ASSETS = [
  {
    symbol: 'tUSDT',
    name: 'Tether USD (Testnet)',
    type: 'stablecoin',
    price: 1.00,
    change24h: 0.00,
    currencySymbol: '$',
    marketCap: '120.4B',
    reserveBacking: '100% Cash & US Treasuries equivalent on testnet mock vault',
    iconColor: '#26A17B',
  },
  {
    symbol: 'tAAPL',
    name: 'Apple Inc. (Tokenised)',
    type: 'equity',
    price: 228.45,
    change24h: 1.82,
    currencySymbol: '$',
    marketCap: '3.48T',
    reserveBacking: '1:1 Regulated Custodian Shares Certificate Tracker',
    iconColor: '#A2AAAD',
  },
  {
    symbol: 'tTSLA',
    name: 'Tesla Inc. (Tokenised)',
    type: 'equity',
    price: 312.20,
    change24h: -0.94,
    currencySymbol: '$',
    marketCap: '998.2B',
    reserveBacking: '1:1 Regulated Custodian Shares Certificate Tracker',
    iconColor: '#E82127',
  },
  {
    symbol: 'tNVDA',
    name: 'NVIDIA Corp. (Tokenised)',
    type: 'equity',
    price: 145.60,
    change24h: 3.42,
    currencySymbol: '$',
    marketCap: '3.58T',
    reserveBacking: '1:1 Regulated Custodian Shares Certificate Tracker',
    iconColor: '#76B900',
  },
  {
    symbol: 'tKES',
    name: 'Kenyan Shilling Token',
    type: 'fx',
    price: 0.0077, // 1 USD = ~129.5 KES
    fxRatePerUsd: 129.50,
    change24h: 0.15,
    currencySymbol: 'KSh',
    marketCap: '42.1M',
    reserveBacking: 'Kenyan Mobile Money M-Pesa Liquidity Reserve & Bank Escrow',
    iconColor: '#00853F',
  },
  {
    symbol: 'tZAR',
    name: 'South African Rand Token',
    type: 'fx',
    price: 0.056, // 1 USD = ~17.85 ZAR
    fxRatePerUsd: 17.85,
    change24h: -0.42,
    currencySymbol: 'R',
    marketCap: '88.5M',
    reserveBacking: 'SARB compliant cash-backed trust account',
    iconColor: '#E03C31',
  },
  {
    symbol: 'tNGN',
    name: 'Nigerian Naira Token',
    type: 'fx',
    price: 0.00060, // 1 USD = ~1660 NGN
    fxRatePerUsd: 1660.0,
    change24h: -1.10,
    currencySymbol: '₦',
    marketCap: '115.3M',
    reserveBacking: 'Commercial bank escrow deposits',
    iconColor: '#008751',
  },
];

class MarketService {
  constructor() {
    this.assets = [...INITIAL_ASSETS];
  }

  getAllAssets() {
    return this.assets;
  }

  getAssetBySymbol(symbol) {
    return this.assets.find(a => a.symbol.toLowerCase() === symbol.toLowerCase());
  }

  getQuote(pair) {
    const asset = this.getAssetBySymbol(pair);
    if (!asset) {
      throw new Error(`Asset ${pair} not supported`);
    }
    return generateSignedQuote(asset.symbol, asset.price);
  }
}

export const marketService = new MarketService();

