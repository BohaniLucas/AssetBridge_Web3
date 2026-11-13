import { API_BASE_URL } from '../config/api';

class MobileMarketService {
  /**
   * Fetch all authentic market assets from backend, optionally filtered by category
   */
  async getMarkets(category = 'all') {
    const url = `${API_BASE_URL}/market/all${category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : ''}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Failed to retrieve market data.');
    }
    return json.data || { assets: [], status: null };
  }

  /**
   * Search markets across providers
   */
  async searchMarkets(query = '') {
    const url = `${API_BASE_URL}/market/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Search request failed.');
    }
    return json.data?.results || [];
  }

  /**
   * Fetch asset details by symbol or ID
   */
  async getAssetDetail(idOrSymbol) {
    const url = `${API_BASE_URL}/market/asset/${encodeURIComponent(idOrSymbol)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Asset details not found.');
    }
    return json.data;
  }

  /**
   * Fetch genuine historical candles or snapshots
   * Range: '24h' | '7d' | '30d' | '1y'
   */
  async getAssetHistory(idOrSymbol, range = '24h') {
    const url = `${API_BASE_URL}/market/history/${encodeURIComponent(idOrSymbol)}?range=${encodeURIComponent(range)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Failed to retrieve chart history.');
    }
    return json.data;
  }

  /**
   * Fetch provider health and WebSocket status
   */
  async getStatus() {
    const url = `${API_BASE_URL}/market/status`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Failed to load market status.');
    }
    return json.data;
  }

  // Legacy helper
  async getLiveAssets() {
    const res = await this.getMarkets('all');
    return res.assets || [];
  }
}

export const mobileMarketService = new MobileMarketService();
export const marketService = mobileMarketService;
export default mobileMarketService;
