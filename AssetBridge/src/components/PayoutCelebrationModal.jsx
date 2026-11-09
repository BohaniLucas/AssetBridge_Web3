import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, ExternalLink, Sparkles, X } from 'lucide-react';

export default function PayoutCelebrationModal({ isOpen, onClose, payoutData }) {
  useEffect(() => {
    if (isOpen) {
      // Trigger festive multi-angle confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          });
        }, 250);
      } catch (e) {
        console.log('Confetti effect triggered');
      }
    }
  }, [isOpen]);

  if (!isOpen || !payoutData) return null;

  const isRotation = payoutData.mode === 'rotation';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-7 shadow-2xl border border-gray-100 text-center overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
        >
          <X size={18} />
        </button>

        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
          <Sparkles className="w-8 h-8 animate-pulse text-emerald-500" />
        </div>

        <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full uppercase tracking-wider mb-2">
          Round {payoutData.round} Unlocked & Settled
        </span>

        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          {isRotation ? `${payoutData.recipient} Received +$${payoutData.amount} USDT!` : `Co-Purchased $${payoutData.amount} of ${payoutData.asset}!`}
        </h3>

        <p className="text-sm text-gray-600 mb-6">
          {isRotation
            ? `All 5 members have contributed their $20 USDT. The smart contract automatically executed the rotation payout without intermediaries!`
            : `Group threshold reached! Contract atomically executed market buy for ${payoutData.asset} and credited vault shares to all 5 members.`}
        </p>

        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-left mb-6 space-y-2 text-xs text-gray-600">
          <div className="flex justify-between">
            <span className="text-gray-500">Beneficiary:</span>
            <span className="font-semibold text-gray-900">{payoutData.recipient}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Amount Paid:</span>
            <span className="font-bold text-emerald-600 text-sm">
              {isRotation ? `+$${payoutData.amount} USDT` : `$${payoutData.amount} -> ${payoutData.asset}`}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-gray-200">
            <span className="text-gray-500">Contract Tx Hash:</span>
            <span className="font-mono text-indigo-600 flex items-center gap-1">
              {payoutData.txHash || '0x49e...a911'}
              <ExternalLink size={12} />
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 px-4 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-lg transition active:scale-[0.99]"
        >
          Great, Continue to Dashboard
        </button>
      </div>
    </div>
  );
}

