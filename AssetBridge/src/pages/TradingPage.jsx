import React, { useState, useEffect } from 'react';
import { TrendingUp, RefreshCw, Clock, CheckCircle2, ShieldCheck, ArrowRightLeft } from 'lucide-react';
import { TOKENS } from '../utils/constants';
import { marketService } from '../services/marketService';
import { activityService } from '../services/activityService';

export default function TradingPage({ user }) {
  const storageUserId = user?.email || user?.id || 'demo';
  const [selectedAsset, setSelectedAsset] = useState(TOKENS[1]); // tAAPL
  const [orderType, setOrderType] = useState('buy'); // 'buy' | 'sell'
  const [usdtAmount, setUsdtAmount] = useState('25');
  const [quote, setQuote] = useState(null);
  const [tradeSuccess, setTradeSuccess] = useState(null);

  // Fetch signed quote
  const refreshQuote = () => {
    const q = marketService.getSignedQuote(selectedAsset.symbol);
    setQuote(q);
  };

  useEffect(() => {
    refreshQuote();
  }, [selectedAsset]);

  const tokensBought = quote ? (Number(usdtAmount) / quote.executionPrice).toFixed(4) : 0;

  const handleExecuteTrade = (e) => {
    e.preventDefault();
    setTradeSuccess({
      asset: selectedAsset.symbol,
      type: orderType.toUpperCase(),
      usdtSpent: usdtAmount,
      tokensReceived: tokensBought,
      executionPrice: quote.executionPrice,
      txHash: `demo-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
    });
    activityService.addActivity({
      type: 'trade',
      title: `Demo ${orderType} order · ${selectedAsset.symbol}`,
      detail: `$${usdtAmount} USDT · indicative quote only; no funds or assets moved`,
      status: 'simulated',
      reference: `demo-${Date.now()}`,
    }, storageUserId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-slate-800 rounded-3xl p-6 sm:p-8 text-white relative shadow-xl">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-sky-300 mb-3 border border-white/10">
            <TrendingUp size={14} />
            <span>Market preview · simulated quotes</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Tokenised asset market preview
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
            Indicative sample prices and locally generated quotes. Orders are recorded as demo activity only; this app is not connected to a broker, custodian, or blockchain settlement.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Asset Selection & Chart (~7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Asset Tabs */}
          <div className="flex flex-wrap gap-2">
            {TOKENS.filter((t) => t.type !== 'stablecoin').map((t) => (
              <button
                key={t.symbol}
                onClick={() => {
                  setSelectedAsset(t);
                  setTradeSuccess(null);
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 border ${
                  selectedAsset.symbol === t.symbol
                    ? 'bg-gray-900 text-white border-gray-900 shadow'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span>{t.symbol}</span>
                <span className={t.change24h >= 0 ? 'text-emerald-500' : 'text-rose-400'}>
                  {t.change24h >= 0 ? `+${t.change24h}%` : `${t.change24h}%`}
                </span>
              </button>
            ))}
          </div>

          {/* Asset Live Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {selectedAsset.type === 'equity' ? 'Fractional US Equity' : 'Tokenised African FX'}
                </span>
                <h3 className="text-2xl font-black text-gray-900">
                  {selectedAsset.name} ({selectedAsset.symbol})
                </h3>
              </div>

              <div className="text-right">
                <div className="text-2xl font-black text-gray-900 font-mono">
                  ${selectedAsset.price >= 1 ? selectedAsset.price.toFixed(2) : selectedAsset.price.toFixed(4)}
                </div>
                <span
                  className={`text-xs font-bold ${
                    selectedAsset.change24h >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {selectedAsset.change24h >= 0 ? `+${selectedAsset.change24h}% (24h)` : `${selectedAsset.change24h}% (24h)`}
                </span>
              </div>
            </div>

            {/* Trading Chart Mockup */}
            <div className="h-44 bg-gray-50 rounded-2xl p-4 flex flex-col justify-between border border-gray-100 relative">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Illustrative sample chart</span>
                <span className="text-amber-700 font-bold">● Sample chart · not live</span>
              </div>

              {/* Chart Line */}
              <svg className="w-full h-24 overflow-visible" viewBox="0 0 400 80">
                <path
                  d="M0,60 Q50,30 100,45 T200,20 T300,50 T400,15"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>

              <div className="flex justify-between text-[11px] text-gray-400 font-mono">
                <span>10:00</span>
                <span>14:00</span>
                <span>18:00</span>
                <span>22:00</span>
                <span>Now</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Execution Console (~5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Demo order preview</h3>
              
              <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setOrderType('buy')}
                  className={`px-3 py-1 rounded-lg transition ${
                    orderType === 'buy' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-black'
                  }`}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('sell')}
                  className={`px-3 py-1 rounded-lg transition ${
                    orderType === 'sell' ? 'bg-rose-600 text-white' : 'text-gray-600 hover:text-black'
                  }`}
                >
                  Sell
                </button>
              </div>
            </div>

            <form onSubmit={handleExecuteTrade} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                  Amount in USDT
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    step="5"
                    required
                    value={usdtAmount}
                    onChange={(e) => setUsdtAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
                    USDT
                  </span>
                </div>
              </div>

              {/* Local demo quote details */}
              {quote && (
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-indigo-950 font-bold flex items-center gap-1.5">
                      <Clock size={13} className="text-indigo-600" />
                      <span>Local demo quote</span>
                    </span>
                    <button
                      type="button"
                      onClick={refreshQuote}
                      className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                    >
                      <RefreshCw size={11} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>Indicative sample price:</span>
                    <span className="font-bold text-gray-900 font-mono">${quote.executionPrice}</span>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>Illustrative spread:</span>
                    <span className="text-gray-900">{quote.spreadPercent}</span>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>Demo identifier:</span>
                    <span className="font-mono text-[10px] text-gray-500 truncate max-w-[140px]">
                      {quote.signature}
                    </span>
                  </div>

                  <div className="flex justify-between text-indigo-900 pt-2 border-t border-indigo-200 font-bold text-sm">
                    <span>You Receive:</span>
                    <span className="text-indigo-700">{tokensBought} {selectedAsset.symbol}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-[#141518] hover:bg-black text-white text-sm font-bold rounded-xl shadow-lg transition active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span>Confirm {orderType.toUpperCase()} {tokensBought} {selectedAsset.symbol}</span>
              </button>
            </form>
          </div>

          {/* Trade Success Notice */}
          {tradeSuccess && (
            <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-sm mb-1 text-emerald-800">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Demo order recorded · no settlement</span>
              </div>
              <p>
                Preview: <strong>${tradeSuccess.usdtSpent} USDT</strong> for{' '}
                <strong>{tradeSuccess.tokensReceived} {tradeSuccess.asset}</strong> at ${tradeSuccess.executionPrice}.
              </p>
              <div className="text-[11px] font-mono text-emerald-700 mt-1">
                Demo reference: {tradeSuccess.txHash} · not a blockchain transaction
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

