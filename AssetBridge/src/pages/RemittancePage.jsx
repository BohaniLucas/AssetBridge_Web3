import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Landmark,
  Link2,
  LockKeyhole,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react';
import { remittanceService, generateIdempotencyKey } from '../services/remittanceService';
import { claimClientService } from '../services/claimClientService';

const FLOW_MODES = [
  {
    id: 'app_to_app',
    label: 'AssetBridge User',
    subtitle: 'Send by verified @username',
    icon: UserRound,
  },
  {
    id: 'gogo_claim',
    label: 'Gogo Claim Link',
    subtitle: 'For a recipient without the app',
    icon: Link2,
  },
  {
    id: 'phone_payout',
    label: 'Bank / PayShap Proxy',
    subtitle: 'Regulated local payout rail',
    icon: Phone,
  },
];

const AMOUNT_PRESETS = ['10', '25', '50', '100'];

export default function RemittancePage() {
  const [flowType, setFlowType] = useState('app_to_app');
  const [corridors, setCorridors] = useState([]);
  const [selectedCorridorCode, setSelectedCorridorCode] = useState('APP-USDT');
  const [selectedRailId, setSelectedRailId] = useState('sepolia_usdt_erc20');
  const [sendAmount, setSendAmount] = useState('25');

  // Recipient inputs (never prefilled with sample personal data)
  const [recipientUsername, setRecipientUsername] = useState('');
  const [verifiedRecipient, setVerifiedRecipient] = useState(null);
  const [isResolvingUser, setIsResolvingUser] = useState(false);

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [transferNote, setTransferNote] = useState('');

  // Quote & Transfer State Machine
  const [lockedQuote, setLockedQuote] = useState(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState(null);
  const [createdClaimResult, setCreatedClaimResult] = useState(null);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [fundingTxHashInput, setFundingTxHashInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History & Claims Tracking
  const [userTransfers, setUserTransfers] = useState([]);
  const [senderClaims, setSenderClaims] = useState([]);
  const [formError, setFormError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [copiedField, setCopiedField] = useState('');

  const loadInitialData = useCallback(async () => {
    try {
      const [destList, transfersList, claimsList] = await Promise.all([
        remittanceService.fetchDestinations(),
        remittanceService.listTransfers(),
        claimClientService.getSenderClaims(),
      ]);
      if (destList.length > 0) {
        setCorridors(destList);
      }
      setUserTransfers(transfersList);
      setSenderClaims(claimsList);
    } catch (err) {
      setFormError(err.message || 'Unable to load remittance configuration.');
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Adjust default corridor when switching flow mode
  const handleSelectFlowMode = (modeId) => {
    setFlowType(modeId);
    setFormError('');
    setStatusMessage('');
    setLockedQuote(null);
    setActiveTransfer(null);
    setCreatedClaimResult(null);
    setRiskAcknowledged(false);

    if (modeId === 'app_to_app') {
      setSelectedCorridorCode('APP-USDT');
      setSelectedRailId('sepolia_usdt_erc20');
    } else if (modeId === 'gogo_claim') {
      setSelectedCorridorCode('ZA-ZAR');
      setSelectedRailId('za_gogo_claim');
    } else {
      setSelectedCorridorCode('ZA-ZAR');
      setSelectedRailId('za_payshap_proxy');
    }
  };

  const currentCorridor =
    corridors.find((c) => c.corridorCode === selectedCorridorCode) || corridors[0] || null;

  const availableCorridorsForFlow = corridors.filter((c) => {
    if (flowType === 'app_to_app') return c.corridorCode === 'APP-USDT';
    return c.corridorCode !== 'APP-USDT';
  });

  const handleResolveUsername = async () => {
    setFormError('');
    setVerifiedRecipient(null);
    if (!recipientUsername.trim()) {
      setFormError('Enter an AssetBridge @username to verify.');
      return;
    }
    setIsResolvingUser(true);
    try {
      const resolved = await remittanceService.resolveUsername(recipientUsername);
      setVerifiedRecipient(resolved);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsResolvingUser(false);
    }
  };

  const handleRequestQuote = async (e) => {
    if (e) e.preventDefault();
    setFormError('');
    setStatusMessage('');
    setActiveTransfer(null);
    setCreatedClaimResult(null);

    if (flowType === 'app_to_app' && !verifiedRecipient) {
      setFormError('Please verify the recipient @username before requesting a quote.');
      return;
    }
    if (flowType !== 'app_to_app') {
      if (!recipientName.trim() || recipientName.trim().length < 2) {
        setFormError('Enter the recipient’s full name.');
        return;
      }
      if (!recipientPhone.trim()) {
        setFormError('Enter the recipient’s mobile phone number.');
        return;
      }
    }

    setIsQuoting(true);
    try {
      const quote = await remittanceService.createQuote({
        flowType,
        corridorCode: selectedCorridorCode,
        payoutRail: selectedRailId,
        sendAmountUsdt: sendAmount,
      });
      setLockedQuote(quote);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsQuoting(false);
    }
  };

  const handleCreateIntentOrClaim = async () => {
    if (!lockedQuote) return;
    setFormError('');
    setIsSubmitting(true);

    try {
      const idempotencyKey = generateIdempotencyKey(flowType);

      if (flowType === 'gogo_claim') {
        const result = await claimClientService.createClaimLink({
          quoteId: lockedQuote.id,
          idempotencyKey,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          note: transferNote.trim(),
          riskAcknowledged,
        });
        setCreatedClaimResult(result.claim);
        setActiveTransfer(result.transfer);
        setStatusMessage('One-time Gogo claim link created. Fund the escrow transfer on Sepolia to make it claimable.');
      } else {
        const intentRes = await remittanceService.createTransferIntent({
          quoteId: lockedQuote.id,
          idempotencyKey,
          recipientUsername: verifiedRecipient?.username || recipientUsername.trim(),
          recipientName: verifiedRecipient?.displayName || recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          note: transferNote.trim(),
        });
        setActiveTransfer(intentRes.transfer);
      }
      await loadInitialData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveTransfer = async () => {
    if (!activeTransfer) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      const res = await remittanceService.approveTransfer(activeTransfer.id, {
        riskAcknowledged,
      });
      setActiveTransfer(res.transfer);
      setStatusMessage('Transfer approved. Broadcast your ERC-20 funding transaction on Sepolia and submit the transaction hash below.');
      await loadInitialData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTransfer = async (transferId) => {
    setFormError('');
    setIsSubmitting(true);
    try {
      const res = await remittanceService.cancelTransfer(transferId);
      if (activeTransfer?.id === transferId) {
        setActiveTransfer(res.transfer);
      }
      setStatusMessage('Transfer cancelled before funding.');
      await loadInitialData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmFunding = async (e) => {
    e.preventDefault();
    if (!activeTransfer) return;
    setFormError('');
    if (!fundingTxHashInput.trim()) {
      setFormError('Enter the 32-byte Sepolia transaction hash (0x...) to verify on-chain funding.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await remittanceService.confirmBlockchainFunding(activeTransfer.id, {
        txHash: fundingTxHashInput.trim(),
      });
      setActiveTransfer(res.transfer);
      setStatusMessage(`On-chain funding verified! Current status: ${res.transfer.status.toUpperCase()}`);
      setFundingTxHashInput('');
      await loadInitialData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefundClaim = async (claimId) => {
    setFormError('');
    setIsSubmitting(true);
    try {
      const res = await claimClientService.refundClaimLink(claimId);
      setStatusMessage(res.message || 'Claim cancelled/refunded.');
      await loadInitialData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyText = (text, label) => {
    if (!text || !navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(''), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      {/* Header Banner */}
      <section className="flex flex-col justify-between gap-4 rounded-[2rem] border border-slate-800 bg-gradient-to-br from-[#101936] via-[#111d3a] to-[#071124] p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">
            <ShieldCheck size={14} />
            Sepolia Testnet Environment · Mainnet Funds Disabled
          </div>
          <span className="text-xs text-slate-300">
            Deterministic State Machine · Integer Minor-Unit Accounting
          </span>
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Remittance &amp; Gogo Claim Links
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-300">
            Send to a verified AssetBridge username on Sepolia Testnet, create a one-time OTP-protected Gogo claim link for a recipient without the app, or check regulated corridor payout availability.
          </p>
        </div>
      </section>

      {/* Flow Mode Selector */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FLOW_MODES.map((mode) => {
          const Icon = mode.icon;
          const isSelected = flowType === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleSelectFlowMode(mode.id)}
              className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Icon size={18} />
              </span>
              <div>
                <div className="text-sm font-bold text-slate-900">{mode.label}</div>
                <div className="mt-0.5 text-xs text-slate-500">{mode.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column: Step 1 — Configure & Quote */}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7 space-y-6">
          {/* Corridor Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">
              Destination Corridor &amp; Payout Rail
            </label>
            <div className="space-y-2">
              {availableCorridorsForFlow.map((corridor) => {
                const isSelected = corridor.corridorCode === selectedCorridorCode;
                return (
                  <div
                    key={corridor.corridorCode}
                    onClick={() => {
                      setSelectedCorridorCode(corridor.corridorCode);
                      if (corridor.rails?.[0]) {
                        setSelectedRailId(corridor.rails[0].id);
                      }
                      setLockedQuote(null);
                      setFormError('');
                    }}
                    className={`cursor-pointer rounded-2xl border p-3.5 transition ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{corridor.flag}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {corridor.country} ({corridor.currency})
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                corridor.isExecutable
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {corridor.availabilityLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Source: {corridor.rateSource}
                            {corridor.ratePerUsd
                              ? ` · 1 USDT = ${corridor.ratePerUsd} ${corridor.currency} (${
                                  corridor.rateType === 'reference_only'
                                    ? 'Daily Reference Rate'
                                    : corridor.rateType === 'par_1_to_1'
                                    ? '1:1 Token Par'
                                    : 'Executable Rate'
                                })`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Flow A: Username Lookup */}
          {flowType === 'app_to_app' && (
            <div className="space-y-3 rounded-2xl bg-slate-50 p-4 border border-slate-200/80">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
                Recipient AssetBridge Username
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <UserRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={recipientUsername}
                    onChange={(e) => {
                      setRecipientUsername(e.target.value);
                      setVerifiedRecipient(null);
                    }}
                    placeholder="Enter username (e.g. @nomsa)"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleResolveUsername}
                  disabled={isResolvingUser}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isResolvingUser ? 'Verifying…' : 'Verify Account'}
                </button>
              </div>

              {verifiedRecipient && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-900">
                    <UserCheck size={15} className="text-emerald-700" />
                    <span>
                      Verified: {verifiedRecipient.displayName} ({verifiedRecipient.username})
                    </span>
                  </div>
                  <div className="text-emerald-800">
                    Settlement Rail: <strong>{verifiedRecipient.settlementAsset}</strong> on{' '}
                    <strong>{verifiedRecipient.settlementNetwork}</strong>
                  </div>
                  {verifiedRecipient.walletAddress && (
                    <div className="font-mono text-[11px] text-emerald-700 break-all">
                      Recipient Wallet: {verifiedRecipient.walletAddress}
                    </div>
                  )}
                  <div className="pt-1 text-[11px] text-amber-900 bg-amber-50/80 border border-amber-200 rounded-lg p-2">
                    <strong>Important:</strong> {verifiedRecipient.fiatPayoutDisclosure}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Flow B & Flow C: Recipient Name & Phone */}
          {flowType !== 'app_to_app' && (
            <div className="space-y-4 rounded-2xl bg-slate-50 p-4 border border-slate-200/80">
              {currentCorridor?.rails?.[0]?.proxyDisclosure && (
                <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900">
                  <Info size={16} className="shrink-0 mt-0.5 text-blue-700" />
                  <span>{currentCorridor.rails[0].proxyDisclosure}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Recipient Full Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => {
                      setRecipientName(e.target.value);
                      setLockedQuote(null);
                    }}
                    placeholder="Enter recipient full name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {flowType === 'phone_payout'
                      ? 'Registered PayShap ShapID Phone (+27...)'
                      : 'Recipient Mobile Phone (+27...)'}
                  </label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => {
                      setRecipientPhone(e.target.value);
                      setLockedQuote(null);
                    }}
                    placeholder="+27 82 000 0000"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Send Amount & Note */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Send Amount (USDT)
              </label>
              <span className="text-xs text-slate-500">Min $1.00 · Max $10,000.00</span>
            </div>
            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 focus-within:border-teal-600 focus-within:bg-white">
              <span className="text-xl font-bold text-slate-400 mr-2">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={sendAmount}
                onChange={(e) => {
                  setSendAmount(e.target.value.replace(/[^0-9.]/g, ''));
                  setLockedQuote(null);
                }}
                placeholder="25.00"
                className="flex-1 bg-transparent text-2xl font-extrabold text-slate-900 outline-none"
              />
              <span className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                USDT
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {AMOUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSendAmount(preset);
                    setLockedQuote(null);
                  }}
                  className={`rounded-full border px-3.5 py-1 text-xs font-semibold transition ${
                    sendAmount === preset
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400'
                  }`}
                >
                  ${preset} USDT
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Reference / Note (Optional)
              </label>
              <input
                type="text"
                maxLength={120}
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="e.g. Monthly groceries support"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-teal-600"
              />
            </div>
          </div>

          {formError && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {statusMessage && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900">
              <BadgeCheck size={16} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>{statusMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleRequestQuote}
            disabled={isQuoting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#101936] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw size={16} className={isQuoting ? 'animate-spin' : ''} />
            <span>{isQuoting ? 'Calculating Backend Quote…' : 'Get Locked Quote & Review Terms'}</span>
          </button>
        </section>

        {/* Right Column: Step 2 & 3 — Locked Quote Review, Approval & State Machine */}
        <aside className="space-y-5 lg:col-span-5">
          {/* Quote Review Card */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Quote &amp; Settlement Review</h3>
                <p className="text-xs text-slate-500">
                  {lockedQuote
                    ? `Quote ID: ${lockedQuote.id.slice(0, 8)}… · Expires ${new Date(
                        lockedQuote.expiresAt
                      ).toLocaleTimeString()}`
                    : 'Request a quote to lock rate and review fees'}
                </p>
              </div>
              {lockedQuote && (
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                    lockedQuote.fiatPayoutExecutable || lockedQuote.corridorCode === 'APP-USDT'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {lockedQuote.rateType === 'reference_only'
                    ? 'Reference Rate'
                    : lockedQuote.rateType === 'par_1_to_1'
                    ? '1:1 Token Par'
                    : 'Partner Quote'}
                </span>
              )}
            </div>

            {!lockedQuote ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                <Landmark size={28} className="mx-auto text-slate-300" />
                <p>Enter recipient details and amount, then click &ldquo;Get Locked Quote&rdquo;.</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="rounded-2xl bg-slate-50 p-4 space-y-2.5 border border-slate-200/70">
                  <div className="flex justify-between">
                    <span className="text-slate-500">You Send</span>
                    <strong className="text-slate-900">${lockedQuote.sendAmountFormatted} {lockedQuote.sendCurrency}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Platform / Escrow Fee</span>
                    <strong className="text-slate-900">${lockedQuote.feeAmountFormatted} {lockedQuote.sendCurrency}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net Converted Amount</span>
                    <strong className="text-slate-900">${lockedQuote.netSendAmountFormatted} {lockedQuote.sendCurrency}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Exchange Rate</span>
                    <strong className="text-slate-900">
                      1 USDT = {lockedQuote.fxRateDisplay} {lockedQuote.receiveCurrency}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Rate Source</span>
                    <span className="text-slate-700 font-medium text-right">{lockedQuote.rateSource}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payout Method</span>
                    <span className="text-slate-800 font-semibold text-right">{lockedQuote.payoutRailName}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2.5 flex justify-between items-baseline text-sm">
                    <span className="font-bold text-slate-700">Estimated Recipient Amount</span>
                    <strong className="text-lg font-black text-teal-800">
                      {lockedQuote.receiveSymbol} {lockedQuote.receiveAmountFormatted} {lockedQuote.receiveCurrency}
                    </strong>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-[11px] leading-relaxed text-amber-950">
                  <strong>Availability &amp; Settlement Disclosure:</strong> {lockedQuote.availabilityDisclosure}
                </div>

                {/* Risk & Scam Prevention Check */}
                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={riskAcknowledged}
                    onChange={(e) => setRiskAcknowledged(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-[11px] text-slate-600 leading-relaxed">
                    I have verified the recipient’s identity, reviewed the fee and exchange rate, and understand that on-chain transfers cannot be reversed once funded and that fiat payouts require partner confirmation.
                  </span>
                </label>

                {!activeTransfer && (
                  <button
                    type="button"
                    onClick={handleCreateIntentOrClaim}
                    disabled={isSubmitting || !riskAcknowledged || (!lockedQuote.isExecutable && flowType === 'phone_payout')}
                    className="w-full rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
                  >
                    {flowType === 'phone_payout' && !lockedQuote.fiatPayoutExecutable
                      ? 'Not Available Yet (PayShap Partner Unconfigured)'
                      : isSubmitting
                      ? 'Processing…'
                      : flowType === 'gogo_claim'
                      ? 'Approve & Generate One-Time Gogo Claim Link'
                      : 'Continue to Sender Approval'}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Active Transfer State Machine & On-Chain Funding Verification Card */}
          {activeTransfer && (
            <section className="rounded-[2rem] border border-teal-200 bg-teal-50/40 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                    Persistent Payment State
                  </span>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Status: {activeTransfer.status.toUpperCase()}
                  </h4>
                </div>
                <span className="font-mono text-[11px] text-slate-500">
                  ID: {activeTransfer.id.slice(0, 10)}…
                </span>
              </div>

              {activeTransfer.riskWarnings?.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1 text-[11px] text-amber-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert size={14} />
                    <span>Safety &amp; Risk Advisories:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1">
                    {activeTransfer.riskWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* One-Time Gogo Claim Secret Display (Shown ONLY once on creation) */}
              {createdClaimResult && (
                <div className="rounded-2xl border border-emerald-300 bg-white p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-900">
                      Gogo One-Time Claim Details
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Shown Once Only
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {createdClaimResult.securityWarning}
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200 flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">Public Claim Link (No Secret in URL)</span>
                        <span className="font-mono text-slate-800">{createdClaimResult.safeClaimUrl}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(createdClaimResult.safeClaimUrl, 'url')}
                        className="shrink-0 rounded-lg bg-slate-200/80 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-300"
                      >
                        {copiedField === 'url' ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>

                    {createdClaimResult.oneTimeClaimCode && (
                      <div className="rounded-xl bg-amber-50/70 p-2.5 border border-amber-200 flex items-center justify-between gap-2">
                        <div className="truncate">
                          <span className="block text-[10px] text-amber-800 font-bold uppercase">One-Time Secret Claim Code</span>
                          <span className="font-mono font-bold text-amber-950">{createdClaimResult.oneTimeClaimCode}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(createdClaimResult.oneTimeClaimCode, 'code')}
                          className="shrink-0 rounded-lg bg-amber-200/80 px-2.5 py-1 text-[11px] font-bold text-amber-950 hover:bg-amber-300"
                        >
                          {copiedField === 'code' ? 'Copied!' : 'Copy Code'}
                        </button>
                      </div>
                    )}
                  </div>

                  <a
                    href={`#/claim/${createdClaimResult.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:underline"
                  >
                    <span>Open Public Gogo Receiver Screen</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              )}

              {/* Actions based on current state */}
              {activeTransfer.status === 'awaiting_sender_approval' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCancelTransfer(activeTransfer.id)}
                    disabled={isSubmitting}
                    className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel Transfer
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveTransfer}
                    disabled={isSubmitting || !riskAcknowledged}
                    className="flex-1 rounded-xl bg-teal-600 py-2.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    Approve Final Terms
                  </button>
                </div>
              )}

              {activeTransfer.status === 'pending' && (
                <form onSubmit={handleConfirmFunding} className="space-y-3 rounded-xl bg-white p-4 border border-slate-200 text-xs">
                  <div className="font-bold text-slate-800">
                    Submit On-Chain Sepolia Funding Proof
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Send <strong>${activeTransfer.sendAmountFormatted} USDT</strong> on Sepolia (contract{' '}
                    <span className="font-mono">{activeTransfer.tokenContract?.slice(0, 10)}…</span>) to{' '}
                    <span className="font-mono">{activeTransfer.escrowOrRecipientAddress?.slice(0, 12)}…</span>, then paste the 32-byte transaction hash below for RPC receipt verification.
                  </p>
                  <input
                    type="text"
                    value={fundingTxHashInput}
                    onChange={(e) => setFundingTxHashInput(e.target.value)}
                    placeholder="0x... (64 hex characters)"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-teal-600"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCancelTransfer(activeTransfer.id)}
                      disabled={isSubmitting}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Verifying on Sepolia…' : 'Verify On-Chain Receipt'}
                    </button>
                  </div>
                </form>
              )}

              {/* Status Timeline */}
              {activeTransfer.statusHistory?.length > 0 && (
                <div className="space-y-1.5 border-t border-teal-200/60 pt-3">
                  <span className="text-[10px] font-bold uppercase text-slate-500">State Audit Trail</span>
                  {activeTransfer.statusHistory.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2 text-[11px] text-slate-600">
                      <span>
                        <strong className="text-slate-800">{item.status}</strong> — {item.reason}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-400">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* Sender Gogo Claim Links & Transfer History */}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Your Gogo Claim Links &amp; Transfers</h3>
            <p className="text-xs text-slate-500">
              Track deterministic backend status or cancel/refund unclaimed links.
            </p>
          </div>
          <button
            type="button"
            onClick={loadInitialData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>

        {senderClaims.length === 0 && userTransfers.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No remittance transfers or Gogo claim links created yet in this session.
          </p>
        ) : (
          <div className="space-y-3">
            {senderClaims.map((clm) => (
              <div
                key={clm.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      Gogo Claim for {clm.recipientName} ({clm.recipientPhoneMasked})
                    </span>
                    <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-teal-900">
                      {clm.status}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    Send: ${clm.sendAmountFormatted} USDT → Est. {clm.receiveSymbol}
                    {clm.receiveAmountFormatted} {clm.receiveCurrency} · Claim ID:{' '}
                    <span className="font-mono">{clm.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`#/claim/${clm.id}`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-teal-700 hover:bg-teal-50"
                  >
                    Receiver View
                  </a>
                  {!['claimed', 'refunded', 'cancelled'].includes(clm.status) && (
                    <button
                      type="button"
                      onClick={() => handleRefundClaim(clm.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <RotateCcw size={12} />
                      <span>Cancel / Refund</span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {userTransfers
              .filter((t) => t.flowType !== 'gogo_claim')
              .map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => setActiveTransfer(tx)}
                  className="cursor-pointer flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 text-xs hover:bg-slate-50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        To: {tx.recipientDisplayName}{' '}
                        {tx.recipientUsername ? `(${tx.recipientUsername})` : ''}
                      </span>
                      <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-800">
                        {tx.status}
                      </span>
                    </div>
                    <div className="text-slate-500">
                      ${tx.sendAmountFormatted} USDT → {tx.receiveSymbol}
                      {tx.receiveAmountFormatted} {tx.receiveCurrency} · Rail: {tx.payoutRailName}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {new Date(tx.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
