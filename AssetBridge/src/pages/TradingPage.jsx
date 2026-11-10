import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Info,
  RefreshCw,
  X,
} from 'lucide-react';
import { TOKENS } from '../utils/constants';
import { marketService } from '../services/marketService';
import { activityService } from '../services/activityService';

const marketAssets = TOKENS.filter((token) => token.type !== 'stablecoin');

const formatPrice = (price) => `$${price >= 1 ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price.toFixed(4)}`;

function MarketIllustration() {
  return (
    <svg viewBox="0 0 360 210" role="img" aria-label="Illustration of a globe and a rising sample price chart" className="h-full w-full">
      <defs>
        <linearGradient id="globeFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#54d8cd" />
          <stop offset="1" stopColor="#146b9c" />
        </linearGradient>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity=".28" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="236" cy="108" r="78" fill="url(#globeFill)" opacity=".95" />
      <path d="M174 91c19-7 27-23 44-24 11 0 11 12 25 14 12 1 18-12 30-9 13 3 21 18 34 20 4 27-7 51-27 67-12 10-27 17-44 18-8-15-26-21-28-37-2-12-13-15-28-19-12-4-15-17-6-30Z" fill="#d9fff4" opacity=".65" />
      <ellipse cx="236" cy="108" rx="35" ry="78" fill="none" stroke="#dffcf7" strokeOpacity=".5" />
      <path d="M160 108h152M177 69c34 17 85 17 118 0M176 147c35-17 86-17 119 0" fill="none" stroke="#dffcf7" strokeOpacity=".5" />
      <path d="M8 169 52 147l36 10 39-57 32 14 38-63 32 26 35-39 39 5 44-30v149H8Z" fill="url(#chartFill)" />
      <path d="m8 169 44-22 36 10 39-57 32 14 38-63 32 26 35-39 39 5 44-30" fill="none" stroke="#4b2cac" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m280 12 28 1-2 27" fill="none" stroke="#4b2cac" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {[52, 88, 127, 159, 197, 229, 264, 303].map((x, index) => <circle key={x} cx={x} cy={[147, 157, 100, 114, 51, 77, 38, 43][index]} r="4" fill="#fff" stroke="#4b2cac" strokeWidth="2" />)}
    </svg>
  );
}

function MarketInfoDialog({ asset, onClose }) {
  if (!asset) return null;
  const isUp = asset.change24h >= 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="market-info-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-violet-700">Market in simple terms</p>
            <h2 id="market-info-title" className="mt-1 text-xl font-extrabold text-slate-900">{asset.name} ({asset.symbol})</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close market explanation" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className={`rounded-2xl p-4 ${isUp ? 'bg-emerald-50 text-emerald-950' : 'bg-rose-50 text-rose-950'}`}>
          <div className="flex items-center gap-2 font-bold">
            {isUp ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            <span>Sample price is {isUp ? 'up' : 'down'} {Math.abs(asset.change24h).toFixed(2)}% over the shown 24-hour period.</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed">
            {isUp
              ? 'In this sample, the price is higher than it was at the start of that period.'
              : 'In this sample, the price is lower than it was at the start of that period.'}
            {' '}That describes a past move; it does not tell you what the price will do next.
          </p>
          <p className="mt-2 text-sm leading-relaxed">This preview has no live news or company updates, so it cannot tell you why the price moved.</p>
        </div>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          <strong>This is not live market data.</strong> AssetBridge currently uses example prices and a sample chart. Don’t use this screen to decide on a real-money trade. Consider your goal, the possibility of loss, and whether you understand the asset before trading.
        </div>
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">Got it</button>
      </section>
    </div>
  );
}

