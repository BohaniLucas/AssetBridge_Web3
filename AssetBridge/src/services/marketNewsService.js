const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

export const marketNewsService = {
  async getLatest({ refresh = false } = {}) {
    const endpoint = new URL(`${API_BASE_URL}/market/news`);
    if (refresh) endpoint.searchParams.set('refresh', 'true');
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
    const result = await response.json();
    if (!response.ok || result.status !== 'success') {
      throw new Error(result.message || 'Could not load the latest updates.');
    }
    return result.data;
  },
};
