import React, { useState } from 'react';
import { ArrowRight, Shield, Zap, TrendingUp, Users, Send, CheckCircle2, ChevronRight, Lock } from 'lucide-react';

export default function LandingPage({ onNavigate }) {
  const [emailInput, setEmailInput] = useState('');

  const handleGetStarted = (e) => {
    e.preventDefault();
    onNavigate('signup');
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-gray-900 selection:text-white">
      {/* Top Navigation Bar matching Image 3 */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('landing')}>
            <div className="w-8 h-8 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold text-sm">
              AB
            </div>
            <span className="font-extrabold text-lg tracking-tight">AssetBridge</span>
          </div>
          <span className="hidden md:inline-block text-xs text-gray-400 font-mono">
            / build.africa@assetbridge.xyz
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-600">
          <button onClick={() => onNavigate('dashboard')} className="hover:text-black transition">Overview</button>
          <button onClick={() => onNavigate('remittance')} className="hover:text-black transition">Send Home (KES/ZAR)</button>
          <button onClick={() => onNavigate('stokvel')} className="hover:text-black transition">Stokvel Pots</button>
          <button onClick={() => onNavigate('trading')} className="hover:text-black transition">Tokenised Equities</button>
          <button onClick={() => onNavigate('reserves')} className="hover:text-black transition">Proof of Reserves</button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('login')}
            className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-black transition"
          >
            Log In
          </button>
          <button
            onClick={() => onNavigate('signup')}
            className="px-5 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-black transition shadow-sm"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Main Hero Section matching Image 3 */}
      <main className="max-w-5xl mx-auto px-6 pt-16 pb-24 text-center">
        {/* Track Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-800 mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Mobile Money & P2P + Real-World Assets Hackathon Solution</span>
        </div>

        {/* Big Bold Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.08] mb-6">
          Trade global markets. <br className="hidden sm:inline" />
          Send money anywhere.
        </h1>

        {/* Subhead */}
        <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-500 leading-relaxed mb-10">
          One mobile wallet where African users send stablecoins peer-to-peer, run community Stokvel savings pots, and trade tokenised equities live 24/7 with USDT.
        </p>

        {/* Center Inline Email Input matching Image 3 */}
        <form onSubmit={handleGetStarted} className="max-w-md mx-auto flex items-center p-1.5 rounded-full border border-gray-200 bg-white shadow-lg focus-within:ring-2 focus-within:ring-gray-900 mb-4 transition">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Your email address"
            className="flex-1 px-5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
          />
          <button
            type="submit"
            className="px-6 py-2.5 rounded-full bg-gray-900 hover:bg-black text-white text-sm font-semibold transition shrink-0 shadow-sm"
          >
            Get Started
          </button>
        </form>

        <p className="text-xs text-gray-400 mb-16">
          *No minimum balance or international bank account required. Runs on testnet USDT.
        </p>

        {/* Hero Visual Mockup with Floating Badges matching Image 3 */}
        <div className="relative max-w-4xl mx-auto pt-6 pb-12">
          {/* Background Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-tr from-purple-200 via-sky-200 to-emerald-200 rounded-full blur-3xl opacity-50 pointer-events-none" />

          {/* Floating Feature Badge 1: Remittance (Left Purple Badge) */}
          <div className="hidden md:flex absolute top-12 left-4 z-20 flex-col items-start bg-[#E8DEF8] text-[#3B0764] p-4 rounded-2xl shadow-lg border border-purple-200 max-w-[210px] text-left transform -rotate-3 hover:rotate-0 transition">
            <div className="flex items-center gap-2 mb-1.5 font-bold text-xs uppercase tracking-wider">
              <Zap size={14} className="text-purple-700" />
              <span>Instant Remittance</span>
            </div>
            <p className="text-xs font-semibold leading-snug">
              Send $100 → Receiver gets 12,950 tKES in 3 seconds with 95% lower fees.
            </p>
          </div>

          {/* Floating Feature Badge 2: Stokvel Pots (Right Lime Green Badge) */}
          <div className="hidden md:flex absolute top-10 right-4 z-20 flex-col items-start bg-[#D9F99D] text-[#14532D] p-4 rounded-2xl shadow-lg border border-lime-300 max-w-[220px] text-left transform rotate-3 hover:rotate-0 transition">
            <div className="flex items-center gap-2 mb-1.5 font-bold text-xs uppercase tracking-wider">
              <Users size={14} className="text-lime-800" />
              <span>Stokvel Pots</span>
            </div>
            <p className="text-xs font-semibold leading-snug">
              Friends pool $20/mo: Thandi receives $100 lump sum. Safe smart contract rules.
            </p>
          </div>

          {/* Center Card Mockup matching Image 3 */}
          <div className="relative z-10 max-w-sm mx-auto bg-gray-900 rounded-[2.5rem] p-4 shadow-2xl border-4 border-gray-800 text-white">
            <div className="bg-[#18191E] rounded-[2rem] p-6 border border-white/10 text-left">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-6">
                <span>AssetBridge Multi-Asset Wallet</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-tr from-gray-800 via-indigo-950 to-slate-900 border border-white/10 shadow-inner mb-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-xs text-gray-400">Total Portfolio</span>
                    <h3 className="text-2xl font-bold font-mono">$17,643.41</h3>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/20">USDT</span>
                </div>
                <div className="flex justify-between items-end text-xs text-gray-300">
                  <span>Lucas Maluleke</span>
                  <span className="font-mono">8902 2437 5350 1240</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => onNavigate('remittance')}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Send size={14} className="text-sky-400" />
                  <span>Send Home</span>
                </button>
                <button
                  onClick={() => onNavigate('stokvel')}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Users size={14} className="text-emerald-400" />
                  <span>Stokvel Pots</span>
                </button>
              </div>

              <button
                onClick={() => onNavigate('dashboard')}
                className="w-full py-2.5 rounded-xl bg-white text-gray-900 font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-100 transition"
              >
                <span>Open Dashboard</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left mt-8">
          <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-300 transition">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
              <Send size={20} />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Local Remittance</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Send $100 and recipient gets tKES or tZAR instantly. Clear comparison showing savings over traditional SWIFT bank transfers.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-300 transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
              <Users size={20} />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Smart Stokvel Pots</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Rotation mode (ajo/chama) and Investment mode. Transparent smart-contract rule: round only pays out once every member has paid.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-300 transition">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
              <TrendingUp size={20} />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Real-World Equities</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Fractional tokenised shares (tAAPL, tTSLA, tNVDA) traded 24/7 settled on-chain with backend signed price quotes.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

