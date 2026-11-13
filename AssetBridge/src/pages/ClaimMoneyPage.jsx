import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Globe,
  HelpCircle,
  Info,
  KeyRound,
  Landmark,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { claimClientService } from '../services/claimClientService';

export default function ClaimMoneyPage({ claimId: propClaimId }) {
  const extractOpaqueClaimId = () => {
    if (propClaimId) return propClaimId;
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    if (hash.includes('/claim/')) {
      const idPart = hash.split('/claim/')[1]?.split('?')[0]?.trim();
      if (idPart) return idPart;
    }
    if (search.includes('claim=')) {
      const params = new URLSearchParams(search);
      return params.get('claim') || '';
    }
    return '';
  };

  const [claimIdInput, setClaimIdInput] = useState(extractOpaqueClaimId);
  const [activeClaimId, setActiveClaimId] = useState(extractOpaqueClaimId);
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(Boolean(extractOpaqueClaimId()));
  const [claim, setClaim] = useState(null);

  // Step 1: Enter phone & one-time claim token -> Request OTP
  // Step 2: Verify 6-digit SMS OTP
  // Step 3: Plain-language review & Payout Method Selection
  // Step 4: Deterministic Backend Status / Next Steps
  const [step, setStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [claimToken, setClaimToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devTestOtpNotice, setDevTestOtpNotice] = useState('');
  const [verificationSessionToken, setVerificationSessionToken] = useState('');
  const [selectedPayoutMethod, setSelectedPayoutMethod] = useState('za_payshap_proxy');
  const [errorMsg, setErrorMsg] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadClaimSummary = useCallback(async (idToLoad, selectedLang = lang) => {
    if (!idToLoad) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await claimClientService.getPublicClaim(idToLoad, selectedLang);
      setClaim(data);
    } catch (err) {
      setClaim(null);
      setErrorMsg(err.message || 'Claim link not found or unavailable.');
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    if (activeClaimId) {
      loadClaimSummary(activeClaimId, lang);
    }
  }, [activeClaimId, lang, loadClaimSummary]);

  const handleLookupClaimId = (e) => {
    e.preventDefault();
    if (!claimIdInput.trim()) {
      setErrorMsg('Enter your claim reference ID (e.g. clm_...).');
      return;
    }
    setActiveClaimId(claimIdInput.trim());
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setDevTestOtpNotice('');
    if (!phoneNumber.trim()) {
      setErrorMsg('Please enter your mobile phone number.');
      return;
    }
    if (!claimToken.trim()) {
      setErrorMsg('Please enter the one-time secret claim code shared by the sender.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await claimClientService.requestClaimOtp(activeClaimId, {
        claimToken: claimToken.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      if (res._devTestOtpOnly) {
        setDevTestOtpNotice(res._devTestOtpOnly);
      }
      setStatusNotice(res.message || 'Verification code issued.');
      setStep(2);
    } catch (err) {
      setErrorMsg(err.message);
      await loadClaimSummary(activeClaimId, lang);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMsg('Enter the 6-digit verification code sent to your phone.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await claimClientService.verifyClaimOtp(activeClaimId, {
        otpCode: otpCode.trim(),
      });
      setVerificationSessionToken(res.verificationSessionToken);
      setStatusNotice(res.message);
      await loadClaimSummary(activeClaimId, lang);
      setStep(3);
    } catch (err) {
      setErrorMsg(err.message);
      await loadClaimSummary(activeClaimId, lang);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPayout = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const res = await claimClientService.confirmClaimPayout(activeClaimId, {
        verificationSessionToken,
        payoutMethod: selectedPayoutMethod,
      });
      setStatusNotice(res.message);
      await loadClaimSummary(activeClaimId, lang);
      setStep(4);
    } catch (err) {
      setErrorMsg(err.message);
      await loadClaimSummary(activeClaimId, lang);
    } finally {
      setIsSubmitting(false);
    }
  };

  const guidance = claim?.aiGuidance;

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-between p-4 sm:p-6 font-sans antialiased text-slate-800">
      {/* Header */}
      <header className="max-w-xl mx-auto w-full pt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-sm shadow-sm">
            AB
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm block leading-none">
              AssetBridge Gogo Claim
            </span>
            <span className="text-[11px] text-slate-500">
              No App Installation Required · Sepolia Testnet
            </span>
          </div>
        </div>

        {/* Language Selector for AI-Assisted Plain-Language Guidance */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
          <Globe size={14} className="text-emerald-700" />
          <select
            aria-label="Select explanation language"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer"
          >
            <option value="en">English</option>
            <option value="zu">isiZulu</option>
            <option value="st">Sesotho</option>
            <option value="af">Afrikaans</option>
          </select>
        </div>
      </header>

      <main className="max-w-xl mx-auto w-full my-auto py-6 space-y-5">
        {/* Claim Reference Lookup if no ID in URL */}
        {!activeClaimId && (
          <div className="bg-white rounded-[2rem] border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
            <h1 className="text-xl font-extrabold text-slate-900">
              Enter Your Gogo Claim Reference
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Paste the claim reference ID (starting with <span className="font-mono font-bold">clm_</span>) shared by your family member.
            </p>
            <form onSubmit={handleLookupClaimId} className="space-y-3">
              <input
                type="text"
                value={claimIdInput}
                onChange={(e) => setClaimIdInput(e.target.value)}
                placeholder="clm_..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 outline-none focus:bg-white focus:border-emerald-600"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white hover:bg-emerald-800"
              >
                Load Claim Details
              </button>
            </form>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 text-center space-y-3">
            <RefreshCw size={24} className="animate-spin text-emerald-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">Loading deterministic claim status from backend…</p>
          </div>
        )}

        {activeClaimId && !loading && !claim && (
          <div className="bg-white rounded-[2rem] border border-rose-200 p-6 space-y-4 text-center">
            <AlertCircle size={32} className="text-rose-600 mx-auto" />
            <h2 className="text-base font-bold text-slate-900">Claim Reference Unavailable</h2>
            <p className="text-xs text-rose-700">{errorMsg}</p>
            <button
              type="button"
              onClick={() => {
                setActiveClaimId('');
                setErrorMsg('');
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Try Another Claim ID
            </button>
          </div>
        )}

        {claim && (
          <>
            {/* Deterministic Backend Status Banner */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Deterministic Backend Status
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-extrabold text-slate-900">
                    {claim.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-500">
                    · Ref: <span className="font-mono">{claim.id}</span>
                  </span>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  claim.fundingVerified
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {claim.fundingVerified ? 'On-Chain Funded (Sepolia)' : 'Awaiting Sender On-Chain Funding'}
              </span>
            </div>

            {/* AI-Assisted Plain-Language Helper & Scam Warnings */}
            {guidance && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-950">
                    <Sparkles size={15} className="text-emerald-700" />
                    <span>Gogo Plain-Language Guide ({guidance.languageName})</span>
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-800 bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">
                    Read-Only Guide
                  </span>
                </div>

                <p className="text-emerald-900 font-medium leading-relaxed">
                  {guidance.greeting} {guidance.plainLanguageSummary}
                </p>

                <div className="space-y-1 text-emerald-900">
                  {guidance.steps.map((s, idx) => (
                    <div key={idx} className="text-[11px]">{s}</div>
                  ))}
                </div>

                <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-3 space-y-1 text-[11px] text-amber-950">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-amber-700" />
                    <span>Important Scam &amp; Safety Warnings:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {guidance.scamWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>

                <p className="text-[10px] text-slate-500 italic">
                  {guidance.aiSafetyBoundary}
                </p>
              </section>
            )}

            {/* Main Interactive Verification Card */}
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              {errorMsg && (
                <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {statusNotice && !errorMsg && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
                  <Info size={16} className="shrink-0 mt-0.5 text-blue-700" />
                  <span>{statusNotice}</span>
                </div>
              )}

              {/* Locked / Cancelled / Expired / Refunded terminal states */}
              {['locked', 'cancelled', 'refunded', 'expired'].includes(claim.status) ? (
                <div className="space-y-4 text-center py-4">
                  <AlertTriangle size={36} className="text-amber-600 mx-auto" />
                  <h2 className="text-lg font-extrabold text-slate-900">
                    This Claim Link is {claim.status.toUpperCase()}
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                    {claim.status === 'locked'
                      ? 'Too many unsuccessful verification attempts were made. For your protection, this link is locked. Contact the sender so they can reclaim the escrow funds or issue a new link.'
                      : 'This claim link is no longer active. Please contact the sender if you need assistance.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* STEP 1: Verify One-Time Claim Code & Recipient Phone */}
                  {step === 1 && (
                    <form onSubmit={handleRequestOtp} className="space-y-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                          Step 1 of 3 · Identity &amp; Claim Code Verification
                        </span>
                        <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                          {claim.senderDisplayName} prepared {claim.receiveSymbol}
                          {claim.receiveAmountFormatted} {claim.receiveCurrency} for {claim.recipientName}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          Confirm the mobile number ({claim.recipientPhoneMasked}) and enter the one-time secret claim code sent to you.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Your Mobile Phone Number
                        </label>
                        <div className="relative">
                          <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+27 82 000 0000"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none focus:bg-white focus:border-emerald-600"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          One-Time Secret Claim Code
                        </label>
                        <div className="relative">
                          <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={claimToken}
                            onChange={(e) => setClaimToken(e.target.value)}
                            placeholder="Paste the secret code shared by the sender"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 font-mono text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-emerald-600"
                            required
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Attempts remaining: {claim.verificationRequirements?.remainingAttempts ?? 5}
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-xl bg-emerald-700 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <span>{isSubmitting ? 'Verifying…' : 'Send 6-Digit SMS Verification Code'}</span>
                        <ArrowRight size={16} />
                      </button>
                    </form>
                  )}

                  {/* STEP 2: Verify 6-Digit OTP */}
                  {step === 2 && (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                          Step 2 of 3 · SMS OTP Verification
                        </span>
                        <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                          Enter the 6-Digit Verification Code
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          Enter the code generated for {claim.recipientPhoneMasked}. Demo codes (such as 123456) are strictly rejected.
                        </p>
                      </div>

                      {devTestOtpNotice && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                          <strong>[Non-Production Dev Test Mode Only]:</strong> Generated one-time OTP is{' '}
                          <span className="font-mono font-black underline">{devTestOtpNotice}</span>
                        </div>
                      )}

                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="••••••"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 text-center font-mono text-2xl font-black tracking-[0.4em] text-slate-900 outline-none focus:bg-white focus:border-emerald-600"
                        required
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-1 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Checking OTP…' : 'Verify Code & Continue'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* STEP 3: Plain-Language Review & Payout Selection */}
                  {step === 3 && (
                    <form onSubmit={handleConfirmPayout} className="space-y-5">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                          Step 3 of 3 · Plain-Language Transfer Review
                        </span>
                        <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                          Review Your Transfer Before Confirming
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          Check every detail below. We never ask for a PIN, bank password, or wallet recovery phrase.
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Sender</span>
                          <strong className="text-slate-900">{claim.senderDisplayName}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Verified Recipient</span>
                          <strong className="text-slate-900">
                            {claim.recipientName} ({claim.recipientPhoneMasked})
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Amount Sent by Sender</span>
                          <strong className="text-slate-900">
                            ${claim.sendAmountFormatted} {claim.sendCurrency}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Platform / Escrow Fee</span>
                          <strong className="text-slate-900">
                            ${claim.feeAmountFormatted} {claim.sendCurrency}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Reference Exchange Rate</span>
                          <strong className="text-slate-900">
                            1 USDT = {claim.fxRateDisplay} {claim.receiveCurrency} ({claim.rateSource})
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">On-Chain Funding Status</span>
                          <strong className={claim.fundingVerified ? 'text-emerald-700' : 'text-amber-700'}>
                            {claim.fundingVerified
                              ? `Confirmed (${claim.fundingTxHash?.slice(0, 10)}…)`
                              : 'Awaiting Sender On-Chain Funding'}
                          </strong>
                        </div>
                        <div className="border-t border-slate-200 pt-2.5 flex justify-between items-baseline text-sm">
                          <span className="font-bold text-slate-700">Estimated Local Amount</span>
                          <strong className="text-lg font-black text-emerald-800">
                            {claim.receiveSymbol} {claim.receiveAmountFormatted} {claim.receiveCurrency}
                          </strong>
                        </div>
                      </div>

                      {/* Payout Method Selection */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700">
                          Select Payout Rail
                        </label>
                        {claim.supportedPayoutMethods?.map((method) => (
                          <label
                            key={method.id}
                            className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 cursor-pointer text-xs ${
                              selectedPayoutMethod === method.id
                                ? 'border-emerald-600 bg-emerald-50/50'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <input
                                type="radio"
                                name="payoutMethod"
                                value={method.id}
                                checked={selectedPayoutMethod === method.id}
                                onChange={() => setSelectedPayoutMethod(method.id)}
                                className="mt-0.5"
                              />
                              <div>
                                <div className="font-bold text-slate-900">{method.name}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{method.description}</div>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                method.available
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {method.statusLabel}
                            </span>
                          </label>
                        ))}
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-xl bg-emerald-700 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {isSubmitting ? 'Submitting Payout Request…' : 'Confirm & Request Payout'}
                      </button>
                    </form>
                  )}

                  {/* STEP 4: Final Deterministic Outcome */}
                  {step === 4 && (
                    <div className="space-y-4 text-center py-4">
                      <CheckCircle2 size={40} className="text-emerald-600 mx-auto" />
                      <h2 className="text-xl font-extrabold text-slate-900">
                        Payout Status: {claim.status.toUpperCase()}
                      </h2>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {statusNotice}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="max-w-xl mx-auto w-full text-center text-[11px] text-slate-400 pb-4">
        AssetBridge Remittance · Need help? Contact support or ask the sender to cancel/refund from their dashboard.
      </footer>
    </div>
  );
}
