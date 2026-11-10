import React from 'react';
import { LayoutGrid, Send, Users, TrendingUp, ShieldCheck, LogOut, ArrowRightLeft } from 'lucide-react';

export default function Sidebar({ currentView, onNavigate, onLogout }) {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutGrid },
    { id: 'remittance', label: 'Send Home (Remittance)', icon: Send },
    { id: 'stokvel', label: 'Stokvel Pots', icon: Users },
    { id: 'trading', label: 'Trade Markets', icon: TrendingUp },
    { id: 'split', label: 'Split Payments', icon: ArrowRightLeft },
    { id: 'reserves', label: 'Reserve Panel', icon: ShieldCheck },
  ];

  return (
    <aside className="w-20 md:w-24 bg-[#141518] text-white flex flex-col items-center py-6 px-2 rounded-3xl m-3 shadow-xl shrink-0 select-none justify-between">
      {/* Brand Icon */}
      <div className="flex flex-col items-center gap-6">
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-12 h-12 rounded-2xl bg-[#F6EEDF] text-[#141518] flex items-center justify-center font-black text-xl shadow-md hover:scale-105 transition"
          title="AssetBridge Home"
        >
          <span className="tracking-tighter">AB</span>
        </button>

        {/* Navigation Items */}
        <nav className="flex flex-col items-center gap-4 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-white/15 text-white shadow-inner font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title={item.label}
              >
                <Icon size={22} strokeWidth={isActive ? 2.3 : 1.8} />
                {isActive && (
                  <span className="absolute -left-1 w-1.5 h-6 bg-[#3B82F6] rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout button at bottom */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onLogout}
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-gray-400 hover:text-rose-400 hover:bg-white/5 transition"
          title="Log out"
        >
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
}

