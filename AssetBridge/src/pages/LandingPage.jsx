import React, { useState } from 'react';
import { ArrowRight, Send, Users, TrendingUp, Shield, Zap, Sparkles } from 'lucide-react';

export default function LandingPage({ onNavigate }) {
  const [emailInput, setEmailInput] = useState('');
  const [isCardActive, setIsCardActive] = useState(true);

  const handleGetStarted = (e) => {
    e.preventDefault();
    onNavigate('signup');
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-gray-900 selection:text-white">
      
      {/* Top Header matching Samurai (Image 3) */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('landing')}>
            <div className="w-8 h-8 rounded-xl bg-gray-950 text-white flex items-center justify-center font-bold text-sm">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-extrabold text-lg tracking-tight text-gray-950">AssetBridge</span>
          </div>
          <span className="hidden md:inline-block text-xs text-gray-400 font-normal">
            / hello@assetbridge.africa
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-600">
          <button onClick={() => onNavigate('dashboard')} className="hover:text-black transition">Products</button>
          <button onClick={() => onNavigate('remittance')} className="hover:text-black transition">Solutions</button>
          <button onClick={() => onNavigate('stokvel')} className="hover:text-black transition">Pricing</button>
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

      {/* Main Hero Section matching Samurai (Image 3) */}
      <main className="max-w-5xl mx-auto px-6 pt-16 pb-20 text-center">
        
        {/* Giant Bold Black Headline */}
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-gray-950 leading-[1.08] mb-6">
          Forget high fees. Forever.
        </h1>

        {/* Subtitle */}
        <p className="max-w-3xl mx-auto text-lg sm:text-xl text-gray-600 leading-relaxed font-normal mb-10">
          AssetBridge functions as your borderless remittance wallet, group savings club, and global equity trader—all in one, redefining efficiency and convenience.
        </p>

        {/* Center Inline Email Input Form matching Samurai */}
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
          *No personal guarantee or personal credit check required.
        </p>

        {/* Smartphone Mockup with Real Virtual Debit Card & Floating Badges matching Image 3 */}
        <div className="relative max-w-4xl mx-auto pt-4 pb-16">
          
          {/* Natural Organic Plant Leaves Backdrop matching Samurai bottom */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[460px] h-48 bg-gradient-to-t from-emerald-600/25 via-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

          {/* Left Floating Purple Badge with Pointer Arrow matching Samurai */}
          <div className="hidden lg:flex absolute top-28 left-4 z-20 flex-col items-start bg-[#E9D5FF] text-[#3B0764] p-5 rounded-3xl shadow-xl border border-purple-200 max-w-[210px] text-left transform -rotate-2 hover:rotate-0 transition duration-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">✦</span>
              <span className="font-bold text-xs uppercase tracking-wider text-purple-900">Cashback</span>
            </div>
            <p className="text-xs font-semibold leading-snug text-purple-950">
              On The Every Payment with instant local settlement.
            </p>
          </div>

          {/* Right Floating Neon Lime Badge with Pointer Arrow matching Samurai */}
          <div className="hidden lg:flex absolute top-28 right-4 z-20 flex-col items-start bg-[#D9F99D] text-[#14532D] p-5 rounded-3xl shadow-xl border border-lime-300 max-w-[230px] text-left transform rotate-2 hover:rotate-0 transition duration-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">⚡</span>
              <span className="font-bold text-xs uppercase tracking-wider text-lime-900">Premium Plan</span>
            </div>
            <p className="text-xs font-semibold leading-snug text-lime-950">
              Group Stokvel pots and tokenised equities access.
            </p>
          </div>

          {/* iPhone Frame */}
          <div className="relative z-10 max-w-[340px] sm:max-w-[360px] mx-auto bg-gray-950 rounded-[3rem] p-3 shadow-2xl border-4 border-gray-900 text-gray-900">
            
            {/* Phone Screen Container */}
            <div className="bg-white rounded-[2.5rem] p-5 pt-7 text-left border border-gray-100 overflow-hidden shadow-inner flex flex-col justify-between">
              
              {/* Phone Header */}
              <div className="flex items-center justify-between text-xs font-semibold text-gray-800 mb-5">
                <span className="flex items-center gap-1">
                  <span>‹</span> Virtual Debit Card *3576
                </span>
                <span className="text-[10px] text-gray-400 font-mono">9:41</span>
              </div>

              {/* Virtual Debit Mastercard matching Image 3 */}
              <div className="rounded-2xl p-5 text-white bg-gradient-to-tr from-gray-950 via-slate-800 to-indigo-950 shadow-xl border border-white/10 relative overflow-hidden mb-5">
                {/* Subtle Metallic Card Sheen */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

                {/* Mastercard Logo Top Left */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-red-500/90" />
                    <div className="w-6 h-6 rounded-full bg-amber-400/90" />
                  </div>
                  <span className="text-[10px] font-mono tracking-widest text-gray-300">DEBIT</span>
                </div>

                {/* Card Number */}
                <div className="font-mono text-base tracking-widest font-semibold mb-6 text-gray-100">
                  8902 2437 5350 1240
                </div>

                {/* Card Details Bottom */}
                <div className="flex justify-between items-end text-[10px] text-gray-300">
                  <div>
                    <div className="text-[8px] uppercase text-gray-400">Name</div>
                    <div className="font-medium tracking-wide">Daniel Craig</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase text-gray-400">Exp. Date</div>
                    <div className="font-mono">06/28</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase text-gray-400">CVV</div>
                    <div className="font-mono">412</div>
                  </div>
                </div>
              </div>

              {/* Add to Apple Wallet Button matching Image 3 */}
              <button 
                onClick={() => onNavigate('dashboard')}
                className="w-full py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-900 text-xs font-semibold flex items-center justify-center gap-2 mb-4 transition shadow-sm"
              >
                <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.4c.66-.82 1.11-1.96.99-3.1-.97.04-2.13.65-2.82 1.45-.61.7-.1.14-1.87 2.89.04 1.05.74 2.16 1.83 1.93.94-.17" />
                </svg>
                <span>Add to Apple Wallet</span>
                <span className="font-bold ml-0.5">+</span>
              </button>

              {/* Card Active Toggle matching Image 3 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center text-gray-700">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                      <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 leading-none">Card is active</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Turn your card on or off anytime</div>
                  </div>
                </div>

                {/* Toggle switch */}
                <button
                  type="button"
                  onClick={() => setIsCardActive(!isCardActive)}
                  className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                    isCardActive ? 'bg-gray-950' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      isCardActive ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Feature Overview Section matching modern fintech */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left mt-6">
          <div className="p-7 rounded-3xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition">
            <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-5">
              <Send size={22} />
            </div>
            <h3 className="text-lg font-bold text-gray-950 mb-2">Instant Local Remittances</h3>
            <p className="text-sm text-gray-600 leading-relaxed font-normal">
              Send USDT and your family receives KES, ZAR, or NGN directly into their mobile money wallet in seconds with transparent interbank rates.
            </p>
          </div>

          <div className="p-7 rounded-3xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition">
            <div className="w-11 h-11 rounded-2xl bg-lime-100 text-lime-800 flex items-center justify-center mb-5">
              <Users size={22} />
            </div>
            <h3 className="text-lg font-bold text-gray-950 mb-2">Stokvel & Chama Pots</h3>
            <p className="text-sm text-gray-600 leading-relaxed font-normal">
              Automate community savings. Smart contracts hold group funds and unlock rotational payouts or co-invest in tokenised US equities.
            </p>
          </div>

          <div className="p-7 rounded-3xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-5">
              <TrendingUp size={22} />
            </div>
            <h3 className="text-lg font-bold text-gray-950 mb-2">24/7 Fractional Equities</h3>
            <p className="text-sm text-gray-600 leading-relaxed font-normal">
              Own fractions of Apple, Tesla, and Nvidia starting from just $5. Traded 24/7 and settled on-chain without broker delays.
            </p>
          </div>
        </section>

      </main>

      {/* Clean Human Footer */}
      <footer className="border-t border-gray-100 py-10 text-center text-xs text-gray-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-950">AssetBridge</span>
            <span>© 2026 AssetBridge Africa. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-gray-600">
            <button onClick={() => onNavigate('remittance')} className="hover:text-black">Remittance</button>
            <button onClick={() => onNavigate('stokvel')} className="hover:text-black">Stokvel Pots</button>
            <button onClick={() => onNavigate('trading')} className="hover:text-black">Equities</button>
            <button onClick={() => onNavigate('login')} className="hover:text-black">Log In</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
