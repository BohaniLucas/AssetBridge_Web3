import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Linking,
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
import {
  createPaymentRequestId,
  listPaymentJournal,
  saveOfflinePaymentDraft,
  listOfflinePaymentDrafts,
  deleteOfflinePaymentDraft,
  getPaymentStatusPresentation,
} from '../services/wdkPaymentService';
import {
  WDK_FEE_ASSET_LABEL,
  OFFLINE_SIGNING_DISABLED_REASON,
  TESTNET_FUNDS_NOTICE,
} from '../config/wdkConstants';

export default function HomeScreen({
  wallet,
  currentUser,
  isOffline = false,
  onRefresh,
  onTransfer,
  onFeeQuote,
  onFaucet,
  onNavigate,
}) {
  // Modals state
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showQrChoiceModal, setShowQrChoiceModal] = useState(false);
  const [showPayMethodsModal, setShowPayMethodsModal] = useState(false);
  const [showNfcScanner, setShowNfcScanner] = useState(false);
  const [isNfcScanning, setIsNfcScanning] = useState(false);
  const [nfcStatus, setNfcStatus] = useState('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraMountError, setCameraMountError] = useState('');
  const [cameraMountAttempt, setCameraMountAttempt] = useState(0);
  const [transactions, setTransactions] = useState([]);

  // Synchronous lock to prevent repeated camera callbacks from opening duplicate payment requests
  const scanLockRef = useRef(false);
  const nfcScanLockRef = useRef(false);
  const nfcCancelRef = useRef(false);
  const nfcRequestAttemptedRef = useRef(false);
  const nfcManagerRef = useRef(null);
  const [isScanLocked, setIsScanLocked] = useState(false);
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
  const [paymentRequestId, setPaymentRequestId] = useState('');
  const [paymentResult, setPaymentResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [paymentJournal, setPaymentJournal] = useState([]);
  const [offlineDrafts, setOfflineDrafts] = useState([]);
  const [checkingRequestId, setCheckingRequestId] = useState('');

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

  // Bank Deposit converted to USDT flow
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositStep, setDepositStep] = useState(1); // 1 = select corridor & amount, 2 = review bank deposit details & conversion, 3 = confirmed receipt
  const [depositCorridorCode, setDepositCorridorCode] = useState('ZA-ZAR');
  const [depositAmountFiat, setDepositAmountFiat] = useState('1000');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [depositOptions, setDepositOptions] = useState(null);
  const [depositReference, setDepositReference] = useState('');
  const [depositReceipt, setDepositReceipt] = useState(null);

  // Copy success indicator
  const [copied, setCopied] = useState(false);

  // Strict check: Never treat the Sepolia USDT token contract (0x7169...BA06) as a user's personal wallet!
  const effectiveUserId = currentUser?.id || wallet?.userId;
  const walletScopeKey = wallet?.walletId || effectiveUserId || 'default';
  const hasVerifiedUserWallet = isVerifiedUserWallet(wallet, effectiveUserId);
  const verifiedAddress = hasVerifiedUserWallet ? wallet.address.trim() : null;

  const usdtBalance =
    hasVerifiedUserWallet &&
    wallet?.balanceUsdt != null &&
    Number.isFinite(Number(wallet.balanceUsdt))
      ? Number(wallet.balanceUsdt)
      : null;

  const ethBalanceFormatted = wallet?.balanceEth || null;
  const lastUpdatedLabel = wallet?.lastUpdatedAt
    ? new Date(wallet.lastUpdatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  const visibleTransactions = hasVerifiedUserWallet && effectiveUserId ? transactions : [];

  const reloadLocalJournalAndDrafts = useCallback(async () => {
    const [journalItems, draftItems] = await Promise.all([
      listPaymentJournal(walletScopeKey),
      listOfflinePaymentDrafts(walletScopeKey),
    ]);
    setPaymentJournal(journalItems || []);
    setOfflineDrafts(draftItems || []);
  }, [walletScopeKey]);

  useEffect(() => {
    let active = true;
    Promise.all([
      listPaymentJournal(walletScopeKey),
      listOfflinePaymentDrafts(walletScopeKey),
    ]).then(([journalItems, draftItems]) => {
      if (active) {
        setPaymentJournal(journalItems || []);
        setOfflineDrafts(draftItems || []);
      }
    });
    return () => {
      active = false;
    };
  }, [walletScopeKey, wallet?.balanceUsdt, isOffline]);

  useEffect(() => {
    if (!hasVerifiedUserWallet || !effectiveUserId) {
      return undefined;
    }
    let active = true;
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

  const openPayMethods = () => {
    sessionLockService.recordActivity();
    setShowPayMethodsModal(true);
  };

  // Watchdog timer so the scanner never remains stuck on an endless "Starting camera…" or silent black preview
  useEffect(() => {
    if (!showScanner || !cameraPermission?.granted || cameraReady || cameraMountError) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setCameraMountError(
        'Camera preview timed out while starting. Ensure no other app is using the camera, then tap "Remount Camera".'
      );
    }, 8000);
    return () => clearTimeout(timer);
  }, [showScanner, cameraPermission?.granted, cameraReady, cameraMountError, cameraMountAttempt]);

  const handleCloseScanner = () => {
    setShowScanner(false);
    setCameraReady(false);
    setTorchEnabled(false);
    setCameraMountError('');
    setScannerError('');
    scanLockRef.current = false;
    setIsScanLocked(false);
  };

  const handleSelectQrSend = async () => {
    setShowPayMethodsModal(false);
    setShowQrChoiceModal(false);
    setScannerError('');
    setCameraMountError('');
    setCameraReady(false);
    scanLockRef.current = false;
    setIsScanLocked(false);
    setShowScanner(true);

    if (!cameraPermission?.granted && cameraPermission?.canAskAgain !== false) {
      try {
        await requestCameraPermission();
      } catch (err) {
        setCameraMountError(
          err?.message || 'Unable to request camera permission from the operating system.'
        );
      }
    }
  };

  const handleRequestPermissionAgain = async () => {
    setCameraMountError('');
    setCameraReady(false);
    try {
      await requestCameraPermission();
    } catch (err) {
      setCameraMountError(
        err?.message || 'Unable to request camera permission from the operating system.'
      );
    }
  };

  const handleOpenDeviceSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        'Open Device Settings',
        'Open your device Settings > Apps > Expo Go (or InterLink) > Permissions > Camera and select Allow.'
      );
    }
  };

  const handleRetryCamera = () => {
    setScannerError('');
    setCameraMountError('');
    setCameraReady(false);
    scanLockRef.current = false;
    setIsScanLocked(false);
    setCameraMountAttempt((attempt) => attempt + 1);
  };

  const openValidatedPaymentRequest = (validation, sourceLabel) => {
    if (!validation.valid) {
      setScannerError(validation.error || 'Invalid or unsupported QR code.');
      return false;
    }

    setShowScanner(false);
    setCameraReady(false);
    setCameraMountError('');
    setScannerError('');
    setRecipient(validation.recipientAddress);
    setQrScanMeta({ ...validation, sourceLabel });
    setPaymentRequestId(validation.amountUsdt ? createPaymentRequestId() : '');
    setPaymentResult(null);
    if (validation.note) {
      setNote(validation.note);
    }

    if (validation.amountUsdt) {
      setAmount(validation.amountUsdt);
      setErrorMsg('');
      setSendStep(2);
      fetchLiveFeeForReview(validation.recipientAddress, validation.amountUsdt);
    } else {
      setErrorMsg('');
      setSendStep(1);
    }
    setShowSendModal(true);
    return true;
  };

  // --- QR FLOW: 2. Strict Barcode Scanner Callback with Duplicate-Scan Lock ---
  const handleBarcodeScanned = (scanningResult) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setIsScanLocked(true);
    sessionLockService.recordActivity();
    const validation = parseAndValidateUsdtQr(scanningResult);
    openValidatedPaymentRequest(validation, 'QR');
  };

  const handleResetScannerLock = () => {
    setScannerError('');
    scanLockRef.current = false;
    setIsScanLocked(false);
  };

  const fetchLiveFeeForReview = async (recipientAddress = recipient, amountText = amount) => {
    setFeeQuote(null);
    setFeeQuoteError('');
    if (isOffline) {
      setFeeQuoteError(
        'Offline mode: Live Sepolia network fee quotes require an internet connection. You can save this payment as an unsigned draft ("Draft — not sent") and review the fee when back online.'
      );
      return;
    }
    try {
      const q = await onFeeQuote?.(String(recipientAddress).trim(), String(amountText).trim());
      if (!q) throw new Error('WDK fee quote is unavailable.');
      setFeeQuote(q);
    } catch (error) {
      setFeeQuoteError(
        error?.message || 'Could not get a live Sepolia fee quote. No funds were moved.'
      );
    }
  };

  const cancelNfcScan = async () => {
    nfcCancelRef.current = true;
    const nfcManager = nfcManagerRef.current;
    if (nfcRequestAttemptedRef.current && nfcManager) {
      try { await nfcManager.cancelTechnologyRequest(); } catch { /* Scanner may already have closed. */ }
      nfcRequestAttemptedRef.current = false;
    }
    setShowNfcScanner(false);
    setIsNfcScanning(false);
  };

  const startNfcPaymentScan = async () => {
    setShowPayMethodsModal(false);
    if (nfcScanLockRef.current) return;
    nfcScanLockRef.current = true;
    nfcCancelRef.current = false;
    nfcRequestAttemptedRef.current = false;
    setNfcStatus('Checking NFC support…');
    setShowNfcScanner(true);
    setIsNfcScanning(true);
    let nfcManager;
    try {
      // Load lazily so Expo Go can still run the rest of the app. This module
      // intentionally throws at import time when its native bridge is absent.
      const nfcModule = await import('react-native-nfc-manager');
      nfcManager = nfcModule.default;
      const { Ndef, NfcTech } = nfcModule;
      nfcManagerRef.current = nfcManager;
      const supported = await nfcManager.isSupported(NfcTech.Ndef);
      if (!supported) throw new Error('This device does not support NFC NDEF tag reading. Use QR scan or enter the address.');
      if (Platform.OS === 'android' && !(await nfcManager.isEnabled())) {
        throw new Error('Turn on NFC in Android Settings, then try again. No payment was made.');
      }
      await nfcManager.start();
      if (nfcCancelRef.current) return;
      setNfcStatus('Hold the back of your phone near the merchant’s NFC payment tag.');
      nfcRequestAttemptedRef.current = true;
      await nfcManager.requestTechnology(NfcTech.Ndef);
      if (nfcCancelRef.current) return;
      const tag = await nfcManager.getTag();
      const records = tag?.ndefMessage || [];
      let paymentPayload = '';
      for (const record of records) {
        if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) {
          paymentPayload = Ndef.uri.decodePayload(Uint8Array.from(record.payload || []));
          break;
        }
        if (Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) {
          const textPayload = Ndef.text.decodePayload(Uint8Array.from(record.payload || [])).trim();
          if (/^(ethereum:|assetbridge:\/\/|0x)/i.test(textPayload)) {
            paymentPayload = textPayload;
            break;
          }
        }
      }
      if (!paymentPayload) throw new Error('This NFC tag does not contain a supported AssetBridge or Sepolia USDT payment request.');
      const validation = parseAndValidateUsdtQr(paymentPayload);
      if (!validation.valid) throw new Error(validation.error || 'NFC payment request was rejected.');
      setShowNfcScanner(false);
      setIsNfcScanning(false);
      openValidatedPaymentRequest(validation, 'NFC');
    } catch (error) {
      if (!nfcCancelRef.current) {
        setShowNfcScanner(false);
        const nativeBuildRequired = /native module is unavailable|Expo Go cannot load/i.test(error?.message || '');
        const message = nativeBuildRequired
          ? 'NFC needs the custom EAS development build. Expo Go does not include its native NFC module. Install the NFC-enabled development build, then scan again.'
          : error?.message || 'NFC scan failed.';
        Alert.alert('NFC payment request not accepted', `${message}\n\nNo payment was made. You can scan a QR code or enter the address.`);
      }
    } finally {
      if (nfcRequestAttemptedRef.current) {
        try { await nfcManager.cancelTechnologyRequest(); } catch { /* Session may already have ended. */ }
      }
      nfcRequestAttemptedRef.current = false;
      nfcScanLockRef.current = false;
      setIsNfcScanning(false);
      setNfcStatus('');
      setShowNfcScanner(false);
      nfcManagerRef.current = null;
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
    setPaymentRequestId(createPaymentRequestId());
    setPaymentResult(null);
    setSendStep(2);
    fetchLiveFeeForReview();
  };

  const handleExecuteSend = async () => {
    if (sessionLockService.hasIdleExpired()) {
      await sessionLockService.lock();
      return setErrorMsg('Session locked due to inactivity. Please unlock to continue.');
    }
    if (isOffline) {
      return setErrorMsg(
        'Offline mode: Cannot broadcast a transaction without network connectivity. Tap "Save as Offline Draft" below to prepare this intent safely.'
      );
    }
    if (!onTransfer) {
      return setErrorMsg('Wallet signing is unavailable right now. No funds were debited.');
    }

    const reqId = paymentRequestId || createPaymentRequestId();
    if (!paymentRequestId) {
      setPaymentRequestId(reqId);
    }

    const isCheckingExisting =
      paymentResult?.status === 'pending' ||
      paymentResult?.status === 'submitted' ||
      paymentResult?.status === 'outcome-unknown';

    if (!isCheckingExisting && !feeQuote?.feeBaseUnits) {
      return setErrorMsg(
        'A verified live Sepolia network fee quote is required before approving this transfer. Tap "Refresh Fee Quote" or save as an offline draft.'
      );
    }

    setIsSending(true);
    setErrorMsg('');
    try {
      const result = await onTransfer({
        senderUserId: effectiveUserId,
        recipientAddressOrUsername: recipient.trim(),
        amountUsdt: String(amount).trim(),
        note,
        requestId: reqId,
        reviewedFeeQuote: feeQuote,
        skipPreSendRecheck: isCheckingExisting,
        expiresAt: qrScanMeta?.expiresAt || null,
      });
      setPaymentResult(result);
      await reloadLocalJournalAndDrafts();

      if (activeDraftId && (result?.status === 'submitted' || result?.status === 'pending' || result?.status === 'successful')) {
        await deleteOfflinePaymentDraft(activeDraftId, walletScopeKey);
        setActiveDraftId(null);
        await reloadLocalJournalAndDrafts();
      }

      if (result?.status === 'pending' || result?.status === 'submitted') {
        setErrorMsg(
          'Submitted to Sepolia bundler — awaiting block confirmation. Use "Check status" to reconcile this same request.'
        );
        return;
      }
      if (result?.status === 'outcome-unknown') {
        setErrorMsg(
          result.error ||
            'Outcome unknown — do not retry. Check your wallet balance and activity before creating a new transfer.'
        );
        return;
      }
      if (result?.status !== 'successful') {
        throw new Error(
          result?.error ||
            'The network did not confirm this payment. Check status before creating another request.'
        );
      }
      await onRefresh?.();
      return;
    } catch (error) {
      if (error?.freshFeeQuote) {
        setFeeQuote(error.freshFeeQuote);
      }
      setErrorMsg(
        error.message ||
          'Payment was not confirmed. Use Check status before attempting another payment.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveOfflineDraft = async () => {
    sessionLockService.recordActivity();
    setErrorMsg('');
    try {
      const draft = await saveOfflinePaymentDraft({
        scopeKey: walletScopeKey,
        to: recipient.trim(),
        amountUsdt: String(amount).trim(),
        note: note.trim(),
        sourceLabel: qrScanMeta?.sourceLabel ? `${qrScanMeta.sourceLabel} (Offline draft)` : 'Offline draft',
        expiresAt: qrScanMeta?.expiresAt || null,
      });
      await reloadLocalJournalAndDrafts();
      setShowSendModal(false);
      setSendStep(1);
      setQrScanMeta(null);
      Alert.alert(
        'Saved as "Draft — not sent"',
        `Draft ${draft.draftId} saved locally for $${draft.amountUsdt} USDT to ${draft.recipient.slice(0, 10)}...${draft.recipient.slice(-6)}.\n\nImportant: No blockchain transaction has been signed or broadcast, and the recipient has NOT been paid. When you reconnect, tap "Review & Send" on the draft to fetch a live Sepolia fee quote and submit.`
      );
    } catch (err) {
      setErrorMsg(err.message || 'Could not save offline payment draft.');
    }
  };

  const handleOpenDraftForReview = (draft) => {
    sessionLockService.recordActivity();
    if (draft.status === 'expired') {
      Alert.alert(
        'Draft Expired',
        'This payment request has passed its expiry time and cannot be submitted. Delete the expired draft and ask the recipient for a fresh request.'
      );
      return;
    }
    setActiveDraftId(draft.draftId);
    setRecipient(draft.recipient);
    setAmount(draft.amountUsdt);
    setNote(draft.note || '');
    setQrScanMeta({
      valid: true,
      recipientAddress: draft.recipient,
      amountUsdt: draft.amountUsdt,
      networkName: draft.networkName,
      tokenSymbol: draft.tokenSymbol,
      expiresAt: draft.expiresAt,
      sourceLabel: draft.sourceLabel || 'Saved Draft',
    });
    setPaymentRequestId(createPaymentRequestId());
    setPaymentResult(null);
    setErrorMsg('');
    setSendStep(2);
    setShowSendModal(true);
    fetchLiveFeeForReview(draft.recipient, draft.amountUsdt);
  };

  const handleCheckJournalRecordStatus = async (record) => {
    if (!record?.requestId || !onTransfer) return;
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'Checking live Sepolia bundler and block receipt status requires an internet connection. Reconnect and tap "Check status" again.'
      );
      return;
    }
    setCheckingRequestId(record.requestId);
    try {
      await onTransfer({
        senderUserId: effectiveUserId,
        recipientAddressOrUsername: record.recipient,
        amountUsdt: record.amountUsdt,
        note: record.note || '',
        requestId: record.requestId,
        skipPreSendRecheck: true,
      });
      await reloadLocalJournalAndDrafts();
      await onRefresh?.();
    } catch (err) {
      Alert.alert('Status Check Notice', err.message || 'Unable to check status right now.');
    } finally {
      setCheckingRequestId('');
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
    if (isOffline) {
      setWithdrawError(
        'Offline Mode: Local-currency withdrawals require live backend FX quotes, verified destination checks, and licensed payout provider connectivity. Reconnect to inspect live reference quotes.'
      );
      return;
    }
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

  const handleRequestWithdrawQuote = async () => {
    sessionLockService.recordActivity();
    setWithdrawError('');
    if (isOffline) {
      return setWithdrawError(
        'Offline Mode: Cannot generate or lock a live FX withdrawal quote while offline.'
      );
    }
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
    if (isOffline) {
      return setWithdrawError(
        'Offline Mode: Withdrawals to local currency cannot be submitted while offline.'
      );
    }
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

  // --- BANK DEPOSIT CONVERTED TO USDT FLOW ---
  const openDepositModal = async () => {
    sessionLockService.recordActivity();
    setShowDepositModal(true);
    setDepositStep(1);
    setDepositError('');
    setDepositReceipt(null);
    setDepositAmountFiat('1000');
    setDepositReference(`DEP-ZA-${Math.floor(10000 + Math.random() * 90000)}`);
    setDepositLoading(true);
    try {
      const opts = await remittanceService.getWithdrawOptions();
      setDepositOptions(opts);
      if (opts?.corridors?.length) {
        const za = opts.corridors.find((c) => c.corridorCode === 'ZA-ZAR') || opts.corridors[0];
        setDepositCorridorCode(za.corridorCode);
      }
    } catch {
      // Fallback
    } finally {
      setDepositLoading(false);
    }
  };

  const activeDepositCorridor =
    depositOptions?.corridors?.find((c) => c.corridorCode === depositCorridorCode) || {
      corridorCode: 'ZA-ZAR',
      country: 'South Africa',
      currency: 'ZAR',
      symbol: 'R',
      ratePerUsd: 18.35,
    };

  const depositRate = Number(activeDepositCorridor?.ratePerUsd) || 18.35;
  const depositUsdtEstimate =
    Number(depositAmountFiat) > 0 ? (Number(depositAmountFiat) / depositRate).toFixed(2) : '0.00';

  const handleReviewDeposit = () => {
    sessionLockService.recordActivity();
    setDepositError('');
    const num = Number(depositAmountFiat);
    if (!Number.isFinite(num) || num <= 0) {
      return setDepositError(`Enter a valid deposit amount in ${activeDepositCorridor.currency}.`);
    }
    setDepositStep(2);
  };

  const handleConfirmDeposit = async () => {
    sessionLockService.recordActivity();
    setDepositLoading(true);
    try {
      const usdtCredited = Number(depositUsdtEstimate);
      const nowIso = new Date().toISOString();
      const receipt = {
        reference: depositReference,
        fiatAmount: Number(depositAmountFiat),
        fiatCurrency: activeDepositCorridor.currency,
        exchangeRate: depositRate,
        usdtCredited,
        timestamp: nowIso,
        status: 'CONFIRMED',
      };
      setDepositReceipt(receipt);

      // Add to recent activity
      setTransactions((prev) => [
        {
          id: `dep_${Date.now()}`,
          title: `Bank Deposit (${receipt.fiatCurrency}) → USDT`,
          amount: `+$${usdtCredited.toFixed(2)} USDT`,
          date: 'Just now',
          type: 'deposit',
          status: 'Confirmed',
          note: `Ref: ${receipt.reference} · ${receipt.fiatCurrency} ${receipt.fiatAmount} @ R${depositRate.toFixed(2)}`,
        },
        ...prev,
      ]);

      setDepositStep(3);
    } catch (err) {
      setDepositError(err.message || 'Deposit confirmation failed.');
    } finally {
      setDepositLoading(false);
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
          <Text style={styles.portfolioLabel}>
            {isOffline || wallet?.isCachedBalance
              ? 'CACHED TESTNET BALANCE'
              : 'TOTAL TESTNET BALANCE'}
          </Text>
          <View
            style={[
              styles.sepoliaBadge,
              (isOffline || wallet?.isCachedBalance) && {
                backgroundColor: 'rgba(245, 158, 11, 0.25)',
              },
            ]}
          >
            <View
              style={[
                styles.sepoliaDot,
                (isOffline || wallet?.isCachedBalance) && { backgroundColor: '#FBBF24' },
              ]}
            />
            <Text
              style={[
                styles.sepoliaText,
                (isOffline || wallet?.isCachedBalance) && { color: '#FDE68A' },
              ]}
            >
              {isOffline ? 'OFFLINE · CACHED' : 'SEPOLIA TESTNET · 11155111'}
            </Text>
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
            name={
              !hasVerifiedUserWallet
                ? 'alert-circle-outline'
                : isOffline || wallet?.isCachedBalance
                ? 'time-outline'
                : 'shield-checkmark-outline'
            }
            size={15}
            color={
              !hasVerifiedUserWallet || isOffline || wallet?.isCachedBalance
                ? '#FBBF24'
                : '#34D399'
            }
          />
          <Text style={styles.profitTimeframe}>
            {!hasVerifiedUserWallet
              ? 'Wallet setup required — No personal WDK wallet linked'
              : isOffline || wallet?.isCachedBalance
              ? `Cached balance (not verified live)${
                  lastUpdatedLabel ? ` · Last updated ${lastUpdatedLabel}` : ''
                }`
              : `Live on-chain Sepolia test balance${
                  lastUpdatedLabel ? ` · Updated ${lastUpdatedLabel}` : ''
                }`}
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
          { label: 'Deposit', icon: 'add', color: '#3B82F6', action: openDepositModal },
          {
            label: 'Pay',
            icon: 'card',
            color: '#10B981',
            action: openPayMethods,
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
      {/* MODAL A: PAY METHODS (MANUAL, QR OR NFC REQUEST)                     */}
      {/* ===================================================================== */}
      <Modal
        visible={showPayMethodsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPayMethodsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sendSheet}>
            <View style={styles.sendHeader}>
              <Text style={styles.sendTitle}>Pay someone</Text>
              <TouchableOpacity onPress={() => setShowPayMethodsModal(false)} accessibilityLabel="Close pay options">
                <Ionicons name="close" size={23} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.reviewCopy}>Choose how to get the recipient’s Sepolia USDT payment details. You will review and approve the transfer before anything is sent.</Text>
            <TouchableOpacity style={styles.qrChoiceCard} onPress={() => { setShowPayMethodsModal(false); setQrScanMeta(null); setErrorMsg(''); setSendStep(1); setShowSendModal(true); }}>
              <View style={[styles.qrChoiceIcon, { backgroundColor: '#ECFDF5' }]}><Ionicons name="create-outline" size={24} color="#059669" /></View>
              <View style={{ flex: 1 }}><Text style={styles.qrChoiceTitle}>Enter wallet details</Text><Text style={styles.qrChoiceSub}>Type a Sepolia wallet address and amount.</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.qrChoiceCard} onPress={handleSelectQrSend}>
              <View style={[styles.qrChoiceIcon, { backgroundColor: '#EEF2FF' }]}><Ionicons name="qr-code-outline" size={24} color="#6366F1" /></View>
              <View style={{ flex: 1 }}><Text style={styles.qrChoiceTitle}>Scan QR code</Text><Text style={styles.qrChoiceSub}>Read a Sepolia USDT request with your camera.</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.qrChoiceCard} onPress={startNfcPaymentScan}>
              <View style={[styles.qrChoiceIcon, { backgroundColor: '#EFF6FF' }]}><Ionicons name="radio-outline" size={24} color="#2563EB" /></View>
              <View style={{ flex: 1 }}><Text style={styles.qrChoiceTitle}>Tap an NFC payment tag</Text><Text style={styles.qrChoiceSub}>Read the merchant’s NFC request, then review the USDT transfer.</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
            <Text style={styles.reviewCopy}>NFC and QR only carry payment details. They do not move money or replace your approval.</Text>
          </View>
        </View>
      </Modal>

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
              <View style={[styles.qrChoiceIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="lock-closed-outline" size={24} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.qrChoiceTitle}>Receive USDT (Disabled)</Text>
                <Text style={styles.qrChoiceSub}>
                  {hasVerifiedUserWallet
                    ? 'QR rendering disabled — Awaiting package approval for local SVG QR renderer'
                    : 'QR receiving disabled — Wallet setup required & local QR renderer pending approval'}
                </Text>
              </View>
              <Ionicons name="information-circle-outline" size={20} color="#D97706" />
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
                  <Text style={styles.setupRequiredTitle}>
                    QR Receiving Disabled — Wallet Setup Required
                  </Text>
                </View>
                <Text style={styles.setupRequiredText}>
                  1. No verified user-controlled wallet address is linked to your account yet (requires an Expo SDK 58-compatible WDK release).
                </Text>
                <Text style={[styles.setupRequiredText, { marginTop: 6 }]}>
                  2. Local on-device QR rendering also awaits approval to install react-native-svg@15.16.0 and react-native-qrcode-svg@6.3.21. Wallet addresses are never sent to external QR image services.
                </Text>
                <Text style={[styles.setupRequiredText, { marginTop: 8, fontWeight: '700' }]}>
                  Security Guard: The Sepolia USDT token contract ({SUPPORTED_WALLET_CONFIG.tokenContractAddress.slice(0, 10)}...{SUPPORTED_WALLET_CONFIG.tokenContractAddress.slice(-6)}) is never displayed or encoded as a personal receive address.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.setupRequiredBox}>
                  <View style={styles.setupRequiredHeader}>
                    <Ionicons name="lock-closed" size={18} color="#B45309" />
                    <Text style={styles.setupRequiredTitle}>
                      Receive QR Disabled — Awaiting Local QR Renderer Approval
                    </Text>
                  </View>
                  <Text style={styles.setupRequiredText}>
                    Local QR matrix rendering requires installing react-native-svg@15.16.0 and react-native-qrcode-svg@6.3.21, which are not currently in package.json. For privacy and security, wallet addresses are never sent to remote QR image services.
                  </Text>
                  <Text style={[styles.qrPlaceholderSub, { marginTop: 8, marginBottom: 0 }]}>
                    Validated EIP-681 URI: {buildReceiveQrPayload(wallet, effectiveUserId)}
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
                  {qrScanMeta.sourceLabel || 'Scanned'} & validated {qrScanMeta.networkName} ({qrScanMeta.tokenSymbol}) payment request
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
                  { errorMsg ? <Text style={styles.sendError}>{errorMsg}</Text> : null }
                <TouchableOpacity style={styles.sendPrimaryBtn} onPress={handleReviewSend}>
                  <Text style={styles.sendPrimaryText}>
                    {isOffline ? 'Review Offline Draft' : 'Review transfer'}
                  </Text>
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
                    <Text style={styles.infoKey}>Token & Contract</Text>
                    <Text style={styles.infoVal}>
                      {SUPPORTED_WALLET_CONFIG.tokenSymbol} (
                      {SUPPORTED_WALLET_CONFIG.tokenContractAddress.slice(0, 8)}...
                      {SUPPORTED_WALLET_CONFIG.tokenContractAddress.slice(-4)})
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Chain / Network</Text>
                    <Text style={styles.infoVal}>{SUPPORTED_WALLET_CONFIG.networkLabel}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Fee Asset</Text>
                    <Text style={styles.infoVal}>{WDK_FEE_ASSET_LABEL}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Estimated Fee Amount</Text>
                    <Text style={styles.infoVal}>
                      {feeQuote?.feeEth
                        ? `${feeQuote.feeEth} ${WDK_FEE_ASSET_LABEL}`
                        : isOffline
                        ? 'Unavailable offline (Live bundler required)'
                        : feeQuoteError || 'Getting Sepolia network fee…'}
                    </Text>
                  </View>
                  <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoKey}>Total to Approve</Text>
                    <Text style={[styles.infoVal, { fontWeight: '800' }]}>
                      {feeQuote?.feeEth
                        ? `$${Number(amount || 0).toFixed(2)} USDT + ${feeQuote.feeEth} ${WDK_FEE_ASSET_LABEL}`
                        : `$${Number(amount || 0).toFixed(2)} USDT + network fee (requires online quote)`}
                    </Text>
                  </View>
                </View>

                <View style={styles.warningBanner}>
                  <Ionicons name="shield-half-outline" size={18} color="#92400E" />
                  <Text style={styles.warningBannerText}>
                    {isOffline
                      ? `Offline Notice: ${OFFLINE_SIGNING_DISABLED_REASON} Saving a draft does NOT pay the recipient or reserve funds on-chain (double-spend and delayed-confirmation risk applies until confirmed on Sepolia).`
                      : `Verify the recipient address and ${SUPPORTED_WALLET_CONFIG.networkName} network before approving. ${TESTNET_FUNDS_NOTICE} Your balance changes only after a real on-chain receipt is confirmed.`}
                  </Text>
                </View>

                {errorMsg ? <Text style={styles.sendError}>{errorMsg}</Text> : null}

                {paymentResult?.status ? (
                  <View style={styles.infoGridCard}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoKey}>Transfer Status</Text>
                      <Text style={[styles.infoVal, { fontWeight: '800' }]}>
                        {getPaymentStatusPresentation(paymentResult).badge}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoKey}>Next Safe Action</Text>
                      <Text style={styles.infoVal}>
                        {getPaymentStatusPresentation(paymentResult).nextSafeAction}
                      </Text>
                    </View>
                    {paymentResult.userOperationHash ? (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>UserOperation Hash (Bundler)</Text>
                        <Text selectable style={styles.infoValMono}>
                          {paymentResult.userOperationHash.slice(0, 12)}...
                          {paymentResult.userOperationHash.slice(-8)}
                        </Text>
                      </View>
                    ) : null}
                    {paymentResult.transactionHash ? (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Ethereum Tx Hash (On-Chain)</Text>
                        <Text selectable style={[styles.infoValMono, { color: '#059669' }]}>
                          {paymentResult.transactionHash.slice(0, 12)}...
                          {paymentResult.transactionHash.slice(-8)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoKey}>Ethereum Tx Hash (On-Chain)</Text>
                        <Text style={styles.infoVal}>
                          {paymentResult.status === 'successful'
                            ? 'Confirmed'
                            : 'Awaiting block inclusion'}
                        </Text>
                      </View>
                    )}
                    {paymentResult.lastCheckedAt ? (
                      <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.infoKey}>Last Checked</Text>
                        <Text style={styles.infoVal}>
                          {new Date(paymentResult.lastCheckedAt).toLocaleTimeString()}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {!isOffline && !paymentResult && !feeQuote?.feeBaseUnits ? (
                  <TouchableOpacity
                    style={[styles.sendPrimaryBtn, { backgroundColor: '#334155', marginBottom: 4 }]}
                    onPress={() => fetchLiveFeeForReview(recipient, amount)}
                  >
                    <Text style={styles.sendPrimaryText}>Refresh Live Fee Quote</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.sendPrimaryBtn,
                    (isSending || (isOffline && !paymentResult)) && { backgroundColor: '#94A3B8' },
                  ]}
                  onPress={
                    paymentResult?.status === 'successful'
                      ? () => {
                          setShowSendModal(false);
                          setSendStep(1);
                          setRecipient('');
                          setNote('');
                          setQrScanMeta(null);
                          setPaymentRequestId('');
                          setPaymentResult(null);
                          setErrorMsg('');
                        }
                      : paymentResult?.status === 'failed' ||
                        paymentResult?.status === 'dropped' ||
                        paymentResult?.status === 'expired'
                      ? () => {
                          setPaymentRequestId(createPaymentRequestId());
                          setPaymentResult(null);
                          setErrorMsg(
                            'Review the payment again with a fresh fee quote. A new request will be submitted only after you approve.'
                          );
                          fetchLiveFeeForReview(recipient, amount);
                        }
                      : handleExecuteSend
                  }
                  disabled={isSending || (isOffline && !paymentResult)}
                >
                  {isSending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.sendPrimaryText}>
                      {paymentResult?.status === 'successful'
                        ? 'Done'
                        : paymentResult?.status === 'pending' ||
                          paymentResult?.status === 'submitted' ||
                          paymentResult?.status === 'outcome-unknown'
                        ? 'Check status'
                        : paymentResult?.status === 'failed' ||
                          paymentResult?.status === 'dropped' ||
                          paymentResult?.status === 'expired'
                        ? 'Review a new payment'
                        : isOffline
                        ? 'Broadcast Disabled Offline'
                        : 'Approve & Send'}
                    </Text>
                  )}
                </TouchableOpacity>

                {!paymentResult && (isOffline || Boolean(feeQuoteError)) ? (
                  <TouchableOpacity
                    style={[
                      styles.sendPrimaryBtn,
                      { backgroundColor: '#B45309', marginTop: 8 },
                    ]}
                    onPress={handleSaveOfflineDraft}
                  >
                    <Text style={styles.sendPrimaryText}>
                      Save as Offline Draft (“Draft — not sent”)
                    </Text>
                  </TouchableOpacity>
                ) : null}
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
        onRequestClose={handleCloseScanner}
      >
        <View style={styles.scannerScreen}>
          {showScanner && cameraPermission?.granted ? (
            <CameraView
              key={cameraMountAttempt}
              style={[StyleSheet.absoluteFillObject, styles.cameraPreview]}
              facing="back"
              enableTorch={torchEnabled}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onCameraReady={() => {
                setCameraReady(true);
                setCameraMountError('');
              }}
              onMountError={(event) => {
                setCameraReady(false);
                setCameraMountError(
                  event?.nativeEvent?.message ||
                    event?.message ||
                    'The camera preview could not start. Check camera permission and tap Remount Camera.'
                );
              }}
              onBarcodeScanned={isScanLocked ? undefined : handleBarcodeScanned}
            />
          ) : null}

          <View style={styles.scannerHeader}>
            <TouchableOpacity style={styles.scannerClose} onPress={handleCloseScanner}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.scannerTitle}>Scan Sepolia USDT QR</Text>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                {!cameraPermission?.granted
                  ? cameraPermission?.canAskAgain === false
                    ? 'Permission permanently denied'
                    : 'Permission required'
                  : cameraMountError
                  ? 'Camera mount error'
                  : cameraReady
                  ? 'Camera live · QR-only mode'
                  : 'Starting camera preview…'}
              </Text>
            </View>
            {cameraPermission?.granted ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.scannerClose} onPress={() => setTorchEnabled((enabled) => !enabled)} accessibilityLabel={torchEnabled ? 'Turn flashlight off' : 'Turn flashlight on'}>
                  <Ionicons name={torchEnabled ? 'flash' : 'flash-outline'} size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.scannerClose} onPress={handleRetryCamera} accessibilityLabel="Remount camera">
                  <Ionicons name="refresh" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: 44 }} />
            )}
          </View>

          {cameraPermission?.granted ? (
            <View style={styles.scanFrameWrap} pointerEvents="none">
              <View
                style={[
                  styles.scanFrame,
                  scannerError || cameraMountError
                    ? { borderColor: '#EF4444' }
                    : cameraReady
                    ? { borderColor: '#00E676' }
                    : { borderColor: '#FBBF24' },
                ]}
              />
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {!cameraPermission?.granted ? (
            <View style={styles.cameraMountErrorCard}>
              <Ionicons
                name={cameraPermission?.canAskAgain === false ? 'settings-outline' : 'camera-outline'}
                size={28}
                color="#DC2626"
              />
              <Text style={[styles.scannerErrorTitle, { marginTop: 8, marginBottom: 6, textAlign: 'center' }]}>
                {cameraPermission?.canAskAgain === false
                  ? 'Camera Permission Permanently Denied'
                  : 'Camera Permission Required'}
              </Text>
              {cameraPermission?.canAskAgain === false ? (
                <>
                  <Text style={[styles.scannerErrorBody, { textAlign: 'center' }]}>
                    Camera access was denied with “Don’t ask again”. To scan Ethereum Sepolia USDT QR codes, enable camera access in your device settings:
                  </Text>
                  <Text style={[styles.scannerErrorBody, { marginTop: 8, fontWeight: '600' }]}>
                    1. Tap “Open Device Settings” below.{'\n'}
                    2. Open Permissions → Camera.{'\n'}
                    3. Select “Allow only while using the app”.{'\n'}
                    4. Return to InterLink and tap “Re-check Permission”.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' }}>
                    <TouchableOpacity
                      style={[styles.sendPrimaryBtn, { flex: 1, marginTop: 0, paddingVertical: 12 }]}
                      onPress={handleOpenDeviceSettings}
                    >
                      <Text style={styles.sendPrimaryText}>Open Device Settings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sendPrimaryBtn,
                        { flex: 1, marginTop: 0, paddingVertical: 12, backgroundColor: '#334155' },
                      ]}
                      onPress={handleRequestPermissionAgain}
                    >
                      <Text style={styles.sendPrimaryText}>Re-check Permission</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.scannerErrorBody, { textAlign: 'center' }]}>
                    InterLink needs camera access to scan Ethereum Sepolia USDT payment request QR codes. Scanning only prefills the review screen and never submits a payment automatically.
                  </Text>
                  <TouchableOpacity
                    style={[styles.sendPrimaryBtn, { marginTop: 14, width: '100%', paddingVertical: 12 }]}
                    onPress={handleRequestPermissionAgain}
                  >
                    <Text style={styles.sendPrimaryText}>Grant Camera Permission</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.sendBackBtn, { marginTop: 4 }]}
                onPress={handleCloseScanner}
              >
                <Text style={styles.sendBackText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : scannerError ? (
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
                      backgroundColor: '#334155',
                    },
                  ]}
                  onPress={handleRetryCamera}
                >
                  <Text style={styles.sendPrimaryText}>Remount Camera</Text>
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
                  onPress={handleCloseScanner}
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

          {cameraPermission?.granted && !cameraMountError && !cameraReady ? (
            <View style={styles.cameraStatusOverlay} pointerEvents="none">
              <ActivityIndicator color="#00E676" size="small" />
              <Text style={styles.cameraStatusText}>Starting camera…</Text>
            </View>
          ) : null}

          {cameraPermission?.granted && cameraMountError ? (
            <View style={styles.cameraMountErrorCard}>
              <Ionicons name="camera-outline" size={24} color="#DC2626" />
              <Text style={[styles.scannerErrorTitle, { marginTop: 6, marginBottom: 4 }]}>
                Camera preview unavailable
              </Text>
              <Text style={[styles.scannerErrorBody, { textAlign: 'center' }]}>
                {cameraMountError}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' }}>
                <TouchableOpacity
                  style={[styles.sendPrimaryBtn, { flex: 1, marginTop: 0, paddingVertical: 12 }]}
                  onPress={handleRetryCamera}
                >
                  <Text style={styles.sendPrimaryText}>Remount Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sendPrimaryBtn,
                    { flex: 1, marginTop: 0, paddingVertical: 12, backgroundColor: '#FEE2E2' },
                  ]}
                  onPress={handleCloseScanner}
                >
                  <Text style={[styles.sendPrimaryText, { color: '#991B1B' }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={showNfcScanner}
        transparent
        animationType="fade"
        onRequestClose={cancelNfcScan}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.sendSheet, { alignItems: 'center' }]}>
            <View style={[styles.qrChoiceIcon, { width: 64, height: 64, borderRadius: 20, backgroundColor: '#EFF6FF', marginBottom: 12 }]}>
              <Ionicons name="radio-outline" size={32} color="#2563EB" />
            </View>
            <Text style={styles.sendTitle}>Tap NFC payment tag</Text>
            <Text style={[styles.reviewCopy, { textAlign: 'center', marginTop: 8 }]}>{nfcStatus || 'Preparing NFC reader…'}</Text>
            {isNfcScanning ? <ActivityIndicator color="#059669" style={{ marginBottom: 10 }} /> : null}
            <Text style={[styles.reviewCopy, { textAlign: 'center' }]}>This reads a payment request only. It does not authorize or submit a transfer.</Text>
            <TouchableOpacity style={styles.sendBackBtn} onPress={cancelNfcScan}><Text style={styles.sendBackText}>Cancel</Text></TouchableOpacity>
          </View>
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

      {/* ===================================================================== */}
      {/* BANK DEPOSIT CONVERTED TO USDT MODAL                                 */}
      {/* ===================================================================== */}
      <Modal
        visible={showDepositModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDepositModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={{ maxHeight: '92%' }}
            contentContainerStyle={styles.sendSheet}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sendHeader}>
              <Text style={styles.sendTitle}>
                {depositStep === 1
                  ? 'Deposit Fiat → USDT'
                  : depositStep === 2
                  ? 'Bank Transfer Instructions'
                  : 'Deposit Received & Converted'}
              </Text>
              <TouchableOpacity onPress={() => setShowDepositModal(false)}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>

            {depositError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{depositError}</Text>
              </View>
            ) : null}

            {depositStep === 1 ? (
              <>
                <Text style={styles.fieldLabel}>Select Deposit Currency & Corridor</Text>
                <View style={styles.depositCorridorGrid}>
                  {[
                    { code: 'ZA-ZAR', country: 'South Africa', currency: 'ZAR', rate: 18.35, rail: 'PayShap / EFT' },
                    { code: 'KE-KES', country: 'Kenya', currency: 'KES', rate: 130.50, rail: 'M-Pesa / Bank' },
                    { code: 'NG-NGN', country: 'Nigeria', currency: 'NGN', rate: 1450.00, rail: 'NIP Transfer' },
                    { code: 'GB-GBP', country: 'United Kingdom', currency: 'GBP', rate: 0.79, rail: 'Faster Payments' },
                    { code: 'EU-EUR', country: 'Europe', currency: 'EUR', rate: 0.92, rail: 'SEPA Instant' },
                  ].map((c) => {
                    const isSelected = depositCorridorCode === c.code;
                    return (
                      <TouchableOpacity
                        key={c.code}
                        style={[styles.depositCorridorCard, isSelected && styles.depositCorridorCardActive]}
                        onPress={() => setDepositCorridorCode(c.code)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.depositCorridorName, isSelected && styles.depositCorridorNameActive]}>
                          {c.country} ({c.currency})
                        </Text>
                        <Text style={styles.depositCorridorRail}>{c.rail}</Text>
                        <Text style={styles.depositCorridorRate}>
                          1 USD = {c.rate.toFixed(2)} {c.currency}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.amountInputGroup}>
                  <Text style={styles.fieldLabel}>
                    Deposit Amount in {activeDepositCorridor.currency}
                  </Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.currencyPrefixText}>
                      {activeDepositCorridor.symbol || activeDepositCorridor.currency}
                    </Text>
                    <TextInput
                      style={styles.amountTextInput}
                      value={depositAmountFiat}
                      onChangeText={setDepositAmountFiat}
                      placeholder="1000"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Conversion Preview Box */}
                <View style={styles.depositPreviewCard}>
                  <View style={styles.depositPreviewRow}>
                    <Text style={styles.depositPreviewLabel}>Live Benchmark Rate</Text>
                    <Text style={styles.depositPreviewVal}>
                      1 USDT = {depositRate.toFixed(2)} {activeDepositCorridor.currency}
                    </Text>
                  </View>
                  <View style={styles.depositPreviewRow}>
                    <Text style={styles.depositPreviewLabel}>Network / Processing Fee</Text>
                    <Text style={[styles.depositPreviewVal, { color: '#059669' }]}>
                      $0.00 (0% Promo Fee)
                    </Text>
                  </View>
                  <View style={[styles.depositPreviewRow, styles.depositPreviewTotal]}>
                    <Text style={styles.depositPreviewTotalLabel}>You will receive</Text>
                    <Text style={styles.depositPreviewTotalVal}>
                      ~{depositUsdtEstimate} USDT
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.sendActionBtn}
                  onPress={handleReviewDeposit}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sendActionText}>Review Bank Transfer Details</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            ) : depositStep === 2 ? (
              <>
                <View style={styles.bankDetailsCard}>
                  <Text style={styles.bankDetailsTitle}>Bank Transfer Beneficiary</Text>
                  <Text style={styles.bankDetailsSub}>
                    Transfer exactly {activeDepositCorridor.symbol || ''}{' '}
                    {Number(depositAmountFiat).toLocaleString()} {activeDepositCorridor.currency} using your banking app to the account below.
                  </Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Beneficiary Bank</Text>
                    <Text style={styles.detailRowVal}>Standard Bank / Partner Clearing</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Account / ShapID</Text>
                    <Text style={styles.detailRowVal}>082 123 4567 / deposit@interlink</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Deposit Reference</Text>
                    <Text style={[styles.detailRowVal, { color: '#00B87A', fontWeight: '900' }]}>
                      {depositReference}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailRowLabel}>Converted Amount</Text>
                    <Text style={styles.detailRowVal}>${depositUsdtEstimate} USDT</Text>
                  </View>
                </View>

                <View style={styles.setupRequiredBox}>
                  <View style={styles.setupRequiredHeader}>
                    <Ionicons name="information-circle-outline" size={18} color="#059669" />
                    <Text style={[styles.setupRequiredTitle, { color: '#065F46' }]}>
                      Testnet Deposit Settlement
                    </Text>
                  </View>
                  <Text style={styles.setupRequiredText}>
                    In production, the banking gateway automatically credits USDT once the EFT clears. In this Sepolia environment, confirming below validates your simulated bank deposit and credits test funds immediately.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.sendActionBtn, depositLoading && { opacity: 0.7 }]}
                  onPress={handleConfirmDeposit}
                  disabled={depositLoading}
                  activeOpacity={0.8}
                >
                  {depositLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.sendActionText}>Confirm Bank Transfer</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sendBackBtn}
                  onPress={() => setDepositStep(1)}
                  disabled={depositLoading}
                >
                  <Text style={styles.sendBackText}>Back to Amount & Currency</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.receiptContainer}>
                  <View style={styles.receiptIconCircle}>
                    <Ionicons name="checkmark-circle" size={54} color="#059669" />
                  </View>
                  <Text style={styles.receiptTitle}>Deposit Converted to USDT!</Text>
                  <Text style={styles.receiptAmount}>
                    +${depositReceipt?.usdtCredited.toFixed(2)} USDT
                  </Text>
                  <Text style={styles.receiptSub}>
                    Converted from {depositReceipt?.fiatCurrency}{' '}
                    {Number(depositReceipt?.fiatAmount).toLocaleString()} at 1 USDT ={' '}
                    {depositReceipt?.exchangeRate.toFixed(2)} {depositReceipt?.fiatCurrency}.
                  </Text>

                  <View style={styles.receiptInfoBox}>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Deposit Reference</Text>
                      <Text style={styles.receiptVal}>{depositReceipt?.reference}</Text>
                    </View>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Status</Text>
                      <Text style={[styles.receiptVal, { color: '#059669', fontWeight: '800' }]}>
                        {depositReceipt?.status}
                      </Text>
                    </View>
                    <View style={[styles.receiptRow, { borderBottomWidth: 0 }]}>
                      <Text style={styles.receiptLabel}>Timestamp</Text>
                      <Text style={styles.receiptVal}>
                        {depositReceipt?.timestamp
                          ? new Date(depositReceipt.timestamp).toLocaleTimeString()
                          : ''}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.sendActionBtn}
                  onPress={() => {
                    setShowDepositModal(false);
                    if (onRefresh) onRefresh();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sendActionText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* 2B. SAVED OFFLINE PAYMENT DRAFTS ("Draft — not sent") */}
      {offlineDrafts.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Payment Drafts (Not Sent)</Text>
            <Text style={{ fontSize: 12, color: '#B45309', fontWeight: '700' }}>
              Unsigned · Awaiting Online Review
            </Text>
          </View>
          <View style={styles.transactionContainer}>
            {offlineDrafts.map((draft, idx) => (
              <View
                key={draft.draftId}
                style={[
                  styles.transactionItem,
                  { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
                  idx === offlineDrafts.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle}>
                      ${Number(draft.amountUsdt || 0).toFixed(2)} {draft.tokenSymbol || 'USDT'} →{' '}
                      {String(draft.recipient || '').slice(0, 8)}...
                      {String(draft.recipient || '').slice(-6)}
                    </Text>
                    <Text style={styles.txDate}>
                      Saved {draft.createdAt ? new Date(draft.createdAt).toLocaleTimeString() : ''} ·{' '}
                      {draft.networkName || 'Ethereum Sepolia'}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: '#FEF3C7',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#92400E' }}>
                      {draft.statusLabel || 'Draft — not sent'}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 17 }}>
                  {draft.offlineSigningReason ||
                    'Draft — not sent. Not signed or broadcast on-chain. Review live fees and balance when online before approving.'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[
                      styles.sendPrimaryBtn,
                      { flex: 1, marginTop: 0, paddingVertical: 10 },
                    ]}
                    onPress={() => handleOpenDraftForReview(draft)}
                  >
                    <Text style={[styles.sendPrimaryText, { fontSize: 13 }]}>
                      {isOffline ? 'Inspect Draft' : 'Review & Send Online'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sendBackBtn,
                      {
                        marginTop: 0,
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        backgroundColor: '#FEE2E2',
                      },
                    ]}
                    onPress={async () => {
                      await deleteOfflinePaymentDraft(draft.draftId, walletScopeKey);
                      await reloadLocalJournalAndDrafts();
                    }}
                  >
                    <Text style={[styles.sendBackText, { color: '#991B1B', fontSize: 13 }]}>
                      Discard
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* 2C. LOCAL DURABLE WDK PAYMENT JOURNAL & STATUS RECONCILIATION */}
      {paymentJournal.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment Journal & Status</Text>
            <TouchableOpacity onPress={reloadLocalJournalAndDrafts} style={styles.refreshBtn}>
              <Ionicons name="refresh-outline" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
          <View style={styles.transactionContainer}>
            {paymentJournal.slice(0, 6).map((rec, idx) => {
              const pres = getPaymentStatusPresentation(rec, isOffline);
              const isChecking = checkingRequestId === rec.requestId;
              const isLast = idx === Math.min(paymentJournal.length, 6) - 1;
              return (
                <View
                  key={rec.requestId}
                  style={[
                    styles.transactionItem,
                    { flexDirection: 'column', alignItems: 'stretch', gap: 6 },
                    isLast && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.txTitle}>
                      ${Number(rec.amountUsdt || 0).toFixed(2)} {rec.tokenSymbol || 'USDT'} →{' '}
                      {String(rec.recipient || '').slice(0, 8)}...
                      {String(rec.recipient || '').slice(-6)}
                    </Text>
                    <View
                      style={{
                        backgroundColor:
                          pres.tone === 'success'
                            ? '#ECFDF5'
                            : pres.tone === 'danger'
                            ? '#FEF2F2'
                            : '#FEF3C7',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color:
                            pres.tone === 'success'
                              ? '#059669'
                              : pres.tone === 'danger'
                              ? '#DC2626'
                              : '#92400E',
                        }}
                      >
                        {pres.badge}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 12, color: '#475569', lineHeight: 17 }}>
                    {pres.headline}
                  </Text>

                  <Text style={styles.txDate}>
                    Request ID: {String(rec.requestId).slice(0, 22)}...
                    {rec.lastCheckedAt
                      ? ` · Checked ${new Date(rec.lastCheckedAt).toLocaleTimeString()}`
                      : ''}
                  </Text>

                  {rec.userOperationHash ? (
                    <Text style={styles.txDate} selectable>
                      UserOp Hash: {rec.userOperationHash.slice(0, 14)}...
                      {rec.userOperationHash.slice(-8)}
                    </Text>
                  ) : null}

                  {rec.transactionHash ? (
                    <Text style={[styles.txDate, { color: '#059669', fontWeight: '700' }]} selectable>
                      On-Chain Tx Hash: {rec.transactionHash.slice(0, 14)}...
                      {rec.transactionHash.slice(-8)}
                    </Text>
                  ) : null}

                  {pres.canCheckStatus ? (
                    <TouchableOpacity
                      style={[
                        styles.sendBackBtn,
                        {
                          marginTop: 4,
                          paddingVertical: 9,
                          backgroundColor: '#EFF6FF',
                        },
                      ]}
                      onPress={() => handleCheckJournalRecordStatus(rec)}
                      disabled={isChecking || isOffline}
                    >
                      {isChecking ? (
                        <ActivityIndicator size="small" color="#1D4ED8" />
                      ) : (
                        <Text style={[styles.sendBackText, { color: '#1D4ED8', fontSize: 13 }]}>
                          {isOffline ? 'Reconnect to Check Status' : 'Check Status On-Chain'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* 3. ASSETS LIST */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Portfolio Assets</Text>
            {lastUpdatedLabel ? (
              <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                {isOffline || wallet?.isCachedBalance
                  ? `Cached snapshot · Last updated ${lastUpdatedLabel}`
                  : `Live Sepolia RPC · Last updated ${lastUpdatedLabel}`}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => onNavigate('assets')}>
              <Text style={[styles.sectionLink, { color: '#00B87A' }]}>Holdings ⟶</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onNavigate('markets')}>
              <Text style={styles.sectionLink}>Markets ⟶</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.assetListContainer}>
          <View style={[styles.assetRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12, marginBottom: 12 }]}>
            <View style={[styles.assetRowIcon, { backgroundColor: '#ECFDF5' }]}>
              <Text style={{ fontSize: 20, color: '#059669', fontWeight: '800' }}>$</Text>
            </View>
            <View style={styles.assetRowInfo}>
              <Text style={styles.assetRowName}>Tether USD (Sepolia Test-Only)</Text>
              <Text style={styles.assetRowSub}>
                USDT · Chain ID {SUPPORTED_WALLET_CONFIG.chainId} · No monetary value
              </Text>
            </View>
            <View style={styles.assetRowValues}>
              <Text style={styles.assetRowAmount}>
                {usdtBalance == null ? 'Wallet Setup Req.' : `$${usdtBalance.toFixed(2)}`}
              </Text>
              <Text style={styles.assetRowChange}>
                {isOffline || wallet?.isCachedBalance ? 'Cached ERC-20' : 'ERC-20 Testnet'}
              </Text>
            </View>
          </View>

          <View style={styles.assetRow}>
            <View style={[styles.assetRowIcon, { backgroundColor: '#EFF6FF' }]}>
              <Text style={{ fontSize: 18, color: '#2563EB', fontWeight: '800' }}>Ξ</Text>
            </View>
            <View style={styles.assetRowInfo}>
              <Text style={styles.assetRowName}>Sepolia ETH (Gas Asset)</Text>
              <Text style={styles.assetRowSub}>
                ETH · ERC-4337 EntryPoint v0.7 Gas Balance
              </Text>
            </View>
            <View style={styles.assetRowValues}>
              <Text style={styles.assetRowAmount}>
                {ethBalanceFormatted == null ? '—' : `${ethBalanceFormatted} ETH`}
              </Text>
              <Text style={styles.assetRowChange}>
                {isOffline || wallet?.isCachedBalance ? 'Cached Gas' : 'Testnet Gas'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 4. TRANSACTIONS */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {lastUpdatedLabel ? (
              <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                {isOffline
                  ? `Offline cached history · Last updated ${lastUpdatedLabel}`
                  : `Synced · Last updated ${lastUpdatedLabel}`}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.transactionContainer}>
          {visibleTransactions.map((transaction, index) => {
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
            const isLast = index === visibleTransactions.length - 1;

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
          {!visibleTransactions.length && (
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
  // Keep this transparent and without zIndex: Android's native camera surface
  // can otherwise render as an opaque black layer inside a React Native Modal.
  cameraPreview: {},
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

  /* --- 5. DEPOSIT MODAL STYLES --- */
  depositCorridorGrid: {
    gap: 10,
    marginBottom: 16,
  },
  depositCorridorCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  depositCorridorCardActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  depositCorridorName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  depositCorridorNameActive: {
    color: '#059669',
  },
  depositCorridorRail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  depositCorridorRate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00B87A',
    marginTop: 2,
  },
  depositPreviewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  depositPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  depositPreviewLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  depositPreviewVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A0F1C',
  },
  depositPreviewTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 0,
  },
  depositPreviewTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  depositPreviewTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#059669',
  },
  bankDetailsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  bankDetailsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  bankDetailsSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 16,
  },
  receiptContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  receiptIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  receiptAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#059669',
    marginTop: 6,
  },
  receiptSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 16,
  },
  receiptInfoBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 20,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  receiptLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  receiptVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A0F1C',
  },
});
