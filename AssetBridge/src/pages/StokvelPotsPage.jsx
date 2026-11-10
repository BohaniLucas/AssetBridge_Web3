import React, { useState } from 'react';
import { Users, CheckCircle2, Circle, Plus, Sparkles, RefreshCw, ArrowRight, ExternalLink, ShieldCheck, DollarSign, HelpCircle, Layers, Info } from 'lucide-react';
import ProgressRing from '../components/ProgressRing';
import PayoutCelebrationModal from '../components/PayoutCelebrationModal';
import { potsService } from '../services/potsService';

export default function StokvelPotsPage({ user }) {
  const storageUserId = user?.email || user?.id || 'demo';
  const [pots, setPots] = useState(() => potsService.getPots(storageUserId));
  const [activePotId, setActivePotId] = useState('friends-stokvel');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [payoutCelebration, setPayoutCelebration] = useState(null);
  const [newPotForm, setNewPotForm] = useState({
    name: '',
    mode: 'rotation',
    contributionAmount: 20,
    targetAsset: 'tAAPL',
  });

  const activePot = pots.find((p) => p.id === activePotId) || pots[0];
  const paidCount = activePot.members.filter((m) => m.paid).length;
  const progressPercent = Math.round((paidCount / activePot.members.length) * 100);
  const isRotation = activePot.mode === 'rotation';

  // Handle member contribution (Simulate 5th member paying for the 40s demo)
  const handleContribute = () => {
    const result = potsService.contributeToPot(activePot.id, '5', storageUserId);
    if (result) {
      setPots([...result.pots]);
      if (result.payoutEvent) {
        setPayoutCelebration(result.payoutEvent);
      }
    }
  };

  // Next Round button for the demo
  const handleNextRound = () => {
    const result = potsService.advanceNextRound(activePot.id, storageUserId);
    if (result) {
      setPots([...result.pots]);
    }
  };

  // Reset demo
  const handleResetDemo = () => {
    const resetList = potsService.resetDemo(storageUserId);
    setPots([...resetList]);
  };

  // Create new pot
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const created = potsService.createPot(newPotForm, storageUserId);
    setPots(potsService.getPots(storageUserId));
    setActivePotId(created.id);
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Payout Modal */}
      <PayoutCelebrationModal
        isOpen={Boolean(payoutCelebration)}
        onClose={() => setPayoutCelebration(null)}
        payoutData={payoutCelebration}
      />

      {/* Top Banner / Concept Explainer */}
      <div className="bg-gradient-to-r from-gray-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-emerald-300 mb-3 border border-white/10">
            <ShieldCheck size={14} />
            <span>Pan-African Group Wallet: Stokvel, Ajo, Chama, Susu</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Automated Group Savings & Co-Investing
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
            Track group contributions and agreed payout order. This preview stores demo activity in this browser; no USDT is collected and no smart contract payout or investment is executed.
          </p>
        </div>

        {/* Demo Controller Toolbar */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
                <span className="font-bold text-gray-300">Preview controls:</span>
            <button
              onClick={handleNextRound}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition shadow"
              title="Fast-forward month to next rotation round"
            >
              <RefreshCw size={13} />
              <span>Next Round (Demo Step)</span>
            </button>
            <button
              onClick={handleResetDemo}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 font-medium transition"
              title="Reset pot to 4/5 paid state"
            >
              Reset 4/5 Paid State
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-900 font-bold flex items-center gap-1.5 transition shadow-sm ml-auto"
          >
            <Plus size={15} />
            <span>Create New Pot</span>
          </button>
        </div>
      </div>

      {/* Two Modes Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        {pots.map((pot) => (
          <button
            key={pot.id}
            onClick={() => setActivePotId(pot.id)}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 shadow-sm border ${
              activePotId === pot.id
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>{pot.name}</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                pot.mode === 'rotation'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {pot.mode === 'rotation' ? 'Rotation Pot' : 'Investment Pot'}
            </span>
          </button>
        ))}
      </div>

      {/* Active Pot Interactive Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Progress Ring & Pot Overview (~5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {isRotation ? 'Rotation Mode (Stokvel)' : 'Investment Club Mode'}
                </span>
                <h3 className="text-2xl font-black text-gray-900 mt-0.5">
                  {activePot.name}
                </h3>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                Round {activePot.currentRound} of {activePot.totalRounds}
              </span>
            </div>

            {/* Circular Progress & Status Callout */}
            <div className="my-6 flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-gray-50 border border-gray-100">
              <ProgressRing
                radius={54}
                stroke={9}
                progress={progressPercent}
                label={`${paidCount} of ${activePot.members.length}`}
                sublabel="members paid"
              />

              <div className="text-center sm:text-left space-y-1">
                <div className="text-xs text-gray-500 font-medium">Current Pot Pool:</div>
                <div className="text-2xl font-black text-gray-900">
                  ${activePot.contributionAmount * paidCount} / ${activePot.totalPot} USDT
                </div>
              <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1 justify-center sm:justify-start">
                  <CheckCircle2 size={13} />
                  <span>
                    {progressPercent === 100
                      ? 'Demo round complete. No funds moved.'
                      : 'Waiting for final contribution'}
                  </span>
                </div>
              </div>
            </div>

            {/* Mode-specific detail card */}
            <div className="p-4 rounded-2xl border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Contribution per member:</span>
                <span className="font-bold text-gray-900">${activePot.contributionAmount} USDT / month</span>
              </div>

              {isRotation ? (
                <div className="flex justify-between text-gray-600">
                  <span>Round {activePot.currentRound} Beneficiary:</span>
                  <span className="font-bold text-indigo-600">
                    {activePot.members.find((m) => m.payoutOrder === activePot.currentRound)?.name || 'Next Member'}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between text-gray-600">
                  <span>Target Investment Asset:</span>
                  <span className="font-bold text-indigo-600">{activePot.targetAsset} (Apple Token)</span>
                </div>
              )}

              <div className="flex justify-between text-gray-600 pt-1 border-t border-gray-100">
                <span>Contract Rule:</span>
                <span className="text-gray-900 font-medium">Payout requires a real contract integration</span>
              </div>
            </div>
          </div>

          {/* Action Button: Contribute $20 USDT */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            {activePot.members.find((m) => m.id === '5')?.paid ? (
              <div className="w-full py-3.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>You have contributed ${activePot.contributionAmount} USDT for this round!</span>
              </div>
            ) : (
              <button
                onClick={handleContribute}
                className="w-full py-3.5 px-4 bg-[#141518] hover:bg-black text-white text-sm font-bold rounded-xl shadow-lg transition active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span>Record demo contribution · ${activePot.contributionAmount} USDT</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Member List & Payout Order (~7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Member List Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-base font-bold text-gray-900">
                  Pot Members & Payout Schedule
                </h4>
                <p className="text-xs text-gray-500">
                  Fixed order agreed in advance by all members.
                </p>
              </div>
              <span className="text-xs font-semibold text-gray-400">
                {activePot.members.length} Members
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {activePot.members.map((member) => {
                const isCurrentBeneficiary = isRotation && member.payoutOrder === activePot.currentRound;
                return (
                  <div
                    key={member.id}
                    className={`py-3.5 px-3 rounded-2xl flex items-center justify-between transition ${
                      isCurrentBeneficiary ? 'bg-indigo-50/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg border border-gray-200">
                        {member.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">
                            {member.name}
                          </span>
                          {isCurrentBeneficiary && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white uppercase tracking-wider">
                              Receives ${activePot.totalPot}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                          Payout Turn: Round #{member.payoutOrder}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {member.paid ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                          <CheckCircle2 size={14} />
                          <span>Paid ${activePot.contributionAmount}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                          <Circle size={14} />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pot Payout History */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h4 className="text-base font-bold text-gray-900 mb-3">
              Demo Round History
            </h4>
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <Info size={15} className="mt-0.5 shrink-0" />
              <span>History is saved in this browser only. Demo references are not blockchain transaction hashes.</span>
            </div>
            {activePot.payoutHistory.length === 0 ? (
              <p className="text-xs text-gray-400">No demo rounds completed yet.</p>
            ) : (
              <div className="space-y-2">
                {activePot.payoutHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-gray-900">{item.beneficiary}</span>
                      <span className="text-gray-400 ml-2">({item.date})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600">{item.amount}</span>
                      <span className="font-mono text-indigo-600 flex items-center gap-1 hover:underline cursor-pointer">
                        {item.tx}
                        <ExternalLink size={12} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Pot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-7 shadow-2xl border border-gray-100 text-gray-900">
            <h3 className="text-2xl font-bold mb-1">Create a Stokvel Pot</h3>
            <p className="text-xs text-gray-500 mb-5">
              Set group rules, contribution amount, and fixed payout schedule.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-semibold text-gray-700">
              <div>
                <label className="block mb-1">Pot Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Family Emergency Chama"
                  value={newPotForm.name}
                  onChange={(e) => setNewPotForm({ ...newPotForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-normal focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPotForm({ ...newPotForm, mode: 'rotation' })}
                    className={`p-3 rounded-xl border text-left transition ${
                      newPotForm.mode === 'rotation'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold">Rotation Pot</div>
                    <div className="text-[10px] opacity-80 mt-0.5">Stokvel, Ajo, Chama</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPotForm({ ...newPotForm, mode: 'investment' })}
                    className={`p-3 rounded-xl border text-left transition ${
                      newPotForm.mode === 'investment'
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold">Investment Pot</div>
                    <div className="text-[10px] opacity-80 mt-0.5">Co-buy tokenised equities</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block mb-1">Contribution Amount (USDT per member)</label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={newPotForm.contributionAmount}
                  onChange={(e) => setNewPotForm({ ...newPotForm, contributionAmount: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-normal focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              {newPotForm.mode === 'investment' && (
                <div>
                  <label className="block mb-1">Target Tokenised Asset</label>
                  <select
                    value={newPotForm.targetAsset}
                    onChange={(e) => setNewPotForm({ ...newPotForm, targetAsset: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-normal focus:ring-2 focus:ring-gray-900 focus:outline-none"
                  >
                    <option value="tAAPL">tAAPL (Apple Inc.)</option>
                    <option value="tTSLA">tTSLA (Tesla Inc.)</option>
                    <option value="tNVDA">tNVDA (NVIDIA Corp.)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white font-semibold shadow"
                >
                  Deploy Pot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

