import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Landmark,
  LockKeyhole,
  Phone,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
  X,
  Zap,
  Search,
  Globe,
} from 'lucide-react';
import { remittanceService, FX_DESTINATIONS, REGIONS } from '../services/remittanceService';
import { walletClientService } from '../services/walletClientService';

const recipientMethods = [
  { id: 'username', label: 'Username', icon: UserRound, placeholder: '@recipient' },
  { id: 'phone', label: 'Phone', icon: Phone, placeholder: '+254 712 345 678' },
  { id: 'wallet', label: 'QR / wallet', icon: QrCode, placeholder: 'Paste recipient wallet address' },
];

const amountPresets = [10, 25, 50, 100];

export default function RemittancePage({ user }) {
  const [destinations, setDestinations] = useState(FX_DESTINATIONS);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sendAmount, setSendAmount] = useState('100');
  const [selectedCurrency, setSelectedCurrency] = useState('tKES');
  const [recipientNumber, setRecipientNumber] = useState('+254 712 345 678');
  const [recipientMethod, setRecipientMethod] = useState('phone');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [userWallet, setUserWallet] = useState(null);

  // Fetch or create cryptographically verified wallet
  useEffect(() => {
    walletClientService.getOrCreateWallet(user).then((wallet) => {
      setUserWallet(wallet);
    });
  }, [user]);

  // Fetch destinations from backend API on mount
  useEffect(() => {
    let isMounted = true;
    remittanceService.fetchDestinations().then((data) => {
      if (isMounted && data && Array.isArray(data) && data.length > 0) {
        setDestinations(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const numAmount = Number(sendAmount) || 0;
  const quote = remittanceService.calculateComparison(numAmount, selectedCurrency);
  const currentDest = destinations.find((d) => d.code === selectedCurrency) || destinations[0] || FX_DESTINATIONS[0];
  const activeMethod = recipientMethods.find((method) => method.id === recipientMethod) || recipientMethods[1];
  const RecipientIcon = activeMethod.icon;

  const filteredDestinations = destinations.filter((destination) => {
    const matchesRegion = selectedRegion === 'All' || destination.region === selectedRegion;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesRegion;
    return (
      matchesRegion &&
      (destination.country.toLowerCase().includes(q) ||
        destination.name.toLowerCase().includes(q) ||
        destination.code.toLowerCase().includes(q) ||
        destination.mobileChannels.some((ch) => ch.toLowerCase().includes(q)))
    );
  });

  const handleSelectDestination = (destination) => {
    setSelectedCurrency(destination.code);
    setIsDropdownOpen(false);
    setFormError('');
    if (recipientMethod === 'phone') {
      setRecipientNumber(destination.defaultRecipient || '');
    }
  };

  const handleInitiateSend = (event) => {
    event.preventDefault();
    setFormError('');

    if (numAmount < 1) {
      setFormError('Minimum transfer amount is $1.00 USDT.');
      return;
    }

    if (numAmount > 10000) {
      setFormError('Safety limit: Maximum single transfer is $10,000 USDT on testnet.');
      return;
    }

    if (userWallet && userWallet.balanceUsdt < numAmount) {
      setFormError(`Insufficient Tether USDT balance. Required: $${numAmount.toFixed(2)} USDT, Available: $${userWallet.balanceUsdt.toFixed(2)} USDT.`);
      return;
    }

    if (!recipientNumber.trim()) {
      setFormError(`Enter a recipient ${activeMethod.label.toLowerCase()} to continue.`);
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmAndSign = () => {
    setShowConfirmModal(false);
    setIsSending(false);
    setFormError('Remittance is unavailable: no real transaction or payout provider is connected. No funds were sent.');
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 pb-6">
      <section className="flex flex-col justify-between gap-5 rounded-[2rem] border border-slate-800 bg-gradient-to-br from-[#101936] via-[#111d3a] to-[#071124] p-5 text-white shadow-xl shadow-blue-950/15 sm:flex-row sm:items-center sm:p-7">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-teal-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-teal-300">
            <Send size={13} />
            Direct Global Remittance · Zero Spread
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Send Money Worldwide</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-300">
            Send USDT stablecoins globally with immediate local currency payout into mobile money (M-Pesa, Capitec, OPay, Pix) and local banks at 95% lower fees.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/5 p-2 sm:self-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-400 text-xs font-bold text-[#101936]">1</div>
          <span className="pr-2 text-xs font-semibold text-white">Transfer details</span>
          <div className="h-px w-5 bg-white/20" />
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-xs font-bold text-slate-400">2</div>
          <span className="pr-2 text-xs font-medium text-slate-400">Authorize</span>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm xl:col-span-7">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Who are you sending to?</h3>
                <p className="mt-1 text-sm text-slate-500">Choose how to identify your recipient.</p>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
                <ShieldCheck size={14} />
                Protected transfer
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
              {recipientMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = recipientMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setRecipientMethod(method.id);
                      setRecipientNumber('');
                      setFormError('');
                    }}
                    aria-pressed={isSelected}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold transition sm:text-sm ${
                      isSelected
                        ? 'bg-white text-teal-800 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon size={16} />
                    {method.label}
                  </button>
                );
              })}
            </div>

            <label htmlFor="recipient" className="mb-2 mt-5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              {recipientMethod === 'wallet' ? 'Recipient wallet address' : `Recipient ${activeMethod.label}`}
            </label>
            <div className="relative">
              <RecipientIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="recipient"
                form="remittance-form"
                type="text"
                required
                value={recipientNumber}
                onChange={(event) => setRecipientNumber(event.target.value)}
                placeholder={
                  recipientMethod === 'phone'
                    ? (quote.dest.recipientType || activeMethod.placeholder)
                    : activeMethod.placeholder
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
              />
            </div>
            {recipientMethod === 'wallet' ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Paste the destination wallet address from the recipient’s QR code. Confirm the address carefully before authorizing.
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                {recipientMethod === 'phone'
                  ? `Payout rails for ${quote.dest.country}: ${quote.dest.mobileChannels.join(', ')}`
                  : 'Enter the recipient’s AssetBridge username.'}
              </p>
            )}
          </div>

          <form id="remittance-form" onSubmit={handleInitiateSend} className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
            <div>
              <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                    <Globe size={18} className="text-teal-600" />
                    <span>Where should it go?</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Send money globally with instant local currency payout.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700 border border-teal-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                  {destinations.length} worldwide destinations
                </span>
              </div>

              {/* Clean Dropdown Trigger Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isDropdownOpen}
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-teal-500 hover:shadow-md focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50 font-black text-sm text-slate-800 shadow-sm">
                      {currentDest.iso || currentDest.country.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{currentDest.country}</span>
                        <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-mono font-bold text-teal-700 border border-teal-200">
                          {currentDest.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        Payout via {currentDest.mobileChannels.join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden text-right sm:block">
                      <span className="block text-xs font-semibold text-slate-900">
                        1 USDT = {currentDest.ratePerUsd.toLocaleString()} {currentDest.symbol}
                      </span>
                      <span className="block text-[11px] text-emerald-600 font-medium">Guaranteed rate · 0% FX spread</span>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-teal-50 group-hover:text-teal-700">
                      {isDropdownOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </button>

                {/* Dropdown Options Popover Menu */}
                {isDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl ring-1 ring-slate-900/5 animate-fade-in">
                      {/* Search Bar inside Dropdown */}
                      <div className="relative mb-2.5">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          autoFocus
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search country, currency, or rail (e.g. Kenya, Pix, Euro, SEPA)..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-xs font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      {/* Region Filters inside Dropdown */}
                      <div className="flex flex-wrap items-center gap-1 mb-2.5 pb-2 border-b border-slate-100">
                        {REGIONS.map((region) => {
                          const isSelected = selectedRegion === region;
                          return (
                            <button
                              key={region}
                              type="button"
                              onClick={() => setSelectedRegion(region)}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                                isSelected
                                  ? 'bg-slate-900 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                              }`}
                            >
                              {region}
                            </button>
                          );
                        })}
                      </div>

                      {/* Destinations List */}
                      <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                        {filteredDestinations.map((destination) => {
                          const isSelected = selectedCurrency === destination.code;
                          return (
                            <button
                              key={destination.code}
                              type="button"
                              onClick={() => handleSelectDestination(destination)}
                              className={`flex w-full items-center justify-between gap-3 rounded-xl p-2.5 text-left transition ${
                                isSelected
                                  ? 'bg-teal-50/90 text-teal-950 font-semibold ring-1 ring-teal-500/30'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white font-bold text-xs text-slate-800 shadow-sm">
                                  {destination.iso || destination.country.slice(0, 2).toUpperCase()}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-900 truncate">{destination.country}</span>
                                    <span className="text-[11px] text-slate-400 font-normal truncate">· {destination.name}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {destination.mobileChannels.join(', ')}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <div className="text-right">
                                  <span className="font-mono text-xs font-bold text-slate-900">{destination.code}</span>
                                  <span className="block text-[10px] text-slate-400">1 USDT = {destination.ratePerUsd.toLocaleString()} {destination.symbol}</span>
                                </div>
                                {isSelected ? (
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm">
                                    <Check size={12} strokeWidth={3} />
                                  </div>
                                ) : (
                                  <div className="h-5 w-5 rounded-full border border-slate-200" />
                                )}
                              </div>
                            </button>
                          );
                        })}

                        {filteredDestinations.length === 0 && (
                          <div className="py-6 text-center text-xs text-slate-500">
                            <p>No destinations found for "{searchQuery}".</p>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                setSelectedRegion('All');
                              }}
                              className="mt-2 text-teal-700 font-bold hover:underline"
                            >
                              Reset search
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Live Real-Time Converted Amount Pill */}
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-teal-50/90 to-emerald-50/90 border border-teal-100 px-3.5 py-2.5 text-xs text-teal-950">
                  <div className="flex items-center gap-2 min-w-0">
                    <Zap size={14} className="text-teal-600 shrink-0" />
                    <span className="truncate">
                      <strong>${sendAmount || '0'} USDT</strong> converts to <strong className="text-teal-800 font-extrabold">{quote.assetBridge.receivedFormatted}</strong>
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] font-semibold text-teal-700 bg-white/90 px-2 py-0.5 rounded-md border border-teal-200">
                    1 USDT = {currentDest.ratePerUsd.toLocaleString()} {currentDest.symbol}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="send-amount" className="text-xs font-bold uppercase tracking-wide text-slate-600">You send</label>
                <span className="text-xs text-slate-500">Transfer limit <strong className="text-slate-700">$10,000</strong></span>
              </div>
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50/70 p-2 transition focus-within:border-teal-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-500/10">
                <span className="pl-3 text-2xl font-semibold text-slate-400">$</span>
                <input
                  id="send-amount"
                  type="number"
                  min="1"
                  max="10000"
                  step="any"
                  required
                  value={sendAmount}
                  onChange={(event) => setSendAmount(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 text-3xl font-bold tracking-tight text-slate-950 outline-none"
                  aria-label="Amount in USDT"
                />
                <span className="mr-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm">USDT</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-medium text-slate-400">Quick amount</span>
                {amountPresets.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setSendAmount(String(amount))}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      numAmount === amount
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-800'
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSendAmount('10000')}
                  className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-800"
                >
                  Max
                </button>
              </div>
            </div>

            {formError && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                <AlertTriangle size={17} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 border-t border-slate-100 pt-5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <LockKeyhole size={14} className="text-teal-700" />
                Review before you authorize
              </span>
            </div>

          </form>
        </section>

        <aside className="space-y-5 xl:col-span-5">
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#082f3a] via-[#07545b] to-[#087d76] p-6 text-white shadow-xl shadow-teal-950/10 sm:p-7">
            <div className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-cyan-300/15 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-100">
                  <Sparkles size={13} />
                  Guaranteed Live FX Quote
                </div>
                <span className="text-xs font-medium text-teal-100">Direct Payout</span>
              </div>
              <div className="mt-7 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-2xl ring-1 ring-white/15">{quote?.dest?.flag || '🌐'}</span>
                <div>
                  <p className="text-xs font-medium text-teal-100">Recipient gets</p>
                  <p className="text-sm font-bold">{quote?.dest?.country || 'Destination'} · {selectedCurrency}</p>
                </div>
              </div>
              <p className="mt-4 break-words text-3xl font-extrabold tracking-tight sm:text-4xl">{quote?.assetBridge?.receivedFormatted}</p>
              <div className="mt-5 flex items-center gap-2 text-xs text-teal-100">
                <span className="rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold">${sendAmount || '0'} USDT</span>
                <ArrowRight size={14} />
                <span className="font-medium">{quote?.dest?.flag} {quote?.dest?.country}</span>
              </div>
              <div className="my-5 h-px bg-white/15" />
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 text-teal-50">
                  <span className="flex items-center gap-2"><Wallet size={15} /> Network fee</span>
                  <strong className="text-white">{quote?.assetBridge?.fee}</strong>
                </div>
                <div className="flex items-center justify-between gap-3 text-teal-50">
                  <span className="flex items-center gap-2"><Clock3 size={15} /> Delivery</span>
                  <strong className="text-white">{quote?.assetBridge?.speed}</strong>
                </div>
                <div className="flex items-center justify-between gap-3 text-teal-50">
                  <span className="flex items-center gap-2"><Landmark size={15} /> Exchange rate</span>
                  <strong className="text-right text-white">{quote?.assetBridge?.exchangeRateFormatted}</strong>
                </div>
              </div>
              <p className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-teal-100">
                <BadgeCheck size={16} className="shrink-0 text-emerald-300" />
                Zero FX spread markup. Instant local payout via {quote?.dest?.mobileChannels?.[0] || 'Local Rail'}.
              </p>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Zap size={19} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Why send with AssetBridge?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Direct USDT stablecoin rails eliminate 3-5 intermediary correspondent banking fees and predatory 4.5% foreign exchange markups.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Estimated savings</p>
                <p className="mt-1 text-lg font-extrabold text-emerald-900">
                  ${quote?.advantage?.extraReceivedUsd || quote?.savings?.extraUsdFormatted?.replace('+$', '') || '0.00'}
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Settlement</p>
                <p className="mt-1 text-sm font-extrabold text-blue-900">~3 seconds</p>
              </div>
            </div>
          </section>
          <button
            type="submit"
            form="remittance-form"
            disabled={isSending}
            className="group flex min-h-24 w-full items-center gap-4 rounded-[2rem] border border-emerald-100 bg-[#E5F9F0] p-5 text-left text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/20 active:translate-y-0 disabled:cursor-wait disabled:opacity-70"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm transition-transform group-hover:scale-105">
              <Send size={22} strokeWidth={2.5} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-bold tracking-tight">
                {isSending ? 'Sending securely…' : 'Continue to review'}
              </span>
              <span className="mt-0.5 text-xs font-medium text-emerald-700/80">
                Review your ${sendAmount || '0'} USDT transfer
              </span>
            </span>
            {!isSending && (
              <ArrowRight size={20} className="shrink-0 transition-transform group-hover:translate-x-1" />
            )}
          </button>
        </aside>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-rose-600">
              <Landmark size={14} />
              Transparent comparison
            </div>
            <h3 className="text-lg font-bold text-slate-950">See what arrives at the other end</h3>
          </div>
          <p className="text-xs text-slate-500">Based on a ${sendAmount || '0'} USDT transfer to {quote?.dest?.country || 'destination'}.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-6">
          <article className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-emerald-950">AssetBridge</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">Recommended</span>
            </div>
            <p className="mt-4 text-xs font-medium text-emerald-800">Recipient gets</p>
            <p className="mt-1 break-words text-2xl font-extrabold tracking-tight text-emerald-950">{quote?.assetBridge?.receivedFormatted || '—'}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-emerald-200 pt-3 text-xs text-emerald-900">
              <span>Fee <strong>{quote?.assetBridge?.fee || '$0.20'}</strong></span>
              <span>FX markup <strong>$0.00</strong></span>
              <span>Delivery <strong>~3 sec</strong></span>
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-700">Typical bank wire</span>
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">Traditional</span>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">Recipient gets</p>
            <p className="mt-1 break-words text-2xl font-extrabold tracking-tight text-slate-700">{quote?.traditionalBank?.receivedFormatted || quote?.bankWire?.receivedFormatted || '—'}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
              <span>Fee <strong>{quote?.traditionalBank?.fee || quote?.bankWire?.fee || '$15.00'}</strong></span>
              <span>FX markup <strong>4.5%</strong></span>
              <span>Delivery <strong>3–5 days</strong></span>
            </div>
          </article>
        </div>
      </section>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fade-in">
          <section role="dialog" aria-modal="true" aria-labelledby="transfer-dialog-title" className="w-full max-w-lg rounded-[2rem] border border-slate-100 bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-800"><LockKeyhole size={20} /></span>
                <div>
                  <h3 id="transfer-dialog-title" className="text-lg font-bold">Review your transfer</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Check the details before authorizing.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowConfirmModal(false)} aria-label="Close review" className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-3"><span className="text-slate-500">Destination</span><strong className="text-right text-slate-900">{quote?.dest?.flag} {quote?.dest?.country} ({selectedCurrency})</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Payout Rail</span><strong className="text-right text-slate-900">{quote?.dest?.mobileChannels?.[0] || 'Local Rail'}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Recipient</span><strong className="max-w-[65%] break-all text-right text-slate-900">{recipientNumber}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">You send</span><strong className="text-slate-900">${sendAmount} USDT</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Network fee</span><strong className="text-emerald-700">{quote?.assetBridge?.fee}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Exchange rate</span><strong className="text-right text-slate-900">{quote?.assetBridge?.exchangeRateFormatted}</strong></div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-base">
                <span className="font-semibold text-slate-700">Recipient gets</span>
                <strong className="text-right text-teal-800">{quote?.assetBridge?.receivedFormatted}</strong>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Once authorized, blockchain settlement cannot be reversed. Make sure the recipient details are correct.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" onClick={() => setShowConfirmModal(false)} className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Edit details</button>
              <button type="button" onClick={handleConfirmAndSign} className="min-h-11 flex-1 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white shadow-md transition hover:bg-teal-800">Sign & authorize</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
