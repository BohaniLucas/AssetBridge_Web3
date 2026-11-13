import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  CheckCircle2,
  Circle,
  Plus,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  QrCode,
  Share2,
  Copy,
  Check,
  X,
  FileText,
  Clock,
  History,
  AlertTriangle,
  Globe,
  Lock,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { potsService } from '../services/potsService';

const SEPOLIA_USDT_CONTRACT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';
const SEPOLIA_CHAIN_ID = 11155111;

export default function StokvelPotsPage({ user }) {
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'discover'
  const [myPots, setMyPots] = useState([]);
  const [discoverablePots, setDiscoverablePots] = useState([]);
  const [activePotId, setActivePotId] = useState(null);
  const [activePotDetails, setActivePotDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const [showJoinByTokenModal, setShowJoinByTokenModal] = useState(false);
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [targetApplyPot, setTargetApplyPot] = useState(null);
  const [applyNote, setApplyNote] = useState('');

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  // New Stokvel Form
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    contributionAmount: 50,
    maxMembers: 5,
    frequency: 'monthly',
    discoverability: 'discoverable_open',
    deadlineDays: 3,
    graceDays: 2,
    timezone: 'Africa/Johannesburg',
  });
  const [isCreating, setIsCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [mine, discoverable] = await Promise.all([
        potsService.getMyStokvels().catch(() => []),
        potsService.getDiscoverableStokvels().catch(() => []),
      ]);
      setMyPots(mine);
      setDiscoverablePots(discoverable);

      const targetId = activePotId || (mine.length > 0 ? mine[0].id : null);
      if (targetId) {
        setActivePotId(targetId);
        const details = await potsService.getStokvelDetails(targetId).catch(() => null);
        setActivePotDetails(details);
      } else {
        setActivePotDetails(null);
      }
    } finally {
      setLoading(false);
    }
  }, [activePotId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectPot = async (id) => {
    setActivePotId(id);
    setFeedbackError('');
    setFeedbackSuccess('');
    try {
      const details = await potsService.getStokvelDetails(id);
      setActivePotDetails(details);
    } catch (err) {
      setFeedbackError(err.message || 'Could not load group details');
    }
  };

  // Create Stokvel
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFeedbackError('');
    setIsCreating(true);
    try {
      const payload = {
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        contributionAmount: Number(createForm.contributionAmount),
        maxMembers: Number(createForm.maxMembers),
        frequency: createForm.frequency,
        discoverability: createForm.discoverability,
        firstCycleDate: new Date().toISOString(),
        contributionDeadlineDays: Number(createForm.deadlineDays),
        gracePeriodDays: Number(createForm.graceDays),
        timezone: createForm.timezone,
      };

      const created = await potsService.createStokvel(payload);
      setFeedbackSuccess(`Rotating stokvel "${created.name}" created successfully under immutable terms.`);
      setShowCreateModal(false);
      setActivePotId(created.id);
      await loadData();
    } catch (err) {
      setFeedbackError(err.message || 'Failed to create stokvel');
    } finally {
      setIsCreating(false);
    }
  };

  // Generate Invite
  const handleGenerateInvite = async () => {
    if (!activePotId) return;
    try {
      const res = await potsService.generateInvite(activePotId, { maxUses: 1, expiryHours: 72 });
      setGeneratedInvite(res);
      setShowInviteModal(true);
    } catch (err) {
      setFeedbackError(err.message || 'Permission denied: only Owner or Co-admin can issue invites.');
    }
  };

  // Preview Invite
  const handlePreviewToken = async (e) => {
    e.preventDefault();
    if (!inviteTokenInput.trim()) return;
    setPreviewLoading(true);
    setFeedbackError('');
    try {
      const preview = await potsService.previewInvite(inviteTokenInput.trim());
      setPreviewData(preview);
    } catch (err) {
      setFeedbackError(err.message || 'Invalid, expired, or revoked invitation token.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Accept Invite
  const handleAcceptInvite = async () => {
    if (!previewData) return;
    try {
      await potsService.acceptInvite(inviteTokenInput.trim(), previewData.termsVersion);
      setFeedbackSuccess(`Successfully accepted terms and joined ${previewData.name}!`);
      setShowJoinByTokenModal(false);
      setInviteTokenInput('');
      setPreviewData(null);
      await loadData();
    } catch (err) {
      setFeedbackError(err.message || 'Failed to complete admission.');
    }
  };

  // Apply to Discoverable Group
  const handleApplyToJoin = async (e) => {
    e.preventDefault();
    if (!targetApplyPot) return;
    try {
      await potsService.requestToJoin(targetApplyPot.id, applyNote.trim());
      setFeedbackSuccess(`Join application submitted for ${targetApplyPot.name}. The Owner or Co-admin will review it.`);
      setShowApplyModal(false);
      setApplyNote('');
      await loadData();
    } catch (err) {
      setFeedbackError(err.message || 'Could not submit application.');
    }
  };

  // Review Application
  const handleReviewRequest = async (reqId, status) => {
    if (!activePotId) return;
    try {
      await potsService.reviewJoinRequest(activePotId, reqId, status);
      setFeedbackSuccess(`Applicant was ${status}.`);
      await loadData();
    } catch (err) {
      setFeedbackError(err.message || 'Failed to review request.');
    }
  };

  // Accept Approved Terms
  const handleAcceptApprovedTerms = async (stokvelId, termsVersion) => {
    try {
      await potsService.acceptApprovedTerms(stokvelId, termsVersion);
      setFeedbackSuccess('Terms accepted! You are now an active member.');
      await loadData();
    } catch (err) {
      setFeedbackError(err.message || 'Could not accept terms.');
    }
  };

  // Dispute
  const handleRaiseDispute = async (e) => {
    e.preventDefault();
    if (!activePotId || !disputeReason.trim()) return;
    try {
      await potsService.raiseDispute(activePotId, { reason: disputeReason.trim() });
      setFeedbackSuccess('Formal dispute notice recorded and logged on the audit trail.');
      setShowDisputeModal(false);
      setDisputeReason('');
      await loadData();
    } catch (err) {
      setFeedbackError(err.message || 'Failed to log dispute.');
    }
  };

  // Audit
  const handleOpenAudit = async () => {
    if (!activePotId) return;
    try {
      const logs = await potsService.getAuditTrail(activePotId);
      setAuditLogs(logs);
      setShowAuditModal(true);
    } catch (err) {
      setFeedbackError(err.message || 'Audit trail is restricted to enrolled members.');
    }
  };

  const isOwnerOrCoAdmin =
    activePotDetails?.user_role === 'owner' || activePotDetails?.user_role === 'co_admin';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-gray-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-400 mb-3 border border-emerald-500/20">
              <ShieldCheck size={14} />
              <span>Rotating Payout Stokvel (ROSCA) Only</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Non-Custodial Rotating Stokvels
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Transparent, immutable community savings. Every member contributes an equal amount each cycle; one scheduled recipient receives the pooled funds in rotation. Non-custodial Sepolia USDT testnet governance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setInviteTokenInput('');
                setPreviewData(null);
                setShowJoinByTokenModal(true);
              }}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 transition border border-white/15"
            >
              <QrCode size={16} />
              <span>Join via Invite</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs flex items-center gap-2 transition shadow-lg active:scale-95"
            >
              <Plus size={16} />
              <span>Create Rotating Stokvel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Disabled Future Types Disclaimer */}
      <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
        <AlertTriangle size={16} className="text-amber-500 shrink-0" />
        <div>
          <span className="font-semibold text-slate-800">Supported Scope: </span>
          Only Rotating Payout Stokvels (ROSCA) are operational. Investment, lending, grocery, and burial stokvel types are disabled until audited smart-contract vaults are reviewed and approved.
        </div>
      </div>

      {/* Main Tabs: My Stokvels vs Discover */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'my'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <Users size={15} />
            <span>My Stokvels ({myPots.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'discover'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <Globe size={15} />
            <span>Discover Open Groups ({discoverablePots.length})</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {feedbackError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{feedbackError}</span>
          </div>
          <button onClick={() => setFeedbackError('')}><X size={14} /></button>
        </div>
      )}
      {feedbackSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
          <button onClick={() => setFeedbackSuccess('')}><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
          <Loader2 className="animate-spin text-gray-400" size={24} />
          <span className="text-xs font-semibold">Loading Stokvels…</span>
        </div>
      ) : activeTab === 'discover' ? (
        /* DISCOVERABLE GROUPS VIEW */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">Open Community Directories</h3>
              <p className="text-xs text-gray-500">Apply to join an open group. Once approved by the Owner or Co-admin, you must explicitly accept terms to be enrolled.</p>
            </div>
          </div>

          {discoverablePots.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <Globe size={36} className="mx-auto text-gray-400 mb-3" />
              <h4 className="text-sm font-bold text-gray-800">No Open Groups Listed</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                There are currently no discoverable stokvels accepting applications. Create one or ask an organizer for a direct invitation link.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {discoverablePots.map((pot) => {
                const expectedPool = Math.round(pot.max_members * Number(pot.contribution_amount) * 100) / 100;
                const isFull = pot.join_status === 'closed';

                return (
                  <div key={pot.id} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-bold text-gray-900 text-sm">{pot.name}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isFull ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isFull ? 'Capacity Reached' : 'Open'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-4">
                        {pot.description || 'Rotating Payout Stokvel (ROSCA)'}
                      </p>

                      <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-xl p-3 mb-4 text-xs">
                        <div>
                          <span className="text-[10px] text-gray-500 block">Contribution</span>
                          <span className="font-bold text-gray-900">${pot.contribution_amount} USDT</span>
                          <span className="text-[10px] text-gray-400 block">{pot.frequency}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500 block">Expected Pool (N×C)</span>
                          <span className="font-bold text-emerald-600">${expectedPool.toFixed(2)} USDT</span>
                          <span className="text-[10px] text-gray-400 block">{pot.max_members} members</span>
                        </div>
                      </div>
                    </div>

                    <button
                      disabled={isFull}
                      onClick={() => {
                        setTargetApplyPot(pot);
                        setShowApplyModal(true);
                      }}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                        isFull
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-900 hover:bg-gray-800 text-white shadow-sm'
                      }`}
                    >
                      <span>{isFull ? 'Group Closed' : 'Apply to Join Group'}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* MY STOKVELS VIEW */
        <div className="space-y-6">
          {myPots.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <Users size={36} className="mx-auto text-gray-400 mb-3" />
              <h4 className="text-sm font-bold text-gray-800">You Are Not in Any Stokvels</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                You have not created or joined any rotating groups yet.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-gray-900 text-white font-bold text-xs hover:bg-gray-800 transition"
                >
                  Create Rotating Stokvel
                </button>
                <button
                  onClick={() => setActiveTab('discover')}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200 transition"
                >
                  Browse Open Groups
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Group Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                {myPots.map((pot) => (
                  <button
                    key={pot.id}
                    onClick={() => handleSelectPot(pot.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      activePotId === pot.id
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <span>{pot.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 uppercase">
                      {pot.lifecycle_status}
                    </span>
                  </button>
                ))}
              </div>

              {activePotDetails && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Details & Overview */}
                  <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <h3 className="text-xl font-extrabold text-gray-900">{activePotDetails.name}</h3>
                          <p className="text-xs text-gray-500">Rotating ROSCA · Terms v{activePotDetails.terms_version}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            Role: {activePotDetails.user_role || 'member'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                            {activePotDetails.lifecycle_status}
                          </span>
                        </div>
                      </div>

                      {activePotDetails.description && (
                        <p className="text-xs text-gray-600 mt-2">{activePotDetails.description}</p>
                      )}
                    </div>

                    {/* Pending Approved Reservation Banner */}
                    {activePotDetails.my_request?.status === 'approved' && (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                        <div className="flex items-center gap-2 font-bold mb-1">
                          <Clock size={15} className="text-amber-600" />
                          <span>Seat Reserved! Action Required</span>
                        </div>
                        <p className="text-[11px] text-amber-700 mb-3">
                          Your application was approved by the group administration. A seat has been reserved for 48 hours. Review and accept the immutable terms to complete your enrollment.
                        </p>
                        <button
                          onClick={() => handleAcceptApprovedTerms(activePotDetails.id, activePotDetails.terms_version)}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition"
                        >
                          Accept Immutable Terms & Enter
                        </button>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-2xl p-4 text-center">
                      <div>
                        <span className="text-[10px] text-gray-500 font-medium block">Contribution</span>
                        <span className="text-base font-extrabold text-gray-900">${activePotDetails.contribution_amount}</span>
                        <span className="text-[10px] text-gray-400 block">USDT / {activePotDetails.frequency}</span>
                      </div>
                      <div className="border-x border-gray-200">
                        <span className="text-[10px] text-gray-500 font-medium block">Expected Pool</span>
                        <span className="text-base font-extrabold text-emerald-600">
                          ${Math.round(activePotDetails.max_members * Number(activePotDetails.contribution_amount) * 100) / 100}
                        </span>
                        <span className="text-[10px] text-gray-400 block">N×C USDT</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-medium block">Active Members</span>
                        <span className="text-base font-extrabold text-gray-900">
                          {(activePotDetails.members || []).length}/{activePotDetails.max_members}
                        </span>
                        <span className="text-[10px] text-gray-400 block">{activePotDetails.join_status === 'closed' ? 'Closed' : 'Open'}</span>
                      </div>
                    </div>

                    {/* Non-Custodial Safety Callout */}
                    <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-start gap-2.5">
                      <ShieldCheck size={16} className="text-sky-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <span className="font-semibold text-sky-950">Testnet Non-Custodial Safety: </span>
                        Financial contribution and payout writes remain disabled until real WDK signing and on-chain verification are integrated. No mock tx hashes or fake balances are recorded.
                      </div>
                    </div>

                    {/* Quick Group Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {isOwnerOrCoAdmin && (
                        <button
                          onClick={handleGenerateInvite}
                          className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <Share2 size={13} />
                          <span>Invite Link</span>
                        </button>
                      )}
                      <button
                        onClick={() => setShowTermsModal(true)}
                        className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <FileText size={13} />
                        <span>Constitution</span>
                      </button>
                      <button
                        onClick={handleOpenAudit}
                        className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <History size={13} />
                        <span>Audit Trail</span>
                      </button>
                      <button
                        onClick={() => setShowDisputeModal(true)}
                        className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <AlertCircle size={13} />
                        <span>File Dispute</span>
                      </button>
                    </div>

                    {/* Token Allowlist Info */}
                    <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-3">
                      <span className="font-semibold text-gray-700">Token Allowlist: </span>
                      Provisional Sepolia USDT (<code className="text-gray-800">{SEPOLIA_USDT_CONTRACT.slice(0, 10)}...{SEPOLIA_USDT_CONTRACT.slice(-6)}</code>, Chain {SEPOLIA_CHAIN_ID})
                    </div>
                  </div>

                  {/* Right Column: Schedule, Rotation Roster & Admin Inbox */}
                  <div className="lg:col-span-7 space-y-6">
                    {/* Admin Review Inbox */}
                    {isOwnerOrCoAdmin && (activePotDetails.join_requests || []).filter((r) => r.status === 'pending').length > 0 && (
                      <div className="bg-white rounded-3xl p-5 border border-amber-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                            <Clock size={14} className="text-amber-600" />
                            <span>Pending Join Applications ({activePotDetails.join_requests.filter((r) => r.status === 'pending').length})</span>
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {(activePotDetails.join_requests || [])
                            .filter((r) => r.status === 'pending')
                            .map((req) => (
                              <div key={req.id} className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex items-center justify-between gap-3 text-xs">
                                <div>
                                  <div className="font-bold text-gray-900">Applicant: {req.user_id.slice(0, 8)}...</div>
                                  <div className="text-gray-500 text-[11px]">{req.note || 'No note provided'}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleReviewRequest(req.id, 'approved')}
                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReviewRequest(req.id, 'declined')}
                                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                                  >
                                    Decline
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Schedule & Rotation Roster */}
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-extrabold text-gray-900">Rotation Schedule & Payout Order</h4>
                        <span className="text-xs text-gray-500">1 Round · {activePotDetails.max_members} Cycles</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                        Every member contributes in each cycle, including their own payout cycle. One recipient receives the pooled funds each round in agreed sequence. Short-month calendar cutoffs automatically resolve to month-end.
                      </p>

                      <div className="divide-y divide-gray-100">
                        {(activePotDetails.schedule || []).map((slot) => {
                          const member = (activePotDetails.members || []).find((m) => m.rotation_order === slot.cycleNumber);

                          return (
                            <div key={slot.cycleNumber} className="py-3 flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-xs">
                                  #{slot.cycleNumber}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-900">
                                    {member ? `Member (${member.user_id.slice(0, 8)}...)` : `Unassigned Slot #${slot.cycleNumber}`}
                                  </div>
                                  <div className="text-[11px] text-gray-500">
                                    Due: {slot.cutoffDate?.slice(0, 10)} · Disburse: {slot.payoutDate?.slice(0, 10)}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="font-extrabold text-emerald-600">${slot.expectedPool} USDT</div>
                                <div className="text-[10px] text-gray-400 uppercase font-semibold">Scheduled</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* MODAL 1: Create Rotating Stokvel */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-gray-900">Create Rotating Stokvel (ROSCA)</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 leading-relaxed">
              <span className="font-bold">Rotating Payout Only: </span>
              Fixed roster, equal contributions every cycle, and single scheduled payouts. Investment, lending, and grocery stokvels are disabled.
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Stokvel Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pretoria Rotating Chama"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Community purpose or mutual support focus..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Contribution (USDT)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={createForm.contributionAmount}
                    onChange={(e) => setCreateForm({ ...createForm, contributionAmount: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Member Capacity (N)</label>
                  <input
                    type="number"
                    min="2"
                    max="50"
                    required
                    value={createForm.maxMembers}
                    onChange={(e) => setCreateForm({ ...createForm, maxMembers: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Frequency</label>
                  <select
                    value={createForm.frequency}
                    onChange={(e) => setCreateForm({ ...createForm, frequency: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="biweekly">Bi-Weekly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Discoverability</label>
                  <select
                    value={createForm.discoverability}
                    onChange={(e) => setCreateForm({ ...createForm, discoverability: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  >
                    <option value="discoverable_open">Discoverable (Open Application)</option>
                    <option value="private_invite_only">Private (Direct Invite Only)</option>
                  </select>
                </div>
              </div>

              {/* Pool Math Live Display */}
              <div className="bg-gray-900 text-white rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                  <span>Expected Cycle Pool (N × C)</span>
                  <span>{createForm.maxMembers || 0} members × ${createForm.contributionAmount || 0} USDT</span>
                </div>
                <div className="text-2xl font-black text-white">
                  ${(Number(createForm.maxMembers || 0) * Number(createForm.contributionAmount || 0)).toFixed(2)} USDT
                </div>
                <div className="text-[10px] text-gray-400">
                  Before disclosed network gas fees. Fixed 1 round of {createForm.maxMembers || 0} cycles.
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>Create Rotating Stokvel</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Direct Invite Link & QR */}
      {showInviteModal && generatedInvite && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900">Direct Invitation Link</h3>
              <button onClick={() => setShowInviteModal(false)}><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-600">
              Share this secure, high-entropy invite token. The invitee will preview the terms constitution and must explicitly accept before enrollment.
            </p>

            <div className="flex justify-center p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <QRCodeSVG value={generatedInvite.token} size={150} />
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Invite Token</span>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs text-gray-800 break-all">{generatedInvite.token}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedInvite.token);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shrink-0"
                >
                  {copiedToken ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">
                Expires in 72 hours · Single use · Hashed storage
              </div>
            </div>

            <button
              onClick={() => setShowInviteModal(false)}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-white font-bold text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: Join via Invite Token */}
      {showJoinByTokenModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900">Join via Invitation Token</h3>
              <button onClick={() => setShowJoinByTokenModal(false)}><X size={18} /></button>
            </div>

            {!previewData ? (
              <form onSubmit={handlePreviewToken} className="space-y-4">
                <p className="text-xs text-gray-600">
                  Enter the invitation token received from your group organizer to inspect group rules and constitution before deciding to join.
                </p>
                <input
                  type="text"
                  required
                  placeholder="Paste 64-character token..."
                  value={inviteTokenInput}
                  onChange={(e) => setInviteTokenInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
                />
                <button
                  type="submit"
                  disabled={previewLoading}
                  className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs flex items-center justify-center gap-2"
                >
                  {previewLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  <span>Preview Group Rules & Terms</span>
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-gray-900 text-sm">{previewData.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                      Terms v{previewData.termsVersion}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    Contribution: ${previewData.contributionAmount} USDT · Expected Pool: ${previewData.expectedPool} USDT · {previewData.frequency}
                  </div>
                  <div className="max-h-48 overflow-y-auto p-3 bg-white rounded-xl border border-gray-200 font-mono text-[11px] text-gray-700 whitespace-pre-wrap">
                    {previewData.termsMarkdown}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAcceptInvite}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    Accept Immutable Terms & Join
                  </button>
                  <button
                    onClick={() => setPreviewData(null)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: Apply to Join Discoverable Group */}
      {showApplyModal && targetApplyPot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900">Apply to Join</h3>
              <button onClick={() => setShowApplyModal(false)}><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-600">
              Apply to join <span className="font-bold">{targetApplyPot.name}</span>. The Owner or Co-admin will review your application. If approved, a seat will be reserved for 48 hours for your terms acceptance.
            </p>
            <form onSubmit={handleApplyToJoin} className="space-y-4">
              <textarea
                rows={3}
                placeholder="Introduce yourself or leave an application note (optional)..."
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs"
              >
                Submit Application
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Constitution Viewer */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900">Immutable Group Constitution</h3>
              <button onClick={() => setShowTermsModal(false)}><X size={18} /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-4 bg-gray-50 rounded-2xl border border-gray-200 font-mono text-xs text-gray-800 whitespace-pre-wrap">
              {activePotDetails?.terms_markdown || 'No constitution record available.'}
            </div>
            <button
              onClick={() => setShowTermsModal(false)}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-white font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL 6: Audit Trail */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900">Immutable Audit Trail</h3>
              <button onClick={() => setShowAuditModal(false)}><X size={18} /></button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 text-xs">
              {auditLogs.length === 0 ? (
                <p className="text-gray-500 py-4 text-center">No audit events recorded yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-gray-900">{log.action}</div>
                      <div className="text-[10px] text-gray-400">Actor: {log.actor_user_id || 'System'}</div>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {log.created_at?.slice(0, 19).replace('T', ' ')}
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowAuditModal(false)}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-white font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL 7: File Dispute */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900">File Formal Dispute Notice</h3>
              <button onClick={() => setShowDisputeModal(false)}><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-600">
              Submit a formal notice if an on-chain contribution status, schedule slot, or payout calculation is disputed. All notices are preserved on the group audit trail.
            </p>
            <form onSubmit={handleRaiseDispute} className="space-y-4">
              <textarea
                rows={4}
                required
                placeholder="Explain the dispute, cycle number, and reason in detail..."
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Submit Dispute Notice
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
