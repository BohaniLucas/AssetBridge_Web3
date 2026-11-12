import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  CheckCircle2,
  Circle,
  Share2,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Receipt,
  X,
} from 'lucide-react';
import { walletClientService } from '../services/walletClientService';

export default function SplitPaymentsView({ user }) {
  const userId = user?.email || user?.id || 'demo_user';
  const [splits, setSplits] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isContributing, setIsContributing] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [copyLinkId, setCopyLinkId] = useState(null);

  const [newSplitForm, setNewSplitForm] = useState({
    title: '',
    targetAmountUsdt: 100,
    participantsInput: '',
  });

  const loadSplits = async () => {
    const list = await walletClientService.getSplitPayments(userId);
    if (list && list.length > 0) {
      setSplits(list);
    } else {
      // Default initial split for demo
      setSplits([
        {
          id: 'split-nairobi-dinner',
          creatorUserId: 'lucas@assetbridge.africa',
          creatorAddress: '0x4f0b819D2E527B13D774925dfc477284600be09f',
          title: 'Team Tech Hub & Dinner Expenses',
          targetAmountUsdt: 120,
          collectedAmountUsdt: 60,
          status: 'collecting',
          createdAt: new Date().toISOString(),
          participants: [
            { userId: 'lucas@assetbridge.africa', name: 'Lucas (Organizer)', assignedAmount: 30, paid: true, paidAt: '2026-11-10T14:20:00Z' },
            { userId: 'thandi@assetbridge.africa', name: 'Thandi', assignedAmount: 30, paid: true, paidAt: '2026-11-10T15:10:00Z' },
            { userId: userId, name: `${userId.split('@')[0]} (You)`, assignedAmount: 30, paid: false },
            { userId: 'sipho@assetbridge.africa', name: 'Sipho', assignedAmount: 30, paid: false },
          ],
        },
      ]);
    }
  };

  useEffect(() => {
    loadSplits();
  }, [userId]);

  const handleCreateSplit = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    const emails = newSplitForm.participantsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const created = await walletClientService.createSplitPayment({
        creatorUserId: userId,
        title: newSplitForm.title,
        targetAmountUsdt: newSplitForm.targetAmountUsdt,
        participantIdentifiers: emails,
      });

      setSplits((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewSplitForm({ title: '', targetAmountUsdt: 100, participantsInput: '' });
      setStatusMessage({ type: 'success', text: `Shared expense "${created.title}" deployed!` });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create split.' });
    }
  };

  const handleContribute = async (split) => {
    setIsContributing(true);
    setStatusMessage({ type: '', text: '' });

    try {
      const participant = split.participants.find(
        (p) => p.userId.toLowerCase() === userId.toLowerCase()
      );
      const amount = participant ? participant.assignedAmount : split.targetAmountUsdt / split.participants.length;

      await walletClientService.contributeSplitPayment({
        splitId: split.id,
        contributorUserId: userId,
        amountUsdt: amount,
      });

      setStatusMessage({ type: 'success', text: `Paid $${amount} USDT towards "${split.title}"!` });
      await loadSplits();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Payment failed.' });
    } finally {
      setIsContributing(false);
    }
  };

  return (
    <div className="space-y-7 pb-10">
      {/* Banner */}
      <section className="rounded-[2.5rem] bg-gradient-to-br from-[#101936] via-[#111d3a] to-[#071124] p-7 sm:p-9 text-white shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-300 mb-3">
            <Receipt size={14} />
            <span>Group Shared Expenses · Zero Spread</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Split Bills & Group Payments
          </h2>
          <p className="mt-1 max-w-xl text-xs sm:text-sm text-slate-300 leading-relaxed">
            Split team dinners, rent, utilities, or bulk purchases with friends. Track live on-chain contributions with automated completion verification.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="shrink-0 px-5 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm flex items-center gap-2 transition shadow-lg"
        >
          <Plus size={18} />
          <span>New Shared Expense</span>
        </button>
      </section>

      {/* Alert Banner */}
      {statusMessage.text && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-fade-in ${
            statusMessage.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          {statusMessage.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Split Expenses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {splits.map((split) => {
          const userParticipant = split.participants.find(
            (p) => p.userId.toLowerCase() === userId.toLowerCase()
          );
          const percent = Math.min(100, Math.round((split.collectedAmountUsdt / split.targetAmountUsdt) * 100));
          const isFullyPaid = split.status === 'completed' || percent >= 100;
          const userHasPaid = Boolean(userParticipant?.paid);

          const shareMsg = `Contribute your share for "${split.title}" ($${split.targetAmountUsdt} USDT total) on AssetBridge: http://localhost:5173/?split=${split.id}`;
          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMsg)}`;

          return (
            <div
              key={split.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                      {isFullyPaid ? 'Fully Funded' : 'Collecting'}
                    </span>
                    <h3 className="text-xl font-bold text-slate-950 mt-1.5">{split.title}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Target</span>
                    <p className="text-lg font-black text-slate-900">${split.targetAmountUsdt} USDT</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="my-4">
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600">Collected: ${split.collectedAmountUsdt} USDT</span>
                    <span className="text-teal-700">{percent}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Participants List */}
                <div className="mt-5 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Participants ({split.participants.length})</p>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                    {split.participants.map((p, idx) => {
                      const isMe = p.userId.toLowerCase() === userId.toLowerCase();
                      return (
                        <div key={idx} className="flex items-center justify-between py-2 px-2 text-xs">
                          <span className="font-semibold text-slate-900">
                            {p.name} {isMe && '(You)'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-mono">${p.assignedAmount} USDT</span>
                            {p.paid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 size={12} />
                                <span>Paid</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <Circle size={12} />
                                <span>Pending</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition border border-emerald-200"
                >
                  <Share2 size={14} />
                  <span>Share on WhatsApp</span>
                </a>

                {userParticipant && !userHasPaid && !isFullyPaid ? (
                  <button
                    onClick={() => handleContribute(split)}
                    disabled={isContributing}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
                  >
                    {isContributing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    <span>Pay My Share (${userParticipant.assignedAmount} USDT)</span>
                  </button>
                ) : userHasPaid ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={16} />
                    <span>Your Share Paid</span>
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Split Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-7 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X size={18} />
            </button>
            <h3 className="text-2xl font-bold text-slate-950 mb-1">Create Shared Expense</h3>
            <p className="text-xs text-slate-500 mb-5">
              Set target amount and add participant emails or usernames.
            </p>

            <form onSubmit={handleCreateSplit} className="space-y-4 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1">Expense Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Airbnb Booking & Weekend Groceries"
                  value={newSplitForm.title}
                  onChange={(e) => setNewSplitForm({ ...newSplitForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-normal focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1">Total Target Amount (USDT)</label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  required
                  value={newSplitForm.targetAmountUsdt}
                  onChange={(e) => setNewSplitForm({ ...newSplitForm, targetAmountUsdt: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-normal focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1">Participants (comma-separated usernames or emails)</label>
                <input
                  type="text"
                  placeholder="sipho@assetbridge.africa, thandi@assetbridge.africa"
                  value={newSplitForm.participantsInput}
                  onChange={(e) => setNewSplitForm({ ...newSplitForm, participantsInput: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-normal focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 block mt-1">You will automatically be added as the organizer.</span>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-semibold shadow"
                >
                  Deploy Split
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

