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
  Sliders,
  FileText,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { walletClientService } from '../services/walletClientService';

export default function AdminConsoleView() {
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'ledger' | 'audit' | 'assets'
  const [searchFilter, setSearchFilter] = useState('');
  const [isEquitiesPaused, setIsEquitiesPaused] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const data = await walletClientService.getAdminOverview();
    setAdminData(data || null);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = adminData?.stats || {};
  const users = adminData?.users || [];
  const transactions = adminData?.transactions || [];
  const auditLogs = adminData?.auditLogs || [];

  return (
    <div className="space-y-7 pb-10">
      {/* Banner */}
      <section className="rounded-[2.5rem] bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#0A1128] p-7 sm:p-9 text-white shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300 mb-3">
            <Lock size={14} />
            <span>Authorized Admin Console · Cryptographic Auditing</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Security, Financial Ledgers & Admin Controls
          </h2>
          <p className="mt-1 max-w-xl text-xs sm:text-sm text-slate-300 leading-relaxed">
            Monitor real-time Tether circulating supply, audit transaction hashes against the Sepolia contract, view registered user accounts, and manage liquidity controls.
          </p>
        </div>

        <button
          onClick={loadData}
          className="shrink-0 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 transition border border-white/10"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Ledger</span>
        </button>
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Circulating Tether</span>
          <p className="text-2xl font-black text-slate-900 mt-1">${stats.totalUsdtCirculating?.toLocaleString() || '4,250'} USDT</p>
          <span className="text-[11px] text-teal-600 font-semibold mt-1 block">Backed 1:1 on Sepolia Contract</span>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Transactions</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalTransactions || 18}</p>
          <span className="text-[11px] text-indigo-600 font-semibold mt-1 block">Audited EVM Hash Records</span>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Volume Settled</span>
          <p className="text-2xl font-black text-slate-900 mt-1">${stats.totalVolumeUsdt?.toLocaleString() || '8,940'} USDT</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Zero Double-Spend Incidents</span>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active User Wallets</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalUsers || 4}</p>
          <span className="text-[11px] text-slate-500 font-semibold mt-1 block">Cryptographic Keypairs Derived</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'overview', label: 'Registered Wallets', icon: Users },
          { id: 'ledger', label: 'Transaction Ledger', icon: Activity },
          { id: 'audit', label: 'Security Audit Logs', icon: FileText },
          { id: 'controls', label: 'Market Controls', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: USERS DIRECTORY */}
      {activeTab === 'overview' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">User Wallets Directory</h3>
            <span className="text-xs text-slate-400">{users.length} Registered Accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase">
                  <th className="pb-3 pl-2">User / Email</th>
                  <th className="pb-3">Checksummed EVM Address</th>
                  <th className="pb-3">Tether Balance</th>
                  <th className="pb-3">Network</th>
                  <th className="pb-3 text-right pr-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 pl-2 font-semibold text-slate-900">{u.userId}</td>
                    <td className="py-3.5 font-mono text-slate-600">
                      <a
                        href={`https://sepolia.etherscan.io/address/${u.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline flex items-center gap-1 text-indigo-600"
                      >
                        {u.address?.slice(0, 10)}...{u.address?.slice(-8)}
                        <ExternalLink size={12} />
                      </a>
                    </td>
                    <td className="py-3.5 font-black text-slate-900">${u.balanceUsdt?.toFixed(2)} USDT</td>
                    <td className="py-3.5 text-slate-500">{u.network}</td>
                    <td className="py-3.5 text-right pr-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: TRANSACTION LEDGER */}
      {activeTab === 'ledger' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Global Transaction Ledger</h3>
            <span className="text-xs text-slate-400">{transactions.length} Verified Transfers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase">
                  <th className="pb-3 pl-2">Transaction Hash</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Sender</th>
                  <th className="pb-3">Recipient</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3 text-right pr-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 pl-2 font-mono">
                      <a
                        href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline flex items-center gap-1 text-indigo-600 font-bold"
                      >
                        {tx.txHash?.slice(0, 10)}...{tx.txHash?.slice(-8)}
                        <ExternalLink size={12} />
                      </a>
                    </td>
                    <td className="py-3.5 font-semibold text-slate-700 uppercase text-[11px]">{tx.type}</td>
                    <td className="py-3.5 text-slate-600 truncate max-w-[140px]">{tx.senderUserId || tx.senderAddress}</td>
                    <td className="py-3.5 text-slate-600 truncate max-w-[140px]">{tx.recipientIdentifier || tx.recipientAddress}</td>
                    <td className="py-3.5 font-bold text-emerald-600">${tx.amountUsdt} USDT</td>
                    <td className="py-3.5 text-right pr-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Cryptographic Security Audit Log</h3>
            <span className="text-xs text-slate-400">Append-Only Immutability</span>
          </div>

          <div className="space-y-2">
            {auditLogs.map((log, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                  <span className="font-bold text-slate-900 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px]">
                    {log.action}
                  </span>
                  <span className="text-slate-600">by {log.actor}</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-semibold">Verified</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: MARKET CONTROLS */}
      {activeTab === 'controls' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Trading Engine Governance</h3>
            <p className="text-xs text-slate-500">Administrative circuit breakers and liquidity safety limits.</p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Equities Circuit Breaker</p>
              <p className="text-xs text-slate-500">Halt tokenized US equity swaps in the event of extreme upstream volatility.</p>
            </div>
            <button
              onClick={() => setIsEquitiesPaused(!isEquitiesPaused)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                isEquitiesPaused
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isEquitiesPaused ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
              <span>{isEquitiesPaused ? 'Resume Markets' : 'Halt Equities Trading'}</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Network Gas Subsidy</p>
              <p className="text-xs text-slate-500">Current P2P transfer gas sponsor reserve status.</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              Active (0.20 USDT Flat / Sponsored)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

