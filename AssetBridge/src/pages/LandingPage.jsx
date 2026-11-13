import React, { useState } from 'react';
import { ArrowRight, Send, Users, TrendingUp, ShieldCheck, Zap, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export default function LandingPage({ onNavigate }) {
  const [emailInput, setEmailInput] = useState('');

  const handleGetStarted = (e) => {
    e.preventDefault();
    onNavigate('signup');
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-gray-900 selection:text-white">
      
      {/* Top Header matching Samurai style with authentic AssetBridge identity */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('landing')}>
            <img src="/interlink-logo.png" alt="InterLink" className="w-9 h-9 object-contain" />
            <span className="font-extrabold text-lg tracking-tight text-gray-950">InterLink</span>
          </div>
          <span className="hidden md:inline-block text-xs text-gray-400 font-normal">
            / hello@interlink.africa
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-600">
          <button onClick={() => onNavigate('dashboard')} className="hover:text-black transition">Overview</button>
          <button onClick={() => onNavigate('remittance')} className="hover:text-black transition">Send Home</button>
          <button onClick={() => onNavigate('stokvel')} className="hover:text-black transition">Stokvel Pots</button>
          <button onClick={() => onNavigate('trading')} className="hover:text-black transition">Tokenised Equities</button>
          <button onClick={() => onNavigate('reserves')} className="hover:text-black transition">Proof of Reserves</button>
        </nav>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('login')}
            className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-black transition"
          >
            Log In
          </button>
          <button
            onClick={() => onNavigate('signup')}
            className="px-5 py-2.5 rounded-full bg-gray-950 text-white text-sm font-semibold hover:bg-black transition shadow-sm"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Main Hero Section with AssetBridge's authentic pitch */}
      <main className="max-w-5xl mx-auto px-6 pt-16 pb-20 text-center">
        
        {/* Real Product Tagline from Checkpoint 1 & Concept PDF */}
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-gray-950 leading-[1.08] mb-6">
          Trade global markets. <br className="hidden sm:inline" />
          Send money anywhere.
        </h1>

        {/* Authentic Subtitle from PDF Page 2 */}
        <p className="max-w-3xl mx-auto text-lg sm:text-xl text-gray-600 leading-relaxed font-normal mb-10">
          One mobile wallet where African users send and request stablecoins peer-to-peer, run community Stokvel savings pots, and trade tokenised equities live 24/7 with USDT.
        </p>

        {/* Center Inline Email Input Form */}
        <form onSubmit={handleGetStarted} className="max-w-md mx-auto flex items-center p-1.5 rounded-full border border-gray-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-gray-900 mb-4 transition">
          <div className="pl-4 pr-2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Your email address"
            className="flex-1 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
          />
          <button
            type="submit"
            className="px-6 py-2.5 rounded-full bg-gray-950 hover:bg-black text-white text-sm font-semibold transition shrink-0 shadow-sm"
          >
            Get Started
          </button>
        </form>

        <p className="text-xs text-gray-400 font-normal mb-16">
          *Own more. Trade smarter. Invest without boundaries.
        </p>

        {/* Smartphone Mockup with Real AssetBridge Multi-Asset Wallet UI */}
        <div className="relative max-w-4xl mx-auto pt-4 pb-16">
          
          {/* Ambient Glow */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[460px] h-48 bg-gradient-to-t from-emerald-600/20 via-sky-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

          {/* Left Floating Badge: Send Home in Local Currency (from solution) */}
          <div className="hidden lg:flex absolute top-20 left-2 z-20 flex-col items-start bg-[#F3E8FF] text-[#3B0764] p-5 rounded-3xl shadow-xl border border-purple-200 max-w-[230px] text-left transform -rotate-2 hover:rotate-0 transition duration-300">
            <div className="flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider text-purple-900">
              <Zap size={14} className="text-purple-700" />
              <span>Send Home</span>
            </div>
            <p className="text-xs font-semibold leading-snug text-purple-950 mb-1">
              Send $100 USDT → Receiver gets tKES instantly with only $0.20 fee.
            </p>
            <span className="text-[10px] text-purple-700 font-medium">95% lower fees than SWIFT bank wire</span>
          </div>

          {/* Right Floating Badge: Stokvel Pots (from solution) */}
          <div className="hidden lg:flex absolute top-20 right-2 z-20 flex-col items-start bg-[#DCFCE7] text-[#14532D] p-5 rounded-3xl shadow-xl border border-emerald-300 max-w-[240px] text-left transform rotate-2 hover:rotate-0 transition duration-300">
            <div className="flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider text-emerald-900">
              <Users size={14} className="text-emerald-700" />
              <span>Stokvel Pots</span>
            </div>
            <p className="text-xs font-semibold leading-snug text-emerald-950 mb-1">
              Friends pool $20/month. The contract handles rotation payouts and co-investing.
            </p>
            <span className="text-[10px] text-emerald-700 font-medium">Zero counterparty risk</span>
          </div>

          {/* iPhone Frame */}
          <div className="relative z-10 max-w-[340px] sm:max-w-[360px] mx-auto bg-gray-950 rounded-[3rem] p-3 shadow-2xl border-4 border-gray-900 text-gray-900">
            
            {/* Phone Screen Container: True AssetBridge Mobile Wallet */}
            <div className="bg-[#F8FAFC] rounded-[2.5rem] p-5 pt-7 text-left border border-gray-100 overflow-hidden shadow-inner flex flex-col justify-between">
              
              {/* Phone Header */}
              <div className="flex items-center justify-between text-xs font-semibold text-gray-800 mb-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>InterLink Wallet</span>
                </span>
                <span className="text-[11px] text-gray-400 font-mono">0x884a...12be</span>
              </div>

              {/* Main Wallet Card showing actual AssetBridge Balance */}
              <div className="rounded-2xl p-5 text-white bg-gradient-to-tr from-gray-950 via-slate-900 to-indigo-950 shadow-xl border border-white/10 relative overflow-hidden mb-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[11px] font-medium text-gray-400">Total Balance</span>
                    <div className="text-2xl font-black font-mono tracking-tight text-white mt-0.5">
                      $17,643.41
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    USDT Testnet
                  </span>
                </div>

                <div className="flex justify-between items-end text-[11px] text-gray-300 pt-2 border-t border-white/10">
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase">Account</span>
                    <div className="font-semibold text-white">Lucas Maluleke</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-gray-400 uppercase">Active Holdings</span>
                    <div className="font-mono text-emerald-400">+1.82% 24h</div>
                  </div>
                </div>
              </div>

              {/* Wallet Action Buttons matching core features */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <button
                  onClick={() => onNavigate('remittance')}
                  className="p-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Send size={13} className="text-indigo-600" />
                  <span>Send Home</span>
                </button>
                <button
                  onClick={() => onNavigate('stokvel')}
                  className="p-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Users size={13} className="text-emerald-600" />
                  <span>Stokvel Pots</span>
                </button>
              </div>

              {/* Asset Holdings Row in Phone (from PDF: tAAPL & tKES) */}
              <div className="space-y-2 mb-4">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1">
                  Your Assets
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-gray-200/80 flex items-center justify-between text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-[10px]">
                      AAPL
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Apple Token</div>
                      <div className="text-[10px] text-gray-400">1.25 tAAPL</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-gray-900">$285.56</div>
                    <div className="text-[10px] text-emerald-600 font-semibold">+1.82%</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-gray-200/80 flex items-center justify-between text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px]">
                      KES
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Kenyan Shilling</div>
                      <div className="text-[10px] text-gray-400">12,950 tKES</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-gray-900">$100.00</div>
                    <div className="text-[10px] text-emerald-600 font-semibold">+0.15%</div>
                  </div>
                </div>
              </div>

              {/* Launch to Dashboard */}
              <button
                onClick={() => onNavigate('dashboard')}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-950 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow"
              >
                <span>Open Dashboard</span>
                <ArrowRight size={13} />
              </button>

            </div>
          </div>
        </div>

        {/* 3 Core Solution Feature Columns from PDF */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left mt-6">
          {/* Feature 1 */}
          <div className="p-7 rounded-3xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition">
            <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-5">
              <Send size={22} />
            </div>
            <h3 className="text-lg font-bold text-gray-950 mb-2">Send Home in Local Currency</h3>
            <p className="text-sm text-gray-600 leading-relaxed font-normal">
              Send test USDT by username, phone or QR code. The receiver gets local-currency tokens (tKES, tZAR, tNGN) directly into their mobile money wallet in seconds with visible exchange rates and low fees.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-7 rounded-3xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-5">
              <Users size={22} />
            </div>
            <h3 className="text-lg font-bold text-gray-950 mb-2">Stokvel & Chama Pots</h3>
            <p className="text-sm text-gray-600 leading-relaxed font-normal">
              A group wallet where friends each contribute USDT every month. In rotation mode, each round pays out the full lump sum to one member; in investment mode, the group co-buys tokenised equities together.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-7 rounded-3xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-5">
              <TrendingUp size={22} />
            </div>
            <h3 className="text-lg font-bold text-gray-950 mb-2">Tokenised Equities & Currencies</h3>
            <p className="text-sm text-gray-600 leading-relaxed font-normal">
              Buy, sell and swap fractional equities (tAAPL, tTSLA, tNVDA) and tokenised currencies live 24/7. Backend signs short-lived quotes with transparent spreads and on-chain settlement in seconds.
            </p>
          </div>
        </section>

      </main>

      {/* Clean Human Footer */}
      <footer className="border-t border-gray-100 py-10 text-center text-xs text-gray-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/interlink-logo.png" alt="InterLink" className="w-5 h-5 object-contain" />
            <span className="font-bold text-gray-950">InterLink</span>
            <span>· Own More. Trade Smarter. Invest Without Boundaries.</span>
          </div>
          <div className="flex items-center gap-6 text-gray-600 font-medium">
            <button onClick={() => onNavigate('dashboard')} className="hover:text-black">Overview</button>
            <button onClick={() => onNavigate('remittance')} className="hover:text-black">Send Home</button>
            <button onClick={() => onNavigate('stokvel')} className="hover:text-black">Stokvel Pots</button>
            <button onClick={() => onNavigate('trading')} className="hover:text-black">Trading</button>
            <button onClick={() => onNavigate('reserves')} className="hover:text-black">Reserve Panel</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
