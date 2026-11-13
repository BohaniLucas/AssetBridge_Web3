import React, { useState, useEffect } from 'react';
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
import { mobileWalletService } from '../services/walletService';
import { mobileClaimService } from '../services/claimService';

export default function HomeScreen({
  wallet,
  walletStatus,
  walletError,
  walletExists,
  balanceError,
  balanceLoading,
  onRefresh,
  onCreateWallet,
  onSaveWallet,
  onUnlockWallet,
  onTransfer,
  onNavigate,
}) {
  // Modals state
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [transactions, setTransactions] = useState([]);

  // Send USDT flow
  const [sendStep, setSendStep] = useState(1);
  const [recipient, setRecipient] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('50');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [backupAcknowledged, setBackupAcknowledged] = useState(false);
  const [walletActionLoading, setWalletActionLoading] = useState(false);
  const [walletActionError, setWalletActionError] = useState('');

  // Send to Gogo (WhatsApp Escrow Link)
  const [claimZar, setClaimZar] = useState('400');
  const [claimName, setClaimName] = useState('Gogo');
  const [claimPhone, setClaimPhone] = useState('+27 82 555 0192');
  const [activeClaim, setActiveClaim] = useState(null);
  const [isCreatingClaim, setIsCreatingClaim] = useState(false);
  const [isSimulatingClaim, setIsSimulatingClaim] = useState(false);

  // Copy success indicator
  const [copied, setCopied] = useState(false);

  const formattedUsdtBalance = formatUsdtBalance(wallet?.balanceUsdt);

  useEffect(() => {
    let active = true;
    mobileWalletService.getTransactions(wallet?.userId)
      .then((items) => {
        if (active) setTransactions(items || []);
      })
      .catch(() => {
        if (active) setTransactions([]);
      });
    return () => { active = false; };
  }, [wallet?.userId]);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openScanner = async () => {
    setShowMoreActions(false);
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera access needed', 'Allow camera access in your device settings to scan QR codes.');
        return;
      }
    }
    setShowScanner(true);
  };

  const handleBarcodeScanned = ({ data }) => {
    setShowScanner(false);
    Alert.alert('QR code scanned', data, [{ text: 'OK' }]);
  };

  const beginWalletCreation = async () => {
    setWalletActionLoading(true);
    setWalletActionError('');
    try {
      const phrase = await onCreateWallet();
      setRecoveryPhrase(phrase);
      setBackupAcknowledged(false);
    } catch (error) {
      setWalletActionError(error.message || 'Wallet setup could not be started.');
    } finally {
      setWalletActionLoading(false);
    }
  };

  const confirmWalletCreation = async () => {
    if (!backupAcknowledged || !recoveryPhrase) return;
    setWalletActionLoading(true);
    setWalletActionError('');
    try {
      await onSaveWallet(recoveryPhrase);
      setRecoveryPhrase('');
      setShowReceiveModal(false);
      await onRefresh?.();
    } catch (error) {
      setWalletActionError(error.message || 'The wallet could not be saved.');
    } finally {
      setWalletActionLoading(false);
    }
  };

  const handleUnlockWallet = async () => {
    setWalletActionLoading(true);
    setWalletActionError('');
    try {
      await onUnlockWallet();
    } catch (error) {
      setWalletActionError(error.message || 'The wallet could not be unlocked.');
    } finally {
      setWalletActionLoading(false);
    }
  };

  const closeRecoveryPhrase = () => {
    if (walletActionLoading) return;
    setRecoveryPhrase('');
    setBackupAcknowledged(false);
    setWalletActionError('');
  };

  const walletStatusCopy = {
    INITIALIZING: 'Connecting to the WDK wallet service…',
    REINITIALIZING: 'Reconnecting to the WDK wallet service…',
    NO_WALLET: 'No WDK wallet is set up on this device.',
    LOCKED: walletExists ? 'Your WDK wallet is locked.' : 'No wallet is linked to this account on this device.',
    ERROR: walletError || 'The WDK wallet could not be initialized.',
    CONFIG_ERROR: walletError || 'Sepolia wallet configuration is incomplete.',
    UNAVAILABLE: walletError || 'Wallet operations are unavailable on web.',
  };

  const handleReviewSend = () => {
    if (!recipient.trim()) return setErrorMsg('Enter a wallet address or username.');
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return setErrorMsg('Enter an amount greater than zero.');
    setErrorMsg('');
    setSendStep(2);
  };

  const handleExecuteSend = async () => {
    if (!onTransfer) return setErrorMsg('Transfers are unavailable right now.');
    setIsSending(true);
    setErrorMsg('');
    try {
      const result = await onTransfer({
        senderUserId: wallet?.userId,
        recipientAddressOrUsername: recipient.trim(),
        amountUsdt: Number(amount),
        note,
      });
      setLastReceipt(result?.transaction || result);
      setShowSendModal(false);
      setSendStep(1);
      setRecipient('');
      setNote('');
      await onRefresh?.();
      Alert.alert('Transfer sent', `$${Number(amount).toFixed(2)} USDT was sent successfully.`);
    } catch (error) {
      setErrorMsg(error.message || 'The transfer could not be completed.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      
      
      <View style={styles.portfolioCard}>
        
        <View style={styles.decorCircleTop} />
        <View style={styles.decorCircleBottom} />

        <View style={styles.portfolioHeader}>
          <Text style={styles.portfolioLabel}>USDT BALANCE</Text>
          <View style={styles.sepoliaBadge}>
            <View style={styles.sepoliaDot} />
            <Text style={styles.sepoliaText}>SEPOLIA</Text>
          </View>
        </View>

        <View style={styles.balanceContainer}>
          <Text style={styles.balanceCurrency}>USDT</Text>
          <Text style={styles.balanceAmount}>
            {formattedUsdtBalance == null
              ? (balanceLoading ? '…' : '—')
              : formattedUsdtBalance}
          </Text>
        </View>

        <View style={styles.profitRow}>
          <Ionicons name="information-circle-outline" size={15} color="#94A3B8" />
          <Text style={styles.profitTimeframe}>
            {walletStatus === 'READY' && !balanceError
              ? 'Live Sepolia network balance'
              : balanceError
                ? 'Balance unavailable — not a confirmed zero'
                : 'Connect your WDK wallet to view its balance'}
          </Text>
        </View>

        <View style={styles.addressBar}>
          <Text style={styles.addressValue} numberOfLines={1}>
            {wallet?.address ? `${wallet.address.slice(0, 10)}...${wallet.address.slice(-6)}` : 'No wallet connected'}
          </Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {walletStatus !== 'READY' || balanceError ? (
        <View style={styles.walletStatusCard}>
          <Text style={styles.walletStatusText}>
            {walletStatus === 'READY' ? balanceError : walletStatusCopy[walletStatus] || 'Wallet status unavailable.'}
          </Text>
          {walletStatus === 'NO_WALLET' || (walletStatus === 'LOCKED' && !walletExists) ? (
            <TouchableOpacity
              style={styles.walletActionButton}
              onPress={beginWalletCreation}
              disabled={walletActionLoading || !onCreateWallet}
            >
              {walletActionLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.walletActionButtonText}>Create WDK wallet</Text>}
            </TouchableOpacity>
          ) : null}
          {walletStatus === 'LOCKED' && walletExists ? (
            <TouchableOpacity
              style={styles.walletActionButton}
              onPress={handleUnlockWallet}
              disabled={walletActionLoading || !onUnlockWallet}
            >
              {walletActionLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.walletActionButtonText}>Unlock wallet</Text>}
            </TouchableOpacity>
          ) : null}
          {walletStatus === 'READY' && balanceError ? (
            <TouchableOpacity style={styles.walletActionButton} onPress={onRefresh} disabled={balanceLoading}>
              {balanceLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.walletActionButtonText}>Retry balance</Text>}
            </TouchableOpacity>
          ) : null}
          {walletActionError ? <Text style={styles.walletActionError}>{walletActionError}</Text> : null}
          {walletError && walletStatus !== 'CONFIG_ERROR' ? (
            <Text style={styles.walletActionError}>{walletError}</Text>
          ) : null}
        </View>
      ) : null}

      
      <View style={[styles.actionGrid, styles.shadowSm]}>
        {[
          { label: 'Receive', icon: 'download', color: '#3B82F6', action: () => setShowReceiveModal(true) },
          { label: 'Send', icon: 'paper-plane', color: '#10B981', action: () => { setSendStep(1); setShowSendModal(true); } },
          { label: 'Withdraw', icon: 'cash', color: '#F59E0B', action: () => onNavigate('markets') },
          { label: 'Qr Scan', icon: 'qr-code', color: '#6366F1', action: openScanner },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={styles.actionBtn} onPress={item.action} activeOpacity={0.7}>
            <View style={[styles.actionIconBox, { backgroundColor: `${item.color}15` }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <Text style={styles.actionBtnText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {showMoreActions && (
        <View style={styles.moreActionsContainer}>
          <TouchableOpacity style={styles.moreActionBtn} onPress={() => setShowReceiveModal(true)}>
            <Ionicons name="qr-code-outline" size={20} color="#334155" />
            <Text style={styles.moreActionText}>Receive address</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreActionBtn} onPress={() => { setActiveClaim(null); setShowClaimModal(true); }}>
            <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
            <Text style={styles.moreActionText}>WhatsApp Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreActionBtn} onPress={() => onNavigate('remittance')}>
            <Ionicons name="globe-outline" size={20} color="#334155" />
            <Text style={styles.moreActionText}>Send Home</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={Boolean(recoveryPhrase)} transparent animationType="slide" onRequestClose={closeRecoveryPhrase}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sendSheet}>
            <View style={styles.sendHeader}>
              <Text style={styles.sendTitle}>Back up your wallet</Text>
              <TouchableOpacity onPress={closeRecoveryPhrase} disabled={walletActionLoading}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>
            <Text style={styles.recoveryWarning}>
              Write this phrase down and keep it offline. Anyone with it can control this wallet. AssetBridge will never ask you to share it.
            </Text>
            <Text selectable style={styles.recoveryPhrase}>{recoveryPhrase}</Text>
            <TouchableOpacity
              style={styles.recoveryCheck}
              onPress={() => setBackupAcknowledged((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: backupAcknowledged }}
            >
              <Ionicons
                name={backupAcknowledged ? 'checkbox' : 'square-outline'}
                size={22}
                color={backupAcknowledged ? '#059669' : '#64748B'}
              />
              <Text style={styles.recoveryCheckText}>I have saved this recovery phrase somewhere safe.</Text>
            </TouchableOpacity>
            {walletActionError ? <Text style={styles.sendError}>{walletActionError}</Text> : null}
            <TouchableOpacity
              style={[styles.sendPrimaryBtn, !backupAcknowledged && styles.disabledButton]}
              onPress={confirmWalletCreation}
              disabled={!backupAcknowledged || walletActionLoading}
            >
              {walletActionLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.sendPrimaryText}>Save wallet on this device</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showReceiveModal} transparent animationType="slide" onRequestClose={() => setShowReceiveModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sendSheet}>
            <View style={styles.sendHeader}>
              <Text style={styles.sendTitle}>Receive USDT</Text>
              <TouchableOpacity onPress={() => setShowReceiveModal(false)}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>
            <Text style={styles.recoveryWarning}>Only send Sepolia test tokens to this address.</Text>
            <Text selectable style={styles.receiveAddress}>{wallet?.address || 'Unlock your WDK wallet to view its address.'}</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={showSendModal} transparent animationType="slide" onRequestClose={() => setShowSendModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sendSheet}>
            <View style={styles.sendHeader}>
              <Text style={styles.sendTitle}>{sendStep === 1 ? 'Send USDT' : 'Review transfer'}</Text>
              <TouchableOpacity onPress={() => { setShowSendModal(false); setSendStep(1); setErrorMsg(''); }}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>
            {sendStep === 1 ? <>
              <Text style={styles.sendLabel}>Recipient address or username</Text>
              <TextInput style={styles.sendInput} value={recipient} onChangeText={setRecipient} placeholder="0x… or username" autoCapitalize="none" />
              <Text style={styles.sendLabel}>Amount (USDT)</Text>
              <TextInput style={styles.sendInput} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
              <Text style={styles.sendLabel}>Note (optional)</Text>
              <TextInput style={styles.sendInput} value={note} onChangeText={setNote} placeholder="What is this for?" />
              <TouchableOpacity style={styles.sendPrimaryBtn} onPress={handleReviewSend}><Text style={styles.sendPrimaryText}>Review transfer</Text></TouchableOpacity>
            </> : <>
              <Text style={styles.reviewCopy}>Send ${Number(amount || 0).toFixed(2)} USDT to</Text>
              <Text style={styles.reviewRecipient}>{recipient}</Text>
              <Text style={styles.reviewCopy}>A network fee may apply. Check the recipient before confirming.</Text>
              {errorMsg ? <Text style={styles.sendError}>{errorMsg}</Text> : null}
              <TouchableOpacity style={styles.sendPrimaryBtn} onPress={handleExecuteSend} disabled={isSending}>
                {isSending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sendPrimaryText}>Confirm and send</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBackBtn} onPress={() => { setSendStep(1); setErrorMsg(''); }}><Text style={styles.sendBackText}>Back</Text></TouchableOpacity>
            </>}
            {sendStep === 1 && errorMsg ? <Text style={styles.sendError}>{errorMsg}</Text> : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={styles.scannerScreen}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.scannerHeader}>
            <TouchableOpacity style={styles.scannerClose} onPress={() => setShowScanner(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scan a QR code</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.scanFrameWrap} pointerEvents="none"><View style={styles.scanFrame} /></View>
          <Text style={styles.scannerHint}>Place the QR code inside the frame</Text>
        </View>
      </Modal>

      
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
              <Text style={styles.assetRowName}>Tether USD</Text>
              <Text style={styles.assetRowSub}>USDT on Sepolia</Text>
            </View>
            <View style={styles.assetRowValues}>
            <Text style={styles.assetRowAmount}>
              {formattedUsdtBalance == null ? 'Unavailable' : `${formattedUsdtBalance} USDT`}
            </Text>
              <Text style={styles.assetRowChange}>Stablecoin</Text>
            </View>
          </View>
        </View>
      </View>

      
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.transactionContainer}>
          {transactions.map((transaction, index) => {
            const sent = transaction.type === 'p2p_transfer' || transaction.type === 'transfer';
            const from = transaction.senderUserId === wallet?.userId ? 'You' : (transaction.senderUserId || 'External');
            const to = sent ? (transaction.recipientAddress || 'Recipient') : (wallet?.address || 'You');
            const dateValue = transaction.timestamp || transaction.createdAt;
            const isLast = index === transactions.length - 1;
            
            return (
              <View key={transaction.id || transaction.txHash} style={[styles.transactionItem, isLast && { borderBottomWidth: 0 }]}>
                <View style={[styles.txIconBox, sent ? { backgroundColor: '#FEF2F2' } : { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name={sent ? "arrow-up" : "arrow-down"} size={16} color={sent ? "#DC2626" : "#059669"} />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>{sent ? `Sent to ${to.slice(0,8)}` : `Received from ${from.slice(0,8)}`}</Text>
                  <Text style={styles.txDate}>{dateValue ? new Date(dateValue).toLocaleDateString() : 'Pending'} • {transaction.status}</Text>
                </View>
              </View>
            );
          })}
          {!transactions.length && (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
              <Text style={styles.emptyTransactions}>No recent transactions.</Text>
            </View>
          )}
        </View>
      </View>

      
      
    </ScrollView>
  );
}

function formatUsdtBalance(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    return null;
  }

  const [whole, fraction = ''] = value.split('.');
  let cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  if (fraction.charAt(2) >= '5') cents += 1n;
  const displayedWhole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const displayedCents = (cents % 100n).toString().padStart(2, '0');
  return `${displayedWhole}.${displayedCents}`;
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
  portfolioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  portfolioLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.5 },
  sepoliaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
  sepoliaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },
  sepoliaText: { fontSize: 10, fontWeight: '800', color: '#34D399', letterSpacing: 0.5 },
  
  balanceContainer: { flexDirection: 'row', alignItems: 'flex-start' },
  balanceCurrency: { fontSize: 24, fontWeight: '700', color: '#94A3B8', marginTop: 4, marginRight: 4 },
  balanceAmount: { fontSize: 44, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1.5 },
  
  profitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  profitPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4 },
  profitText: { fontSize: 13, fontWeight: '700', color: '#34D399' },
  profitTimeframe: { fontSize: 13, fontWeight: '500', color: '#64748B' },

  addressBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 24, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, borderRadius: 16 },
  addressValue: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#E2E8F0', fontWeight: '500', flex: 1 },
  copyBtn: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 8, borderRadius: 10 },

  /* --- 2. FLOATING QUICK ACTIONS --- */
  actionGrid: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 8, marginTop: 20, marginBottom: 20, marginHorizontal: 10, justifyContent: 'space-between' },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 8 },
  actionIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  walletStatusCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 18, padding: 16, marginHorizontal: 10, marginTop: 16 },
  walletStatusText: { color: '#334155', fontSize: 13, lineHeight: 19 },
  walletActionButton: { backgroundColor: '#0F172A', borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16, marginTop: 12 },
  walletActionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  walletActionError: { color: '#DC2626', fontSize: 12, lineHeight: 18, marginTop: 10 },
  recoveryWarning: { color: '#475569', fontSize: 14, lineHeight: 21, marginBottom: 14 },
  recoveryPhrase: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1', color: '#0F172A', fontSize: 16, fontWeight: '700', lineHeight: 28, padding: 16, textAlign: 'center' },
  recoveryCheck: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  recoveryCheckText: { color: '#334155', flex: 1, fontSize: 13, lineHeight: 19 },
  disabledButton: { opacity: 0.5 },
  receiveAddress: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1', color: '#0F172A', fontSize: 14, lineHeight: 22, padding: 16 },
  
  moreActionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF' },
  moreActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  moreActionText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  scannerScreen: { flex: 1, backgroundColor: '#0A0F1C', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 60 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  sendSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  sendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  sendTitle: { fontSize: 21, fontWeight: '800', color: '#0F172A' },
  sendLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  sendInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: '#0F172A', marginBottom: 16 },
  sendPrimaryBtn: { backgroundColor: '#0F172A', borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 8 },
  sendPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  sendError: { color: '#DC2626', fontSize: 13, marginTop: 10 },
  reviewCopy: { color: '#64748B', fontSize: 14, lineHeight: 21, marginBottom: 8 },
  reviewRecipient: { color: '#0F172A', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  sendBackBtn: { alignItems: 'center', padding: 14 },
  sendBackText: { color: '#334155', fontSize: 14, fontWeight: '700' },
  scannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  scannerClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  scannerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  scanFrameWrap: { alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 250, height: 250, borderColor: '#00E676', borderWidth: 3, borderRadius: 24, backgroundColor: 'transparent' },
  scannerHint: { color: '#FFFFFF', textAlign: 'center', fontSize: 15, fontWeight: '600', marginHorizontal: 32 },

  /* --- 3. SECTIONS & ASSETS LIST --- */
  section: { marginTop: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  sectionLink: { fontSize: 14, fontWeight: '700', color: '#3B82F6' },
  
  assetListContainer: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E8EDF3', ...Platform.select({ ios: { shadowColor: '#1E293B', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 14 }, android: { elevation: 3 } }) },
  assetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  assetRowIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  assetRowInfo: { flex: 1 },
  assetRowName: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  assetRowSub: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  assetRowValues: { alignItems: 'flex-right' },
  assetRowAmount: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4, textAlign: 'right' },
  assetRowChange: { fontSize: 12, fontWeight: '600', color: '#64748B', textAlign: 'right' },

  /* --- 4. TRANSACTIONS --- */
  refreshBtn: { backgroundColor: '#F1F5F9', padding: 8, borderRadius: 10 },
  transactionContainer: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#E8EDF3', ...Platform.select({ ios: { shadowColor: '#1E293B', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 14 }, android: { elevation: 3 } }) },
  transactionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  txIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  txDate: { fontSize: 12, color: '#64748B', fontWeight: '500', textTransform: 'capitalize' },
  emptyState: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTransactions: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
});
