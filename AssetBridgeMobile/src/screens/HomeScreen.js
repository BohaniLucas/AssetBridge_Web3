import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  mobileWalletService,
  SUPPORTED_WALLET_CONFIG,
  isVerifiedUserWallet,
  isSafePersonalEvmAddress,
  buildReceiveQrPayload,
  parseAndValidateUsdtQr,
} from '../services/walletService';
import { remittanceService } from '../services/remittanceService';
import { mobileAuthService } from '../services/authService';
import { sessionLockService } from '../services/sessionLockService';

export default function HomeScreen({
  wallet,
  currentUser,
  onRefresh,
  onTransfer,
  onFaucet,
  onNavigate,
}) {
  // Modals state
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showQrChoiceModal, setShowQrChoiceModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraMountError, setCameraMountError] = useState('');
  const [cameraMountAttempt, setCameraMountAttempt] = useState(0);
  const [transactions, setTransactions] = useState([]);

  // Synchronous lock to prevent repeated camera callbacks from opening duplicate payment requests
  const scanLockRef = useRef(false);
  const [scannerError, setScannerError] = useState('');

  // Send USDT flow
  const [sendStep, setSendStep] = useState(1);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('50');
  const [note, setNote] = useState('');
  const [qrScanMeta, setQrScanMeta] = useState(null);
  const [feeQuote, setFeeQuote] = useState(null);
  const [feeQuoteError, setFeeQuoteError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Withdraw to local currency flow
  const [withdrawStep, setWithdrawStep] = useState(1);
  const [withdrawOptions, setWithdrawOptions] = useState(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [selectedCorridorCode, setSelectedCorridorCode] = useState('ZA-ZAR');
  const [selectedPayoutMethod, setSelectedPayoutMethod] = useState('za_payshap_proxy');
  const [withdrawAmountUsdt, setWithdrawAmountUsdt] = useState('50');
  const [withdrawQuote, setWithdrawQuote] = useState(null);
  const [withdrawQuoteRemainingSec, setWithdrawQuoteRemainingSec] = useState(0);
  const [stepUpPassword, setStepUpPassword] = useState('');
  const [isStepUpSubmitting, setIsStepUpSubmitting] = useState(false);
  const [stepUpVerifiedSec, setStepUpVerifiedSec] = useState(0);

  // Copy success indicator
  const [copied, setCopied] = useState(false);

  // Strict check: Never treat the Sepolia USDT token contract (0x7169...BA06) as a user's personal wallet!
  const effectiveUserId = currentUser?.id || wallet?.userId;
  const hasVerifiedUserWallet = isVerifiedUserWallet(wallet, effectiveUserId);
  const verifiedAddress = hasVerifiedUserWallet ? wallet.address.trim() : null;

  const usdtBalance =
    hasVerifiedUserWallet &&
    wallet?.balanceUsdt != null &&
    Number.isFinite(Number(wallet.balanceUsdt))
      ? Number(wallet.balanceUsdt)
      : null;

  useEffect(() => {
    let active = true;
    if (!hasVerifiedUserWallet || !effectiveUserId) {
      setTransactions([]);
      return () => {
        active = false;
      };
    }
    mobileWalletService
      .getTransactions(effectiveUserId)
      .then((items) => {
        if (active) setTransactions(items || []);
      })
      .catch(() => {
        if (active) setTransactions([]);
      });
    return () => {
      active = false;
    };
  }, [effectiveUserId, hasVerifiedUserWallet, wallet?.balanceUsdt]);

  // Countdown timer for Withdraw Quote expiry & Step-Up reauth window
  useEffect(() => {
    if (!showWithdrawModal) return undefined;
    const tick = () => {
      setStepUpVerifiedSec(sessionLockService.getStepUpRemainingSeconds());
      if (withdrawQuote?.expiresAt) {
        const rem = Math.max(
          0,
          Math.ceil((new Date(withdrawQuote.expiresAt).getTime() - Date.now()) / 1000)
        );
        setWithdrawQuoteRemainingSec(rem);
      } else {
        setWithdrawQuoteRemainingSec(0);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [showWithdrawModal, withdrawQuote]);

  const handleCopyAddress = async () => {
    if (!hasVerifiedUserWallet || !verifiedAddress) {
      Alert.alert(
        'Wallet setup required',
        'No verified user-controlled wallet address is linked to your account yet.'
      );
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    try {
      await Share.share({
        message: verifiedAddress,
        title: 'My Ethereum Sepolia USDT Wallet Address',
      });
    } catch {
      // User dismissed share sheet
    }
  };

  // --- QR FLOW: 1. Open Styled Choice ("Send USDT" or "Receive USDT") ---
  const openQrChoice = () => {
    sessionLockService.recordActivity();
    setShowQrChoiceModal(true);
  };

  const handleSelectQrReceive = () => {
    setShowQrChoiceModal(false);
    setShowReceiveModal(true);
  };

  const handleSelectQrSend = async () => {
    setShowQrChoiceModal(false);
    setScannerError('');
    setCameraMountError('');
    setCameraReady(false);
    scanLockRef.current = false;

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera access needed',
          'Allow camera access in your device settings to scan payment QR codes.'
        );
        return;
      }
    }
    setShowScanner(true);
  };

  const handleRetryCamera = () => {
    setCameraMountError('');
    setCameraReady(false);
    setCameraMountAttempt((attempt) => attempt + 1);
  };

  // --- QR FLOW: 2. Strict Barcode Scanner Callback with Duplicate-Scan Lock ---
  const handleBarcodeScanned = ({ data }) => {
    if (scanLockRef.current) {
      return;
    }
    scanLockRef.current = true;
    sessionLockService.recordActivity();

    const validation = parseAndValidateUsdtQr(data);
    if (!validation.valid) {
      setScannerError(validation.error || 'Invalid or unsupported QR code.');
      return;
    }

    // Validated Ethereum Sepolia USDT QR code -> close scanner & open Review screen
    // Never send immediately after scanning!
    setShowScanner(false);
    setScannerError('');
    setRecipient(validation.recipientAddress);
    setQrScanMeta(validation);
    if (validation.note) {
      setNote(validation.note);
    }

    if (validation.amountUsdt) {
      setAmount(validation.amountUsdt);
      setErrorMsg('');
      setSendStep(2);
      fetchLiveFeeForReview();
    } else {
      // Amount was not encoded in QR: prefill recipient on Step 1 so user enters amount before Step 2 Review
      setErrorMsg('');
      setSendStep(1);
    }
    setShowSendModal(true);
  };

  const handleResetScannerLock = () => {
    setScannerError('');
    scanLockRef.current = false;
  };

  const fetchLiveFeeForReview = async () => {
    setFeeQuote(null);
    setFeeQuoteError('');
    try {
      const q = await mobileWalletService.getFeeQuote();
      setFeeQuote(q);
    } catch {
      setFeeQuoteError(
        'Live network fee quote unavailable until on-device WDK signing is active.'
      );
    }
  };

  // --- SEND FLOW: Validate & Advance to Review ---
  const handleReviewSend = () => {
    sessionLockService.recordActivity();
    const cleanRecipient = recipient.trim();
    if (!cleanRecipient) {
      return setErrorMsg('Enter a verified 0x wallet address or @username.');
    }

    // Block sending to the Sepolia USDT token contract address itself or restricted addresses
    if (cleanRecipient.startsWith('0x') || cleanRecipient.startsWith('0X')) {
      if (
        cleanRecipient.toLowerCase() ===
        SUPPORTED_WALLET_CONFIG.tokenContractAddress.toLowerCase()
      ) {
        return setErrorMsg(
          'Invalid recipient: This is the Sepolia USDT token contract address (0x7169...BA06), not a user wallet.'
        );
      }
      if (!isSafePersonalEvmAddress(cleanRecipient)) {
        return setErrorMsg(
          'Enter a valid 40-hex-character Ethereum Sepolia wallet address (0x...).'
        );
      }
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return setErrorMsg('Enter an amount greater than zero.');
    }
    if (
      String(amount).includes('.') &&
      String(amount).split('.')[1].length > SUPPORTED_WALLET_CONFIG.tokenDecimals
    ) {
      return setErrorMsg(
        `USDT supports at most ${SUPPORTED_WALLET_CONFIG.tokenDecimals} decimal places.`
      );
    }

    setErrorMsg('');
    setSendStep(2);
    fetchLiveFeeForReview();
  };

  const handleExecuteSend = async () => {
    if (sessionLockService.hasIdleExpired()) {
      await sessionLockService.lock();
      return setErrorMsg('Session locked due to inactivity. Please unlock to continue.');
    }
    if (!onTransfer) {
      return setErrorMsg('Wallet signing is unavailable right now. No funds were debited.');
    }

    setIsSending(true);
    setErrorMsg('');
    try {
      await onTransfer({
        senderUserId: effectiveUserId,
        recipientAddressOrUsername: recipient.trim(),
        amountUsdt: Number(amount),
        note,
      });
      // Only reached if an official WDK integration + backend receipt verification succeeds
      setShowSendModal(false);
      setSendStep(1);
      setRecipient('');
      setNote('');
      setQrScanMeta(null);
      await onRefresh?.();
    } catch (error) {
      setErrorMsg(
        error.message ||
          'Wallet signing is unavailable until an Expo SDK 58-compatible WDK release is integrated. No funds were moved.'
      );
    } finally {
      setIsSending(false);
    }
  };

  // --- WITHDRAW TO LOCAL CURRENCY FLOW ---
  const openWithdrawModal = async () => {
    sessionLockService.recordActivity();
    setShowWithdrawModal(true);
    setWithdrawStep(1);
    setWithdrawQuote(null);
    setWithdrawError('');
    setStepUpPassword('');
    setWithdrawLoading(true);
    try {
      const opts = await remittanceService.getWithdrawOptions();
      setWithdrawOptions(opts);
      if (opts?.corridors?.length) {
        const defaultZa =
          opts.corridors.find((c) => c.corridorCode === 'ZA-ZAR') || opts.corridors[0];
        setSelectedCorridorCode(defaultZa.corridorCode);
        if (defaultZa.payoutMethods?.length) {
          setSelectedPayoutMethod(defaultZa.payoutMethods[0].id);
        }
      }
    } catch (err) {
      setWithdrawError(
        err.message || 'Unable to load withdrawal corridors from the backend.'
      );
    } finally {
      setWithdrawLoading(false);
    }
  };

  const activeWithdrawCorridor =
    withdrawOptions?.corridors?.find((c) => c.corridorCode === selectedCorridorCode) ||
    null;

  const activeWithdrawMethod =
    activeWithdrawCorridor?.payoutMethods?.find((m) => m.id === selectedPayoutMethod) ||
    activeWithdrawCorridor?.payoutMethods?.[0] ||
    null;

  const handleRequestWithdrawQuote = async () => {
    sessionLockService.recordActivity();
    setWithdrawError('');
    const num = Number(withdrawAmountUsdt);
    if (!Number.isFinite(num) || num <= 0) {
      return setWithdrawError('Enter a valid withdrawal amount greater than 0 USDT.');
    }
    const maxLimit = Number(withdrawOptions?.policy?.perTransactionLimitUsdt || 500);
    if (num > maxLimit) {
      return setWithdrawError(
        `Withdrawal amount exceeds the per-transaction limit of $${maxLimit.toFixed(2)} USDT.`
      );
    }
    if (!activeWithdrawCorridor?.ratePerUsd) {
      return setWithdrawError(
        `Live FX reference rate for ${selectedCorridorCode} is currently unavailable.`
      );
    }

    setWithdrawLoading(true);
    try {
      const quote = await remittanceService.createWithdrawQuote({
        corridorCode: selectedCorridorCode,
        payoutMethod: selectedPayoutMethod,
        sendAmount: withdrawAmountUsdt.trim(),
      });
      setWithdrawQuote(quote);
      setWithdrawStep(2);
    } catch (err) {
      setWithdrawError(err.message || 'Could not generate withdrawal quote.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleStepUpReauthenticate = async () => {
    if (!stepUpPassword) {
      return setWithdrawError('Enter your account password for step-up verification.');
    }
    setIsStepUpSubmitting(true);
    setWithdrawError('');
    try {
      await mobileAuthService.reauthenticate(stepUpPassword);
      sessionLockService.recordStepUpReauth();
      setStepUpPassword('');
      setStepUpVerifiedSec(sessionLockService.getStepUpRemainingSeconds());
    } catch (err) {
      setWithdrawError(err.message || 'Step-up password verification failed.');
    } finally {
      setIsStepUpSubmitting(false);
    }
  };

  const handleExecuteWithdrawal = async () => {
    setWithdrawError('');
    if (!sessionLockService.hasRecentStepUpReauth()) {
      return setWithdrawError(
        'Recent step-up password verification is required before approving a withdrawal.'
      );
    }
    if (withdrawQuoteRemainingSec <= 0) {
      return setWithdrawError('This withdrawal quote has expired. Please request a fresh quote.');
    }
    setWithdrawLoading(true);
    try {
      await remittanceService.executeWithdrawal({
        quoteId: withdrawQuote?.id,
        destinationId: null,
      });
    } catch (err) {
      setWithdrawError(
        err.message ||
          'Withdrawal submission is disabled pending outbound payout provider onboarding. No funds were debited.'
      );
    } finally {
      setWithdrawLoading(false);
    }
  };

  const formatCountdown = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. PREMIUM PORTFOLIO CARD */}
      <View style={styles.portfolioCard}>
        <View style={styles.decorCircleTop} />
        <View style={styles.decorCircleBottom} />

        <View style={styles.portfolioHeader}>
          <Text style={styles.portfolioLabel}>TOTAL BALANCE</Text>
          <View style={styles.sepoliaBadge}>
            <View style={styles.sepoliaDot} />
            <Text style={styles.sepoliaText}>SEPOLIA · 11155111</Text>
          </View>
        </View>

        <View style={styles.balanceContainer}>
          <Text style={styles.balanceCurrency}>$</Text>
          <Text style={styles.balanceAmount}>
            {usdtBalance == null
              ? '—'
              : usdtBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </Text>
        </View>

        <View style={styles.profitRow}>
          <Ionicons
            name={hasVerifiedUserWallet ? 'shield-checkmark-outline' : 'alert-circle-outline'}
            size={15}
            color={hasVerifiedUserWallet ? '#34D399' : '#FBBF24'}
          />
          <Text style={styles.profitTimeframe}>
            {hasVerifiedUserWallet
              ? 'Verified on-chain balance'
              : 'Wallet setup required — No personal WDK wallet linked'}
          </Text>
        </View>

        <View style={styles.addressBar}>
          <Text
            style={[
              styles.addressValue,
              !hasVerifiedUserWallet && { color: '#FDE68A', fontFamily: undefined },
            ]}
            numberOfLines={1}
          >
            {hasVerifiedUserWallet
              ? `${verifiedAddress.slice(0, 10)}...${verifiedAddress.slice(-6)}`
              : 'Wallet setup required (QR Receive disabled)'}
          </Text>
          <TouchableOpacity
            style={[styles.copyBtn, !hasVerifiedUserWallet && { opacity: 0.45 }]}
            onPress={handleCopyAddress}
            disabled={!hasVerifiedUserWallet}
          >
            <Ionicons
              name={
                !hasVerifiedUserWallet
                  ? 'lock-closed-outline'
                  : copied
                  ? 'checkmark'
                  : 'copy-outline'
              }
              size={16}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. FLOATING QUICK ACTIONS */}
      <View style={[styles.actionGrid, styles.shadowSm]}>
        {[
          { label: 'Deposit', icon: 'add', color: '#3B82F6', action: onFaucet },
          {
            label: 'Send',
            icon: 'paper-plane',
            color: '#10B981',
            action: () => {
              setQrScanMeta(null);
              setErrorMsg('');
              setSendStep(1);
              setShowSendModal(true);
            },
          },
          {
            label: 'Withdraw',
            icon: 'cash',
            color: '#F59E0B',
            action: openWithdrawModal,
          },
          {
            label: 'Qr Scan',
            icon: 'qr-code',
            color: '#6366F1',
            action: openQrChoice,
          },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.actionBtn}
            onPress={item.action}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: `${item.color}15` }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <Text style={styles.actionBtnText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ===================================================================== */}
      {/* MODAL A: QR SCAN STYLED CHOICE ("Send USDT" or "Receive USDT")        */}
      {/* ===================================================================== */}
      <Modal
        visible={showQrChoiceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQrChoiceModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sendSheet}>
            <View style={styles.sendHeader}>
              <Text style={styles.sendTitle}>QR Payments</Text>
              <TouchableOpacity onPress={() => setShowQrChoiceModal(false)}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>
            <Text style={styles.reviewCopy}>
              Choose whether to scan a recipient’s Ethereum Sepolia USDT QR code or display your own verified receive details.
            </Text>

            <TouchableOpacity
              style={styles.qrChoiceCard}
              onPress={handleSelectQrSend}
              activeOpacity={0.8}
            >
              <View style={[styles.qrChoiceIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="scan-outline" size={24} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.qrChoiceTitle}>Send USDT</Text>
                <Text style={styles.qrChoiceSub}>
                  Scan a recipient QR code and review network, token, and amount before approval
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.qrChoiceCard}
              onPress={handleSelectQrReceive}
              activeOpacity={0.8}
            >
              <View style={[styles.qrChoiceIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="qr-code-outline" size={24} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.qrChoiceTitle}>Receive USDT</Text>
                <Text style={styles.qrChoiceSub}>
                  {hasVerifiedUserWallet
                    ? 'Show your verified Ethereum Sepolia USDT address and payment request'
                    : 'Wallet setup required — Personal wallet not yet linked'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL B: RECEIVE USDT (Guards against token contract masquerade)      */}
      {/* ===================================================================== */}
      <Modal
        visible={showReceiveModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReceiveModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sendSheet}>
            <View style={styles.sendHeader}>
              <Text style={styles.sendTitle}>Receive USDT</Text>
              <TouchableOpacity onPress={() => setShowReceiveModal(false)}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>

            <View style={styles.infoGridCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Supported Network</Text>
                <Text style={styles.infoVal}>{SUPPORTED_WALLET_CONFIG.networkLabel}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Supported Token</Text>
                <Text style={styles.infoVal}>
                  {SUPPORTED_WALLET_CONFIG.tokenSymbol} ({SUPPORTED_WALLET_CONFIG.tokenDecimals} decimals)
                </Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoKey}>ERC-20 Token Contract</Text>
                <Text style={styles.infoValMono}>
                  {SUPPORTED_WALLET_CONFIG.tokenContractAddress.slice(0, 10)}...
                  {SUPPORTED_WALLET_CONFIG.tokenContractAddress.slice(-6)}
                </Text>
              </View>
            </View>

            {!hasVerifiedUserWallet ? (
              <View style={styles.setupRequiredBox}>
                <View style={styles.setupRequiredHeader}>
                  <Ionicons name="warning" size={20} color="#B45309" />
                  <Text style={styles.setupRequiredTitle}>Wallet setup required</Text>
                </View>
                <Text style={styles.setupRequiredText}>
                  No verified user-controlled wallet address is linked to your account yet. QR receiving is disabled until an official Expo SDK 58-compatible WDK wallet is created on your device.
                </Text>
                <Text style={[styles.setupRequiredText, { marginTop: 8, fontWeight: '700' }]}>
                  Security Guard: The Sepolia USDT token contract ({SUPPORTED_WALLET_CONFIG.tokenContractAddress.slice(0, 10)}...{SUPPORTED_WALLET_CONFIG.tokenContractAddress.slice(-6)}) is never displayed or encoded as a personal receive address.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.qrPreviewPlaceholder}>
                  <Ionicons name="qr-code-outline" size={46} color="#0F172A" />
                  <Text style={styles.qrPlaceholderTitle}>
                    Verified EIP-681 Receive Payload Ready
                  </Text>
                  <Text style={styles.qrPlaceholderSub}>
                    {buildReceiveQrPayload(wallet, effectiveUserId)}
                  </Text>
                  <Text style={styles.qrPackageNotice}>
                    On-device SVG QR matrix rendering awaits package approval for react-native-svg@15.16.0 and react-native-qrcode-svg@6.3.21. Wallet addresses are never sent to external QR image servers.
                  </Text>
                </View>

                <Text style={styles.sendLabel}>Your Verified Wallet Address</Text>
                <View style={styles.fullAddressBox}>
                  <Text style={styles.fullAddressText} selectable>
                    {verifiedAddress}
                  </Text>
                </View>

                <View style={styles.warningBanner}>
                  <Ionicons name="alert-circle-outline" size={18} color="#92400E" />
                  <Text style={styles.warningBannerText}>
                    Verify the sender selects {SUPPORTED_WALLET_CONFIG.networkLabel} and Sepolia USDT before sending. Showing this screen does not credit your balance; activity updates only after on-chain confirmation.
                  </Text>
                </View>

                <TouchableOpacity style={styles.sendPrimaryBtn} onPress={handleCopyAddress}>
                  <Text style={styles.sendPrimaryText}>
                    {copied ? 'Address Shared / Copied' : 'Copy / Share Verified Address'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.sendBackBtn}
              onPress={() => setShowReceiveModal(false)}
            >
              <Text style={styles.sendBackText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL C: SEND USDT (Manual Entry + QR Scan Pre-filled Review)         */}
      {/* ===================================================================== */}
      <Modal
        visible={showSendModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSendModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={{ maxHeight: '90%' }}
            contentContainerStyle={styles.sendSheet}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sendHeader}>
              <Text style={styles.sendTitle}>
                {sendStep === 1 ? 'Send USDT' : 'Review USDT Transfer'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSendModal(false);
                  setSendStep(1);
                  setErrorMsg('');
                  setQrScanMeta(null);
                }}
              >
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>

            {qrScanMeta && (
              <View style={styles.qrVerifiedPill}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.qrVerifiedPillText}>
                  Scanned & validated {qrScanMeta.networkName} ({qrScanMeta.tokenSymbol}) QR request
                </Text>
              </View>
            )}

            {sendStep === 1 ? (
              <>
                <Text style={styles.sendLabel}>Recipient wallet address (0x...) or @username</Text>
                <TextInput
                  style={styles.sendInput}
                  value={recipient}
                  onChangeText={(val) => {
                    setRecipient(val);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="0x... or @username"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.sendLabel}>Amount (USDT)</Text>
                <TextInput
                  style={styles.sendInput}
                  value={amount}
                  onChangeText={(val) => {
                    setAmount(val);
                    if (errorMsg) setErrorMsg('');
                  }}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.sendLabel}>Note (optional)</Text>
                <TextInput
                  style={styles.sendInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="What is this for?"
                />
                {errorMsg ? <Text style={styles.sendError}>{errorMsg}</Text> : null}
                <TouchableOpacity style={styles.sendPrimaryBtn} onPress={handleReviewSend}>
                  <Text style={styles.sendPrimaryText}>Review transfer</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.infoGridCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Recipient</Text>
                    <Text style={styles.infoValMono} numberOfLines={1}>
                      {recipient.trim()}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Amount</Text>
                    <Text style={[styles.infoVal, { color: '#059669', fontWeight: '800' }]}>
                      ${Number(amount || 0).toFixed(2)} {SUPPORTED_WALLET_CONFIG.tokenSymbol}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Asset & Contract</Text>
                    <Text style={styles.infoVal}>
                      {SUPPORTED_WALLET_CONFIG.tokenSymbol} (
                      {SUPPORTED_WALLET_CONFIG.tokenContractAddress.slice(0, 8)}...
                      {SUPPORTED_WALLET_CONFIG.tokenContractAddress.slice(-4)})
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Network</Text>
                    <Text style={styles.infoVal}>{SUPPORTED_WALLET_CONFIG.networkLabel}</Text>
                  </View>
                  <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoKey}>Estimated Network Fee</Text>
                    <Text style={styles.infoVal}>
                      {feeQuote?.feeEth
                        ? `${feeQuote.feeEth} ETH (~$${feeQuote.feeUsdt} USDT)`
                        : feeQuoteError || 'Unavailable (WDK signing required)'}
                    </Text>
                  </View>
                </View>

                <View style={styles.warningBanner}>
                  <Ionicons name="shield-half-outline" size={18} color="#92400E" />
                  <Text style={styles.warningBannerText}>
                    Verify the recipient address and {SUPPORTED_WALLET_CONFIG.networkName} network before approving. Scanning and reviewing does not move funds. Your balance changes only after a real network receipt is confirmed.
                  </Text>
                </View>

                {errorMsg ? <Text style={styles.sendError}>{errorMsg}</Text> : null}

                <TouchableOpacity
                  style={styles.sendPrimaryBtn}
                  onPress={handleExecuteSend}
                  disabled={isSending}
                >
                  {isSending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.sendPrimaryText}>Approve & Send (Requires WDK Signing)</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sendBackBtn}
                  onPress={() => {
                    setSendStep(1);
                    setErrorMsg('');
                  }}
                >
                  <Text style={styles.sendBackText}>Back to Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendBackBtn, { paddingTop: 4 }]}
                  onPress={() => {
                    setShowSendModal(false);
                    setSendStep(1);
                    setErrorMsg('');
                    setQrScanMeta(null);
                  }}
                >
                  <Text style={[styles.sendBackText, { color: '#DC2626' }]}>Cancel Transfer</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL D: CAMERA QR SCANNER (With Duplicate-Callback Lock & Validator) */}
      {/* ===================================================================== */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={styles.scannerScreen}>
          {showScanner && (
            <CameraView
              key={cameraMountAttempt}
              style={[StyleSheet.absoluteFillObject, styles.cameraPreview]}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onCameraReady={() => {
                setCameraReady(true);
                setCameraMountError('');
              }}
              onMountError={(event) => {
                setCameraReady(false);
                setCameraMountError(
                  event?.message || 'The camera could not start. Check camera permission and try again.'
                );
              }}
              onBarcodeScanned={scanLockRef.current ? undefined : handleBarcodeScanned}
            />
          )}
          <View style={styles.scannerHeader}>
            <TouchableOpacity
              style={styles.scannerClose}
              onPress={() => {
                setShowScanner(false);
                setScannerError('');
                scanLockRef.current = false;
              }}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scan Sepolia USDT QR</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.scanFrameWrap} pointerEvents="none">
            <View
              style={[
                styles.scanFrame,
                scannerError ? { borderColor: '#EF4444' } : { borderColor: '#00E676' },
              ]}
            />
          </View>

          {scannerError ? (
            <View style={styles.scannerErrorCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="close-circle" size={20} color="#DC2626" />
                <Text style={styles.scannerErrorTitle}>QR Code Rejected</Text>
              </View>
              <Text style={styles.scannerErrorBody}>{scannerError}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.sendPrimaryBtn, { flex: 1, marginTop: 0, paddingVertical: 12 }]}
                  onPress={handleResetScannerLock}
                >
                  <Text style={styles.sendPrimaryText}>Scan Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sendPrimaryBtn,
                    {
                      flex: 1,
                      marginTop: 0,
                      paddingVertical: 12,
                      backgroundColor: '#FEE2E2',
                    },
                  ]}
                  onPress={() => {
                    setShowScanner(false);
                    setScannerError('');
                    scanLockRef.current = false;
                  }}
                >
                  <Text style={[styles.sendPrimaryText, { color: '#991B1B' }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.scannerHint}>
              Align an Ethereum Sepolia (Chain ID 11155111) USDT QR code within the frame. You will review all details before approving.
            </Text>
          )}
          {!cameraMountError && !cameraReady ? (
            <View style={styles.cameraStatusOverlay} pointerEvents="none">
              <ActivityIndicator color="#00E676" size="small" />
              <Text style={styles.cameraStatusText}>Starting camera…</Text>
            </View>
          ) : null}
          {cameraMountError ? (
            <View style={styles.cameraMountErrorCard}>
              <Ionicons name="camera-outline" size={24} color="#DC2626" />
              <Text style={styles.scannerErrorTitle}>Camera preview unavailable</Text>
              <Text style={styles.scannerErrorBody}>{cameraMountError}</Text>
              <TouchableOpacity
                style={[styles.sendPrimaryBtn, { marginTop: 12 }]}
                onPress={handleRetryCamera}
              >
                <Text style={styles.sendPrimaryText}>Try camera again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL E: WITHDRAW TO LOCAL CURRENCY (Truthful Audit & Step-Up Auth)   */}
      {/* ===================================================================== */}
      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={{ maxHeight: '92%' }}
            contentContainerStyle={styles.sendSheet}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sendHeader}>
              <Text style={styles.sendTitle}>
                {withdrawStep === 1 ? 'Withdraw to Local Currency' : 'Review Withdrawal & Step-Up'}
              </Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>

            {/* Outbound Provider Audit Status Banner */}
            <View style={styles.setupRequiredBox}>
              <View style={styles.setupRequiredHeader}>
                <Ionicons name="shield-outline" size={18} color="#B45309" />
                <Text style={styles.setupRequiredTitle}>
                  Outbound Payout Provider Audit: Disabled
                </Text>
              </View>
              <Text style={styles.setupRequiredText}>
                {withdrawOptions?.providerAudit?.auditSummary ||
                  'No licensed South African PayShap / bank disbursement outbound API is integrated yet. You can inspect live reference FX quotes and security requirements below, but withdrawal submission is disabled and no funds will be debited.'}
              </Text>
            </View>

            {withdrawLoading && !withdrawOptions ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0F172A" />
                <Text style={[styles.reviewCopy, { marginTop: 12 }]}>
                  Loading backend corridor availability & FX reference rates…
                </Text>
              </View>
            ) : withdrawStep === 1 ? (
              <>
                <Text style={styles.sendLabel}>1. Source Asset & Network</Text>
                <View style={styles.infoGridCard}>
                  <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoKey}>Token / Network</Text>
                    <Text style={styles.infoVal}>
                      {SUPPORTED_WALLET_CONFIG.tokenSymbol} · {SUPPORTED_WALLET_CONFIG.networkLabel}
                    </Text>
                  </View>
                </View>

                <Text style={styles.sendLabel}>2. Local Currency Corridor</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 14 }}
                >
                  {(withdrawOptions?.corridors || []).map((c) => {
                    const selected = c.corridorCode === selectedCorridorCode;
                    return (
                      <TouchableOpacity
                        key={c.corridorCode}
                        style={[
                          styles.corridorChip,
                          selected && styles.corridorChipSelected,
                        ]}
                        onPress={() => {
                          setSelectedCorridorCode(c.corridorCode);
                          if (c.payoutMethods?.length) {
                            setSelectedPayoutMethod(c.payoutMethods[0].id);
                          }
                          setWithdrawError('');
                        }}
                      >
                        <Text style={styles.corridorChipTitle}>
                          {c.country} ({c.currency})
                        </Text>
                        <Text style={styles.corridorChipRate}>
                          {c.ratePerUsd
                            ? `Ref: 1 USD = ${Number(c.ratePerUsd).toFixed(2)} ${c.currency}`
                            : 'Rate unavailable'}
                        </Text>
                        <Text style={styles.corridorChipStatus}>
                          {c.isExecutable ? 'Executable' : 'Partner Onboarding Req.'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={styles.sendLabel}>3. Payout Rail</Text>
                {(activeWithdrawCorridor?.payoutMethods || []).map((m) => {
                  const selected = m.id === selectedPayoutMethod;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.methodCard,
                        selected && styles.methodCardSelected,
                      ]}
                      onPress={() => setSelectedPayoutMethod(m.id)}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.methodTitle}>{m.label}</Text>
                        <Text style={styles.methodBadge}>{m.statusLabel}</Text>
                      </View>
                      <Text style={styles.methodDisclosure}>{m.regulatoryDisclosure}</Text>
                    </TouchableOpacity>
                  );
                })}

                <Text style={styles.sendLabel}>4. Verified Personal Destination</Text>
                <View style={styles.destinationPolicyCard}>
                  <Text style={styles.destinationPolicyTitle}>
                    No Verified Bank / PayShap Destination Linked
                  </Text>
                  <Text style={styles.destinationPolicyBody}>
                    Withdrawals pay out exclusively to the signed-in user’s own verified bank account or registered South African PayShap ShapID (+27 with a participating SA bank). Arbitrary client-entered phone numbers cannot become verified withdrawal destinations.
                  </Text>
                  <Text style={[styles.destinationPolicyBody, { marginTop: 6, fontWeight: '700' }]}>
                    Security Policy: Max ${withdrawOptions?.policy?.perTransactionLimitUsdt || '500.00'} USDT/tx · 24-hour cooling-off hold on newly verified destinations.
                  </Text>
                </View>

                <Text style={styles.sendLabel}>
                  5. Withdrawal Amount (USDT · Max ${withdrawOptions?.policy?.perTransactionLimitUsdt || '500.00'})
                </Text>
                <TextInput
                  style={styles.sendInput}
                  value={withdrawAmountUsdt}
                  onChangeText={(val) => {
                    setWithdrawAmountUsdt(val);
                    if (withdrawError) setWithdrawError('');
                  }}
                  keyboardType="decimal-pad"
                  placeholder="50.00"
                />

                {withdrawError ? <Text style={styles.sendError}>{withdrawError}</Text> : null}

                <TouchableOpacity
                  style={styles.sendPrimaryBtn}
                  onPress={handleRequestWithdrawQuote}
                  disabled={withdrawLoading}
                >
                  {withdrawLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.sendPrimaryText}>
                      Preview Official Reference Quote & Step-Up
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* STEP 2: Full Pre-Approval Breakdown + Step-Up Reauthentication */}
                <View style={styles.infoGridCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Source Asset & Network</Text>
                    <Text style={styles.infoVal}>
                      {withdrawQuote?.sourceToken} · {withdrawQuote?.sourceNetwork}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Withdrawal Amount</Text>
                    <Text style={styles.infoVal}>
                      ${withdrawQuote?.sendAmountFormatted} USDT
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Payout & Network Fee</Text>
                    <Text style={styles.infoVal}>
                      ${withdrawQuote?.totalFeeFormatted} USDT
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Reference FX Rate</Text>
                    <Text style={styles.infoVal}>
                      1 USD = {withdrawQuote?.exchangeRate} {withdrawQuote?.receiveCurrency} (
                      {withdrawQuote?.rateType})
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Quote Expiry</Text>
                    <Text
                      style={[
                        styles.infoVal,
                        { color: withdrawQuoteRemainingSec > 0 ? '#059669' : '#DC2626' },
                      ]}
                    >
                      {withdrawQuoteRemainingSec > 0
                        ? `Locks for ${formatCountdown(withdrawQuoteRemainingSec)}`
                        : 'EXPIRED'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Exact Local Payout</Text>
                    <Text style={[styles.infoVal, { color: '#059669', fontWeight: '800' }]}>
                      {withdrawQuote?.receiveCurrencySymbol}
                      {withdrawQuote?.receiveAmountFormatted} {withdrawQuote?.receiveCurrency}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Verified Destination</Text>
                    <Text style={[styles.infoVal, { color: '#B45309' }]}>
                      None linked (Provider verification required)
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Provider</Text>
                    <Text style={styles.infoVal}>
                      {withdrawQuote?.providerAudit?.providerName || withdrawQuote?.providerName}
                    </Text>
                  </View>
                  <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoKey}>Estimated Timing</Text>
                    <Text style={styles.infoVal}>{withdrawQuote?.estimatedTiming}</Text>
                  </View>
                </View>

                {/* Step-Up Security Verification Box */}
                <View style={styles.stepUpCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Ionicons
                      name={stepUpVerifiedSec > 0 ? 'lock-open' : 'lock-closed'}
                      size={18}
                      color={stepUpVerifiedSec > 0 ? '#059669' : '#0F172A'}
                    />
                    <Text style={styles.stepUpTitle}>
                      Step-Up Security Reauthentication
                    </Text>
                  </View>
                  {stepUpVerifiedSec > 0 ? (
                    <Text style={[styles.stepUpSub, { color: '#059669', fontWeight: '700' }]}>
                      Recent password reauthentication verified ({stepUpVerifiedSec}s remaining).
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.stepUpSub}>
                        Withdrawals require recent password reauthentication ({currentUser?.email || 'signed-in account'}) before approval.
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <TextInput
                          style={[styles.sendInput, { flex: 1, marginBottom: 0, paddingVertical: 10 }]}
                          value={stepUpPassword}
                          onChangeText={setStepUpPassword}
                          placeholder="Confirm account password"
                          secureTextEntry
                          autoCapitalize="none"
                        />
                        <TouchableOpacity
                          style={[
                            styles.sendPrimaryBtn,
                            { marginTop: 0, paddingHorizontal: 16, paddingVertical: 10 },
                          ]}
                          onPress={handleStepUpReauthenticate}
                          disabled={isStepUpSubmitting}
                        >
                          {isStepUpSubmitting ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Text style={styles.sendPrimaryText}>Verify</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>

                {/* Risk Warnings */}
                <View style={styles.warningBanner}>
                  <Ionicons name="warning-outline" size={18} color="#92400E" />
                  <View style={{ flex: 1 }}>
                    {(withdrawQuote?.riskWarnings || []).map((w, idx) => (
                      <Text key={idx} style={styles.warningBannerText}>
                        • {w}
                      </Text>
                    ))}
                  </View>
                </View>

                {withdrawError ? <Text style={styles.sendError}>{withdrawError}</Text> : null}

                {/* Disabled Submission Button when no provider is onboarded */}
                <TouchableOpacity
                  style={[
                    styles.sendPrimaryBtn,
                    !withdrawQuote?.isExecutable && { backgroundColor: '#94A3B8' },
                  ]}
                  onPress={handleExecuteWithdrawal}
                  disabled={!withdrawQuote?.isExecutable || withdrawLoading}
                >
                  <Text style={styles.sendPrimaryText}>
                    {withdrawQuote?.isExecutable
                      ? 'Approve & Submit Withdrawal'
                      : 'Withdrawal Disabled — Provider Onboarding Required'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.disabledReasonFootnote}>
                  {withdrawQuote?.submissionDisabledReason}
                </Text>

                <TouchableOpacity
                  style={styles.sendBackBtn}
                  onPress={() => {
                    setWithdrawStep(1);
                    setWithdrawError('');
                  }}
                >
                  <Text style={styles.sendBackText}>Back to Corridor & Amount</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* 3. ASSETS LIST */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Portfolio Assets</Text>
          <TouchableOpacity onPress={() => onNavigate('markets')}>
            <Text style={styles.sectionLink}>View Markets ⟶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.assetListContainer}>
          <View style={styles.assetRow}>
            <View style={[styles.assetRowIcon, { backgroundColor: '#ECFDF5' }]}>
              <Text style={{ fontSize: 20, color: '#059669', fontWeight: '800' }}>$</Text>
            </View>
            <View style={styles.assetRowInfo}>
              <Text style={styles.assetRowName}>Tether USD (Sepolia)</Text>
              <Text style={styles.assetRowSub}>
                USDT · Chain ID {SUPPORTED_WALLET_CONFIG.chainId}
              </Text>
            </View>
            <View style={styles.assetRowValues}>
              <Text style={styles.assetRowAmount}>
                {usdtBalance == null ? 'Wallet Setup Req.' : `$${usdtBalance.toFixed(2)}`}
              </Text>
              <Text style={styles.assetRowChange}>ERC-20 Testnet</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 4. TRANSACTIONS */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.transactionContainer}>
          {transactions.map((transaction, index) => {
            const sent =
              transaction.type === 'p2p_transfer' || transaction.type === 'transfer';
            const from =
              transaction.senderUserId === effectiveUserId
                ? 'You'
                : transaction.senderUserId || 'External';
            const to = sent
              ? transaction.recipientAddress || 'Recipient'
              : verifiedAddress || 'You';
            const dateValue = transaction.timestamp || transaction.createdAt;
            const isLast = index === transactions.length - 1;

            return (
              <View
                key={transaction.id || transaction.txHash}
                style={[styles.transactionItem, isLast && { borderBottomWidth: 0 }]}
              >
                <View
                  style={[
                    styles.txIconBox,
                    sent ? { backgroundColor: '#FEF2F2' } : { backgroundColor: '#ECFDF5' },
                  ]}
                >
                  <Ionicons
                    name={sent ? 'arrow-up' : 'arrow-down'}
                    size={16}
                    color={sent ? '#DC2626' : '#059669'}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>
                    {sent
                      ? `Sent to ${String(to).slice(0, 8)}`
                      : `Received from ${String(from).slice(0, 8)}`}
                  </Text>
                  <Text style={styles.txDate}>
                    {dateValue ? new Date(dateValue).toLocaleDateString() : 'Pending'} •{' '}
                    {transaction.status}
                  </Text>
                </View>
              </View>
            );
          })}
          {!transactions.length && (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
              <Text style={styles.emptyTransactions}>
                {hasVerifiedUserWallet
                  ? 'No confirmed on-chain transactions.'
                  : 'Connect a user-controlled wallet to view confirmed on-chain activity.'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /* --- GLOBALS & LAYOUT --- */
  container: { flex: 1, backgroundColor: '#F1F4F8' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  shadowSm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },

  /* --- 1. PREMIUM PORTFOLIO CARD --- */
  portfolioCard: {
    backgroundColor: '#0B132B',
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0B132B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  decorCircleTop: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#3B82F6',
    opacity: 0.15,
  },
  decorCircleBottom: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#10B981',
    opacity: 0.1,
  },
  portfolioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  portfolioLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.5 },
  sepoliaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  sepoliaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },
  sepoliaText: { fontSize: 10, fontWeight: '800', color: '#34D399', letterSpacing: 0.5 },

  balanceContainer: { flexDirection: 'row', alignItems: 'flex-start' },
  balanceCurrency: {
    fontSize: 24,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 4,
    marginRight: 4,
  },
  balanceAmount: { fontSize: 44, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1.5 },

  profitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  profitTimeframe: { fontSize: 13, fontWeight: '500', color: '#94A3B8' },

  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addressValue: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#E2E8F0',
    fontWeight: '500',
    flex: 1,
  },
  copyBtn: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 8, borderRadius: 10 },

  /* --- 2. FLOATING QUICK ACTIONS --- */
  actionGrid: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 8,
    marginTop: 20,
    marginBottom: 20,
    marginHorizontal: 10,
    justifyContent: 'space-between',
  },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 8 },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { color: '#334155', fontSize: 12, fontWeight: '700' },

  /* --- MODALS & SHEETS --- */
  scannerScreen: {
    flex: 1,
    backgroundColor: '#0A0F1C',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 60,
    position: 'relative',
  },
  cameraPreview: { backgroundColor: '#0A0F1C', zIndex: 0 },
  cameraStatusOverlay: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 10,
    zIndex: 3,
  },
  cameraStatusText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  cameraMountErrorCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '40%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    zIndex: 4,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  sendSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  sendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sendTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  sendLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 6 },
  sendInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#0F172A',
    marginBottom: 14,
  },
  sendPrimaryBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 10,
  },
  sendPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  sendError: { color: '#DC2626', fontSize: 13, marginTop: 8, fontWeight: '600' },
  reviewCopy: { color: '#64748B', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  sendBackBtn: { alignItems: 'center', padding: 12 },
  sendBackText: { color: '#334155', fontSize: 14, fontWeight: '700' },

  /* --- QR CHOICE & RECEIVE --- */
  qrChoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  qrChoiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrChoiceTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 3 },
  qrChoiceSub: { fontSize: 12, color: '#64748B', lineHeight: 17 },

  infoGridCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  infoKey: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  infoVal: { fontSize: 13, fontWeight: '700', color: '#0F172A', flexShrink: 1, textAlign: 'right' },
  infoValMono: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
    textAlign: 'right',
  },

  setupRequiredBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  setupRequiredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  setupRequiredTitle: { fontSize: 14, fontWeight: '800', color: '#92400E' },
  setupRequiredText: { fontSize: 12, color: '#78350F', lineHeight: 18 },

  qrPreviewPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  qrPlaceholderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
    marginBottom: 4,
  },
  qrPlaceholderSub: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 8,
  },
  qrPackageNotice: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  fullAddressBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  fullAddressText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#0F172A',
    textAlign: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  warningBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  qrVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 12,
  },
  qrVerifiedPillText: { fontSize: 12, fontWeight: '700', color: '#065F46', flex: 1 },

  /* --- SCANNER --- */
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  scannerClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  scanFrameWrap: { alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 250,
    height: 250,
    borderColor: '#00E676',
    borderWidth: 3,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  scannerHint: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 32,
    lineHeight: 20,
  },
  scannerErrorCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 18,
  },
  scannerErrorTitle: { fontSize: 16, fontWeight: '800', color: '#DC2626' },
  scannerErrorBody: { fontSize: 13, color: '#334155', lineHeight: 19 },

  /* --- WITHDRAW STYLES --- */
  corridorChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    minWidth: 165,
  },
  corridorChipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  corridorChipTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  corridorChipRate: { fontSize: 11, color: '#334155', marginTop: 2 },
  corridorChipStatus: { fontSize: 10, fontWeight: '700', color: '#B45309', marginTop: 4 },

  methodCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  methodCardSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  methodTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  methodBadge: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  methodDisclosure: { fontSize: 11, color: '#475569', marginTop: 4, lineHeight: 16 },

  destinationPolicyCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  destinationPolicyTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  destinationPolicyBody: { fontSize: 12, color: '#475569', lineHeight: 17 },

  stepUpCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  stepUpTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  stepUpSub: { fontSize: 12, color: '#475569', lineHeight: 17 },
  disabledReasonFootnote: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },

  /* --- 3. SECTIONS & ASSETS LIST --- */
  section: { marginTop: 32 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  sectionLink: { fontSize: 14, fontWeight: '700', color: '#3B82F6' },

  assetListContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    ...Platform.select({
      ios: {
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
    }),
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  assetRowIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  assetRowInfo: { flex: 1 },
  assetRowName: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  assetRowSub: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  assetRowValues: { alignItems: 'flex-end' },
  assetRowAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'right',
  },
  assetRowChange: { fontSize: 12, fontWeight: '600', color: '#64748B', textAlign: 'right' },

  /* --- 4. TRANSACTIONS --- */
  refreshBtn: { backgroundColor: '#F1F5F9', padding: 8, borderRadius: 10 },
  transactionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    ...Platform.select({
      ios: {
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
    }),
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  txDate: { fontSize: 12, color: '#64748B', fontWeight: '500', textTransform: 'capitalize' },
  emptyState: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTransactions: { color: '#94A3B8', fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
