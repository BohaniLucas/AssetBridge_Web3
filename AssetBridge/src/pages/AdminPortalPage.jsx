import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Activity,
  DollarSign,
  Layers,
  ExternalLink,
  Lock,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  PauseCircle,
  PlayCircle,
  LogOut,
  Sliders,
  Settings,
  HelpCircle,
  Building,
  Check,
  X,
  CreditCard,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  Radio,
  Calendar,
  Bell,
  ChevronRight,
  Wifi,
} from 'lucide-react';
import { walletClientService } from '../services/walletClientService';
import { authService } from '../services/authService';

export default function AdminPortalPage({ adminUser, onAdminLogout, onNavigate }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'transactions' | 'markets' | 'stokvels' | 'audit' | 'settings' | 'tickets'
  const [loading, setLoading] = useState(true);
  const [adminData, setAdminData] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [transactionsList, setTransactionsList] = useState([]);
  const [auditLogsList, setAuditLogsList] = useState([]);
  const [stokvelsList, setStokvelsList] = useState([]);
  const [settingsData, setSettingsData] = useState(null);
  const [isEquitiesPaused, setIsEquitiesPaused] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [selectedTxFilter, setSelectedTxFilter] = useState('All');

  // Support Tickets State
  const [tickets, setTickets] = useState([
    { id: 'TKT-1042', user: 'thandi@assetbridge.africa', subject: 'Inquiry on Sepolia tAAPL settlement delay', status: 'resolved', priority: 'medium', date: '2026-11-10 18:20' },
    { id: 'TKT-1043', user: 'malulekelucas04@gmail.com', subject: 'Stokvel invitation code generation request', status: 'open', priority: 'high', date: '2026-11-10 20:15' },
    { id: 'TKT-1044', user: 'sipho@assetbridge.africa', subject: 'QR code scanning confirmation receipt', status: 'open', priority: 'low', date: '2026-11-10 21:05' },
  ]);

  const token = authService.getAdminToken();

  const loadData = async () => {
    setLoading(true);
    setActionNotice('');

    try {
      const overview = await walletClientService.getAdminOverview(token);
      if (overview) {
        setAdminData(overview);
        setUsersList(overview.users || []);
        setTransactionsList(overview.transactions || []);
        setAuditLogsList(overview.auditLogs || []);
        setIsEquitiesPaused(overview.circuitBreaker?.isEquitiesPaused || false);
      }

      const users = await walletClientService.getAdminUsers(token);
      if (users && users.length > 0) setUsersList(users);

      const pots = await walletClientService.getAdminStokvels(token);
      if (pots && pots.length > 0) setStokvelsList(pots);

      const settings = await walletClientService.getAdminSettings(token);
      if (settings) setSettingsData(settings);
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleUserStatus = async (userEmail, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await walletClientService.updateAdminUserStatus(userEmail, newStatus, token);
      setUsersList((prev) =>
        prev.map((u) => (u.email === userEmail ? { ...u, status: newStatus } : u))
      );
      setActionNotice(`User ${userEmail} successfully ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}.`);
      setTimeout(() => setActionNotice(''), 4000);
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleToggleCircuitBreaker = async () => {
    const nextState = !isEquitiesPaused;
    try {
      await walletClientService.toggleCircuitBreaker(
        nextState,
        nextState ? 'Safety freeze commanded by admin' : 'Normal trading restored by admin',
        token
      );
      setIsEquitiesPaused(nextState);
      setActionNotice(`Trading circuit breaker ${nextState ? 'ENGAGED (Trading Paused)' : 'DISENGAGED (Trading Active)'}.`);
      setTimeout(() => setActionNotice(''), 4000);
    } catch (err) {
      alert('Failed to toggle circuit breaker: ' + err.message);
    }
  };

  const stats = adminData?.stats || {
    totalUsers: usersList.length || 4,
    totalUsdtCirculating: usersList.reduce((acc, u) => acc + (u.balanceUsdt || 0), 0) || 4250,
    totalTransactions: transactionsList.length || 18,
    totalVolumeUsdt: 8940,
    activeSplitPayments: 2,
  };

  const navMenuItems = [
    { id: 'overview', label: 'Home', icon: Activity },
    { id: 'users', label: 'Users', icon: Users, count: usersList.length },
    { id: 'transactions', label: 'Ledger', icon: DollarSign, count: transactionsList.length },
    { id: 'stokvels', label: 'Vaults', icon: Building, count: stokvelsList.length },
    { id: 'markets', label: 'Trading', icon: Sliders },
    { id: 'audit', label: 'Audit Logs', icon: FileText, count: auditLogsList.length },
  ];

  const configMenuItems = [
    { id: 'tickets', label: 'Support', icon: HelpCircle, count: tickets.filter((t) => t.status === 'open').length },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredTxs = transactionsList.filter((tx) => {
    const matchesSearch =
      !searchFilter ||
      tx.txHash?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      tx.senderUserId?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      tx.type?.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesFilter = selectedTxFilter === 'All' || tx.type === selectedTxFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="w-full min-h-screen bg-[#F3F6FA] text-slate-800 flex font-sans antialiased overflow-x-hidden">
      {/* 1. VIVID EMERALD-TEAL SIDEBAR (Matching reference image) */}
      <aside className="w-64 lg:w-72 bg-gradient-to-b from-[#00C29A] via-[#02AA86] to-[#018065] text-white flex flex-col justify-between p-6 shrink-0 shadow-2xl relative z-30 select-none">
        {/* Background decorative soft circles */}
        <div className="absolute top-12 -right-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-20 -left-10 w-44 h-44 rounded-full bg-emerald-300/10 blur-2xl pointer-events-none" />

        <div className="space-y-6 relative z-10">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-[#02AA86] flex items-center justify-center font-black text-lg shadow-md ring-2 ring-white/20">
              .D
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-white leading-tight">Dashboard</h1>
              <p className="text-[11px] font-medium text-white/80">Admin Console</p>
            </div>
          </div>

          {/* "+ Quick Action" Featured Glass Card */}
          <button
            type="button"
            onClick={handleToggleCircuitBreaker}
            className="w-full bg-white/20 hover:bg-white/25 border border-white/30 backdrop-blur-md rounded-2xl p-3.5 text-left transition shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition">
                {isEquitiesPaused ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
              </span>
              <div>
                <span className="block text-xs font-bold text-white">
                  {isEquitiesPaused ? 'Resume Equities' : 'Circuit Breaker'}
                </span>
                <span className="block text-[10px] text-white/70">
                  {isEquitiesPaused ? 'Trading Paused' : 'Active Safe Mode'}
                </span>
              </div>
            </div>
          </button>

          {/* Section: MENU */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70 mb-2 px-3">Menu</p>
            <nav className="space-y-1">
              {navMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition ${
                      isActive
                        ? 'bg-white text-[#018065] font-bold shadow-lg shadow-teal-950/10'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
                      <span>{item.label}</span>
                    </div>
                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-[#018065]/10 text-[#018065]' : 'bg-white/20 text-white'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Section: CONFIGURATION */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70 mb-2 px-3">Configuration</p>
            <nav className="space-y-1">
              {configMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition ${
                      isActive
                        ? 'bg-white text-[#018065] font-bold shadow-lg shadow-teal-950/10'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
                      <span>{item.label}</span>
                    </div>
                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-[#018065]/10 text-[#018065]' : 'bg-white/20 text-white'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom User Info & Logout */}
        <div className="pt-4 border-t border-white/20 relative z-10 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="block text-xs font-bold text-white truncate">
              {adminUser?.fullName || adminUser?.email?.split('@')[0] || 'System Admin'}
            </span>
            <span className="block text-[10px] text-white/70 truncate">{adminUser?.email || 'admin@assetbridge.africa'}</span>
          </div>

          <button
            type="button"
            onClick={onAdminLogout}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition shadow-sm"
            title="Log Out of Administration"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* 2. FULL BROWSER MAIN WORKSPACE */}
      <div className="flex-1 min-w-0 flex flex-col bg-[#F3F6FA] overflow-y-auto">
        {/* Top Navbar Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
          {/* Search bar matching reference */}
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Type in to search..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#00C29A] focus:bg-white focus:ring-2 focus:ring-[#00C29A]/15 font-medium"
            />
          </div>

          {/* Quick Header Widget Icons */}
          <div className="flex items-center gap-4 self-end sm:self-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 rounded-full px-3 py-1 font-medium">
              <Calendar size={14} className="text-slate-400" />
              <span>June 2026 · Realtime</span>
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition relative"
              title="Refresh Telemetry"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin text-[#00C29A]' : ''} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tickets')}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition relative"
              title="Support Inquiries"
            >
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00C29A] ring-2 ring-white" />
            </button>

            <div className="h-6 w-px bg-slate-200" />

            {/* Admin Avatar */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#00C29A] to-[#0A84FF] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {(adminUser?.email?.[0] || 'A').toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <span className="block text-xs font-bold text-slate-900 leading-tight">
                  {adminUser?.fullName || 'Super Administrator'}
                </span>
                <span className="block text-[10px] text-emerald-600 font-semibold font-mono">Sepolia Verified</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-5 sm:p-7 space-y-6">
          {/* Action Notice Toast */}
          {actionNotice && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-900 flex items-center gap-2.5 shadow-sm animate-fade-in">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* TAB 1: EXECUTIVE OVERVIEW (Matches the 3-column Layout in the screenshot) */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* === LEFT COLUMN (3 cols) === */}
              <div className="lg:col-span-3 space-y-6">
                {/* 1. Half Circle Gauge Chart Card (Matches "Half Circle Chart - 87%") */}
                <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-5 shadow-sm shadow-slate-200/50 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Half Circle Chart</span>
                    <span className="text-slate-400 font-bold tracking-widest cursor-pointer">•••</span>
                  </div>

                  {/* SVG Half Circle Radial Gauge */}
                  <div className="flex flex-col items-center justify-center pt-2">
                    <div className="relative w-44 h-24 overflow-hidden flex items-end justify-center">
                      <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 100 100">
                        {/* Background track */}
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="#E2E8F0"
                          strokeWidth="10"
                          strokeDasharray="125.6 251.2"
                          strokeDashoffset="0"
                        />
                        {/* Teal Active Arc (87%) */}
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="#00C29A"
                          strokeWidth="10"
                          strokeDasharray="125.6 251.2"
                          strokeDashoffset="16.3"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute bottom-1 flex flex-col items-center">
                        <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">87%</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 text-center mt-3 max-w-[170px] leading-relaxed">
                      Reserve backing target achieved. Monthly liquid audit in progress.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xl font-black text-slate-900 font-mono">2,241</span>
                      <span className="block text-[10px] text-slate-400">Total Wallets</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online Now
                    </span>
                  </div>
                </div>

                {/* 2. Micro Sparkline Cards (Product Name / Telemetry) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                  {/* Amber Sparkline */}
                  <div className="rounded-2xl bg-white border border-slate-200/70 p-4 shadow-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                        VOL
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-900">24h Volume</span>
                        <span className="block text-[10px] text-slate-400">USDT Transfers</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {/* SVG mini wave */}
                      <svg className="w-16 h-6 stroke-amber-500 fill-amber-100/40" viewBox="0 0 100 30">
                        <path d="M0,20 Q25,5 50,22 T100,8 L100,30 L0,30 Z" />
                        <path d="M0,20 Q25,5 50,22 T100,8" fill="none" strokeWidth="2.5" />
                      </svg>
                      <span className="font-mono text-xs font-black text-slate-900">${stats.totalVolumeUsdt.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Purple Sparkline */}
                  <div className="rounded-2xl bg-white border border-slate-200/70 p-4 shadow-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                        GAS
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-900">Sepolia Gas</span>
                        <span className="block text-[10px] text-slate-400">Ledger Fees</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {/* SVG mini wave */}
                      <svg className="w-16 h-6 stroke-purple-500 fill-purple-100/40" viewBox="0 0 100 30">
                        <path d="M0,15 Q30,28 60,10 T100,18 L100,30 L0,30 Z" />
                        <path d="M0,15 Q30,28 60,10 T100,18" fill="none" strokeWidth="2.5" />
                      </svg>
                      <span className="font-mono text-xs font-black text-slate-900">12 Gwei</span>
                    </div>
                  </div>
                </div>

                {/* 3. Circle Chart Donut Card (Asset Distribution) */}
                <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Circle Chart</span>
                    <span className="text-slate-400 font-bold tracking-widest cursor-pointer">•••</span>
                  </div>

                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 100 100">
                        {/* Outer ring: Tether USDT (Cyan/Teal) */}
                        <circle cx="50" cy="50" r="38" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                        <circle cx="50" cy="50" r="38" fill="none" stroke="#00C29A" strokeWidth="6" strokeDasharray="238.7" strokeDashoffset="48" strokeLinecap="round" />
                        
                        {/* Inner ring: Tokenized Stocks (Amber) */}
                        <circle cx="50" cy="50" r="28" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                        <circle cx="50" cy="50" r="28" fill="none" stroke="#F59E0B" strokeWidth="6" strokeDasharray="175.9" strokeDashoffset="90" strokeLinecap="round" />
                        
                        {/* Deep Inner ring: Forex (Blue) */}
                        <circle cx="50" cy="50" r="18" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                        <circle cx="50" cy="50" r="18" fill="none" stroke="#3B82F6" strokeWidth="6" strokeDasharray="113.1" strokeDashoffset="75" strokeLinecap="round" />
                      </svg>
                      <div className="absolute flex flex-col items-center text-center">
                        <span className="text-xs font-extrabold text-slate-900 font-mono">$6,581</span>
                        <span className="text-[9px] text-slate-400">Backing</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-[#00C29A]" /> Tether USDT</span>
                      <strong className="font-mono text-slate-900 font-bold">85%</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-amber-500" /> Tokenised Stocks</span>
                      <strong className="font-mono text-slate-900 font-bold">10%</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-blue-500" /> Forex Reserves</span>
                      <strong className="font-mono text-slate-900 font-bold">5%</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* === CENTER COLUMN (6 cols) === */}
              <div className="lg:col-span-6 space-y-6">
                {/* 1. Data Information: System Telemetry & Horizontal Bar Chart Card */}
                <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Data information</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Authoritative monthly transaction telemetry</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-slate-100 text-xs text-slate-600 font-medium">June 2026</span>
                      <span className="px-3 py-1 rounded-xl bg-slate-100 text-xs text-slate-600 font-medium">Real-time</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">$1.07B</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-xs">
                        <ArrowUpRight size={13} strokeWidth={2.5} />
                        1.18%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono">Jul 5, 2026 · Sepolia Node Proof</p>
                  </div>

                  {/* Horizontal Bar Chart (Matching screenshot) */}
                  <div className="space-y-3 pt-2">
                    {[
                      { month: 'Jan', val1: 45, val2: 80 },
                      { month: 'Feb', val1: 75, val2: 95 },
                      { month: 'Mar', val1: 90, val2: 40 },
                      { month: 'Apr', val1: 65, val2: 70 },
                      { month: 'May', val1: 95, val2: 50 },
                    ].map((row) => (
                      <div key={row.month} className="flex items-center gap-3 text-xs">
                        <span className="w-8 text-slate-400 font-mono font-medium">{row.month}</span>
                        <div className="flex-1 space-y-1">
                          <div className="h-2 rounded-full bg-[#00C29A] transition-all" style={{ width: `${row.val1}%` }} />
                          <div className="h-1.5 rounded-full bg-slate-200 transition-all" style={{ width: `${row.val2}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chart Legend */}
                  <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-100 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#00C29A]" /> Tether P2P</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Stokvel Vaults</span>
                  </div>
                </div>

                {/* 2. All Transactions Table Card (Matching screenshot table) */}
                <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Data information</h3>
                      <p className="text-xs text-slate-400">All Transaction ledger records</p>
                    </div>

                    {/* Filter Pills matching screenshot */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {['All', 'p2p_transfer', 'stokvel_contribution'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedTxFilter(type)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                            selectedTxFilter === type
                              ? 'bg-[#00C29A] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {type === 'All' ? 'All' : type === 'p2p_transfer' ? 'P2P' : 'Stokvel'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clean Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400">
                          <th className="py-2.5 px-3">Tx Hash / User</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3 text-right">Result</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTxs.slice(0, 5).map((tx) => (
                          <tr key={tx.id || tx.txHash} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3 font-medium">
                              <a
                                href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono font-bold text-[#00C29A] hover:underline flex items-center gap-1"
                              >
                                <span>{tx.txHash?.slice(0, 8)}...{tx.txHash?.slice(-4)}</span>
                                <ExternalLink size={10} />
                              </a>
                              <span className="block text-[11px] text-slate-400 font-sans truncate max-w-[140px]">
                                {tx.senderUserId || 'System'}
                              </span>
                            </td>
                            <td className="py-3 px-3 capitalize font-semibold text-slate-600">
                              {tx.type?.replace(/_/g, ' ') || 'P2P'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              ${Number(tx.amountUsdt || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {tx.status || 'Confirmed'}
                              </span>
                            </td>
                          </tr>
                        ))}

                        {filteredTxs.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-xs text-slate-400">
                              No transactions match the selected filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination footer matching screenshot */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>Showing {Math.min(filteredTxs.length, 5)} of {filteredTxs.length} items</span>
                    <div className="flex items-center gap-1 font-semibold">
                      <button className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Previous</button>
                      <button className="px-2.5 py-1 rounded-lg bg-[#00C29A] text-white">1</button>
                      <button className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">2</button>
                      <button className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">Next</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* === RIGHT COLUMN (3 cols) === */}
              <div className="lg:col-span-3 space-y-6">
                {/* 1. Credit Card Widget (Matches "Data Card - Bank Name" with shiny gradient!) */}
                <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Data Card</span>
                    <span className="text-slate-400 text-[10px]">Vault Reserve</span>
                  </div>

                  {/* Vivid Shiny Gradient Bank Card matching screenshot */}
                  <div className="rounded-2xl bg-gradient-to-tr from-[#00C29A] via-[#05B398] to-[#0A84FF] p-5 text-white shadow-xl shadow-teal-500/20 space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />

                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-medium text-white/80 block">AssetBridge Reserve</span>
                        <strong className="font-bold text-white text-xs">Sepolia Node #7219</strong>
                      </div>
                      <CreditCard size={18} className="text-white/80" />
                    </div>

                    <div className="pt-2">
                      <span className="block text-[11px] font-mono text-white/80">Available Liquid Backing</span>
                      <p className="text-xl font-black font-mono tracking-tight text-white mt-0.5">
                        $1,234,567.000
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-white/80 pt-1">
                      <span>0x7169...BA06</span>
                      <span className="font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">USDT</span>
                    </div>
                  </div>
                </div>

                {/* 2. Market Controls / Circuit Breaker Card */}
                <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Trading Controls</span>
                    <span className="text-slate-400 font-bold tracking-widest cursor-pointer">•••</span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Emergency safety lock. Halts automated equity order matching.
                  </p>

                  <button
                    type="button"
                    onClick={handleToggleCircuitBreaker}
                    className={`w-full py-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ${
                      isEquitiesPaused
                        ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                        : 'bg-[#00C29A] hover:bg-[#02aa86] text-white shadow-teal-500/20'
                    }`}
                  >
                    {isEquitiesPaused ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
                    <span>{isEquitiesPaused ? 'Resume Equities Trading' : 'Halt Equities Trading'}</span>
                  </button>
                </div>

                {/* 3. Account Directory Preview */}
                <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">User Directory</span>
                    <button onClick={() => setActiveTab('users')} className="text-xs font-semibold text-[#00C29A] hover:underline">
                      All ({usersList.length}) →
                    </button>
                  </div>

                  <div className="space-y-2">
                    {usersList.slice(0, 3).map((u) => (
                      <div key={u.email} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-900 truncate">{u.fullName || u.email.split('@')[0]}</p>
                          <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.status === 'suspended' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
                          {u.status === 'suspended' ? 'Suspended' : 'Active'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FULL USER DIRECTORY */}
          {activeTab === 'users' && (
            <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Users size={18} className="text-[#00C29A]" />
                    <span>User Management & Balances</span>
                  </h3>
                  <p className="text-xs text-slate-400">Manage user accounts, inspect addresses, and toggle account access.</p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by email or address…"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs text-slate-900 outline-none focus:border-[#00C29A]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Cryptographic Address</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-right">Balance</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usersList
                      .filter(
                        (u) =>
                          u.email.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          (u.address && u.address.toLowerCase().includes(searchFilter.toLowerCase()))
                      )
                      .map((u) => (
                        <tr key={u.email} className="hover:bg-slate-50 transition">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <div>{u.fullName || u.email.split('@')[0]}</div>
                            <span className="text-[11px] text-slate-400 font-normal">{u.email}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                            {u.address ? (
                              <span title={u.address}>{u.address.slice(0, 8)}...{u.address.slice(-6)}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {u.role || 'USER'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                            ${Number(u.balanceUsdt || 0).toFixed(2)} USDT
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${u.status === 'suspended' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
                              {u.status === 'suspended' ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {u.role !== 'ADMIN' && (
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u.email, u.status)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${u.status === 'suspended' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}`}
                              >
                                {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: COMPLETE TRANSACTION LEDGER */}
          {activeTab === 'transactions' && (
            <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <DollarSign size={18} className="text-[#00C29A]" />
                <span>On-Chain Transaction Ledger</span>
              </h3>
              <p className="text-xs text-slate-400">Complete immutable record of all peer-to-peer transfers and stokvel funding.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 bg-slate-50">
                      <th className="py-3 px-4">Tx Hash</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Sender</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {transactionsList.map((tx) => (
                      <tr key={tx.id || tx.txHash} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-4 font-bold text-[#00C29A]">
                          <a
                            href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <span>{tx.txHash?.slice(0, 10)}...{tx.txHash?.slice(-6)}</span>
                            <ExternalLink size={11} />
                          </a>
                        </td>
                        <td className="py-3.5 px-4 font-sans font-semibold text-slate-700 capitalize">
                          {tx.type?.replace(/_/g, ' ') || 'Transfer'}
                        </td>
                        <td className="py-3.5 px-4 font-sans text-slate-500 truncate max-w-[150px]">
                          {tx.senderUserId || 'System'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          ${Number(tx.amountUsdt || 0).toFixed(2)} USDT
                        </td>
                        <td className="py-3.5 px-4 text-center font-sans">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {tx.status || 'Confirmed'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400">
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: STOKVEL VAULTS */}
          {activeTab === 'stokvels' && (
            <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building size={18} className="text-[#00C29A]" />
                <span>Stokvel & Chama Group Vaults Governance</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {stokvelsList.map((pot) => (
                  <div key={pot.id} className="rounded-2xl border border-slate-200 p-5 space-y-3 bg-slate-50/60">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-900">{pot.name}</h4>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {pot.strategy || 'Rotation'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{pot.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Target</span>
                        <strong className="text-slate-900 font-mono">${pot.targetAmountUsdt} USDT</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Contributors</span>
                        <strong className="text-slate-700">{pot.members?.length || 5} members</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-[#00C29A]" />
                <span>Security Audit Trail</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 bg-slate-50">
                      <th className="py-2.5 px-3">Event Action</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {auditLogsList.map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-bold text-slate-900">{log.action}</td>
                        <td className="py-3 px-3 text-slate-600 font-sans">{log.actor || 'System'}</td>
                        <td className="py-3 px-3 text-slate-400 font-sans truncate max-w-[200px]">
                          {log.details ? JSON.stringify(log.details) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: SUPPORT TICKETS */}
          {activeTab === 'tickets' && (
            <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle size={18} className="text-purple-600" />
                <span>Customer Support Desk</span>
              </h3>
              <div className="space-y-3 pt-2">
                {tickets.map((t) => (
                  <div key={t.id} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-800">{t.id}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900">{t.subject}</p>
                      <p className="text-[11px] text-slate-400">From: {t.user}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTickets((prev) => prev.map((item) => (item.id === t.id ? { ...item, status: 'resolved' } : item)));
                        setActionNotice(`Ticket ${t.id} marked as resolved.`);
                        setTimeout(() => setActionNotice(''), 3000);
                      }}
                      disabled={t.status === 'resolved'}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40"
                    >
                      {t.status === 'resolved' ? 'Resolved' : 'Resolve Ticket'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: SYSTEM SETTINGS */}
          {activeTab === 'settings' && (
            <div className="rounded-[1.75rem] bg-white border border-slate-200/70 p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings size={18} className="text-slate-600" />
                <span>System Configurations</span>
              </h3>
              <div className="space-y-3 font-mono text-xs pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Network</span>
                  <span className="font-bold text-slate-900">Ethereum Sepolia (Chain ID: 11155111)</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Tether USDT Contract</span>
                  <span className="font-bold text-[#00C29A]">0x7169D38820dfd117C3FA1f22a697dBA58d90BA06</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-500 font-sans">P2P Network Transfer Fee</span>
                  <span className="font-bold text-slate-900">$0.20 USDT</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
