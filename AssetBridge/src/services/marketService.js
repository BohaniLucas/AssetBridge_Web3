const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class MarketService {
  /**
   * Fetch all authentic market assets from backend, optionally filtered by category
   * Categories: 'all' | 'gainers' | 'losers' | 'active' | 'stocks' | 'crypto' | 'forex'
   */
  async getMarkets(category = 'all') {
    const url = `${API_BASE}/market/all${category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : ''}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Failed to retrieve market data from backend.');
    }
    return json.data || { assets: [], status: null };
  }

  /**
   * Search markets by symbol or asset name across provider catalogs
   */
  async searchMarkets(query = '') {
    const url = `${API_BASE}/market/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Market search request failed.');
    }
    return json.data?.results || [];
  }

  /**
   * Fetch asset details by canonical ID or symbol
   */
  async getAssetDetail(idOrSymbol) {
    const url = `${API_BASE}/market/asset/${encodeURIComponent(idOrSymbol)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Asset details not found.');
    }
    return json.data;
  }

  /**
   * Fetch genuine historical candles or snapshots for interactive charts
   * Range: '24h' | '7d' | '30d' | '1y'
   */
  async getAssetHistory(idOrSymbol, range = '24h') {
    const url = `${API_BASE}/market/history/${encodeURIComponent(idOrSymbol)}?range=${encodeURIComponent(range)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Failed to retrieve asset historical chart data.');
    }
    return json.data;
  }

  /**
   * Fetch provider health, WebSocket status, and licensing info
   */
  async getStatus() {
    const url = `${API_BASE}/market/status`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Failed to retrieve provider connection status.');
    }
    return json.data;
  }

  // Trading remains explicitly guarded
  async executeTrade() {
    throw new Error(
      'Trading and execution are disabled. Market feeds provide informational reference pricing only.'
    );
  }

  // Legacy compatibility helpers
  async getLiveAssets() {
    const res = await this.getMarkets('all');
    return res.assets || [];
  }

  getAssets() {
    return [];
  }
}

export const marketService = new MarketService();
export default marketService;
