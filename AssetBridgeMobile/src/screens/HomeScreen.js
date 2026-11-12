import React, { useState } from 'react';
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
} from 'react-native';
import { mobileWalletService } from '../services/walletService';
import { mobileClaimService } from '../services/claimService';

export default function HomeScreen({ wallet, onRefresh, onTransfer, onFaucet, onNavigate }) {
  // Modals state
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

  // Send USDT flow
  const [sendStep, setSendStep] = useState(1); // 1: input, 2: review, 3: receipt
  const [recipient, setRecipient] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('50');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);

  // Send to Gogo (WhatsApp Escrow Link)
  const [claimZar, setClaimZar] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [activeClaim, setActiveClaim] = useState(null);
  const [isCreatingClaim, setIsCreatingClaim] = useState(false);
  const [isSimulatingClaim, setIsSimulatingClaim] = useState(false);

  // Copy success indicator
  const [copied, setCopied] = useState(false);

  const savedRecipients = mobileWalletService.getSavedRecipients();
  const usdtBalance = wallet ? Number(wallet.balanceUsdt || 0) : null;

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openSendToRecipient = (rec) => {
    setRecipient(rec.identifier);
    setRecipientName(rec.name);
    setAmount('');
    setNote('');
    setSendStep(1);
    setShowSendModal(true);
  };

  const handleReviewSend = () => {
    setErrorMsg('');
    const num = Number(amount);
    if (!recipient.trim()) {
      setErrorMsg('Please enter a recipient address or username.');
      return;
    }
    if (!num || num <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }
    if (!wallet) {
      setErrorMsg('Sign in and connect your wallet to request a live balance and fee quote.');
      return;
    }
    if (usdtBalance === null) {
      setErrorMsg('A live network balance is unavailable. No payment can be prepared.');
      return;
    }
    setSendStep(2);
  };

  const handleExecuteSend = async () => {
    setIsSending(true);
    const num = Number(amount);
    try {
      const result = await onTransfer({
        recipient,
        amount: num,
        note,
      });
      const txHash = result?.transaction?.txHash;
      if (!txHash) throw new Error('Payment service returned no transaction hash. No receipt can be shown.');

      const receipt = {
        amount: num,
        recipient: recipientName || recipient,
        feeUsdt: result.transaction.feeUsdt,
        txHash,
        timestamp: new Date().toLocaleTimeString(),
      };

      setLastReceipt(receipt);
      setSendStep(3);
    } catch (err) {
      setErrorMsg(err.message || 'Transfer failed.');
      setSendStep(1);
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateClaim = async () => {
    setIsCreatingClaim(true);
    const numZar = Number(claimZar) || 400;
    const numUsdt = Math.round((numZar / 20.0) * 100) / 100;

    try {
      const claim = await mobileClaimService.createClaimLink({
        senderUserId: wallet?.userId,
        senderName: wallet?.ownerName,
        amountZar: numZar,
        amountUsdt: numUsdt,
        recipientName: claimName,
        recipientPhone: claimPhone,
        note: 'Sunday groceries & lunch',
      });

      setActiveClaim(claim);
    } catch (err) {
      Alert.alert('Escrow Lock Error', err.message || 'Failed to create claim link.');
    } finally {
      setIsCreatingClaim(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!activeClaim) return;
    try {
      await Share.share({ message: activeClaim.whatsappMessage });
    } catch {
      //
    }
  };

  const handleSimulateClaim = async () => {
    if (!activeClaim) return;
    setIsSimulatingClaim(true);
    try {
      await mobileClaimService.simulateGogoClaim(activeClaim.id);
    } catch (err) {
      Alert.alert('Claim unavailable', err.message);
    } finally {
      setIsSimulatingClaim(false);
    }
  };

  const handleRefundClaim = async () => {
    if (!activeClaim) return;
    try {
      await mobileClaimService.refundClaimLink({
        claimId: activeClaim.id,
        senderUserId: wallet?.userId,
      });
      setActiveClaim((prev) => ({ ...prev, status: 'refunded' }));
      Alert.alert('Refund Complete', `R${activeClaim.amountZar} ($${activeClaim.amountUsdt} USDT) refunded to your balance.`);
    } catch (err) {
      Alert.alert('Refund Failed', err.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. LUXURIOUS PORTFOLIO CARD (Matches Web Dashboard) */}
      <View style={styles.portfolioCard}>
        <View style={styles.portfolioHeader}>
          <Text style={styles.portfolioLabel}>TESTNET WALLET STATUS</Text>
          <View style={styles.sepoliaBadge}>
            <View style={styles.sepoliaDot} />
            <Text style={styles.sepoliaText}>SEPOLIA EVM</Text>
          </View>
        </View>

        {/* Balance & 24h Change */}
        <View style={styles.balanceRow}>
          <Text style={styles.balanceAmount}>{usdtBalance === null ? 'Balance unavailable' : `$${usdtBalance.toFixed(2)}`}</Text>
        </View>

        {/* Truncated Sepolia Address & Faucet */}
        <View style={styles.addressAndFaucetRow}>
          <TouchableOpacity style={styles.addressBox} onPress={handleCopy}>
            <Text style={styles.addressLabel}>Tether Addr: </Text>
            <Text style={styles.addressValue} numberOfLines={1}>
              {wallet?.address ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}` : 'Wallet not connected'}
            </Text>
            <Text style={styles.copyIcon}>{copied ? '✓' : '📋'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.faucetBtn} onPress={onFaucet}>
            <Text style={styles.faucetBtnText}>Faucet unavailable</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerSettlementText}>Test network balances are shown only when fetched from the connected wallet.</Text>
      </View>

      {/* 2. QUICK ACTIONS (2x2 Grid Matching Web Pastel Colors) */}
      <View style={styles.quickGrid}>
        {/* Action 1: Send USDT (Emerald) */}
        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: '#E5F9F0', borderColor: '#A7F3D0' }]}
          onPress={() => {
            setSendStep(1);
            setShowSendModal(true);
          }}
        >
          <View style={[styles.quickIconBox, { backgroundColor: '#D1FAE5' }]}>
            <Text style={{ fontSize: 20 }}>↑</Text>
          </View>
          <Text style={[styles.quickTitle, { color: '#065F46' }]}>Send USDT</Text>
          <Text style={styles.quickSub}>Connect wallet to enable</Text>
        </TouchableOpacity>

        {/* Action 2: Receive QR (Blue) */}
        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: '#EAF3FF', borderColor: '#BAE6FD' }]}
          onPress={() => setShowReceiveModal(true)}
        >
          <View style={[styles.quickIconBox, { backgroundColor: '#E0F2FE' }]}>
            <Text style={{ fontSize: 20 }}>↓</Text>
          </View>
          <Text style={[styles.quickTitle, { color: '#0369A1' }]}>Receive QR</Text>
          <Text style={styles.quickSub}>Deposit Tether</Text>
        </TouchableOpacity>

        {/* Action 3: Send to Gogo via WhatsApp (Warm Amber - Zero Crypto) */}
        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
          onPress={() => {
            setActiveClaim(null);
            setShowClaimModal(true);
          }}
        >
          <View style={[styles.quickIconBox, { backgroundColor: '#FEF3C7' }]}>
            <Text style={{ fontSize: 20 }}>👵</Text>
          </View>
          <Text style={[styles.quickTitle, { color: '#92400E' }]}>Send via WhatsApp</Text>
          <Text style={styles.quickSub}>Gogo Flow (Rand)</Text>
        </TouchableOpacity>

        {/* Action 4: Send Home / Remit (Purple) */}
        <TouchableOpacity
          style={[styles.quickCard, { backgroundColor: '#F3EBFF', borderColor: '#E9D5FF' }]}
          onPress={() => onNavigate('remittance')}
        >
          <View style={[styles.quickIconBox, { backgroundColor: '#EDE9FE' }]}>
            <Text style={{ fontSize: 20 }}>🌍</Text>
          </View>
          <Text style={[styles.quickTitle, { color: '#6B21A8' }]}>Send Home</Text>
          <Text style={styles.quickSub}>Not connected</Text>
        </TouchableOpacity>
      </View>

      {/* 3. SEND TO FAMILY & FREQUENT CONTACTS */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>👨‍👩‍👧 Send to Family & Frequent Contacts</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipientsRow}>
          {savedRecipients.map((rec) => (
            <TouchableOpacity
              key={rec.id}
              style={styles.recipientCard}
              onPress={() => openSendToRecipient(rec)}
            >
              <View style={styles.recipientAvatar}>
                <Text style={{ fontSize: 24 }}>{rec.avatar}</Text>
              </View>
              <Text style={styles.recipientName} numberOfLines={1}>{rec.name}</Text>
              <Text style={styles.recipientLocation}>{rec.location}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 4. YOUR ASSETS (Glass Cards Matching Web) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Assets</Text>
          <TouchableOpacity onPress={() => onNavigate('markets')}>
            <Text style={styles.sectionLink}>View Markets →</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.activityDetail}>Only verified assets from the connected wallet will appear here.</Text>
      </View>

      {/* 5. RECENT ACTIVITY LEDGER */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.sectionLink}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.activityDetail}>No verified transaction history is connected.</Text>
      </View>

      {/* MODAL 1: SEND USDT (VICTOR'S 5-STEP PAYMENT FLOW) */}
      <Modal visible={showSendModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {sendStep === 1 && (
              <>
                <Text style={styles.stepBadge}>STEP 1 & 2 OF 5: RECIPIENT & BALANCE CHECK</Text>
                <Text style={styles.modalTitle}>Send Tether (USDT)</Text>
                <Text style={styles.modalSub}>Instant settlement on Ethereum Sepolia Testnet</Text>

                {errorMsg ? <Text style={styles.errorBanner}>{errorMsg}</Text> : null}

                <Text style={styles.inputLabel}>Recipient Address or Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="thandi@assetbridge.africa or 0x..."
                  value={recipient}
                  onChangeText={(val) => {
                    setRecipient(val);
                    setRecipientName('');
                  }}
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>Amount (USDT)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />

                <Text style={styles.inputLabel}>Note (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Groceries, school fees, etc."
                  value={note}
                  onChangeText={setNote}
                />

                <View style={styles.modalActionRow}>
                  <TouchableOpacity style={[styles.modalBtn, styles.btnCancel]} onPress={() => setShowSendModal(false)}>
                    <Text style={styles.btnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.btnConfirm]} onPress={handleReviewSend}>
                    <Text style={styles.btnConfirmText}>Review Fee Quote →</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {sendStep === 2 && (
              <>
                <Text style={styles.stepBadge}>STEP 3 OF 5: REVIEW & APPROVAL</Text>
                <Text style={styles.modalTitle}>Confirm Tether Transaction</Text>
                <Text style={styles.modalSub}>A live network fee quote is not connected. Payment approval is unavailable.</Text>

                <View style={styles.reviewCard}>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewKey}>Recipient</Text>
                    <Text style={styles.reviewVal}>{recipientName || recipient}</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewKey}>Network</Text>
                    <Text style={styles.reviewVal}>Ethereum Sepolia (ChainID: 11155111)</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewKey}>Transfer Amount</Text>
                    <Text style={[styles.reviewVal, { color: '#00C29A', fontWeight: '900' }]}>${Number(amount).toFixed(2)} USDT</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewKey}>Network Gas Fee</Text>
                    <Text style={styles.reviewVal}>Unavailable</Text>
                  </View>
                  <View style={[styles.reviewRow, { borderBottomWidth: 0, paddingTop: 10 }]}>
                    <Text style={[styles.reviewKey, { fontWeight: '800', color: '#0F172A' }]}>Total Required</Text>
                    <Text style={[styles.reviewVal, { fontSize: 16, fontWeight: '900', color: '#0F172A' }]}>Unavailable</Text>
                  </View>
                </View>

                <View style={styles.modalActionRow}>
                  <TouchableOpacity style={[styles.modalBtn, styles.btnCancel]} onPress={() => setSendStep(1)} disabled={isSending}>
                    <Text style={styles.btnCancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.btnConfirm]} onPress={handleExecuteSend} disabled={isSending}>
                    {isSending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnConfirmText}>Authorize & Sign</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {sendStep === 3 && lastReceipt && (
              <>
                <Text style={styles.stepBadge}>TRANSACTION SUBMITTED</Text>
                <Text style={styles.modalTitle}>⏳ Payment Pending</Text>
                <Text style={styles.modalSub}>Settled on Ethereum Sepolia Testnet</Text>

                <View style={styles.receiptBox}>
                  <Text style={styles.receiptAmount}>-${lastReceipt.amount.toFixed(2)} USDT</Text>
                  <Text style={styles.receiptTo}>Sent to {lastReceipt.recipient}</Text>
                  <Text style={styles.receiptHash} numberOfLines={1}>Tx: {lastReceipt.txHash}</Text>
                </View>

                <TouchableOpacity style={styles.btnDone} onPress={() => setShowSendModal(false)}>
                  <Text style={styles.btnDoneText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 2: RECEIVE TETHER QR */}
      <Modal visible={showReceiveModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Receive Tether (USDT)</Text>
            <Text style={styles.modalSub}>Scan QR code or share your Sepolia deposit address</Text>

            <View style={styles.qrCard}>
              <Text style={{ fontSize: 60 }}>📱</Text>
              <Text style={styles.qrTitle}>Tether USDT Deposit</Text>
              <Text style={styles.qrNetwork}>Network: Ethereum Sepolia</Text>
            </View>

            <Text style={styles.qrAddressText}>{wallet?.address || '0x4f0b...e09f'}</Text>

            <TouchableOpacity style={styles.btnDone} onPress={() => setShowReceiveModal(false)}>
              <Text style={styles.btnDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: SEND TO GOGO (WHATSAPP ESCROW CLAIM - ZERO CRYPTO) */}
      <Modal visible={showClaimModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {!activeClaim ? (
              <>
                <Text style={styles.stepBadge}>WHATSAPP ESCROW CLAIM (ZERO CRYPTO)</Text>
                <Text style={styles.modalTitle}>Send to Gogo via WhatsApp</Text>
                <Text style={styles.modalSub}>
                  Recipient gets a WhatsApp link, enters phone & SMS code, and receives Rand. No app to install!
                </Text>

                <Text style={styles.inputLabel}>Recipient Name</Text>
                <TextInput
                  style={styles.input}
                  value={claimName}
                  onChangeText={setClaimName}
                  placeholder="e.g. Gogo"
                />

                <Text style={styles.inputLabel}>Mobile Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={claimPhone}
                  onChangeText={setClaimPhone}
                  placeholder="+27 82 555 0192"
                  keyboardType="phone-pad"
                />

                <Text style={styles.inputLabel}>Amount to Send (South African Rand - ZAR)</Text>
                <TextInput
                  style={styles.input}
                  value={claimZar}
                  onChangeText={setClaimZar}
                  placeholder="400"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.claimNote}>
                  Locks ${(Number(claimZar) / 20.0).toFixed(2)} USDT in Escrow Claim Contract (+ $0.20 network gas).
                </Text>

                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.btnCancel]}
                    onPress={() => setShowClaimModal(false)}
                    disabled={isCreatingClaim}
                  >
                    <Text style={styles.btnCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#D97706' }]}
                    onPress={handleCreateClaim}
                    disabled={isCreatingClaim}
                  >
                    {isCreatingClaim ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnConfirmText}>Lock & Generate Link</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.stepBadge}>ESCROW CONTRACT ACTIVE</Text>
                <Text style={styles.modalTitle}>Nomsa sent R{activeClaim.amountZar} to {activeClaim.recipientName}</Text>
                <Text style={styles.modalSub}>Share the link below via WhatsApp:</Text>

                <View style={styles.whatsappBox}>
                  <Text style={styles.whatsappText}>{activeClaim.whatsappMessage}</Text>
                </View>

                {/* Status Indicator */}
                <View style={{ width: '100%', marginVertical: 8 }}>
                  {activeClaim.status === 'waiting' && (
                    <View style={styles.waitingPill}>
                      <ActivityIndicator size="small" color="#B45309" />
                      <Text style={styles.waitingPillText}>Waiting for {activeClaim.recipientName} to claim (R{activeClaim.amountZar} held safely)</Text>
                    </View>
                  )}

                  {activeClaim.status === 'claimed' && (
                    <View style={styles.claimedPill}>
                      <Text style={styles.claimedPillTitle}>🎉 CLAIMED BY {activeClaim.recipientName.toUpperCase()}!</Text>
                      <Text style={styles.claimedPillSub}>R{activeClaim.amountZar} released to her new custodial phone account</Text>
                      <Text style={styles.claimedPillHash}>Ref: {activeClaim.claimedTxHash?.slice(0, 16)}...</Text>
                    </View>
                  )}

                  {activeClaim.status === 'refunded' && (
                    <View style={styles.refundedPill}>
                      <Text style={styles.refundedPillText}>↩️ Link Cancelled · Funds returned to your wallet</Text>
                    </View>
                  )}
                </View>

                <View style={{ width: '100%', gap: 8 }}>
                  <TouchableOpacity style={styles.btnWhatsApp} onPress={handleShareWhatsApp}>
                    <Text style={styles.btnWhatsAppText}>📲 Share on WhatsApp</Text>
                  </TouchableOpacity>

                  {activeClaim.status === 'waiting' && (
                    <TouchableOpacity
                      style={styles.btnSimulate}
                      onPress={handleSimulateClaim}
                      disabled={isSimulatingClaim}
                    >
                      {isSimulatingClaim ? (
                        <ActivityIndicator color="#78350F" size="small" />
                      ) : (
                        <Text style={styles.btnSimulateText}>Claim flow unavailable</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {activeClaim.status === 'waiting' && (
                    <TouchableOpacity style={styles.btnRefund} onPress={handleRefundClaim}>
                      <Text style={styles.btnRefundText}>Return to me (Cancel Link)</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.btnDone} onPress={() => setShowClaimModal(false)}>
                    <Text style={styles.btnDoneText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 32 },

  // 1. Luxurious Portfolio Card
  portfolioCard: {
    backgroundColor: '#101936',
    borderRadius: 28,
    padding: 22,
    shadowColor: '#101936',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  portfolioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  portfolioLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.8 },
  sepoliaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 194, 154, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 194, 154, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sepoliaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00C29A', marginRight: 5 },
  sepoliaText: { fontSize: 10, fontWeight: '800', color: '#5EEAD4' },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 14 },
  balanceAmount: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  changePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  changeText: { fontSize: 12, fontWeight: '800', color: '#6EE7B7' },
  addressAndFaucetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    flex: 1,
  },
  addressLabel: { fontSize: 11, color: '#5EEAD4', fontWeight: '700' },
  addressValue: { fontSize: 11, fontFamily: 'monospace', color: '#CBD5E1', flex: 1 },
  copyIcon: { fontSize: 12, marginLeft: 4, color: '#94A3B8' },
  faucetBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  faucetBtnText: { color: '#FCD34D', fontSize: 11, fontWeight: '800' },
  trendContainer: { marginTop: 18 },
  trendLineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  trendLabel: { fontSize: 11, fontWeight: '700', color: '#E2E8F0' },
  trendSub: { fontSize: 10, color: '#5EEAD4', fontFamily: 'monospace' },
  trendBarTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  trendBarFill: { height: '100%', backgroundColor: '#38BDF8', borderRadius: 2 },
  portfolioFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 16,
    paddingTop: 12,
  },
  footerAssetsText: { fontSize: 11, color: '#CBD5E1', fontWeight: '600' },
  footerSettlementText: { fontSize: 11, color: '#6EE7B7', fontWeight: '700' },

  // 2. Quick Actions Grid
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  quickCard: {
    width: '48%',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  quickIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  quickTitle: { fontSize: 14, fontWeight: '800' },
  quickSub: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // 3. Sections & Cards
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  sectionLink: { fontSize: 12, fontWeight: '700', color: '#00C29A' },
  recipientsRow: { flexDirection: 'row' },
  recipientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    marginRight: 10,
    alignItems: 'center',
    width: 110,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recipientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  recipientName: { fontSize: 11, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  recipientLocation: { fontSize: 9, color: '#64748B', textAlign: 'center', marginTop: 2 },

  // 4. Assets
  assetsGrid: { gap: 10 },
  assetCard: { borderRadius: 18, padding: 14, borderWidth: 1 },
  assetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  assetIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  assetTypeBadge: { fontSize: 9, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  assetName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  assetAmount: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginVertical: 2 },
  assetSub: { fontSize: 10, color: '#64748B' },

  // 5. Activity Ledger
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  activityIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  activityDetail: { fontSize: 10, color: '#64748B', marginTop: 2 },
  activityAmount: { fontSize: 13, fontWeight: '800', color: '#0F172A' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 },
  stepBadge: { fontSize: 9, fontWeight: '900', color: '#00C29A', letterSpacing: 0.8 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginTop: 4 },
  modalSub: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 14 },
  errorBanner: { backgroundColor: '#FEE2E2', color: '#991B1B', padding: 8, borderRadius: 10, fontSize: 11, marginBottom: 10 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#334155', marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0F172A' },
  claimNote: { fontSize: 11, color: '#64748B', marginTop: 4 },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnCancel: { backgroundColor: '#F1F5F9' },
  btnCancelText: { color: '#475569', fontWeight: '700', fontSize: 12 },
  btnConfirm: { backgroundColor: '#00C29A' },
  btnConfirmText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  reviewCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginVertical: 12 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  reviewKey: { fontSize: 11, color: '#64748B' },
  reviewVal: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  receiptBox: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 18, alignItems: 'center', marginVertical: 14 },
  receiptAmount: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  receiptTo: { fontSize: 12, color: '#64748B', marginTop: 2 },
  receiptHash: { fontSize: 10, fontFamily: 'monospace', color: '#00C29A', marginTop: 8 },
  btnDone: { backgroundColor: '#00C29A', paddingVertical: 12, borderRadius: 14, alignItems: 'center', width: '100%', marginTop: 8 },
  btnDoneText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  qrCard: { backgroundColor: '#F8FAFC', borderRadius: 18, padding: 20, alignItems: 'center', marginVertical: 14 },
  qrTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 8 },
  qrNetwork: { fontSize: 11, color: '#64748B', marginTop: 2 },
  qrAddressText: { fontSize: 11, fontFamily: 'monospace', color: '#334155', textAlign: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, marginBottom: 10 },

  // Gogo WhatsApp Elements
  whatsappBox: { backgroundColor: '#DCF8C6', borderColor: '#C5E1A5', borderWidth: 1, borderRadius: 14, padding: 12, marginVertical: 10, width: '100%' },
  whatsappText: { fontSize: 11, color: '#1B5E20', lineHeight: 16, fontWeight: '500' },
  waitingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 12 },
  waitingPillText: { fontSize: 10, fontWeight: '700', color: '#B45309', flex: 1 },
  claimedPill: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, padding: 12, borderRadius: 14, alignItems: 'center' },
  claimedPillTitle: { fontSize: 12, fontWeight: '900', color: '#065F46' },
  claimedPillSub: { fontSize: 10, color: '#047857', marginTop: 2 },
  claimedPillHash: { fontSize: 9, fontFamily: 'monospace', color: '#059669', marginTop: 2 },
  refundedPill: { backgroundColor: '#F1F5F9', padding: 10, borderRadius: 12, alignItems: 'center' },
  refundedPillText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  btnWhatsApp: { backgroundColor: '#25D366', paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  btnWhatsAppText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  btnSimulate: { backgroundColor: '#FDE68A', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  btnSimulateText: { color: '#78350F', fontWeight: '800', fontSize: 11 },
  btnRefund: { backgroundColor: '#F1F5F9', paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
  btnRefundText: { color: '#64748B', fontWeight: '700', fontSize: 10 },
});

