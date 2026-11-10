import React, { useState } from 'react';
import { ShieldCheck, ExternalLink, CheckCircle2, Lock, FileText, Database, Search, ArrowUpRight } from 'lucide-react';
import { TOKENS } from '../utils/constants';

export default function ReservesPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTokens = TOKENS.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.issuer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#061b24] via-[#093539] to-[#042022] rounded-[2rem] p-6 sm:p-8 text-white relative shadow-xl border border-teal-500/20">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/20 text-xs font-bold text-teal-300 mb-3 border border-teal-500/30">
            <ShieldCheck size={14} />
            <span>Real-Time On-Chain Proof of Reserve (PoR)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Reserve & Attestation Panel
          </h2>
          <p className="text-xs sm:text-sm text-teal-100/90 leading-relaxed">
            Every tokenised real-world asset (RWA) and currency token is 100% matched by custodian securities, audited bank deposits, or Tether reserves verified on-chain.
          </p>
        </div>
      </div>

      {/* Reserves Table Card */}
      <div className="bg-white rounded-[2rem] p-6 sm:p-7 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Verified Token Issuers & Custody Assets</h3>
            <p className="text-xs text-slate-500">
              Live smart contract addresses and cryptographic attestation hashes
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by asset or issuer..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider pb-3">
                <th className="pb-3 pl-2">Asset</th>
                <th className="pb-3">Issuer Entity</th>
                <th className="pb-3">Custody Backing</th>
                <th className="pb-3">Smart Contract</th>
                <th className="pb-3 text-right pr-2">Attestation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTokens.map((token) => (
                <tr key={token.symbol} className="hover:bg-slate-50/70 transition">
                  <td className="py-4 pl-2 pr-3 font-bold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                        {token.symbol.replace('t', '')}
                      </span>
                      <div>
                        <span className="block text-slate-900 font-bold">{token.name}</span>
                        <span className="text-[11px] font-mono text-slate-400">{token.symbol}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 pr-3 text-slate-700 font-medium max-w-[200px]">
                    {token.issuer}
                  </td>

                  <td className="py-4 pr-3 max-w-xs text-slate-600 leading-relaxed text-[11px]">
                    {token.backing}
                  </td>

                  <td className="py-4 pr-3 font-mono text-teal-700">
                    <a
                      href={`https://sepolia.etherscan.io/address/${token.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline font-semibold"
                      title="Inspect contract on Etherscan"
                    >
                      <span>{token.contractAddress.slice(0, 8)}...{token.contractAddress.slice(-6)}</span>
                      <ExternalLink size={12} />
                    </a>
                  </td>

                  <td className="py-4 text-right pr-2">
                    <div className="inline-flex flex-col items-end">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        <span>100% Verified</span>
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1 font-mono">{token.lastAttestation}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
