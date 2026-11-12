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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mobileWalletService } from '../services/walletService';
import { mobileClaimService } from '../services/claimService';

export default function HomeScreen({ wallet, onRefresh, onTransfer, onFaucet, onNavigate }) {
  // Modals state
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [transactions, setTransactions] = useState([]);

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
  const [claimZar, setClaimZar] = useState('400');
  const [claimName, setClaimName] = useState('Gogo');
  const [claimPhone, setClaimPhone] = useState('+27 82 555 0192');
  const [activeClaim, setActiveClaim] = useState(null);
  const [isCreatingClaim, setIsCreatingClaim] = useState(false);
  const [isSimulatingClaim, setIsSimulatingClaim] = useState(false);

  // Copy success indicator
  const [copied, setCopied] = useState(false);

  const savedRecipients = mobileWalletService.getSavedRecipients();
  const usdtBalance = wallet ? Number(wallet.balanceUsdt || 0) : 1000.0;
  const portfolioTotalUsd = usdtBalance + 1.25 * 236.40 + 12950 / 129.50; // mirrors web dashboard

  useEffect(() => {
    let active = true;
    mobileWalletService.getTransactions(wallet?.userId).then((items) => {
      if (active) setTransactions(items || []);
    });
    return () => { active = false; };
  }, [wallet?.userId, wallet?.balanceUsdt]);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openSendToRecipient = (rec) => {
    setRecipient(rec.identifier);
    setRecipientName(rec.name);
    setAmount('25');
    setNote(rec.recentNote || 'Family support');
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
    if (num + 0.2 > usdtBalance) {
      setErrorMsg(`Insufficient balance. Required: $${(num + 0.2).toFixed(2)} USDT ($0.20 fee), Available: $${usdtBalance.toFixed(2)} USDT`);
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

      const receipt = {
        amount: num,
        recipient: recipientName || recipient,
        feeUsdt: 0.2,
        txHash: result?.transaction?.txHash || `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
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
      await onTransfer({
        recipient: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
        amount: numUsdt,
        note: `Escrow claim contract: R${numZar} to ${claimName}`,
      });

      const claim = await mobileClaimService.createClaimLink({
        senderUserId: wallet?.userId || 'malulekelucas04@gmail.com',
        senderName: 'Nomsa (Lucas)',
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
    setTimeout(async () => {
      const res = await mobileClaimService.simulateGogoClaim(activeClaim.id);
      setActiveClaim((prev) => ({
        ...prev,
        status: 'claimed',
        claimedTxHash: res.claimedTxHash,
        claimedAt: new Date().toLocaleTimeString(),
      }));
      setIsSimulatingClaim(false);
    }, 1500);
  };

  const handleRefundClaim = async () => {
    if (!activeClaim) return;
    try {
      await mobileClaimService.refundClaimLink({
        claimId: activeClaim.id,
        senderUserId: wallet?.userId || 'malulekelucas04@gmail.com',
      });
      await onFaucet();
      setActiveClaim((prev) => ({ ...prev, status: 'refunded' }));
      Alert.alert('Refund Complete', `R${activeClaim.amountZar} ($${activeClaim.amountUsdt} USDT) refunded to your balance.`);
    } catch (err) {
      Alert.alert('Refund Failed', err.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Wallet overview inspired by the reference; balances remain wallet assets. */}
      <View style={styles.walletHero}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyStrip}>
          {[
            { flag: '🇺🇸', code: 'USD', value: usdtBalance },
            { flag: '🇪🇺', code: 'EUR', value: usdtBalance * 0.92 },
            { flag: '🇦🇺', code: 'AUD', value: usdtBalance * 1.52 },
          ].map((asset) => (
            <View key={asset.code} style={styles.currencyAsset}>
              <Text style={styles.currencyFlag}>{asset.flag}</Text>
              <View><Text style={styles.currencyCode}>{asset.code}</Text><Text style={styles.currencyValue}>{asset.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></View>
            </View>
          ))}
        </ScrollView>
        <Text style={styles.portfolioLabel}>TOTAL PORTFOLIO VALUE</Text>
        <Text style={styles.balanceAmount}>${portfolioTotalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        <View style={styles.heroUtilityRow}>
          <TouchableOpacity style={styles.addressBox} onPress={handleCopy} accessibilityLabel="Copy wallet address">
            <Ionicons name="copy-outline" size={15} color="#D7E6FF" />
            <Text style={styles.addressValue} numberOfLines={1}>{wallet?.address ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}` : 'Wallet loading'}</Text>
            <Text style={styles.copyIcon}>{copied ? 'Copied' : ''}</Text>
          </TouchableOpacity>
          <View style={styles.sepoliaBadge}><View style={styles.sepoliaDot} /><Text style={styles.sepoliaText}>SEPOLIA</Text></View>
        </View>
      </View>

      <View style={styles.actionGrid}>
        {[
          { label: 'Add', icon: 'add', action: onFaucet },
          { label: 'Send', icon: 'arrow-up', action: () => { setSendStep(1); setShowSendModal(true); } },
          { label: 'Convert', icon: 'swap-horizontal', action: () => onNavigate('markets') },
          { label: 'More', icon: 'ellipsis-horizontal', action: () => setShowMoreActions((open) => !open) },
        ].map((item) => <TouchableOpacity key={item.label} style={styles.primaryAction} onPress={item.action}><Ionicons name={item.icon} size={21} color="#101936" /><Text style={styles.primaryActionText}>{item.label}</Text></TouchableOpacity>)}
      </View>
      {showMoreActions && <View style={styles.moreActions}>
        <TouchableOpacity style={styles.moreAction} onPress={() => setShowReceiveModal(true)}><Ionicons name="qr-code-outline" size={18} color="#101936" /><Text style={styles.moreActionText}>Receive QR</Text></TouchableOpacity>
        <TouchableOpacity style={styles.moreAction} onPress={() => { setActiveClaim(null); setShowClaimModal(true); }}><Ionicons name="chatbubble-ellipses-outline" size={18} color="#101936" /><Text style={styles.moreActionText}>Send via WhatsApp</Text></TouchableOpacity>
        <TouchableOpacity style={styles.moreAction} onPress={() => onNavigate('remittance')}><Ionicons name="globe-outline" size={18} color="#101936" /><Text style={styles.moreActionText}>Send Home</Text></TouchableOpacity>
      </View>}

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

        <View style={styles.assetsGrid}>
          {/* Asset 1: Tether USD */}
          <View style={[styles.assetCard, { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' }]}>
            <View style={styles.assetHeader}>
              <View style={[styles.assetIconBox, { backgroundColor: '#A7F3D0' }]}>
                <Text style={{ fontSize: 18, color: '#047857', fontWeight: '900' }}>$</Text>
              </View>
              <Text style={[styles.assetTypeBadge, { color: '#047857', backgroundColor: '#D1FAE5' }]}>Tether Stablecoin</Text>
            </View>
            <Text style={styles.assetName}>Tether USD (tUSDT)</Text>
            <Text style={styles.assetAmount}>${usdtBalance.toFixed(2)}</Text>
            <Text style={styles.assetSub}>Settlement asset · Sepolia EVM</Text>
          </View>

          {/* Asset 2: Apple Tokenized Equity */}
          <View style={[styles.assetCard, { backgroundColor: '#F0F5FF', borderColor: '#E0E7FF' }]}>
            <View style={styles.assetHeader}>
              <View style={[styles.assetIconBox, { backgroundColor: '#C7D2FE' }]}>
                <Text style={{ fontSize: 18, color: '#3730A3', fontWeight: '900' }}></Text>
              </View>
              <Text style={[styles.assetTypeBadge, { color: '#3730A3', backgroundColor: '#E0E7FF' }]}>Tokenised Equity</Text>
            </View>
            <Text style={styles.assetName}>Apple Inc. (tAAPL)</Text>
            <Text style={styles.assetAmount}>1.25 shares</Text>
            <Text style={styles.assetSub}>$295.50 USD · +1.82% today</Text>
          </View>

          {/* Asset 3: Kenyan Shilling FX */}
          <View style={[styles.assetCard, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
            <View style={styles.assetHeader}>
              <View style={[styles.assetIconBox, { backgroundColor: '#FDE68A' }]}>
                <Text style={{ fontSize: 18, color: '#92400E', fontWeight: '900' }}>K</Text>
              </View>
              <Text style={[styles.assetTypeBadge, { color: '#92400E', backgroundColor: '#FEF3C7' }]}>Tokenised Currency</Text>
            </View>
            <Text style={styles.assetName}>Kenyan Shilling (tKES)</Text>
            <Text style={styles.assetAmount}>12,950 KES</Text>
            <Text style={styles.assetSub}>$100.00 USD · 0% FX spread</Text>
          </View>
        </View>
      </View>

      {/* Transaction details and settlement status */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={19} color="#00A987" />
          </TouchableOpacity>
        </View>
        <View style={styles.transactionCard}>
          {transactions.map((transaction) => {
            const sent = transaction.type === 'p2p_transfer' || transaction.type === 'transfer';
            const from = transaction.senderUserId === wallet?.userId ? 'You' : (transaction.senderUserId || 'External wallet');
            const to = sent ? (transaction.recipientAddress || 'Recipient') : (wallet?.address || 'You');
            const dateValue = transaction.timestamp || transaction.createdAt;
            const settlement = transaction.claimedAt || transaction.receivedAt || transaction.settledAt || (transaction.status === 'confirmed' ? dateValue : null);
            return <View key={transaction.id || transaction.txHash} style={styles.transactionRow}>
              <View style={styles.transactionTop}><Text style={styles.transactionDate}>{dateValue ? new Date(dateValue).toLocaleDateString() : '—'}</Text><Text style={[styles.statusPill, transaction.status === 'confirmed' || transaction.status === 'claimed' ? styles.statusComplete : styles.statusPending]}>{transaction.status || 'pending'}</Text></View>
              <View style={styles.transactionParties}><View style={styles.party}><Text style={styles.partyLabel}>FROM</Text><Text style={styles.partyValue} numberOfLines={1}>{from}</Text></View><Ionicons name="arrow-forward" size={15} color="#94A3B8" /><View style={styles.party}><Text style={styles.partyLabel}>TO</Text><Text style={styles.partyValue} numberOfLines={1}>{to}</Text></View></View>
              <Text style={styles.settledAt}>{settlement ? `${transaction.status === 'claimed' ? 'Claimed' : 'Received'} ${new Date(settlement).toLocaleString()}` : 'Received / claimed time: Pending'}</Text>
            </View>;
          })}
          {!transactions.length && <Text style={styles.emptyTransactions}>No transactions yet. Completed transfers will appear here.</Text>}
        </View>
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
                <Text style={styles.modalSub}>Verify recipient and fee quote before signing.</Text>

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
                    <Text style={styles.reviewVal}>$0.20 USDT (~0.00018 ETH)</Text>
                  </View>
                  <View style={[styles.reviewRow, { borderBottomWidth: 0, paddingTop: 10 }]}>
                    <Text style={[styles.reviewKey, { fontWeight: '800', color: '#0F172A' }]}>Total Required</Text>
                    <Text style={[styles.reviewVal, { fontSize: 16, fontWeight: '900', color: '#0F172A' }]}>${(Number(amount) + 0.2).toFixed(2)} USDT</Text>
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
                <Text style={styles.stepBadge}>STEP 5 OF 5: TRANSACTION CONFIRMED</Text>
                <Text style={styles.modalTitle}>✅ Payment Confirmed!</Text>
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
                        <Text style={styles.btnSimulateText}>👵 Simulate Gogo's Phone Claim (Demo)</Text>
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

  walletHero: { backgroundColor: '#101936', borderRadius: 24, padding: 20, overflow: 'hidden' },
  currencyStrip: { flexDirection: 'row', gap: 22, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', paddingBottom: 15, marginBottom: 18 },
  currencyAsset: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencyFlag: { fontSize: 23 },
  currencyCode: { color: '#C7D9F7', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  currencyValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginTop: 2 },
  heroUtilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 13 },
  actionGrid: { flexDirection: 'row', gap: 8, marginTop: 14 },
  primaryAction: { flex: 1, minHeight: 76, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#E7EBF2' },
  primaryActionText: { color: '#101936', fontSize: 12, fontWeight: '800' },
  moreActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  moreAction: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 9 },
  moreActionText: { color: '#334155', fontSize: 11, fontWeight: '700' },

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
  transactionCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E8EDF4', paddingHorizontal: 14 },
  transactionRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  transactionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  transactionDate: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  statusPill: { textTransform: 'capitalize', overflow: 'hidden', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '800' },
  statusComplete: { color: '#047857', backgroundColor: '#D1FAE5' },
  statusPending: { color: '#A16207', backgroundColor: '#FEF3C7' },
  transactionParties: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  party: { flex: 1 },
  partyLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  partyValue: { color: '#0F172A', fontSize: 11, fontWeight: '700', marginTop: 3 },
  settledAt: { color: '#64748B', fontSize: 10, marginTop: 8 },
  emptyTransactions: { color: '#64748B', fontSize: 12, paddingVertical: 16 },
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

