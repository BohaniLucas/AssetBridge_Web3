import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  Circle,
  Plus,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  DollarSign,
  HelpCircle,
  Layers,
  Info,
  AlertCircle,
  Loader2,
  QrCode,
  Share2,
  Copy,
  Check,
  Vote,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import ProgressRing from '../components/ProgressRing';
import PayoutCelebrationModal from '../components/PayoutCelebrationModal';
import { potsService } from '../services/potsService';

export default function StokvelPotsPage({ user }) {
  const storageUserId = user?.email || user?.id || 'demo';
  const [pots, setPots] = useState(() => potsService.getPots(storageUserId));
  const [activePotId, setActivePotId] = useState('friends-stokvel');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [payoutCelebration, setPayoutCelebration] = useState(null);
  const [isContributing, setIsContributing] = useState(false);
  const [contributeError, setContributeError] = useState('');
  const [contributeSuccess, setContributeSuccess] = useState('');
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);

  const [newPotForm, setNewPotForm] = useState({
    name: '',
    mode: 'rotation',
    contributionAmount: 20,
    targetAsset: 'tAAPL',
  });

  // Fetch updated pots on mount
  useEffect(() => {
    potsService.fetchPotsFromBackend(storageUserId).then((backendPots) => {
      if (backendPots && backendPots.length > 0) {
        setPots(backendPots);
      }
    });
  }, [storageUserId]);

  const activePot = pots.find((p) => p.id === activePotId) || pots[0] || {
    id: 'default',
    name: 'Community Pot',
    mode: 'rotation',
    contributionAmount: 20,
    totalPotSize: 100,
    totalRounds: 5,
    currentRound: 1,
    members: [],
    history: [],
    inviteCode: 'POT-STOK-1001',
  };

  const paidCount = activePot.members.filter((m) => m.paid).length;
  const progressPercent = activePot.members.length > 0 ? Math.round((paidCount / activePot.members.length) * 100) : 0;
  const isRotation = activePot.mode === 'rotation';

  const currentUserName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You';
  const userMember = activePot.members.find(
    (m) => (m.userId && m.userId.toLowerCase() === storageUserId.toLowerCase()) || m.isUserSlot || m.id === '5' || m.id === 'm5'
  );
  const hasUserContributed = Boolean(userMember?.paid);

  // Handle member contribution connected to Tether wallet
  const handleContribute = async () => {
    setContributeError('');
    setContributeSuccess('');
    setIsContributing(true);

    try {
      const result = await potsService.contributeToPot(activePot.id, user, storageUserId);
      if (result) {
        setPots([...result.pots]);
        setContributeSuccess(`Successfully contributed $${activePot.contributionAmount} USDT to ${activePot.name}.`);
        if (result.payoutEvent) {
          setPayoutCelebration(result.payoutEvent);
        }
      }
    } catch (err) {
      setContributeError(err.message || 'Failed to submit contribution.');
    } finally {
      setIsContributing(false);
    }
  };

  // Join pot with code
  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    setContributeError('');
    try {
      const result = await potsService.joinPot(inviteCodeInput.trim(), user, storageUserId);
      if (result?.pot) {
        setPots(potsService.getPots(storageUserId));
        setActivePotId(result.pot.id);
        setShowJoinModal(false);
        setInviteCodeInput('');
        setContributeSuccess(`Joined ${result.pot.name} successfully!`);
      }
    } catch (err) {
      setContributeError(err.message || 'Could not join pot.');
    }
  };

  // Vote on investment asset
  const handleVote = async (approved) => {
    try {
      await potsService.voteInvestment(activePot.id, approved, storageUserId);
      setContributeSuccess(`Recorded vote: ${approved ? 'Approved' : 'Rejected'} asset purchase.`);
      const updated = await potsService.fetchPotsFromBackend(storageUserId);
      setPots([...updated]);
    } catch (err) {
      setContributeError(err.message || 'Voting failed.');
    }
  };

  // Create new pot
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const created = potsService.createPot(newPotForm, user, storageUserId);
    setPots(potsService.getPots(storageUserId));
    setActivePotId(created.id);
    setShowCreateModal(false);
  };

  const inviteShareText = `Join our group savings & investment vault "${activePot.name}" on AssetBridge! Invite Code: ${activePot.inviteCode || 'POT-STOK-1001'}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteShareText)}`;

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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-emerald-300 mb-3 border border-white/10">
              <ShieldCheck size={14} />
              <span>Smart Contract Group Wallets · Stokvel, Ajo, Chama, Susu</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Automated Group Savings & Co-Investing
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Pan-African smart-contract vaults governed on Tether. Group contributions are securely locked in on-chain escrow until the round completes, automatically triggering payouts or tokenized equity investments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 transition border border-white/15"
            >
              <QrCode size={16} />
              <span>Join with Code</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs flex items-center gap-2 transition shadow-lg active:scale-95"
            >
              <Plus size={16} />
              <span>Create New Pot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pot Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {pots.map((pot) => (
            <button
              key={pot.id}
              onClick={() => {
                setActivePotId(pot.id);
                setContributeError('');
                setContributeSuccess('');
              }}
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
                {pot.mode === 'rotation' ? 'Rotation' : 'Investment Club'}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowQrModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
        >
          <Share2 size={14} className="text-teal-600" />
          <span>Pot QR & WhatsApp Invite</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {contributeError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2 animate-fade-in">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{contributeError}</span>
        </div>
      )}
      {contributeSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{contributeSuccess}</span>
        </div>
      )}

      {/* Active Pot Interactive Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Progress Ring & Pot Overview */}
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
                <div className="text-xs text-gray-500 font-medium">Escrow Vault Balance:</div>
                <div className="text-2xl font-black text-gray-900">
                  ${activePot.contributionAmount * paidCount} / ${activePot.totalPotSize || activePot.totalPot} USDT
                </div>
                <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1 justify-center sm:justify-start">
                  <CheckCircle2 size={13} />
                  <span>
                    {progressPercent === 100
                      ? 'Round pool fully funded · Payout disbursed'
                      : `Awaiting ${activePot.members.length - paidCount} contribution(s)`}
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
                  <span className="font-bold text-indigo-600">{activePot.targetAsset} (Apple Inc. Token)</span>
                </div>
              )}

              <div className="flex justify-between text-gray-600 pt-1 border-t border-gray-100">
                <span>Governance Protocol:</span>
                <span className="text-gray-900 font-medium">Automated Tether Smart Escrow</span>
              </div>

              {/* Investment approval voting */}
              {!isRotation && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">Member Investment Approval:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVote(true)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px] border border-emerald-200"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleVote(false)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[11px] border border-rose-200"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Button: Contribute USDT */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            {hasUserContributed ? (
              <div className="w-full py-3.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>You contributed ${activePot.contributionAmount} USDT for this round</span>
              </div>
            ) : (
              <button
                onClick={handleContribute}
                disabled={isContributing}
                className="w-full py-3.5 px-4 bg-[#141518] hover:bg-black text-white text-sm font-bold rounded-xl shadow-lg transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isContributing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Signing On-Chain Escrow...</span>
                  </>
                ) : (
                  <>
                    <span>Contribute ${activePot.contributionAmount} USDT</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Member List & Payout Order */}
        <div className="lg:col-span-7 space-y-6">
          {/* Member List Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-base font-bold text-gray-900">
                  Pot Members & Payout Schedule
                </h4>
                <p className="text-xs text-gray-500">
                  Cryptographically verified payout order agreed in advance by all members.
                </p>
              </div>
              <span className="text-xs font-semibold text-gray-400">
                {activePot.members.length} Members
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {activePot.members.map((member) => {
                const isCurrentBeneficiary = isRotation && member.payoutOrder === activePot.currentRound;
                const isSelf = member.isUserSlot || member.isUser || member.id === '5' || member.id === 'm5' || member.userId === storageUserId;
                const displayName = isSelf ? `${currentUserName} (You)` : member.name;

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
                            {displayName}
                          </span>
                          {isCurrentBeneficiary && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white uppercase tracking-wider">
                              Receives ${activePot.totalPotSize || activePot.totalPot} USDT
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
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-gray-900">
                On-Chain Round History
              </h4>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <ShieldCheck size={13} />
                <span>Audited Escrow</span>
              </span>
            </div>

            {(activePot.history || activePot.payoutHistory || []).length === 0 ? (
              <p className="text-xs text-gray-400">No rounds completed yet.</p>
            ) : (
              <div className="space-y-2">
                {(activePot.history || activePot.payoutHistory || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-gray-900">{item.event || item.beneficiary}</span>
                      <span className="text-gray-400 ml-2">({item.date})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600">{item.amount ? `$${item.amount} USDT` : ''}</span>
                      {item.txHash || item.tx ? (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${item.txHash || item.tx}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-indigo-600 flex items-center gap-1 hover:underline"
                        >
                          {(item.txHash || item.tx).slice(0, 8)}...{(item.txHash || item.tx).slice(-6)}
                          <ExternalLink size={12} />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Pot QR / Invite Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 text-center relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Invite Members</h3>
            <p className="text-xs text-gray-500 mb-4">{activePot.name}</p>

            <div className="p-4 bg-white rounded-2xl border-2 border-slate-100 inline-block shadow-sm">
              <QRCodeSVG
                value={`assetbridge:stokvel:${activePot.inviteCode || activePot.id}`}
                size={170}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Invite Code</span>
              <div className="flex items-center justify-center gap-2 font-mono font-bold text-slate-900 text-sm">
                <span>{activePot.inviteCode || 'STOK-FRND-8821'}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activePot.inviteCode || 'STOK-FRND-8821');
                    setCopyCodeSuccess(true);
                    setTimeout(() => setCopyCodeSuccess(false), 2000);
                  }}
                  className="text-slate-400 hover:text-slate-800"
                >
                  {copyCodeSuccess ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
              >
                <Share2 size={14} />
                <span>Share via WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Join Pot Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-7 shadow-2xl border border-gray-100 text-gray-900 relative">
            <button
              onClick={() => setShowJoinModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full"
            >
              <X size={18} />
            </button>
            <h3 className="text-xl font-bold mb-1">Join an Existing Pot</h3>
            <p className="text-xs text-gray-500 mb-5">
              Enter the group invitation code provided by the organizer.
            </p>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Pot Invitation Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STOK-FRND-8821"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-mono uppercase focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white font-semibold text-xs shadow"
                >
                  Join Pot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Pot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-7 shadow-2xl border border-gray-100 text-gray-900">
            <h3 className="text-2xl font-bold mb-1">Create a Group Vault Pot</h3>
            <p className="text-xs text-gray-500 mb-5">
              Set group rules, contribution amount, and smart-contract payout schedule.
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
