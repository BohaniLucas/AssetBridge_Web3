import React from 'react';
import { ShieldCheck, ExternalLink, CheckCircle2, Lock, FileText, Database } from 'lucide-react';
import { TOKENS } from '../utils/constants';

export default function ReservesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-gray-900 rounded-3xl p-6 sm:p-8 text-white relative shadow-xl">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-300 mb-3 border border-emerald-500/30">
            <ShieldCheck size={14} />
            <span>Transparency & Compliance Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Reserve & Attestation Panel
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
            Every tokenised equity and currency token issued on the AssetBridge network publishes real-time proof-of-reserve attestation hashes and custodian statements.
          </p>
        </div>
      </div>

      {/* Reserves Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Tokenised Asset Issuers & Backing</h3>
            <p className="text-xs text-gray-500">
              Verified testnet parameters tracking reference financial markets.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            All 7 Assets Attested
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider pb-3">
                <th className="pb-3">Asset</th>
                <th className="pb-3">Issuer Entity</th>
                <th className="pb-3">Backing & Custody Statement</th>
                <th className="pb-3">Smart Contract</th>
                <th className="pb-3 text-right">Attestation Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {TOKENS.map((token) => (
                <tr key={token.symbol} className="hover:bg-gray-50/60 transition">
                  <td className="py-4 pr-3 font-bold text-gray-900">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-[10px]">
                        {token.symbol.replace('t', '')}
                      </span>
                      <span>{token.symbol}</span>
                    </div>
                  </td>

                  <td className="py-4 pr-3 text-gray-600 font-medium">
                    {token.issuer}
                  </td>

                  <td className="py-4 pr-3 max-w-xs text-gray-600">
                    {token.backing}
                  </td>

                  <td className="py-4 pr-3 font-mono text-indigo-600">
                    <div className="flex items-center gap-1 cursor-pointer hover:underline">
                      <span>{token.contractAddress}</span>
                      <ExternalLink size={11} />
                    </div>
                  </td>

                  <td className="py-4 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <CheckCircle2 size={12} />
                      <span>Verified Live</span>
                    </span>
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

