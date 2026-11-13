const NEWS_ENDPOINT = 'https://finnhub.io/api/v1/news';
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_ARTICLES_PER_CATEGORY = 40;

const cache = new Map();
const inFlight = new Map();

function getApiKey() {
  return process.env.FINNHUB_API_KEY || process.env.FINHUB_API_KEY || '';
}

function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function mapArticle(item, category) {
  const url = safeHttpUrl(item?.url);
  const title = typeof item?.headline === 'string' ? item.headline.trim() : '';
  if (!url || !title) return null;

  const seconds = Number(item.datetime);
  const publishedAt = Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;

  return {
    id: String(item.id || url),
    title,
    summary: typeof item.summary === 'string' ? item.summary.trim() : '',
    source: typeof item.source === 'string' ? item.source.trim() : 'Finnhub',
    url,
    imageUrl: safeHttpUrl(item.image),
    publishedAt,
    category: category === 'crypto' ? 'Blockchain' : 'Markets',
  };
}

async function fetchCategory(category, { refresh = false } = {}) {
  const cached = cache.get(category);
  const now = Date.now();
  if (!refresh && cached && now - cached.fetchedAtMs < CACHE_TTL_MS) {
    return { ...cached, stale: false };
  }

  if (!refresh && inFlight.has(category)) return inFlight.get(category);

  const apiKey = getApiKey();
  if (!apiKey || apiKey.length < 6 || apiKey.includes('your_finnhub')) {
    if (cached) return { ...cached, stale: true };
    throw new Error('Crypto news is not configured on the server.');
  }

  const request = (async () => {
    try {
      const endpoint = new URL(NEWS_ENDPOINT);
      endpoint.searchParams.set('category', category);
      endpoint.searchParams.set('minId', '0');
      endpoint.searchParams.set('token', apiKey);

      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Provider request failed.');

      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error('Provider returned an invalid news feed.');

      const articles = payload
        .map((item) => mapArticle(item, category))
        .filter(Boolean)
        .sort((a, b) => (b.publishedAt ? Date.parse(b.publishedAt) : 0) - (a.publishedAt ? Date.parse(a.publishedAt) : 0))
        .slice(0, MAX_ARTICLES_PER_CATEGORY);

      const result = {
        articles,
        fetchedAt: new Date().toISOString(),
        fetchedAtMs: Date.now(),
        stale: false,
      };
      cache.set(category, result);
      return result;
    } catch {
      if (cached) return { ...cached, stale: true };
      throw new Error('Crypto news is temporarily unavailable. Please try again shortly.');
    } finally {
      inFlight.delete(category);
    }
  })();

  inFlight.set(category, request);
  return request;
}

class MarketNewsService {
  async getLatest({ category = 'all', refresh = false } = {}) {
    const categories = category === 'all'
      ? ['crypto', 'general']
      : [category === 'markets' ? 'general' : 'crypto'];

    const results = await Promise.allSettled(
      categories.map((item) => fetchCategory(item, { refresh }))
    );
    const successful = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    if (!successful.length) {
      const failure = results.find((result) => result.status === 'rejected');
      throw failure?.reason || new Error('Crypto news is temporarily unavailable.');
    }

    const uniqueArticles = new Map();
    successful.flatMap((result) => result.articles).forEach((article) => {
      uniqueArticles.set(article.url, article);
    });
    const articles = [...uniqueArticles.values()]
      .sort((a, b) => (b.publishedAt ? Date.parse(b.publishedAt) : 0) - (a.publishedAt ? Date.parse(a.publishedAt) : 0))
      .slice(0, MAX_ARTICLES_PER_CATEGORY);

    const fetchedTimes = successful.map((result) => result.fetchedAt).sort();

    return {
      articles,
      fetchedAt: fetchedTimes[fetchedTimes.length - 1] || new Date().toISOString(),
      stale: successful.some((result) => result.stale) || successful.length < categories.length,
    };
  }
}

export const marketNewsService = new MarketNewsService();