export default function TradingPage({ user }) {
  const storageUserId = user?.email || user?.id || 'demo';
  const [selectedAsset, setSelectedAsset] = useState(marketAssets[0]);
  const [orderType, setOrderType] = useState('buy');
  const [usdtAmount, setUsdtAmount] = useState('25');
  const [quote, setQuote] = useState(null);
  const [tradeSuccess, setTradeSuccess] = useState(null);
  const [infoAsset, setInfoAsset] = useState(null);

  const refreshQuote = () => setQuote(marketService.getSignedQuote(selectedAsset.symbol));

  useEffect(() => {
    setQuote(marketService.getSignedQuote(selectedAsset.symbol));
  }, [selectedAsset]);

  const estimatedTokens = quote ? (Number(usdtAmount) / quote.executionPrice).toFixed(4) : '0';

  const selectForBuy = (asset) => {
    setSelectedAsset(asset);
    setOrderType('buy');
    setTradeSuccess(null);
    window.requestAnimationFrame(() => document.getElementById('order-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const handleExecuteTrade = (event) => {
    event.preventDefault();
    if (!quote || Number(usdtAmount) <= 0) return;
    const reference = `demo-${Date.now()}`;
    setTradeSuccess({ asset: selectedAsset.symbol, type: orderType.toUpperCase(), usdtSpent: usdtAmount, tokensReceived: estimatedTokens, executionPrice: quote.executionPrice, reference });
    activityService.addActivity({
      type: 'trade',
      title: `Demo ${orderType} order · ${selectedAsset.symbol}`,
      detail: `$${usdtAmount} USDT · indicative quote only; no funds or assets moved`,
      status: 'simulated',
      reference,
    }, storageUserId);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-violet-100 bg-gradient-to-br from-[#f6f5ff] via-[#f0f3ff] to-[#e5fbf6] p-5 shadow-sm sm:p-7">
        <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="relative grid items-center gap-4 md:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-5 flex items-center gap-2 text-xs font-bold text-slate-600"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"><ArrowLeft size={15} /></span>Invest</div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Trade Global Assets</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">Explore example prices for global shares and local currencies. Choose an asset to preview a demo buy.</p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900"><Info size={13} />Sample data · no real trades or funds moved</span>
          </div>
          <div className="h-40 md:h-48"><MarketIllustration /></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div><h2 className="text-lg font-extrabold text-slate-950">Popular Assets</h2><p className="mt-0.5 text-xs text-slate-500">Illustrative prices and 24-hour change</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">{marketAssets.length} examples</span>
        </div>

        <div className="divide-y divide-slate-100">
          {marketAssets.map((asset) => {
            const isUp = asset.change24h >= 0;
            const isSelected = selectedAsset.symbol === asset.symbol;
            return (
              <article key={asset.symbol} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition sm:grid-cols-[minmax(0,1fr)_120px_100px_90px] sm:px-6 ${isSelected ? 'bg-violet-50/50' : 'hover:bg-slate-50'}`}>
                <button type="button" onClick={() => setSelectedAsset(asset)} className="flex min-w-0 items-center gap-3 text-left">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-100 text-[11px] font-black text-slate-800 shadow-sm">{asset.symbol.replace('t', '')}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-900">{asset.name.replace(' Token', '')}</span><span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-400">{asset.symbol} · {asset.type === 'equity' ? 'Equity' : 'Currency'}</span></span>
                </button>
                <span className="hidden text-sm font-extrabold text-slate-900 sm:block">{formatPrice(asset.price)}</span>
                <span className={`hidden items-center gap-1 text-xs font-bold sm:inline-flex ${isUp ? 'text-emerald-700' : 'text-rose-700'}`}>{isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{isUp ? '+' : ''}{asset.change24h.toFixed(2)}%</span>
                <div className="flex items-center justify-end gap-1.5">
                  <button type="button" onClick={() => selectForBuy(asset)} className="rounded-full bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-800">Buy</button>
                  <button type="button" onClick={() => setInfoAsset(asset)} aria-label={`Explain ${asset.name} market movement`} title="Explain this market" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"><Info size={16} /></button>
                </div>
                <div className="col-span-2 flex items-center justify-between pl-14 sm:hidden"><span className="text-xs font-bold text-slate-700">{formatPrice(asset.price)}</span><span className={`text-xs font-bold ${isUp ? 'text-emerald-700' : 'text-rose-700'}`}>{isUp ? '+' : ''}{asset.change24h.toFixed(2)}% today</span></div>
              </article>
            );
          })}
        </div>
        <div className="flex items-start gap-2 border-t border-amber-100 bg-amber-50/70 px-5 py-3 text-xs leading-relaxed text-amber-900 sm:px-6"><Info size={14} className="mt-0.5 shrink-0" /><span>Prices and percentage changes are fixed sample values, not live quotes. Tap the info button beside Buy for a plain-language explanation.</span></div>
      </section>

      <section id="order-panel" className="grid scroll-mt-8 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Selected asset</p><h2 className="mt-1 text-xl font-black text-slate-950">{selectedAsset.name} <span className="text-slate-400">({selectedAsset.symbol})</span></h2></div>
            <div className="text-right"><p className="text-xl font-black text-slate-900">{formatPrice(selectedAsset.price)}</p><p className={`text-xs font-bold ${selectedAsset.change24h >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{selectedAsset.change24h >= 0 ? '+' : ''}{selectedAsset.change24h.toFixed(2)}% · sample 24h</p></div>
          </div>
          <div className="mt-5 flex h-32 items-end gap-2 overflow-hidden rounded-2xl bg-gradient-to-b from-violet-50 to-white p-4">
            <div className="flex h-full w-full flex-col justify-between"><span className="text-[11px] font-semibold text-slate-400">Example price movement · not live</span><svg viewBox="0 0 500 90" preserveAspectRatio="none" className="h-20 w-full"><path d="M0 72 C45 60 45 72 90 55 S145 67 190 36 S245 52 290 29 S340 48 385 20 S445 35 500 8" fill="none" stroke="#7252d5" strokeWidth="3" strokeLinecap="round" /><path d="M0 72 C45 60 45 72 90 55 S145 67 190 36 S245 52 290 29 S340 48 385 20 S445 35 500 8 L500 90 L0 90Z" fill="#b8a8f6" opacity=".18" /></svg></div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold text-slate-950">Try a demo order</h2><p className="mt-0.5 text-xs text-slate-500">This only records a local preview.</p></div>
            <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button type="button" onClick={() => setOrderType('buy')} className={`rounded-lg px-3 py-2 ${orderType === 'buy' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600'}`}>Buy</button>
              <button type="button" onClick={() => setOrderType('sell')} className={`rounded-lg px-3 py-2 ${orderType === 'sell' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600'}`}>Sell</button>
            </div>
          </div>
          <form onSubmit={handleExecuteTrade} className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600" htmlFor="demo-amount">{orderType === 'buy' ? 'Spend amount in USDT' : 'Approximate USDT value to sell'}</label>
            <div className="relative -mt-2"><input id="demo-amount" type="number" min="5" step="5" required value={usdtAmount} onChange={(event) => setUsdtAmount(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-20 text-lg font-bold text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" /><span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">USDT</span></div>
            {quote && <div className="space-y-2 rounded-2xl bg-violet-50 p-4 text-xs text-slate-600">
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 font-bold text-violet-950"><Clock size={13} />Sample quote</span><button type="button" onClick={refreshQuote} className="flex items-center gap-1 font-semibold text-violet-800"><RefreshCw size={12} />Refresh</button></div>
              <div className="flex justify-between"><span>Example price</span><strong className="text-slate-900">{formatPrice(quote.executionPrice)}</strong></div>
              <div className="flex justify-between border-t border-violet-200 pt-2 font-bold text-slate-900"><span>Estimated asset amount</span><span>{estimatedTokens} {selectedAsset.symbol}</span></div>
              <p className="leading-relaxed text-amber-900">Estimate only. No wallet balance is checked and no money or asset will move.</p>
            </div>}
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-teal-800">Record demo {orderType}<ArrowRight size={16} /></button>
          </form>
          {tradeSuccess && <div role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950"><div className="mb-1 flex items-center gap-2 font-bold"><CheckCircle2 size={16} />Demo order recorded · nothing settled</div><p>Preview: ${tradeSuccess.usdtSpent} USDT for {tradeSuccess.tokensReceived} {tradeSuccess.asset} at {formatPrice(tradeSuccess.executionPrice)}.</p><p className="mt-1 text-[11px] text-emerald-800">Reference: {tradeSuccess.reference} · not a transaction hash</p></div>}
        </div>
      </section>

      <MarketInfoDialog asset={infoAsset} onClose={() => setInfoAsset(null)} />
    </div>
  );
}
