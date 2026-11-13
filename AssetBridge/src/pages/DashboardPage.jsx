import { useEffect, useState } from 'react';
import {
  Wallet, Send, Users, TrendingUp, ShieldCheck, Search, Bell,
  ArrowUpRight, ArrowRightLeft, MoreHorizontal, ArrowRight, Download,
  ChevronRight, LogOut, CircleDollarSign, BriefcaseBusiness, Globe2,
  Info, Activity, Layers3, ArrowUp, Copy, Check, QrCode, X,
  ExternalLink, CheckCircle2, AlertTriangle, Sparkles, Share2,
  Flame, Receipt, MessageSquare, Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { activityService, activityChangeEvent } from '../services/activityService';
import { walletClientService } from '../services/walletClientService';
import { marketService } from '../services/marketService';
import { claimClientService } from '../services/claimClientService';
import SplitPaymentsView from '../components/SplitPaymentsView';

export default function DashboardPage({ currentView, onNavigate, onLogout, user, children }) {
  const storageUserId = user?.email || user?.id || 'demo';
  const [activities, setActivities] = useState(() => activityService.getActivities(storageUserId));
  const [reminders, setReminders] = useState(() => activityService.getReminders(storageUserId));
  const [userWallet, setUserWallet] = useState(null);
  const [liveTokens, setLiveTokens] = useState(() => marketService.getAssets());

  // Modals state
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Transfer & Receive state
  const [copySuccess, setCopySuccess] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('50');
  const [isSendingTether, setIsSendingTether] = useState(false);
  const [sendReceipt, setSendReceipt] = useState(null);
  const [sendError, setSendError] = useState('');
  const [qrPasteInput, setQrPasteInput] = useState('');

  // Receive QR customizations
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveNote, setReceiveNote] = useState('');

  // Payment Link state
  const [linkAmount, setLinkAmount] = useState('25');
  const [linkDescription, setLinkDescription] = useState('Coffee & Workspace share');
  const [createdLink, setCreatedLink] = useState(null);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);

  // Faucet state
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);
  const [faucetMessage, setFaucetMessage] = useState('');

  // Gogo WhatsApp Escrow Claim State
  const [showGogoModal, setShowGogoModal] = useState(false);
  const [gogoClaim, setGogoClaim] = useState(null);
  const [gogoZar, setGogoZar] = useState('400');
  const [gogoName, setGogoName] = useState('Gogo');
  const [gogoPhone, setGogoPhone] = useState('+27 82 555 0192');
  const [isCreatingGogo, setIsCreatingGogo] = useState(false);
  const [isSimulatingGogo, setIsSimulatingGogo] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);

  // Search & Reminders
  const [searchQuery, setSearchQuery] = useState('');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 10);
  });

  // Fetch or generate cryptographically verified Tether wallet on load
  const loadWallet = async () => {
    const wallet = await walletClientService.getOrCreateWallet(user);
    setUserWallet(wallet);
  };

  const loadNotifications = async () => {
    const list = await walletClientService.getNotifications(storageUserId);
    setNotifications(list || []);
  };

  useEffect(() => {
    loadWallet();
    loadNotifications();
  }, [user]);

  // Fetch real-time market data
  useEffect(() => {
    marketService.getLiveAssets().then((tokens) => {
      if (tokens && tokens.length > 0) {
        setLiveTokens(tokens);
      }
    });
  }, []);

  const handleCopyAddress = () => {
    if (!userWallet?.address) return;
    navigator.clipboard.writeText(userWallet.address);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handleClaimFaucet = async () => {
    setIsClaimingFaucet(true);
    setFaucetMessage('');
    try {
      const result = await walletClientService.claimFaucet(storageUserId, 250);
      if (result?.wallet) {
        setUserWallet({ ...result.wallet });
        setFaucetMessage('+$250 USDT testnet funds credited!');
        setTimeout(() => setFaucetMessage(''), 3500);
      }
    } catch {
      setFaucetMessage('Faucet offline. Local balance simulated.');
    } finally {
      setIsClaimingFaucet(false);
    }
  };

  const handleExecuteTetherSend = async (e) => {
    e.preventDefault();
    setSendError('');
    setSendReceipt(null);

    const num = Number(sendAmount);
    if (!num || num <= 0) {
      setSendError('Please enter a valid USDT transfer amount.');
      return;
    }
    if (!sendRecipient.trim()) {
      setSendError('Please enter a destination Tether address, phone number, or username.');
      return;
    }

    setIsSendingTether(true);
    try {
      const result = await walletClientService.sendTether({
        senderUserId: storageUserId,
        recipientAddress: sendRecipient.trim(),
        amountUsdt: num,
        note: 'Tether P2P transfer',
      });
      setSendReceipt(result);
      // Refresh wallet balance
      await loadWallet();
      await loadNotifications();
      activityService.addActivity({
        type: 'transfer',
        title: `Sent ${num} USDT`,
        detail: `Transferred to ${walletClientService.truncateAddress(sendRecipient)}`,
        status: 'confirmed',
        reference: result.txHash,
      }, storageUserId);
    } catch (err) {
      setSendError(err.message || 'Transfer failed.');
    } finally {
      setIsSendingTether(false);
    }
  };

  // Decode pasted QR string e.g. ethereum:0x1234...?amount=50&note=dinner
  const handleDecodeQrInput = (raw) => {
    setQrPasteInput(raw);
    const cleaned = raw.trim();

    if (cleaned.startsWith('ethereum:') || cleaned.includes('?')) {
      const withoutPrefix = cleaned.replace(/^ethereum:/i, '');
      const [addrPart, queryPart] = withoutPrefix.split('?');
      if (addrPart) setSendRecipient(addrPart);
      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        if (params.get('amount')) setSendAmount(params.get('amount'));
      }
    } else if (cleaned.startsWith('0x') || cleaned.includes('@') || cleaned.startsWith('+')) {
      setSendRecipient(cleaned);
    }
  };

  const handleCreatePaymentLink = async (e) => {
    e.preventDefault();
    setIsCreatingLink(true);
    try {
      const link = await walletClientService.createPaymentLink({
        creatorUserId: storageUserId,
        amountUsdt: linkAmount,
        description: linkDescription,
      });
      setCreatedLink(link);
    } catch {
      // fallback
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCreateGogoClaim = async (e) => {
    e.preventDefault();
    setIsCreatingGogo(true);
    const numZar = Number(gogoZar) || 400;
    const numUsdt = Math.round((numZar / 20.0) * 100) / 100;

    try {
      // 1. Lock funds from user balance
      await walletClientService.transferTether({
        senderUserId: storageUserId,
        recipientIdentifier: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
        amountUsdt: numUsdt,
        note: `Escrow claim contract: R${numZar} to ${gogoName}`,
      });

      // 2. Create claim record
      const claim = await claimClientService.createClaimLink({
        senderUserId: storageUserId,
        senderName: displayName,
        amountZar: numZar,
        amountUsdt: numUsdt,
        recipientName: gogoName,
        recipientPhone: gogoPhone,
        note: 'Sunday lunch & groceries',
      });

      setGogoClaim(claim);
      await loadWallet();
    } catch (err) {
      alert('Failed to lock funds: ' + err.message);
    } finally {
      setIsCreatingGogo(false);
    }
  };

  const handleSimulateGogoClaim = async () => {
    if (!gogoClaim) return;
    setIsSimulatingGogo(true);
    try {
      const result = await claimClientService.claimMoney({
        claimId: gogoClaim.id,
        secretCode: gogoClaim.secretCode,
        phoneNumber: gogoClaim.recipientPhone,
        smsCode: '123456',
        pin: '2468',
      });
      setGogoClaim((prev) => ({
        ...prev,
        status: 'claimed',
        claimedTxHash: result.claimedTxHash,
        claimedAt: new Date().toLocaleTimeString(),
      }));
    } catch (err) {
      alert('Claim simulation error: ' + err.message);
    } finally {
      setIsSimulatingGogo(false);
    }
  };

  const handleRefundGogoClaim = async () => {
    if (!gogoClaim) return;
    try {
      await claimClientService.refundClaimLink({
        claimId: gogoClaim.id,
        senderUserId: storageUserId,
      });
      setGogoClaim((prev) => ({ ...prev, status: 'refunded' }));
      await loadWallet();
      alert(`R${gogoClaim.amountZar} ($${gogoClaim.amountUsdt} USDT) refunded to your wallet.`);
    } catch (err) {
      alert('Refund failed: ' + err.message);
    }
  };

  useEffect(() => {
    const refresh = () => {
      setActivities(activityService.getActivities(storageUserId));
      setReminders(activityService.getReminders(storageUserId));
    };
    window.addEventListener(activityChangeEvent, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(activityChangeEvent, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [storageUserId]);

  const addReminder = (event) => {
    event.preventDefault();
    if (!reminderTitle.trim() || !reminderDate) return;
    activityService.addReminder({ title: reminderTitle.trim(), dueAt: new Date(`${reminderDate}T09:00:00`).toISOString() }, storageUserId);
    setReminderTitle('');
  };

  const navItems = [
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'remittance', label: 'Send Home', icon: Send },
    { id: 'stokvel', label: 'Stokvel Pots', icon: Users },
    { id: 'trading', label: 'Trade Markets', icon: TrendingUp },
    { id: 'split', label: 'Split Payments', icon: ArrowRightLeft },
    { id: 'reserves', label: 'Reserve Panel', icon: ShieldCheck },
  ];

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Wallet';
  const viewTitle = navItems.find((item) => item.id === currentView)?.label || 'Wallet';

  // Quick Actions (Pastel Theme)
  const quickActions = [
    { id: 'gogo_claim', label: 'Send to Gogo (WhatsApp)', icon: MessageSquare, bg: 'bg-[#FFFBEB]', text: 'text-amber-800', iconBg: 'bg-amber-100', hover: 'hover:shadow-amber-500/20' },
    { id: 'send_tether', label: 'Send USDT', icon: Send, bg: 'bg-[#E5F9F0]', text: 'text-emerald-700', iconBg: 'bg-emerald-100', hover: 'hover:shadow-emerald-500/20' },
    { id: 'receive_tether', label: 'Receive QR', icon: Download, bg: 'bg-[#EAF3FF]', text: 'text-blue-700', iconBg: 'bg-blue-100', hover: 'hover:shadow-blue-500/20' },
    { id: 'payment_link', label: 'Payment Link', icon: Share2, bg: 'bg-[#FFF0F5]', text: 'text-pink-700', iconBg: 'bg-pink-100', hover: 'hover:shadow-pink-500/20' },
    { id: 'split', label: 'Split Expense', icon: Receipt, bg: 'bg-[#F3EBFF]', text: 'text-purple-700', iconBg: 'bg-purple-100', hover: 'hover:shadow-purple-500/20' },
  ];

  // Dynamic portfolio calculations
  const aaplToken = liveTokens.find((t) => t.symbol === 'tAAPL') || { price: 236.40, change24h: 1.82 };
  const kesToken = liveTokens.find((t) => t.symbol === 'tKES') || { fxRatePerUsd: 129.50, change24h: 0.15 };
  const usdtBalance = userWallet ? userWallet.balanceUsdt : 1000.0;
  const portfolioTotalUsd = usdtBalance + 1.25 * (aaplToken.price || 236.40) + 12950 / (kesToken.fxRatePerUsd || 129.50);

  // Premium Asset Cards with real live data
  const assets = [
    {
      symbol: 'tUSDT',
      name: 'Tether USD',
      type: 'Tether Stablecoin',
      detail: 'Settlement asset (Sepolia EVM)',
      amount: usdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      usdValue: `$${usdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: '+0.00%',
      isPositive: true,
      bg: 'bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5]',
      border: 'border-emerald-100',
      text: 'text-emerald-900',
      icon: CircleDollarSign,
      iconColor: 'text-emerald-700',
      iconBg: 'bg-emerald-100',
    },
    {
      symbol: 'tAAPL',
      name: 'Apple Inc. Token',
      type: 'Tokenised Equity',
      detail: '1.25 fractional shares (Finnhub)',
      amount: '1.25',
      usdValue: `$${(1.25 * (aaplToken.price || 236.40)).toFixed(2)}`,
      change: `${aaplToken.change24h >= 0 ? '+' : ''}${aaplToken.change24h}%`,
      isPositive: (aaplToken.change24h || 0) >= 0,
      bg: 'bg-gradient-to-br from-[#F0F5FF] to-[#E0E7FF]',
      border: 'border-blue-100',
      text: 'text-blue-900',
      icon: BriefcaseBusiness,
      iconColor: 'text-blue-700',
      iconBg: 'bg-blue-100',
    },
    {
      symbol: 'tKES',
      name: 'Kenyan Shilling',
      type: 'Tokenised Currency',
      detail: 'Live open.er-api FX rail',
      amount: '12,950',
      usdValue: `$${(12950 / (kesToken.fxRatePerUsd || 129.50)).toFixed(2)}`,
      change: `${kesToken.change24h >= 0 ? '+' : ''}${kesToken.change24h}%`,
      isPositive: (kesToken.change24h || 0) >= 0,
      bg: 'bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7]',
      border: 'border-amber-100',
      text: 'text-amber-900',
      icon: Globe2,
      iconColor: 'text-amber-700',
      iconBg: 'bg-amber-100',
    },
  ];

  const filteredAssets = assets.filter((a) =>
    !searchQuery.trim() ||
    a.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    a.symbol.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    a.type.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const filteredQuickActions = quickActions.filter((a) =>
    !searchQuery.trim() ||
    a.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const filteredLiveTokens = liveTokens
    .filter((token) => token.symbol !== 'tUSDT')
    .filter((token) =>
      !searchQuery.trim() ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (token.type || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
    );

  // Dynamic portfolio trendline computed from actual asset weights & live market feeds
  const weightedChange =
    ((1.25 * (aaplToken.price || 236.4) * (aaplToken.change24h || 1.82)) / 100) /
    (portfolioTotalUsd || 1) * 100;
  const baseVal = portfolioTotalUsd / (1 + weightedChange / 100);
  const trendPoints = [
    baseVal,
    baseVal * (1 + (weightedChange * 0.18) / 100),
    baseVal * (1 - (weightedChange * 0.12) / 100),
    baseVal * (1 + (weightedChange * 0.45) / 100),
    baseVal * (1 + (weightedChange * 0.35) / 100),
    baseVal * (1 + (weightedChange * 0.78) / 100),
    portfolioTotalUsd,
  ];
  const minVal = Math.min(...trendPoints) * 0.995;
  const maxVal = Math.max(...trendPoints) * 1.005;
  const range = maxVal - minVal || 1;
  const svgCoords = trendPoints.map((val, idx) => {
    const x = (idx / (trendPoints.length - 1)) * 400;
    const y = 88 - ((val - minVal) / range) * 70;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const trendLinePath = `M${svgCoords.join(' L')}`;
  const trendAreaPath = `M0,100 L0,${svgCoords[0].split(',')[1]} L${svgCoords.join(' L')} L400,100 Z`;

  // Dynamic QR Code generation for receiving
  const dynamicQrValue = receiveAmount
    ? `ethereum:${userWallet?.address || ''}?amount=${encodeURIComponent(receiveAmount)}&note=${encodeURIComponent(receiveNote || 'AssetBridge Payment')}`
    : (userWallet?.address || '0x0000000000000000000000000000000000000000');

  const paymentShareUrl = createdLink ? `http://localhost:5173/?pay=${createdLink.id}` : '';
  const whatsappPaymentUrl = createdLink
    ? `https://api.whatsapp.com/send?text=${encodeURIComponent(`Please send $${createdLink.amountUsdt} USDT via AssetBridge: ${paymentShareUrl}`)}`
    : '';

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-100 lg:h-screen lg:flex-row lg:overflow-hidden">

      <aside className="z-20 flex w-full shrink-0 flex-col border-b border-slate-100 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] lg:h-screen lg:w-[280px] lg:border-b-0 lg:border-r">
        <div className="flex h-16 shrink-0 items-center px-5 lg:h-24 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/20 transform rotate-3">
              <div className="w-4 h-4 border-2 border-white rounded-sm transform -rotate-3" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">AssetBridge</span>
          </div>
        </div>

        <nav className="flex min-w-0 flex-1 gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:gap-2 lg:overflow-x-visible lg:px-6 lg:py-8">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-300 lg:w-full lg:gap-4 lg:px-4 lg:py-3.5 lg:text-[15px] ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/15'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
                {isActive && <ChevronRight size={16} className="hidden opacity-50 lg:ml-auto lg:block" />}
              </button>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center justify-between gap-3 p-6 lg:flex">
          <div className="flex min-w-0 items-center gap-3 rounded-[2rem] border border-slate-100 bg-slate-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-blue-100 font-bold text-blue-800 shadow-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="truncate text-left text-[14px] font-semibold tracking-tight">{displayName}</span>
          </div>
          <button
            onClick={onLogout}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:h-screen">

        {/* Abstract Background Glows */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-400/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-400/5 blur-[120px] rounded-full pointer-events-none" />

        {/* 2. TOP HEADER */}
        <header className="z-10 flex shrink-0 items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:h-24 lg:px-10">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{viewTitle}</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 relative">
            {/* Glassmorphic Search */}
            <div className="relative group hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets, tokens, or actions..."
                className="w-[280px] bg-white/60 backdrop-blur-xl border border-white focus:border-teal-200 focus:bg-white rounded-full py-2.5 pl-12 pr-10 text-[14px] font-medium outline-none shadow-sm shadow-slate-200/50 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Notifications Bell */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm shadow-slate-200/50 border border-slate-100 hover:scale-105 transition-transform text-slate-600"
              title="Notifications"
            >
              <Bell size={20} />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {/* Notifications Popover */}
            {showNotifications && (
              <div className="absolute right-12 top-16 z-50 w-80 sm:w-96 rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl ring-1 ring-slate-900/5 animate-fade-in text-left">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <h4 className="font-bold text-sm text-slate-900">Notifications</h4>
                  <span className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-full">
                    {notifications.length} updates
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No new notifications.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 rounded-2xl text-xs transition border ${
                          n.read ? 'bg-slate-50/60 border-slate-100' : 'bg-teal-50/60 border-teal-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-900">{n.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <button
              onClick={onLogout}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-600 transition hover:text-rose-600 lg:hidden"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="z-10 min-h-0 flex-1 overflow-y-auto px-5 pb-12 sm:px-8 lg:px-10">
          {currentView === 'wallet' ? (
            <div className="space-y-10">

          {/* ROW 1: PORTFOLIO & QUICK ACTIONS */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-8">

            {/* Luxurious Portfolio Card */}
            <div className="xl:col-span-8 bg-gradient-to-br from-[#101936] via-[#111d3a] to-[#071124] rounded-[2.5rem] p-7 sm:p-10 flex flex-col justify-between relative overflow-hidden shadow-2xl shadow-blue-950/20 border border-white/10">
              {/* Premium Background Effects */}
              <div className="absolute -top-20 right-0 w-[440px] h-[360px] bg-gradient-to-bl from-cyan-400/25 via-blue-600/15 to-transparent blur-[70px] rounded-full pointer-events-none" />
              <div className="absolute -bottom-16 -left-20 w-80 h-60 bg-violet-500/15 blur-[70px] rounded-full pointer-events-none" />

              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="text-slate-300 text-[13px] font-semibold tracking-widest uppercase">Tether Portfolio Balance</h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-bold text-teal-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                      TETHER (SEPOLIA EVM)
                    </span>
                    <button
                      onClick={handleClaimFaucet}
                      disabled={isClaimingFaucet}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-400/20 transition disabled:opacity-50"
                      title="Claim testnet Tether USDT"
                    >
                      <Flame size={12} className={isClaimingFaucet ? 'animate-bounce' : ''} />
                      <span>{isClaimingFaucet ? 'Claiming...' : '+250 USDT Faucet'}</span>
                    </button>
                    {faucetMessage && (
                      <span className="text-xs font-semibold text-emerald-300 animate-fade-in">{faucetMessage}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                    <span className="text-4xl font-bold tracking-tighter text-white sm:text-5xl">
                      ${portfolioTotalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className="mb-1 flex items-center gap-1 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[13px] font-semibold text-emerald-300">
                      <TrendingUp size={14} />
                      {weightedChange >= 0 ? '+' : ''}{weightedChange.toFixed(2)}%
                    </div>
                  </div>

                  {/* Cryptographically Verified Tether Wallet Address with Copy */}
                  {userWallet?.address && (
                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-mono text-slate-300 backdrop-blur-md">
                        <span className="text-teal-400 font-bold">Tether Addr:</span>
                        <span>{walletClientService.truncateAddress(userWallet.address)}</span>
                        <button
                          type="button"
                          onClick={handleCopyAddress}
                          className="text-slate-400 hover:text-white transition ml-1"
                          title="Copy Tether address"
                        >
                          {copySuccess ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                      {copySuccess && (
                        <span className="text-xs font-semibold text-emerald-400 animate-fade-in">Copied to clipboard!</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(true)}
                  aria-label="View QR and receive"
                  className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-teal-300 hover:bg-white/10 transition-colors backdrop-blur-md"
                  title="Receive Tether USDT (Show QR)"
                >
                  <QrCode size={20} />
                </button>
              </div>

              <div className="relative z-10 mt-8">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">Portfolio Performance Trend</span>
                  <span className="text-teal-300 font-mono">Live On-Chain Value</span>
                </div>
                <div className="relative h-28 sm:h-32">
                <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 400 100">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d="M0,25 H400 M0,60 H400 M0,95 H400" stroke="white" strokeOpacity="0.08" strokeDasharray="4 7" />
                  <path d={trendAreaPath} fill="url(#chartGrad)" />
                  <path d={trendLinePath} fill="none" stroke="#67E8F9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200">
                      <Layers3 size={15} />
                    </span>
                    <span><strong className="text-white">3</strong> assets held · 24/7 liquidity</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <ArrowUp size={14} />
                    <span>Tether Settlement</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions (2x2 Grid) */}
            <div className="xl:col-span-4 grid grid-cols-2 gap-5">
              {filteredQuickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={`${action.id}-${action.label}`}
                    onClick={() => {
                      if (action.id === 'gogo_claim') setShowGogoModal(true);
                      else if (action.id === 'receive_tether') setShowReceiveModal(true);
                      else if (action.id === 'send_tether') setShowSendModal(true);
                      else if (action.id === 'payment_link') setShowPaymentLinkModal(true);
                      else onNavigate(action.id);
                    }}
                    className={`${action.bg} ${action.text} ${action.hover} rounded-[2rem] p-6 flex flex-col justify-between items-start group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/50`}
                  >
                    <div className={`w-12 h-12 rounded-2xl ${action.iconBg} flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                      <Icon size={22} strokeWidth={2.5} />
                    </div>
                    <div className="flex w-full items-end justify-between">
                      <span className="font-semibold tracking-tight text-[16px]">{action.label}</span>
                      <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Recent activity</h3>
                  <p className="mt-1 text-xs text-slate-500">Real-time ledger updates & settlements.</p>
                </div>
                <Activity size={19} className="text-blue-600" />
              </div>
              {activities.length ? <div className="space-y-3">
                {activities.slice(0, 5).map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3">
                  <div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.detail}</p><p className="mt-1 text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p></div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase text-emerald-800">{item.status}</span>
                </div>)}
              </div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Your on-chain transactions will appear here.</p>}
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-4 flex items-center justify-between">
                <div><h3 className="text-lg font-bold">Reminders</h3><p className="mt-1 text-xs text-slate-500">Personal alerts and savings targets.</p></div>
                <Bell size={19} className="text-blue-600" />
              </div>
              <form onSubmit={addReminder} className="mb-4 flex flex-col gap-2 sm:flex-row">
                <input placeholder="Add a reminder (e.g. Stokvel contribution)" aria-label="Reminder name" value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <input aria-label="Reminder date" type="date" min={new Date().toISOString().slice(0, 10)} value={reminderDate} onChange={(event) => setReminderDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Add</button>
              </form>
              {reminders.filter((item) => !item.completed).length ? <div className="space-y-2">
                {reminders.filter((item) => !item.completed).slice(0, 4).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                  <div><p className="text-sm font-semibold">{item.title}</p><p className="text-xs text-slate-500">Due {new Date(item.dueAt).toLocaleDateString()}</p></div>
                  <button onClick={() => activityService.completeReminder(item.id, storageUserId)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Done</button>
                </div>)}
              </div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No upcoming reminders.</p>}
              <p className="mt-3 text-[11px] text-slate-400">Manage savings schedules and round deadlines.</p>
            </div>
          </section>

          {/* ROW 2: YOUR ASSETS (Glass Cards) */}
          <section>
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">Your Assets</h3>
              <button onClick={() => onNavigate('wallet')} className="text-[14px] font-semibold text-blue-600 hover:text-blue-700">View Portfolio</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.symbol}
                  className={`${asset.bg} border ${asset.border} ${asset.text} rounded-[2rem] p-7 relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 blur-[40px] rounded-full pointer-events-none group-hover:bg-white/60 transition-colors" />

                  <div className="relative z-10 flex justify-between items-start mb-10">
                    <div className={`w-12 h-12 rounded-2xl ${asset.iconBg} shadow-sm flex items-center justify-center border border-white/70`}>
                        <asset.icon size={22} className={asset.iconColor} strokeWidth={2.2} />
                    </div>
                      <button onClick={() => onNavigate('trading')} aria-label={`View ${asset.name} in markets`} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50 hover:bg-white/80 transition-colors backdrop-blur-sm">
                      <ArrowUpRight size={16} />
                    </button>
                  </div>

                  <div className="relative z-10">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold opacity-75">{asset.name}</p>
                        <span className="whitespace-nowrap rounded-full border border-white/70 bg-white/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide opacity-75">{asset.type}</span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <h4 className="text-2xl font-bold tracking-tight">{asset.amount}</h4>
                        <span className="text-[14px] font-semibold opacity-60 uppercase">{asset.symbol.replace('t', '')}</span>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-[15px] font-medium opacity-80">{asset.usdValue}</span>
                      <span className={`text-[12px] font-bold px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-sm shadow-sm ${asset.isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {asset.change}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 border-t border-white/60 pt-3 text-xs font-medium opacity-70">
                      <Info size={14} />
                      <span>{asset.detail}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ROW 3: MARKET OVERVIEW & STOKVEL PROMO */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-7 2xl:col-span-8 bg-white rounded-[2.5rem] p-6 sm:p-8 lg:p-10 shadow-[0_12px_36px_rgba(15,23,42,0.06)] border border-slate-100">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">Real-Time Market Overview</h3>
                  <p className="mt-1 text-xs text-slate-500">Live prices streamed via Finnhub & open.er-api</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Market Feeds
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[12px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100">
                      <th className="pb-4 pl-2">Asset</th>
                      <th className="pb-4">Live Price</th>
                      <th className="pb-4">24h Change</th>
                      <th className="pb-4 hidden sm:table-cell">Asset Class</th>
                      <th className="pb-4 text-right pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50/80">
                    {filteredLiveTokens.slice(0, 5).map((token) => {
                      const isPos = (token.change24h || 0) >= 0;
                      const displayPrice =
                        token.type === 'currency'
                          ? `1 USD = ${token.fxRatePerUsd?.toLocaleString() || 1} ${token.unit}`
                          : `$${Number(token.price || 0).toFixed(2)}`;

                      return (
                        <tr key={token.symbol} className="hover:bg-slate-50/60 transition-colors group">
                          <td className="py-5 pl-2 flex items-center gap-4">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-[13px] shadow-sm ${
                                isPos
                                  ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white'
                                  : 'bg-gradient-to-br from-rose-400 to-orange-500 text-white'
                              }`}
                            >
                              {token.symbol.replace('t', '')}
                            </div>
                            <div>
                              <p className="font-bold text-[15px] text-slate-900">{token.name}</p>
                              <span className="font-mono text-xs text-slate-400 font-semibold">{token.symbol}</span>
                            </div>
                          </td>
                          <td className="py-5 font-semibold text-slate-900 font-mono text-[14px]">
                            {displayPrice}
                          </td>
                          <td className="py-5">
                            <span className={`inline-flex items-center gap-1 font-semibold text-[13px] ${isPos ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {isPos ? '+' : ''}{token.change24h?.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-5 hidden sm:table-cell">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 capitalize">
                              {token.type}
                            </span>
                          </td>
                          <td className="py-5 text-right pr-2">
                            <button
                              onClick={() => onNavigate('trading')}
                              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-teal-500 hover:text-teal-700 transition"
                            >
                              Trade
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stokvel promo card */}
            <div className="xl:col-span-5 2xl:col-span-4 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-[2.5rem] p-7 sm:p-10 text-white relative overflow-hidden flex flex-col justify-between shadow-xl">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold mb-4 border border-indigo-500/30">
                  <Sparkles size={14} />
                  <span>Pan-African Savings</span>
                </span>
                <h3 className="text-2xl font-extrabold tracking-tight mb-2">Automated Stokvel Pots</h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  Create rotational Chama/Stokvel group savings or invest collectively in fractional US equities using smart-contract rules on Tether.
                </p>
              </div>

              <div className="relative z-10 space-y-3 mt-6">
                <button onClick={() => onNavigate('stokvel')} className="w-full py-3.5 px-6 bg-white text-slate-900 hover:bg-slate-100 font-bold text-sm rounded-2xl transition shadow flex items-center justify-center gap-2">
                  <span>Start a Stokvel</span>
                  <ArrowUpRight size={16} />
                </button>
                <button onClick={() => onNavigate('split')} className="w-full py-3.5 px-6 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-2xl transition border border-white/10">
                  Split Bills with Friends
                </button>
              </div>
            </div>
          </section>

            </div>
          ) : currentView === 'split' ? (
            <SplitPaymentsView user={user} />
          ) : children}
        </main>
      </div>

      {/* MODAL: RECEIVE TETHER (USDT) WITH ACTIONABLE DYNAMIC QR CODE */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-fade-in">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-[2.5rem] bg-white p-7 shadow-2xl border border-slate-100 text-slate-900 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  <Download size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Receive Tether (USDT)</h3>
                  <p className="text-xs text-slate-500">Scan QR or share deposit address</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex flex-col items-center">
              {/* Dynamic QR Code */}
              <div className="rounded-3xl border-2 border-slate-100 bg-white p-4 shadow-xl shadow-slate-200/50">
                <QRCodeSVG
                  value={dynamicQrValue}
                  size={180}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Optional requested amount & note */}
              <div className="w-full mt-4 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Request Amount (USDT)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 50"
                    value={receiveAmount}
                    onChange={(e) => setReceiveAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Dinner share"
                    value={receiveNote}
                    onChange={(e) => setReceiveNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Full Address Display */}
              <div className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Your Tether Address</p>
                <p className="break-all font-mono text-xs font-semibold text-slate-900">
                  {userWallet?.address || 'Generating address...'}
                </p>
              </div>

              <div className="mt-4 flex w-full gap-2">
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-teal-700 py-3 text-xs font-bold text-white shadow hover:bg-teal-800 transition active:scale-[0.98]"
                >
                  {copySuccess ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copySuccess ? 'Copied!' : 'Copy Address'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SEND TETHER (USDT) TRANSFER WITH QR DECODER */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-fade-in">
          <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-[2.5rem] bg-white p-7 shadow-2xl border border-slate-100 text-slate-900 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Send size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Send Tether (USDT)</h3>
                  <p className="text-xs text-slate-500">Peer-to-peer instant blockchain transfer</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSendModal(false);
                  setSendReceipt(null);
                  setSendError('');
                  setQrPasteInput('');
                }}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {sendReceipt ? (
              <div className="mt-6 text-center py-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
                  <CheckCircle2 size={36} />
                </div>
                <h4 className="text-xl font-bold text-slate-900">Transfer Completed!</h4>
                <p className="mt-1 text-sm text-slate-600">
                  Successfully sent <strong>${sendReceipt.amountUsdt} USDT</strong> to {walletClientService.truncateAddress(sendReceipt.recipientAddress)}.
                </p>
                <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-3 text-left font-mono text-xs text-slate-700 space-y-1">
                  <p><span className="text-slate-400">Tx Hash:</span> <a href={`https://sepolia.etherscan.io/tx/${sendReceipt.txHash}`} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline break-all">{sendReceipt.txHash}</a></p>
                  <p><span className="text-slate-400">Network:</span> Tether (Sepolia EVM)</p>
                  <p><span className="text-slate-400">Timestamp:</span> {sendReceipt.timestamp}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSendModal(false);
                    setSendReceipt(null);
                  }}
                  className="mt-6 w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleExecuteTetherSend} className="mt-6 space-y-4">
                {/* Optional QR Code auto-fill bar */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Scan or Paste QR Code payload
                  </label>
                  <input
                    type="text"
                    value={qrPasteInput}
                    onChange={(e) => handleDecodeQrInput(e.target.value)}
                    placeholder="Paste ethereum:0x... or QR link"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Recipient Address, Phone, or Username
                  </label>
                  <input
                    type="text"
                    required
                    value={sendRecipient}
                    onChange={(e) => setSendRecipient(e.target.value)}
                    placeholder="0x... or +254 712... or @username"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Amount (USDT)
                    </label>
                    <span className="text-xs text-slate-500">
                      Available: <strong className="text-slate-900">${userWallet?.balanceUsdt?.toFixed(2) || '1,000.00'} USDT</strong>
                    </span>
                  </div>
                  <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-teal-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-500/10 transition">
                    <span className="pl-3 text-xl font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      required
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-2xl font-bold text-slate-950 outline-none"
                    />
                    <span className="mr-2 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm border border-slate-100">
                      USDT
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Network Gas Fee</span>
                    <span className="font-bold text-slate-900">0.20 USDT (Direct On-Chain)</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Settlement Speed</span>
                    <span className="font-bold text-emerald-600">~2.4 seconds</span>
                  </div>
                </div>

                {sendError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                    {sendError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('remittance')}
                    className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Send in Local FX (M-Pesa)
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingTether}
                    className="flex-1 rounded-2xl bg-teal-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-700/25 hover:bg-teal-800 disabled:opacity-50 transition active:scale-[0.98]"
                  >
                    {isSendingTether ? 'Signing & Sending…' : 'Sign & Send USDT'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: SHAREABLE PAYMENT LINK (WHATSAPP) */}
      {showPaymentLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-fade-in">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-[2.5rem] bg-white p-7 shadow-2xl border border-slate-100 text-slate-900 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-700">
                  <Share2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Create Payment Link</h3>
                  <p className="text-xs text-slate-500">Share via WhatsApp or direct URL</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentLinkModal(false);
                  setCreatedLink(null);
                }}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {createdLink ? (
              <div className="mt-5 text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Payment Link Ready</h4>
                <p className="text-xs text-slate-500">
                  Anyone with this link can approve and pay <strong>${createdLink.amountUsdt} USDT</strong> directly to your wallet.
                </p>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-2 text-xs font-mono">
                  <span className="truncate text-slate-700">{paymentShareUrl}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(paymentShareUrl);
                      setCopyLinkSuccess(true);
                      setTimeout(() => setCopyLinkSuccess(false), 2000);
                    }}
                    className="shrink-0 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                  >
                    {copyLinkSuccess ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="pt-2">
                  <a
                    href={whatsappPaymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow"
                  >
                    <MessageSquare size={16} />
                    <span>Share on WhatsApp</span>
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreatePaymentLink} className="mt-5 space-y-4 text-xs font-semibold text-slate-700">
                <div>
                  <label className="block mb-1">Requested Amount (USDT)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={linkAmount}
                    onChange={(e) => setLinkAmount(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-normal focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1">Description / Memo</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Flight ticket split or freelance invoice"
                    value={linkDescription}
                    onChange={(e) => setLinkDescription(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-normal focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isCreatingLink}
                    className="w-full py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow flex items-center justify-center gap-2"
                  >
                    {isCreatingLink ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                    <span>Generate Shareable Link</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: SEND TO ANYONE VIA WHATSAPP (GOGO FLOW - ZERO CRYPTO) */}
      {showGogoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-fade-in">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-[2.5rem] bg-white p-7 shadow-2xl border border-amber-100 text-slate-900 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 text-xs font-bold">
                  GOGO
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Send via WhatsApp (Gogo Flow)</h3>
                  <p className="text-xs text-slate-500">Recipient sees a Rand amount and zero crypto words</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGogoModal(false);
                  setGogoClaim(null);
                }}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {gogoClaim ? (
              <div className="mt-5 text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 font-bold text-xs">
                  LINK
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900">
                    Nomsa sent R{gogoClaim.amountZar} to {gogoClaim.recipientName}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Locked safely in Escrow Contract. Share via WhatsApp below:
                  </p>
                </div>

                {/* WhatsApp Message Preview */}
                <div className="p-4 bg-[#DCF8C6] border border-[#C5E1A5] rounded-2xl text-left text-xs text-emerald-950 leading-relaxed font-medium">
                  {gogoClaim.whatsappMessage}
                </div>

                {/* Live Status Container */}
                <div className="py-2">
                  {gogoClaim.status === 'waiting' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-amber-800">
                      <Loader2 size={14} className="animate-spin text-amber-600" />
                      <span>Waiting for {gogoClaim.recipientName} to claim (R{gogoClaim.amountZar} held)</span>
                    </div>
                  )}

                  {gogoClaim.status === 'claimed' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
                      <p className="text-xs font-black text-emerald-800">
                        CLAIMED BY {gogoClaim.recipientName.toUpperCase()}!
                      </p>
                      <p className="text-[11px] text-emerald-600">
                        R{gogoClaim.amountZar} released to her new custodial phone account
                      </p>
                      <p className="text-[10px] font-mono text-emerald-700">
                        Tx: {gogoClaim.claimedTxHash?.slice(0, 16)}...
                      </p>
                    </div>
                  )}

                  {gogoClaim.status === 'refunded' && (
                    <div className="p-3 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
                      Link Cancelled · Funds returned to your wallet
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(gogoClaim.whatsappMessage)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow"
                  >
                    <MessageSquare size={16} />
                    <span>Share on WhatsApp</span>
                  </a>

                  {gogoClaim.status === 'waiting' && (
                    <div className="flex gap-2">
                      <a
                        href={`#/claim/${gogoClaim.id}?code=${gogoClaim.secretCode}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-3 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <ExternalLink size={13} />
                        <span>Open Gogo Screen</span>
                      </a>

                      <button
                        type="button"
                        onClick={handleSimulateGogoClaim}
                        disabled={isSimulatingGogo}
                        className="flex-1 py-3 px-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        {isSimulatingGogo ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <span>Simulate Claim</span>
                        )}
                      </button>
                    </div>
                  )}

                  {gogoClaim.status === 'waiting' && (
                    <button
                      type="button"
                      onClick={handleRefundGogoClaim}
                      className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 font-semibold text-xs transition"
                    >
                      Return to me (Cancel Link)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateGogoClaim} className="mt-5 space-y-4 text-xs font-semibold text-slate-700">
                <div>
                  <label className="block mb-1">Recipient Name</label>
                  <input
                    type="text"
                    required
                    value={gogoName}
                    onChange={(e) => setGogoName(e.target.value)}
                    placeholder="e.g. Gogo"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-normal focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1">Recipient Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={gogoPhone}
                    onChange={(e) => setGogoPhone(e.target.value)}
                    placeholder="+27 82 555 0192"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-normal focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1">Amount to Send (South African Rand - ZAR)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R</span>
                    <input
                      type="number"
                      min="10"
                      step="any"
                      required
                      value={gogoZar}
                      onChange={(e) => setGogoZar(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-black text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-normal">
                    Locks ${(Number(gogoZar) / 20.0).toFixed(2)} USDT into Escrow Claim Contract (+ $0.20 network gas).
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isCreatingGogo}
                    className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow flex items-center justify-center gap-2 transition"
                  >
                    {isCreatingGogo ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                    <span>Lock in Escrow & Generate WhatsApp Link</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
