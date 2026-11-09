import React, { useState } from 'react';
import { Send, ArrowRight, ShieldCheck, Zap, Clock, DollarSign, CheckCircle2, AlertTriangle, ExternalLink, X, Lock } from 'lucide-react';
import { remittanceService, FX_DESTINATIONS } from '../services/remittanceService';

export default function RemittancePage() {
  const [sendAmount, setSendAmount] = useState('100');
  const [selectedCurrency, setSelectedCurrency] = useState('tKES');
  const [recipientNumber, setRecipientNumber] = useState('+254 712 345 678');
  const [isSending, setIsSending] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [formError, setFormError] = useState('');

  const numAmount = Number(sendAmount) || 0;
  const quote = remittanceService.calculateComparison(numAmount, selectedCurrency);

  // Validate limits before prompting confirmation
  const handleInitiateSend = (e) => {
    e.preventDefault();
    setFormError('');

    if (numAmount < 1) {
      setFormError('Minimum transfer amount is $1.00 USDT.');
      return;
    }

    if (numAmount > 10000) {
      setFormError('Safety limit: Maximum single transfer is $10,000 USDT on testnet.');
      return;
    }

    if (!recipientNumber.trim()) {
      setFormError('Please enter a recipient phone number or mobile money ID.');
      return;
    }

    // Open security confirmation modal
    setShowConfirmModal(true);
  };

  const handleConfirmAndSign = () => {
    setShowConfirmModal(false);
    setIsSending(true);

    setTimeout(() => {
      setIsSending(false);
      setReceipt({
        id: `tx-remit-${Date.now()}`,
        txHash: '0x' + Math.random().toString(16).substring(2, 10) + '...9c1a',
        amountUsdt: sendAmount,
        currencyCode: selectedCurrency,
        receivedFormatted: quote.assetBridge.receivedFormatted,
        recipient: recipientNumber,
        time: '3.1 seconds',
        timestamp: new Date().toLocaleTimeString(),
      });
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* 2-Step Security Confirmation Modal (PDF Section 4 Safety Control) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-7 shadow-2xl border border-gray-100 text-gray-900">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Lock size={16} />
                </div>
                <h3 className="text-lg font-bold">Authorize Transfer</h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Please review the transaction parameters before signing. Once broadcasted, blockchain settlement is immutable.
            </p>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2.5 text-xs text-gray-700 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-500">Recipient:</span>
                <span className="font-semibold text-gray-900">{recipientNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount Sent:</span>
                <span className="font-bold text-gray-900 font-mono">${sendAmount} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Network / Gas Fee:</span>
                <span className="font-bold text-emerald-600 font-mono">{quote.assetBridge.fee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Exchange Rate:</span>
                <span className="font-medium text-gray-900">{quote.assetBridge.exchangeRateFormatted}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 text-sm font-bold text-gray-900">
                <span>Recipient Gets:</span>
                <span className="text-indigo-600">{quote.assetBridge.receivedFormatted}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-1/2 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSign}
                className="w-1/2 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs shadow-md transition"
              >
                Sign & Authorize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0c182c] via-[#112444] to-[#152e55] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-sky-300 mb-3 border border-white/10">
            <Zap size={14} className="text-sky-400" />
            <span>Mobile Money & Peer-to-Peer Track Feature</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Send Home in Local Currency
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
            Send stablecoins (USDT) from your phone and your family receives local currency tokens (tKES, tZAR, tNGN) directly into their mobile money wallet in seconds.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Transfer Form */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xl font-bold text-gray-900">Send Remittance</h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <ShieldCheck size={12} />
              <span>Safety Verified</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Instant settlement with transparent zero-spread exchange rate.
          </p>

          {formError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleInitiateSend} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">
                  You Send (USDT)
                </label>
                <span className="text-[11px] text-gray-400 font-mono">Limit: $10,000/tx</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="any"
                  required
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
                  USDT
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Receiver Gets (Local Token)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FX_DESTINATIONS.map((dest) => (
                  <button
                    key={dest.code}
                    type="button"
                    onClick={() => setSelectedCurrency(dest.code)}
                    className={`py-2.5 px-3 rounded-xl border text-center transition flex flex-col items-center ${
                      selectedCurrency === dest.code
                        ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg leading-none mb-1">{dest.flag}</span>
                    <span className="text-xs font-bold">{dest.code}</span>
                    <span className="text-[10px] opacity-75">{dest.country}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Recipient Mobile Money / Phone
              </label>
              <input
                type="text"
                required
                value={recipientNumber}
                onChange={(e) => setRecipientNumber(e.target.value)}
                placeholder="+254 712 345 678 (M-Pesa)"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Exchange Rate:</span>
                <span className="font-semibold text-gray-900">
                  {quote.assetBridge.exchangeRateFormatted}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>AssetBridge Network Fee:</span>
                <span className="font-semibold text-emerald-600 font-mono">
                  {quote.assetBridge.fee} (Only 20¢)
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Speed:</span>
                <span className="font-bold text-emerald-600">
                  {quote.assetBridge.speed}
                </span>
              </div>
              <div className="flex justify-between text-gray-900 pt-2 border-t border-gray-200 font-bold text-sm">
                <span>Receiver Receives:</span>
                <span className="text-indigo-600">{quote.assetBridge.receivedFormatted}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3.5 px-4 bg-[#141518] hover:bg-black text-white text-sm font-bold rounded-xl shadow-lg transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {isSending ? (
                <span>Broadcasting to Testnet (~3s)...</span>
              ) : (
                <>
                  <span>Review & Send {quote.assetBridge.receivedFormatted}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {receipt && (
            <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-sm mb-1 text-emerald-800">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Transfer Confirmed in {receipt.time}!</span>
              </div>
              <p className="mb-2">
                Sent <strong>${receipt.amountUsdt} USDT</strong> → <strong>{receipt.receivedFormatted}</strong> delivered to {receipt.recipient}.
              </p>
              <div className="text-[11px] font-mono text-emerald-700 flex items-center gap-1">
                <span>Tx Hash: {receipt.txHash}</span>
                <ExternalLink size={11} />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Problem Visible Comparison */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-sm">
            <div className="mb-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold mb-1">
                <AlertTriangle size={13} />
                <span>Making the Remittance Problem Visible</span>
              </div>
              <h4 className="text-xl font-bold text-gray-900">
                AssetBridge vs. Typical Bank Wire (SWIFT / MTO)
              </h4>
              <p className="text-xs text-gray-500">
                Sending ${sendAmount} USDT home: see exactly what the receiver gets.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AssetBridge Column */}
              <div className="p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-500 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-extrabold text-sm text-emerald-900">
                      AssetBridge Wallet
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                      RECOMMENDED
                    </span>
                  </div>

                  <div className="mb-4">
                    <span className="text-xs text-emerald-700 font-medium">Receiver Gets:</span>
                    <div className="text-2xl font-black text-emerald-900">
                      {quote.assetBridge.receivedFormatted}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-emerald-900">
                    <div className="flex justify-between">
                      <span>Network Fee:</span>
                      <span className="font-bold">{quote.assetBridge.fee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hidden FX Spread:</span>
                      <span className="font-bold">{quote.assetBridge.hiddenMarkup}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Time:</span>
                      <span className="font-bold flex items-center gap-1">
                        <Zap size={12} className="text-amber-500" />
                        {quote.assetBridge.speed}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-emerald-200 text-[11px] text-emerald-800 font-medium">
                  ✓ Direct mobile settlement
                </div>
              </div>

              {/* Traditional Bank Column */}
              <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-extrabold text-sm text-gray-700">
                      Typical Bank Transfer
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      LEGACY
                    </span>
                  </div>

                  <div className="mb-4">
                    <span className="text-xs text-gray-500 font-medium">Receiver Gets:</span>
                    <div className="text-2xl font-black text-gray-700 line-through decoration-rose-500 decoration-2">
                      {quote.traditionalBank.receivedFormatted}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Fixed Wire Fee:</span>
                      <span className="font-bold text-rose-600">{quote.traditionalBank.fee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hidden FX Markup:</span>
                      <span className="font-bold text-rose-600">{quote.traditionalBank.hiddenCosts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Time:</span>
                      <span className="font-bold text-gray-700 flex items-center gap-1">
                        <Clock size={12} />
                        {quote.traditionalBank.speed}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-200 text-[11px] text-gray-500">
                  ✗ High minimums & broker limits
                </div>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-semibold opacity-90 uppercase tracking-wider">
                  Remittance Problem Solved
                </div>
                <div className="text-base sm:text-lg font-black">
                  Receiver gets {quote.advantage.extraReceivedFormatted} MORE
                </div>
                <p className="text-xs opacity-90">
                  You save ~${quote.advantage.extraReceivedUsd} in fees and avoid 3 to 5 business days of delay.
                </p>
              </div>

              <div className="hidden sm:flex flex-col items-center justify-center p-3 rounded-xl bg-white/20 text-center font-bold text-xs shrink-0 ml-4">
                <span className="text-xl font-extrabold">{quote.advantage.lossWithBankPercent}%</span>
                <span>Bank Cut Saved</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
