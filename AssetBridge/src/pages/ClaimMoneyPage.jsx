import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Phone,
  Lock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Heart,
  AlertCircle,
  HelpCircle,
  Building,
  CreditCard,
} from 'lucide-react';
import { claimClientService } from '../services/claimClientService';

export default function ClaimMoneyPage({ claimId: propClaimId }) {
  // Extract claimId & secretCode from URL or hash
  const getParams = () => {
    const hash = window.location.hash;
    const search = window.location.search;
    let id = propClaimId || 'clm_demo_gogo';
    let code = 'GOGO1234';

    if (hash.includes('/claim/')) {
      const parts = hash.split('/claim/')[1]?.split('?');
      if (parts && parts[0]) id = parts[0];
      if (parts && parts[1]) {
        const urlParams = new URLSearchParams(parts[1]);
        if (urlParams.get('code')) code = urlParams.get('code');
      }
    } else if (search.includes('claim=')) {
      const urlParams = new URLSearchParams(search);
      id = urlParams.get('claim') || id;
      if (urlParams.get('code')) code = urlParams.get('code');
    }

    return { id, code };
  };

  const { id: claimId, code: initialCode } = getParams();

  const [loading, setLoading] = useState(true);
  const [claim, setClaim] = useState(null);
  const [step, setStep] = useState(1); // 1: verify phone, 2: sms code, 3: set pin, 4: success
  const [phone, setPhone] = useState('082 555 0192');
  const [smsCode, setSmsCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    claimClientService.getClaimLink(claimId).then((data) => {
      setClaim(data);
      if (data?.recipientPhone) {
        setPhone(data.recipientPhone);
      }
      setLoading(false);
    });
  }, [claimId]);

  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      setErrorMsg('Please enter your mobile phone number.');
      return;
    }
    setErrorMsg('');
    setStep(2); // Move to SMS code
  };

  const handleSmsSubmit = (e) => {
    e.preventDefault();
    if (smsCode.trim() !== '123456' && smsCode.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit code sent to your phone (Demo code: 123456).');
      return;
    }
    setErrorMsg('');
    setStep(3); // Move to Set PIN
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (!pin || pin.length < 4) {
      setErrorMsg('Please choose a 4-digit security PIN.');
      return;
    }
    if (pin !== confirmPin) {
      setErrorMsg('PINs do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const result = await claimClientService.claimMoney({
        claimId,
        secretCode: initialCode,
        phoneNumber: phone,
        smsCode,
        pin,
      });

      setSuccessData(result);
      setStep(4); // Celebration page!
    } catch (err) {
      setErrorMsg(err.message || 'Unable to claim money. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Checking your transfer...</p>
        </div>
      </div>
    );
  }

  const sender = claim?.senderName || 'Nomsa';
  const amount = Number(claim?.amountZar || 400).toFixed(2);

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-between p-4 sm:p-6 font-sans antialiased text-slate-800">
      {/* Top Header */}
      <header className="max-w-md mx-auto w-full pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
            AB
          </div>
          <span className="font-bold text-slate-900 text-sm tracking-tight">AssetBridge Money</span>
        </div>
        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-full flex items-center gap-1">
          <ShieldCheck size={13} />
          Safe & Verified
        </span>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto w-full my-auto py-6">
        <div className="bg-white rounded-[2rem] border border-amber-100/80 p-6 sm:p-8 shadow-xl shadow-amber-950/5 space-y-6">
          {/* STEP 1: Phone Verification */}
          {step === 1 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center text-3xl shadow-inner">
                💌
              </div>

              <div>
                <span className="inline-block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
                  You Have Money Waiting
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                  {sender} sent you R{amount}
                </h1>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Enter your mobile number to confirm it's you. No app to download.
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 text-left flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handlePhoneSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Your Mobile Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 082 123 4567"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md shadow-emerald-600/25 transition flex items-center justify-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight size={16} />
                </button>
              </form>

              <p className="text-[11px] text-slate-400">
                🔒 Free instant deposit into your phone account
              </p>
            </div>
          )}

          {/* STEP 2: 6-Digit SMS Code */}
          {step === 2 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center text-3xl shadow-inner">
                📲
              </div>

              <div>
                <span className="inline-block text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">
                  Step 2 of 3: SMS Verification
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  Enter the 6-Digit SMS Code
                </h1>
                <p className="text-xs text-slate-500 mt-2">
                  We sent a code to <strong className="text-slate-800">{phone}</strong>.
                </p>
              </div>

              {/* Demo Helper Banner */}
              <div className="rounded-xl bg-blue-50/80 border border-blue-200/80 p-2.5 text-xs text-blue-800 font-medium">
                💡 Demo Hackathon Helper: Enter code <span className="font-mono font-black text-blue-900">123456</span>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 text-left flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSmsSubmit} className="space-y-4">
                <input
                  type="text"
                  maxLength={6}
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  placeholder="123456"
                  className="w-full text-center text-2xl tracking-[0.4em] font-mono font-black py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  required
                  autoFocus
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-1/3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                  >
                    Change Phone
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md shadow-emerald-600/25 transition"
                  >
                    Verify Code
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 3: Set Security PIN */}
          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center text-3xl shadow-inner">
                🔑
              </div>

              <div>
                <span className="inline-block text-xs font-bold text-purple-700 uppercase tracking-wider mb-1">
                  Final Step: Protect Your Account
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  Set Your 4-Digit Secret PIN
                </h1>
                <p className="text-xs text-slate-500 mt-2">
                  You will use this PIN whenever you access or spend your money.
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 text-left flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handlePinSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Choose 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    className="w-full text-center text-xl tracking-[0.5em] font-mono py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-purple-500 outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="••••"
                    className="w-full text-center text-xl tracking-[0.5em] font-mono py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-purple-500 outline-none transition"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md shadow-emerald-600/25 transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Depositing R{amount}...</span>
                  ) : (
                    <>
                      <span>Claim R{amount} Now</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 4: Celebration Success Screen ("R400 is yours") */}
          {step === 4 && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center text-4xl shadow-inner">
                🎉
              </div>

              <div>
                <span className="inline-block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
                  Transfer Complete
                </span>
                <h1 className="text-3xl font-black text-slate-900">
                  R{amount} is yours!
                </h1>
                <p className="text-xs text-slate-500 mt-2">
                  Sent with love by <strong className="text-slate-800">{sender}</strong>.
                </p>
              </div>

              {/* Rand Balance Card */}
              <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-lg space-y-2 text-left">
                <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider block">
                  Your Available Balance
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black font-mono">R{amount}</span>
                </div>
                <div className="pt-2 border-t border-emerald-500/40 text-[11px] text-emerald-100 flex items-center justify-between">
                  <span>Linked Phone: {phone}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">Safe & Active</span>
                </div>
              </div>

              {/* Simple Non-Crypto Options */}
              <div className="space-y-2.5 text-left pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💰</span>
                    <div>
                      <strong className="block text-slate-800">Hold Safely in Rand</strong>
                      <span className="text-[11px] text-slate-400">Protected in your phone account</span>
                    </div>
                  </div>
                  <CheckCircle2 size={16} className="text-emerald-600" />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs opacity-75">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🏪</span>
                    <div>
                      <strong className="block text-slate-800">Cash-Out at Retail Agent</strong>
                      <span className="text-[11px] text-slate-400">Shoprite / Pick n Pay (Coming next phase)</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">Next Phase</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-center">
                <p className="text-[11px] text-slate-400">
                  Ref: {successData?.claimedTxHash?.slice(0, 10)}...{successData?.claimedTxHash?.slice(-6)}
                </p>
                <p className="text-[11px] text-emerald-700 font-bold mt-1">
                  "She never needed to know what a blockchain is."
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-md mx-auto w-full text-center text-xs text-slate-400 pb-4">
        AssetBridge Africa · Simple, safe cross-border payments for everyone
      </footer>
    </div>
  );
}

