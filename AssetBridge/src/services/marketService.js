import { TOKENS } from '../utils/constants';

export const marketService = {
  getAssets() {
    return TOKENS;
  },

  getSignedQuote(symbol) {
    const asset = TOKENS.find(t => t.symbol === symbol) || TOKENS[1];
    const timestamp = Date.now();
    const expiresAt = timestamp + 15000;
    const spread = 0.0015; // 15 bps
    const executionPrice = Number((asset.price * (1 + spread)).toFixed(4));
    
    return {
      pair: `${asset.symbol}/USDT`,
      basePrice: asset.price,
      executionPrice,
      spreadPercent: '0.15%',
      timestamp,
      expiresAt,
      signature: '0x' + Math.random().toString(16).substring(2, 14) + 'ed77',
      secondsRemaining: 15,
    };
  }
};

