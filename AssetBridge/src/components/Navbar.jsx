import React from 'react';
import { Search, Bell, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';
import { isSupabaseConfigured } from '../utils/supabaseClient';

export default function Navbar({ title = 'Overview', user, onLogout }) {
  const isSupaActive = isSupabaseConfigured();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Zoia M.';

  return (
    <header className="flex items-center justify-between pb-6 pt-2 px-2 border-b border-gray-100 mb-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        {/* Supabase status badge */}
        <div
          className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
            isSupaActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
          title={isSupaActive ? 'Connected to live Supabase backend' : 'Backend Ready: Set Supabase credentials in .env'}
        >
          {isSupaActive ? (
            <>
              <CheckCircle size={12} className="text-emerald-600" />
              <span>Supabase Connected</span>
            </>
          ) : (
            <>
              <AlertCircle size={12} className="text-amber-600" />
              <span>On-Chain Mode</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <button
          className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition"
          aria-label="Search"
        >
          <Search size={18} />
        </button>

        {/* Notifications */}
        <button
          className="relative w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
        </button>

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
            {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
          </div>
          <span className="text-sm font-semibold text-gray-800 max-w-[120px] truncate">
            {displayName}
          </span>
          <ChevronDown size={14} className="text-gray-400" />
        </div>
      </div>
    </header>
  );
}

