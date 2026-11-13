import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Info,
  RefreshCw,
  X,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Search,
  Activity,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { marketService } from '../services/marketService';

const CATEGORIES = [
  { id: 'all', label: 'All Instruments' },
  { id: 'gainers', label: 'Top Gainers' },
  { id: 'losers', label: 'Top Losers' },
  { id: 'active', label: 'Most Active' },
  { id: 'stocks', label: 'US Stocks' },
  { id: 'crypto', label: 'Crypto (Binance)' },
  { id: 'forex', label: 'Forex Reference' },
];

const TIME_RANGES = [
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '1y', label: '1Y' },
];

function formatPrice(price) {
  if (price == null || !Number.isFinite(Number(price))) return '$0.00';
  const num = Number(price);
  if (num >= 1000) {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (num >= 1) {
    return `$${num.toFixed(2)}`;
  }
  return `$${num.toFixed(4)}`;
}

function formatVolume(vol) {
  if (vol == null || !Number.isFinite(Number(vol)) || vol <= 0) return 'N/A';
  const num = Number(vol);
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

/**
 * Authentic SVG Historical Chart component.
 * Plots strictly genuine historical points received from the backend/providers.
 * Never invents Bezier math or random synthetic curves.
 */
function AuthenticMarketChart({ points, isUp, range, source, historyAvailable, reason, isLoading }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (isLoading) {
    return (
      <div className="flex h-56 w-full flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center">
        <RefreshCw size={24} className="animate-spin text-teal-600 mb-2" />
        <p className="text-xs font-semibold text-slate-600">Retrieving authentic historical market points…</p>
      </div>
    );
  }

  if (!historyAvailable || !points || points.length < 2) {
    return (
      <div className="flex h-56 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
        <Info size={28} className="text-slate-400 mb-2" />
        <h4 className="text-sm font-bold text-slate-800">Historical Series Not Available</h4>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
          {reason ||
            'Historical candles require an upgraded provider plan or are not published for daily benchmark reference rates. Current quotation displayed.'}
        </p>
      </div>
    );
  }

  const prices = points.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const rangeDiff = maxPrice - minPrice || 1;

  // Chart dimensions
  const width = 600;
  const height = 180;
  const paddingX = 10;
  const paddingTop = 20;
  const paddingBottom = 20;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;

  // Calculate SVG coordinates
  const coords = points.map((pt, idx) => {
    const x = paddingX + (idx / (points.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((pt.price - minPrice) / rangeDiff) * chartHeight;
    return { x, y, pt, idx };
  });

  const linePath = coords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x},${curr.y}` : `${acc} L ${curr.x},${curr.y}`;
  }, '');

  const areaPath = `${linePath} L ${coords[coords.length - 1].x},${height} L ${coords[0].x},${height} Z`;

  const strokeColor = isUp ? '#10B981' : '#F43F5E';
  const fillColor = isUp ? '#10B981' : '#F43F5E';

  const activePoint = hoverIndex !== null && coords[hoverIndex] ? coords[hoverIndex] : coords[coords.length - 1];

  return (
    <div className="relative w-full rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50/60 to-white p-4">
      {/* Top Meta info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs">
        <div className="flex items-center gap-3 font-mono">
          <span className="text-slate-400">Min: <strong className="text-slate-700">{formatPrice(minPrice)}</strong></span>
          <span className="text-slate-400">Max: <strong className="text-slate-700">{formatPrice(maxPrice)}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
          <span>{points.length} authentic candles</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 font-mono text-[10px]">
            {source || 'Provider Klines'}
          </span>
        </div>
      </div>

      {/* Interactive Tooltip Banner */}
      <div className="mt-2 flex items-center justify-between font-mono text-xs">
        <span className="text-slate-400">
          {new Date(activePoint.pt.timestamp).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <span className="font-bold text-slate-900 text-sm">
          {formatPrice(activePoint.pt.price)}
        </span>
      </div>

      {/* SVG Canvas */}
      <div className="relative mt-2 h-44 w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="authenticChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaPath} fill="url(#authenticChartGrad)" />

          {/* Line stroke */}
          <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Active hover crosshair and marker */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={height}
                stroke="#94A3B8"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4.5"
                fill={strokeColor}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Invisible interactive hover rects */}
          {coords.map((c, i) => {
            const rectWidth = chartWidth / coords.length;
            return (
              <rect
                key={i}
                x={c.x - rectWidth / 2}
                y={0}
                width={rectWidth}
                height={height}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoverIndex(i)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * Detailed specifications modal for any selected instrument.
 */
function AssetDetailModal({ asset, onClose }) {
  if (!asset) return null;
  const isForex = asset.assetClass === 'forex' || asset.rateType === 'daily_reference';
  const hasChange = asset.changePercent24h != null && Number.isFinite(Number(asset.changePercent24h));
  const isUp = hasChange && Number(asset.changePercent24h) >= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {asset.logoUrl ? (
              <img src={asset.logoUrl} alt={asset.symbol} className="h-11 w-11 rounded-2xl object-contain bg-slate-50 border border-slate-100 p-1" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 font-bold text-slate-700 text-xs">
                {(asset.baseSymbol || asset.symbol).slice(0, 3)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-slate-900">{asset.name}</h3>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 font-mono">
                  {asset.symbol}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Feed: {asset.source} · {isForex ? 'Daily Reference' : 'Live Tick'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Price & Change */}
        <div className={`rounded-2xl p-4 ${isForex ? 'bg-slate-50 text-slate-900' : isUp ? 'bg-emerald-50 text-emerald-950' : 'bg-rose-50 text-rose-950'}`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Quotation</span>
              <p className="text-2xl font-black">{formatPrice(asset.price)}</p>
            </div>
            <div>
              {isForex ? (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                  Daily Benchmark
                </span>
              ) : hasChange ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${isUp ? 'bg-emerald-200/60 text-emerald-800' : 'bg-rose-200/60 text-rose-800'}`}>
                  {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {isUp ? '+' : ''}{Number(asset.changePercent24h).toFixed(2)}% in 24h
                </span>
              ) : null}
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-600 border-t border-slate-200/60 pt-2">
            {asset.description || 'Verified pricing feed.'}
          </p>
        </div>

        {/* Technical Attributes */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <span className="text-slate-400 block font-medium">24h High</span>
            <strong className="text-slate-900 text-sm mt-0.5 block">
              {asset.high24h != null ? formatPrice(asset.high24h) : 'N/A (Reference)'}
            </strong>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <span className="text-slate-400 block font-medium">24h Low</span>
            <strong className="text-slate-900 text-sm mt-0.5 block">
              {asset.low24h != null ? formatPrice(asset.low24h) : 'N/A (Reference)'}
            </strong>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <span className="text-slate-400 block font-medium">24h Volume</span>
            <strong className="text-slate-900 text-sm mt-0.5 block">{formatVolume(asset.volume24h)}</strong>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <span className="text-slate-400 block font-medium">Cadence</span>
            <strong className="text-slate-900 text-sm mt-0.5 block">
              {asset.rateType === 'daily_reference' ? 'Daily (~00:00 UTC)' : 'Live WebSocket/REST'}
            </strong>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 transition"
        >
          Close Detail
        </button>
      </section>
    </div>
  );
}

export default function TradingPage() {
  const [assets, setAssets] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected asset for charting
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedRange, setSelectedRange] = useState('24h');
  const [historyData, setHistoryData] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Detail Modal
  const [modalAsset, setModalAsset] = useState(null);

  // Load Markets
  const loadMarkets = useCallback(async (cat = selectedCategory) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await marketService.getMarkets(cat);
      const list = data.assets || [];
      setAssets(list);
      if (!selectedAsset && list.length > 0) {
        setSelectedAsset(list[0]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unable to retrieve market quotations.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, selectedAsset]);

  useEffect(() => {
    loadMarkets(selectedCategory);
  }, [selectedCategory, loadMarkets]);

  // Search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await marketService.searchMarkets(q);
        setSearchResults(results);
      } catch {
        const filtered = assets.filter(
          (a) =>
            a.symbol.toLowerCase().includes(q.toLowerCase()) ||
            a.name.toLowerCase().includes(q.toLowerCase()) ||
            a.baseSymbol?.toLowerCase().includes(q.toLowerCase())
        );
        setSearchResults(filtered);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, assets]);

  // Load history when selected asset or range changes
  useEffect(() => {
    if (!selectedAsset) {
      setHistoryData(null);
      return;
    }

    let isSubscribed = true;
    setIsHistoryLoading(true);

    marketService
      .getAssetHistory(selectedAsset.id || selectedAsset.symbol, selectedRange)
      .then((res) => {
        if (isSubscribed) setHistoryData(res);
      })
      .catch((err) => {
        if (isSubscribed) {
          setHistoryData({
            historyAvailable: false,
            reason: err.message || 'Historical candle feed is currently unavailable.',
            points: [],
          });
        }
      })
      .finally(() => {
        if (isSubscribed) setIsHistoryLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [selectedAsset, selectedRange]);

  const displayedAssets = searchResults !== null ? searchResults : assets;

  const isUp = useMemo(() => {
    if (!selectedAsset) return true;
    return (selectedAsset.changePercent24h || 0) >= 0;
  }, [selectedAsset]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-gradient-to-br from-[#101936] via-[#111d3a] to-[#071124] p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Markets</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-300">
              Live crypto prices, equities & currency exchange rates.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Market Feeds</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-bold text-white">Live Feeds Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Controls Bar: Search & Categories */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id && searchResults === null;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery('');
                  setSearchResults(null);
                }}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search symbol or name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Chart & Instrument Detail Card */}
      {selectedAsset && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center">
            {/* Asset Identity */}
            <div className="flex items-center gap-3.5">
              {selectedAsset.logoUrl ? (
                <img
                  src={selectedAsset.logoUrl}
                  alt={selectedAsset.symbol}
                  className="h-12 w-12 rounded-2xl object-contain bg-slate-50 border border-slate-100 p-1.5 shadow-sm"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 font-bold text-slate-700 text-xs">
                  {(selectedAsset.baseSymbol || selectedAsset.symbol).slice(0, 3)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-slate-950">{selectedAsset.name}</h2>
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 font-mono">
                    {selectedAsset.symbol}
                  </span>
                  <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700 border border-teal-200">
                    {selectedAsset.source || 'Verified Feed'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {selectedAsset.assetClass === 'crypto'
                    ? 'Binance Spot USDT Pair · Live Orderbook Ticks'
                    : selectedAsset.assetClass === 'equity'
                    ? 'Finnhub Real-Time Quote'
                    : 'Open Exchange Rates Daily Reference (Updated ~00:00 UTC)'}
                </p>
              </div>
            </div>

            {/* Price & Range Tabs */}
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">{formatPrice(selectedAsset.price)}</span>
                {selectedAsset.changePercent24h != null ? (
                  <span
                    className={`inline-flex items-center gap-0.5 text-sm font-bold ${
                      isUp ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    {isUp ? '+' : ''}
                    {Number(selectedAsset.changePercent24h).toFixed(2)}% (24h)
                  </span>
                ) : (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                    Daily Reference
                  </span>
                )}
              </div>

              {/* Time Range Selector */}
              <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-bold">
                {TIME_RANGES.map((r) => {
                  const isSel = selectedRange === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRange(r.id)}
                      className={`rounded-lg px-3 py-1.5 transition ${
                        isSel ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Genuine Chart Display */}
          <div className="mt-5">
            <AuthenticMarketChart
              points={historyData?.points}
              isUp={isUp}
              range={selectedRange}
              source={historyData?.source}
              historyAvailable={historyData?.historyAvailable}
              reason={historyData?.reason}
              isLoading={isHistoryLoading}
            />
          </div>

          {/* Instrument Stats Strip */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">24h High</span>
              <strong className="text-slate-900 text-sm mt-0.5 block">
                {selectedAsset.high24h != null ? formatPrice(selectedAsset.high24h) : 'N/A (Reference)'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">24h Low</span>
              <strong className="text-slate-900 text-sm mt-0.5 block">
                {selectedAsset.low24h != null ? formatPrice(selectedAsset.low24h) : 'N/A (Reference)'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">24h Volume</span>
              <strong className="text-slate-900 text-sm mt-0.5 block">{formatVolume(selectedAsset.volume24h)}</strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Pricing Mode</span>
              <strong className="text-slate-900 text-sm mt-0.5 block">
                {selectedAsset.rateType === 'daily_reference' ? 'Daily Snapshot' : 'Live Tick Stream'}
              </strong>
            </div>
          </div>
        </section>
      )}

      {/* Market Quotations Table */}
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Market Quotations</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {displayedAssets.length} instruments matching criteria
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadMarkets(selectedCategory)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-48 flex-col items-center justify-center p-6 text-center">
            <RefreshCw size={24} className="animate-spin text-teal-600 mb-2" />
            <p className="text-xs font-semibold text-slate-600">Loading truthful market feeds…</p>
          </div>
        ) : errorMsg ? (
          <div className="flex h-48 flex-col items-center justify-center p-6 text-center">
            <AlertTriangle size={28} className="text-rose-500 mb-2" />
            <p className="text-sm font-bold text-slate-900">{errorMsg}</p>
            <button
              type="button"
              onClick={() => loadMarkets(selectedCategory)}
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              Retry Connection
            </button>
          </div>
        ) : displayedAssets.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center p-6 text-center">
            <Search size={28} className="text-slate-400 mb-2" />
            <p className="text-sm font-bold text-slate-900">No assets found</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {searchQuery ? `No instruments match "${searchQuery}".` : 'No instruments found in this category.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayedAssets.map((asset) => {
              const isForex = asset.assetClass === 'forex' || asset.rateType === 'daily_reference';
              const hasChange = asset.changePercent24h != null && Number.isFinite(Number(asset.changePercent24h));
              const assetIsUp = hasChange && Number(asset.changePercent24h) >= 0;
              const isSelected = selectedAsset?.id === asset.id || selectedAsset?.symbol === asset.symbol;

              return (
                <article
                  key={asset.id || asset.symbol}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-6 py-4 transition sm:grid-cols-[minmax(0,1fr)_130px_120px_140px] ${
                    isSelected ? 'bg-teal-50/40' : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Left: Asset info */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAsset(asset);
                      setSelectedRange('24h');
                    }}
                    className="flex min-w-0 items-center gap-3.5 text-left"
                  >
                    {asset.logoUrl ? (
                      <img
                        src={asset.logoUrl}
                        alt={asset.symbol}
                        className="h-10 w-10 shrink-0 rounded-2xl object-contain bg-slate-50 border border-slate-100 p-1"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-slate-100 text-[11px] font-bold text-slate-800">
                        {(asset.baseSymbol || asset.symbol).slice(0, 3)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{asset.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                        <strong className="font-mono text-slate-700">{asset.symbol}</strong>
                        <span>·</span>
                        <span>{asset.source}</span>
                      </span>
                    </span>
                  </button>

                  {/* Price */}
                  <span className="hidden text-sm font-bold text-slate-900 sm:block">
                    {formatPrice(asset.price)}
                  </span>

                  {/* 24h Change / Daily Ref */}
                  <div className="hidden sm:block">
                    {isForex ? (
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        Daily Ref
                      </span>
                    ) : hasChange ? (
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                          assetIsUp ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {assetIsUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {assetIsUp ? '+' : ''}
                        {Number(asset.changePercent24h).toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-mono">—</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAsset(asset);
                        setSelectedRange('24h');
                        window.scrollTo({ top: 180, behavior: 'smooth' });
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                      Chart
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalAsset(asset)}
                      aria-label={`Details for ${asset.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition"
                    >
                      <Info size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Asset Detail Modal */}
      <AssetDetailModal asset={modalAsset} onClose={() => setModalAsset(null)} />
    </div>
  );
}
