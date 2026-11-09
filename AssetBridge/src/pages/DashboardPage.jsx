import React, { useState } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Star, MoreVertical, SlidersHorizontal, Sparkles } from 'lucide-react';
import { TOKENS } from '../utils/constants';

export default function DashboardPage({ onNavigate }) {
  const [timeframe, setTimeframe] = useState('1W');
  const [filterType, setFilterType] = useState('all');

  const assets = [
    {
      symbol: 'tUSDT',
      name: 'Tether USD',
      amount: '17,643.41',
      usdValue: '$ 17,643.41',
      change: '+ 0.00%',
      isPositive: true,
      bg: 'bg-[#F2EDFD]', // soft lavender/purple like Image 1
      icon: '💵',
    },
    {
      symbol: 'tAAPL',
      name: 'Apple Token',
      amount: '1.25 tAAPL',
      usdValue: '$ 285.56',
      change: '+ 1.82%',
      isPositive: true,
      bg: 'bg-[#EAF7EE]', // soft mint/green like Image 1
      icon: '🍏',
    },
    {
      symbol: 'tKES',
      name: 'Kenyan Shilling',
      amount: '12,950 tKES',
      usdValue: '$ 100.00',
      change: '+ 0.15%',
      isPositive: true,
      bg: 'bg-[#FEF6E6]', // soft warm peach/yellow like Image 1
      icon: '🇰🇪',
    },
  ];

  const marketList = TOKENS.map(t => ({
    symbol: t.symbol,
    name: t.name,
    price: `$${t.price >= 1 ? t.price.toFixed(2) : t.price.toFixed(4)}`,
    change: t.change24h >= 0 ? `+${t.change24h}%` : `${t.change24h}%`,
    isPositive: t.change24h >= 0,
    marketCap: t.type === 'equity' ? '$3.4T' : t.type === 'stablecoin' ? '$120B' : '$45M',
    type: t.type,
  }));

  return (
    <div className="space-y-6">
      {/* Top Row: Portfolio Card (Left) & Your Assets (Right) matching Image 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Portfolio Balance Card (Left, ~5 cols) matching Image 1 */}
        <div className="lg:col-span-5 bg-[#E8F2FD] rounded-3xl p-6 flex flex-col justify-between border border-[#D5E6FA] relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Portfolio balance
              </span>
              <div className="text-3xl font-extrabold text-gray-900 mt-1">
                $ 17,643.41
              </div>
            </div>

            <button className="text-gray-400 hover:text-gray-600 p-1">
              <MoreVertical size={18} />
            </button>
          </div>

          {/* Sparkline & floating tooltip matching Image 1 */}
          <div className="relative my-6 h-28 flex items-center">
            {/* Tooltip dot */}
            <div className="absolute left-[62%] top-0 -translate-x-1/2 flex flex-col items-center z-10">
              <div className="bg-[#141518] text-white text-[11px] font-bold py-1 px-3 rounded-full shadow-md">
                $27,483.00
              </div>
              <div className="w-2 h-2 bg-[#141518] rotate-45 -mt-1" />
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white shadow-sm mt-3" />
            </div>

            {/* SVG Chart Wave */}
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 300 80">
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,50 Q40,48 70,52 T140,45 T190,30 T210,65 T250,55 T300,50 L300,80 L0,80 Z"
                fill="url(#blueGrad)"
              />
              <path
                d="M0,50 Q40,48 70,52 T140,45 T190,30 T210,65 T250,55 T300,50"
                fill="none"
                stroke="#60A5FA"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Timeframe Tabs matching Image 1 */}
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 pt-2 border-t border-blue-100/60">
            {['1H', '24H', '1W', '1M', '1Y', 'ALL'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`py-1 px-2.5 rounded-lg transition ${
                  timeframe === tf ? 'bg-white text-gray-900 font-bold shadow-sm' : 'hover:text-gray-900'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Your Assets Cards (Right, ~7 cols) matching Image 1 */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-lg font-bold text-gray-900">Your Assets</h3>
            <button
              onClick={() => onNavigate('trading')}
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1"
            >
              <SlidersHorizontal size={14} />
              <span>Manage</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {assets.map((item) => (
              <div
                key={item.symbol}
                className={`${item.bg} rounded-3xl p-5 flex flex-col justify-between border border-black/5 hover:shadow-md transition`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold text-gray-900 leading-tight">
                      {item.amount}
                    </h4>
                    <span className="text-xs text-gray-500 font-medium">
                      {item.usdValue}
                    </span>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreVertical size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-6 pt-2">
                  <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-sm font-bold">
                    {item.icon}
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      item.isPositive ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {item.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Market Overview (Left) & Promo/Stokvel Card (Right) matching Image 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
        {/* Market Table (Left, ~8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">Market is down 0.80%</span>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>

            <div className="flex items-center gap-2">
              <select className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700 focus:outline-none">
                <option>24h</option>
                <option>7d</option>
                <option>30d</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700 focus:outline-none"
              >
                <option value="all">All Assets</option>
                <option value="equity">Tokenised Equities</option>
                <option value="currency">African FX Tokens</option>
              </select>
            </div>
          </div>

          {/* Table matching Image 1 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-gray-400 border-b border-gray-100 pb-3">
                  <th className="pb-3 font-normal">Name</th>
                  <th className="pb-3 font-normal">Price</th>
                  <th className="pb-3 font-normal">Change</th>
                  <th className="pb-3 font-normal">Market Cap</th>
                  <th className="pb-3 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {marketList
                  .filter((item) => filterType === 'all' || item.type === filterType)
                  .map((token) => (
                    <tr key={token.symbol} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 pr-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                          {token.symbol.replace('t', '')}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 leading-tight">
                            {token.name}
                          </div>
                          <div className="text-xs text-gray-400 uppercase font-semibold">
                            {token.symbol}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 font-bold text-gray-900 font-mono">
                        {token.price}
                      </td>

                      <td className="py-3.5">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            token.isPositive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {token.change}
                        </span>
                      </td>

                      <td className="py-3.5 text-xs text-gray-500 font-medium">
                        {token.marketCap}
                      </td>

                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => onNavigate('trading')}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-xs font-semibold transition"
                        >
                          Trade
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Promo Card (Right, ~4 cols) matching Image 1 Dark Card */}
        <div className="lg:col-span-4 bg-[#141518] text-white rounded-3xl p-7 flex flex-col justify-between shadow-xl relative overflow-hidden">
          {/* Subtle geometric wireframe lines like Image 1 */}
          <div className="absolute -bottom-8 -right-8 w-44 h-44 border border-white/10 rounded-3xl rotate-12 pointer-events-none" />
          <div className="absolute -bottom-4 -right-4 w-44 h-44 border border-white/5 rounded-3xl rotate-45 pointer-events-none" />

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-amber-300 mb-4 border border-white/10">
              <Sparkles size={12} />
              <span>Smart Contract Feature</span>
            </div>

            <h3 className="text-2xl font-bold leading-tight mb-2">
              Save in a <span className="underline decoration-sky-400">Stokvel Pot!</span>
            </h3>

            <p className="text-xs text-gray-300 leading-relaxed mb-6">
              Friends pool $20 USDT every month. Rotational payouts unlock safely once all 5 members contribute. No bank fees or single custodian risk.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => onNavigate('stokvel')}
              className="w-full py-3 px-4 bg-white text-gray-900 hover:bg-gray-100 font-bold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <span>Explore Stokvel Demo</span>
              <ArrowUpRight size={16} />
            </button>

            <button
              onClick={() => onNavigate('remittance')}
              className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition"
            >
              Send Remittance (tKES / tZAR)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

