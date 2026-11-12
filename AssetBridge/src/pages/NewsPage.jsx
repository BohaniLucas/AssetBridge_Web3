import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Blocks, Newspaper, RefreshCw } from 'lucide-react';
import { marketNewsService } from '../services/marketNewsService';

export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('All');

  const loadNews = useCallback(async (refresh = false) => {
    setIsLoading(true);
    setError('');
    try {
      const feed = await marketNewsService.getLatest({ refresh });
      setArticles(feed.articles || []);
      setFetchedAt(feed.fetchedAt || null);
      setIsStale(Boolean(feed.stale));
    } catch (loadError) {
      setError(loadError.message || 'Could not load market and blockchain updates.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
    const refreshTimer = window.setInterval(() => loadNews(), 5 * 60 * 1000);
    return () => window.clearInterval(refreshTimer);
  }, [loadNews]);

  const visibleArticles = category === 'All' ? articles : articles.filter((article) => article.category === category);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <section className="overflow-hidden rounded-[1.75rem] border border-violet-100 bg-gradient-to-br from-[#f6f5ff] via-[#f0f3ff] to-[#e5fbf6] p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            {/* <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/70 px-3 py-1.5 text-xs font-bold text-violet-900"><Newspaper size={14} /> Market & blockchain briefing</div> */}
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">News & Updates</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Keep up with market headlines, blockchain developments, and digital asset news from publishers around the world.</p>
          </div>
          <div className="hidden h-28 w-28 items-center justify-center rounded-[2rem] bg-white/70 text-violet-700 shadow-sm sm:flex"><Blocks size={54} strokeWidth={1.4} /></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Latest headlines</h2>
            <p className="mt-1 text-xs text-slate-500">Refreshes every five minutes while this page is open.</p>
          </div>
          <button type="button" onClick={() => loadNews(true)} disabled={isLoading} className="flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:self-center"><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />Refresh updates</button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 pt-4 sm:px-6">
          {['All', 'Markets', 'Blockchain'].map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${category === item ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{item}</button>)}
          {fetchedAt && <span className={`ml-auto text-[11px] ${isStale ? 'text-amber-700' : 'text-slate-400'}`}>{isStale ? 'Cached feed · latest refresh failed' : 'Feed checked'} · {new Date(fetchedAt).toLocaleString()}</span>}
        </div>

        <div className="p-5 sm:p-6">
          {isLoading && !articles.length && <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-10 text-sm text-slate-500"><RefreshCw size={16} className="animate-spin" />Loading latest updates…</div>}
          {error && <div role="status" className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"><span>{error} Check that the AssetBridge server is running and can reach its news feeds.</span><button type="button" onClick={() => loadNews(true)} className="shrink-0 rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold">Try again</button></div>}
          {!isLoading && !error && !visibleArticles.length && <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">No recent stories found in this category.</p>}
          {visibleArticles.length > 0 && <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {visibleArticles.slice(0, 24).map((article) => <article key={article.id || article.url} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-violet-200 hover:shadow-md">
              <div className="relative aspect-[16/8] overflow-hidden bg-gradient-to-br from-violet-100 via-indigo-100 to-teal-100">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-violet-700"><Newspaper size={34} strokeWidth={1.5} /><span className="text-[10px] font-extrabold uppercase tracking-[0.18em]">Market briefing</span></div>
                {article.imageUrl && <img src={article.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 h-full w-full object-cover" />}
                <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-sm ${article.category === 'Blockchain' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'}`}>{article.category}</span>
              </div>
              <div className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] font-semibold text-slate-500">{article.source}</span>{article.publishedAt && <time dateTime={article.publishedAt} className="text-[10px] text-slate-400">{new Date(article.publishedAt).toLocaleString()}</time>}</div>
                <h3 className="text-base font-bold leading-snug text-slate-900">{article.title}</h3>
                {article.summary && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">{article.summary}</p>}
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-violet-800">View News <ArrowUpRight size={14} /></a>
              </div>
            </article>)}
          </div>}
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-[11px] leading-relaxed text-slate-500 sm:px-6">Headlines are for general information and may be incomplete or delayed. They are not investment advice; verify details with the publisher and other reliable sources.</div>
      </section>
    </div>
  );
}
