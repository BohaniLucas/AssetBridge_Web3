import { marketDataService } from './marketDataService.js';

class MarketService {
  async getAllAssets() {
    return marketDataService.getAllAssets();
  }

  async getAssetBySymbol(symbol) {
    return marketDataService.getAssetById(symbol);
  }

  async getQuote(pair) {
    const asset = await marketDataService.getAssetById(pair);
    if (!asset) throw new Error('Asset not found');

    return {
      pair: asset.symbol,
      price: asset.price,
      source: asset.source,
      timestamp: asset.providerUpdateTime,
    };
  }
}

export const marketService = new MarketService();
export default marketService;
