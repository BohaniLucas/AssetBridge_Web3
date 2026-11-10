import {
  Wallet, Send, Users, TrendingUp, ShieldCheck, Search, Bell,
  ArrowUpRight, ArrowRightLeft, MoreHorizontal, ArrowRight, Download,
  ChevronRight, LogOut, CircleDollarSign, BriefcaseBusiness, Globe2,
  Info, Activity, Layers3, ArrowUp,
} from 'lucide-react';

export default function DashboardPage({ currentView, onNavigate, onLogout, user, children }) {
  const navItems = [
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'remittance', label: 'Send Home', icon: Send },
    { id: 'stokvel', label: 'Stokvel Pots', icon: Users },
    { id: 'trading', label: 'Trade Markets', icon: TrendingUp },
    { id: 'reserves', label: 'Reserve Panel', icon: ShieldCheck },
  ];
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Wallet';
  const viewTitle = navItems.find((item) => item.id === currentView)?.label || 'Wallet';

  // Quick Actions (Pastel Theme)
  const quickActions = [
    { id: 'remittance', label: 'Send', icon: Send, bg: 'bg-[#E5F9F0]', text: 'text-emerald-700', iconBg: 'bg-emerald-100', hover: 'hover:shadow-emerald-500/20' },
    { id: 'wallet', label: 'Receive', icon: Download, bg: 'bg-[#EAF3FF]', text: 'text-blue-700', iconBg: 'bg-blue-100', hover: 'hover:shadow-blue-500/20' },
    { id: 'trading', label: 'Swap', icon: ArrowRightLeft, bg: 'bg-[#F3EBFF]', text: 'text-purple-700', iconBg: 'bg-purple-100', hover: 'hover:shadow-purple-500/20' },
    { id: 'trading', label: 'Invest', icon: TrendingUp, bg: 'bg-[#FFF4E5]', text: 'text-amber-700', iconBg: 'bg-amber-100', hover: 'hover:shadow-amber-500/20' },
  ];

  // Premium Asset Cards
  const assets = [
    {
      symbol: 'tUSDT',
      name: 'Tether USD',
      type: 'Stablecoin',
      detail: 'USD-pegged token',
      amount: '17,643.41',
      usdValue: '$17,643.41',
      change: '+0.00%',
      isPositive: true,
      bg: 'bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5]',
      border: 'border-emerald-100',
      text: 'text-emerald-900',
      icon: CircleDollarSign,
      iconColor: 'text-emerald-700',
      iconBg: 'bg-emerald-100',
    },
    {
      symbol: 'tAAPL',
      name: 'Apple Inc.',
      type: 'Equity token',
      detail: 'Fractional share',
      amount: '1.25',
      usdValue: '$285.56',
      change: '+1.82%',
      isPositive: true,
      bg: 'bg-gradient-to-br from-[#F0F5FF] to-[#E0E7FF]',
      border: 'border-blue-100',
      text: 'text-blue-900',
      icon: BriefcaseBusiness,
      iconColor: 'text-blue-700',
      iconBg: 'bg-blue-100',
    },
    {
      symbol: 'tKES',
      name: 'Kenyan Shilling',
      type: 'FX token',
      detail: 'Kenyan shilling',
      amount: '12,950',
      usdValue: '$100.00',
      change: '+0.15%',
      isPositive: true,
      bg: 'bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7]',
      border: 'border-amber-100',
      text: 'text-amber-900',
      icon: Globe2,
      iconColor: 'text-amber-700',
      iconBg: 'bg-amber-100',
    },
  ];

  // Market Table Data
  const marketList = [
    { symbol: 'tAAPL', name: 'Apple Inc.', price: '$175.40', change: '+0.85%', marketCap: '$2.8T', isPositive: true },
    { symbol: 'tZAR', name: 'South African Rand', price: '$0.053', change: '-0.12%', marketCap: '$45M', isPositive: false },
    { symbol: 'tTSLA', name: 'Tesla Inc.', price: '$210.15', change: '+1.40%', marketCap: '$670B', isPositive: true },
    { symbol: 'tNGN', name: 'Nigerian Naira', price: '$0.0006', change: '+0.05%', marketCap: '$12M', isPositive: true },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-100 lg:h-screen lg:flex-row lg:overflow-hidden">

      <aside className="z-20 flex w-full shrink-0 flex-col border-b border-slate-100 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] lg:h-screen lg:w-[280px] lg:border-b-0 lg:border-r">
        <div className="flex h-16 shrink-0 items-center px-5 lg:h-24 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/20 transform rotate-3">
              <div className="w-4 h-4 border-2 border-white rounded-sm transform -rotate-3" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">AssetBridge</span>
          </div>
        </div>

        <nav className="flex min-w-0 flex-1 gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:gap-2 lg:overflow-x-visible lg:px-6 lg:py-8">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-300 lg:w-full lg:gap-4 lg:px-4 lg:py-3.5 lg:text-[15px] ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/15'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
                {isActive && <ChevronRight size={16} className="hidden opacity-50 lg:ml-auto lg:block" />}
              </button>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center justify-between gap-3 p-6 lg:flex">
          <div className="flex min-w-0 items-center gap-3 rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-blue-100 font-bold text-blue-800 shadow-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="truncate text-left text-[14px] font-semibold tracking-tight">{displayName}</span>
          </div>
          <button
            onClick={onLogout}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:h-screen">

        {/* Abstract Background Glows */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-400/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-400/5 blur-[120px] rounded-full pointer-events-none" />

        {/* 2. TOP HEADER */}
        <header className="z-10 flex shrink-0 items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:h-24 lg:px-10">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{viewTitle}</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Glassmorphic Search */}
            <div className="relative group hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search assets, pots, or users..."
                className="w-[300px] bg-white/60 backdrop-blur-xl border border-white focus:border-blue-100 focus:bg-white rounded-full py-2.5 pl-12 pr-6 text-[14px] font-medium outline-none shadow-sm shadow-slate-200/50 transition-all placeholder:text-slate-400"
              />
            </div>

            <button className="relative w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm shadow-slate-200/50 border border-slate-100 hover:scale-105 transition-transform text-slate-600">
              <Bell size={20} />
              <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full" />
            </button>
            <button
              onClick={onLogout}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-600 transition hover:text-rose-600 lg:hidden"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="z-10 min-h-0 flex-1 overflow-y-auto px-5 pb-12 sm:px-8 lg:px-10">
          {currentView === 'wallet' ? (
            <div className="space-y-10">

          {/* ROW 1: PORTFOLIO & QUICK ACTIONS */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-8">

            {/* Luxurious Portfolio Card */}
            <div className="xl:col-span-8 bg-gradient-to-br from-[#101936] via-[#111d3a] to-[#071124] rounded-[2.5rem] p-7 sm:p-10 flex flex-col justify-between relative overflow-hidden shadow-2xl shadow-blue-950/20 border border-white/10">
              {/* Premium Background Effects */}
              <div className="absolute -top-20 right-0 w-[440px] h-[360px] bg-gradient-to-bl from-cyan-400/25 via-blue-600/15 to-transparent blur-[70px] rounded-full pointer-events-none" />
              <div className="absolute -bottom-16 -left-20 w-80 h-60 bg-violet-500/15 blur-[70px] rounded-full pointer-events-none" />

              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="text-slate-300 text-[13px] font-semibold tracking-widest uppercase">Total Balance</h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      DEMO WALLET
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                    <span className="text-4xl font-bold tracking-tighter text-white sm:text-5xl">
                      $17,643<span className="text-slate-500">.41</span>
                    </span>
                    <div className="mb-1 flex items-center gap-1 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[13px] font-semibold text-emerald-300">
                      <TrendingUp size={14} />
                      +2.45%
                    </div>
                  </div>
                </div>
                <button aria-label="More wallet options" className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors backdrop-blur-md">
                  <MoreHorizontal size={20} />
                </button>
              </div>

              <div className="relative z-10 mt-8">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">Illustrative portfolio trend</span>
                  <span className="text-slate-400">Demo data</span>
                </div>
                <div className="relative h-28 sm:h-32">
                {/* Tooltip dot */}
                <div className="absolute left-[65%] top-[10%] -translate-x-1/2 flex flex-col items-center z-10">
                  <div className="bg-white text-slate-900 text-[12px] font-bold py-1.5 px-3 rounded-xl shadow-xl tracking-tight">
                    $18,050.00
                  </div>
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full border-[3px] border-white shadow-lg mt-2 relative">
                    <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-50" />
                  </div>
                </div>

                <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 400 100">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.42" />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d="M0,25 H400 M0,60 H400 M0,95 H400" stroke="white" strokeOpacity="0.08" strokeDasharray="4 7" />
                  <path d="M0,70 Q40,65 70,80 T150,50 T220,60 T260,30 T320,40 T400,20 L400,100 L0,100 Z" fill="url(#chartGrad)" />
                  <path d="M0,70 Q40,65 70,80 T150,50 T220,60 T260,30 T320,40 T400,20" fill="none" stroke="#67E8F9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200">
                      <Layers3 size={15} />
                    </span>
                    <span><strong className="text-white">3</strong> assets held</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <ArrowUp size={14} />
                    <span>Portfolio trend</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions (2x2 Grid) */}
            <div className="xl:col-span-4 grid grid-cols-2 gap-5">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={`${action.id}-${action.label}`}
                    onClick={() => onNavigate(action.id)}
                    className={`${action.bg} ${action.text} ${action.hover} rounded-[2rem] p-6 flex flex-col justify-between items-start group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/50`}
                  >
                    <div className={`w-12 h-12 rounded-2xl ${action.iconBg} flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                      <Icon size={22} strokeWidth={2.5} />
                    </div>
                    <div className="flex w-full items-end justify-between">
                      <span className="font-semibold tracking-tight text-[16px]">{action.label}</span>
                      <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ROW 2: YOUR ASSETS (Glass Cards) */}
          <section>
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">Your Assets</h3>
              <button onClick={() => onNavigate('wallet')} className="text-[14px] font-semibold text-blue-600 hover:text-blue-700">View Portfolio</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {assets.map((asset) => (
                <div
                  key={asset.symbol}
                  className={`${asset.bg} border ${asset.border} ${asset.text} rounded-[2rem] p-7 relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
                >
                  {/* Subtle Glass Pattern */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 blur-[40px] rounded-full pointer-events-none group-hover:bg-white/60 transition-colors" />

                  <div className="relative z-10 flex justify-between items-start mb-10">
                    <div className={`w-12 h-12 rounded-2xl ${asset.iconBg} shadow-sm flex items-center justify-center border border-white/70`}>
                        <asset.icon size={22} className={asset.iconColor} strokeWidth={2.2} />
                    </div>
                      <button onClick={() => onNavigate('trading')} aria-label={`View ${asset.name} in markets`} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50 hover:bg-white/80 transition-colors backdrop-blur-sm">
                      <ArrowUpRight size={16} />
                    </button>
                  </div>

                  <div className="relative z-10">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold opacity-75">{asset.name}</p>
                        <span className="whitespace-nowrap rounded-full border border-white/70 bg-white/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide opacity-75">{asset.type}</span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <h4 className="text-2xl font-bold tracking-tight">{asset.amount}</h4>
                        <span className="text-[14px] font-semibold opacity-60 uppercase">{asset.symbol.replace('t', '')}</span>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-[15px] font-medium opacity-80">{asset.usdValue}</span>
                      <span className={`text-[12px] font-bold px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-sm shadow-sm ${asset.isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {asset.change}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 border-t border-white/60 pt-3 text-xs font-medium opacity-70">
                      <Info size={14} />
                      <span>{asset.detail}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ROW 3: MARKET OVERVIEW & STOKVEL PROMO */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-8">

            {/* Market Table */}
            <div className="xl:col-span-7 2xl:col-span-8 bg-white rounded-[2.5rem] p-6 sm:p-8 lg:p-10 shadow-[0_12px_36px_rgba(15,23,42,0.06)] border border-slate-100">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">Market Overview</h3>
                  <p className="mt-1 text-xs text-slate-500">Explore assets available to trade</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
                  <Activity size={13} />
                  Markets open
                </span>
                <button aria-label="More market options" className="hidden p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400 sm:inline-flex">
                  <MoreHorizontal size={20} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[12px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100">
                      <th className="pb-4 pl-2">Asset</th>
                      <th className="pb-4">Price</th>
                      <th className="pb-4">Change</th>
                      <th className="pb-4 hidden sm:table-cell">Market Cap</th>
                      <th className="pb-4 text-right pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50/80">
                    {marketList.map((token) => (
                      <tr key={token.symbol} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="py-5 pl-2 flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-[13px] shadow-sm ${
                            token.isPositive ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white' : 'bg-gradient-to-br from-rose-400 to-orange-500 text-white'
                          }`}>
                            {token.symbol.replace('t', '')}
                          </div>
                          <div>
                            <div className="font-bold text-[15px] text-slate-900 tracking-tight">{token.name}</div>
                            <div className="text-[13px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">{token.symbol}</div>
                          </div>
                        </td>
                        <td className="py-5 font-semibold text-slate-900 text-[15px]">
                          {token.price}
                        </td>
                        <td className="py-5">
                          <span className={`inline-flex items-center justify-center text-[13px] font-bold px-3 py-1.5 rounded-full ${
                            token.isPositive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {token.change}
                          </span>
                        </td>
                        <td className="py-5 text-[14px] text-slate-500 font-medium hidden sm:table-cell">
                          {token.marketCap}
                        </td>
                        <td className="py-5 text-right pr-2">
                          <button onClick={() => onNavigate('trading')} className="px-5 py-2.5 bg-blue-50 border border-blue-100 hover:border-blue-300 hover:bg-blue-100 text-blue-800 rounded-2xl text-[14px] font-semibold transition-all">
                            Trade
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stokvel Promo Card (Dark Luxury Theme) */}
            <div className="xl:col-span-5 2xl:col-span-4 bg-[#091122] rounded-[2.5rem] p-10 flex flex-col justify-between relative overflow-hidden shadow-2xl shadow-indigo-900/20 group">
              {/* Cinematic Lighting Effects */}
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none group-hover:bg-indigo-500/30 transition-colors duration-700" />
              <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none" />

              <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                <Users size={120} strokeWidth={0.5} className="text-indigo-300 transform rotate-12" />
              </div>

              <div className="relative z-10">
                {/* <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[12px] font-bold text-indigo-300 mb-8 tracking-wide uppercase"> */}
                  {/* <Sparkles size={14} /> */}
                  {/* <span>Group </span> */}
                {/* </div> */}

                <h3 className="text-4xl font-bold leading-tight mb-4 tracking-tight text-white">
                  Build wealth <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400">together.</span>
                </h3>

                <p className="text-[15px] text-slate-400 leading-relaxed mb-8 font-medium">
                  Create a Stokvel Pot. Pool USDT with friends safely via smart contracts. No banks, no single point of failure.
                </p>
              </div>

              <div className="relative z-10 space-y-4">
                <button onClick={() => onNavigate('stokvel')} className="w-full py-4 px-6 bg-white text-slate-900 hover:bg-slate-100 hover:scale-[1.02] font-bold text-[16px] rounded-2xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2">
                  <span>Start a Stokvel</span>
                  <ArrowUpRight size={18} className="text-slate-500" />
                </button>
                <button onClick={() => onNavigate('stokvel')} className="w-full py-4 px-6 bg-transparent text-white hover:bg-white/5 font-semibold text-[15px] rounded-2xl transition-colors border border-white/10">
                  Learn How it Works
                </button>
              </div>
            </div>

          </section>

            </div>
          ) : children}
        </main>
      </div>
    </div>
  );
}