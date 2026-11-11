import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { mobileWalletService } from '../services/walletService';
import { mobileClaimService } from '../services/claimService';

export default function WalletScreen({ wallet, onRefresh, onTransfer, onFaucet }) {
  const [mode, setMode] = useState('personal'); // 'personal' | 'vendor'
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [step, setStep] = useState(1); // 1: input, 2: review, 3: receipt
  const [recipient, setRecipient] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [feeQuote, setFeeQuote] = useState(null);
  const [lastTxReceipt, setLastTxReceipt] = useState(null);

  // Send to Anyone via WhatsApp Escrow Link (Gogo Flow)
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimZarAmount, setClaimZarAmount] = useState('400');
  const [claimRecipientName, setClaimRecipientName] = useState('Gogo');
  const [claimRecipientPhone, setClaimRecipientPhone] = useState('+27 82 555 0192');
  const [claimNote, setClaimNote] = useState('Sunday groceries & lunch');
  const [activeClaim, setActiveClaim] = useState(null);
  const [isCreatingClaim, setIsCreatingClaim] = useState(false);
  const [isSimulatingClaim, setIsSimulatingClaim] = useState(false);

  // Vendor Mode State
  const [vendorAmount, setVendorAmount] = useState('12.50');
  const [vendorItem, setVendorItem] = useState('Fresh Vegetables & Maize');
  const [vendorStatus, setVendorStatus] = useState('listening'); // 'listening' | 'pending' | 'confirmed'
  const [vendorPaymentReceived, setVendorPaymentReceived] = useState(null);

  const savedRecipients = mobileWalletService.getSavedRecipients();

  useEffect(() => {
    mobileWalletService.getFeeQuote().then((q) => setFeeQuote(q));
  }, []);

  const openSendToRecipient = (rec) => {
    setRecipient(rec.identifier);
    setRecipientName(rec.name);
    setAmount('25.00');
    setNote(rec.recentNote || 'Family support');
    setStep(1);
    setShowSendModal(true);
  };

  const handleReviewPayment = () => {
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
    if (num + 0.2 > (wallet?.balanceUsdt || 0)) {
      setErrorMsg(`Insufficient balance. Required: $${(num + 0.2).toFixed(2)} USDT ($0.20 fee), Available: $${wallet?.balanceUsdt} USDT`);
      return;
    }
    setStep(2);
  };

  const handleExecuteSend = async () => {
    setIsSending(true);
    const num = Number(amount);
    const idempotencyKey = mobileWalletService.generateIdempotencyKey();

    try {
      const result = await onTransfer({
        recipient,
        amount: num,
        note,
        idempotencyKey,
      });

      const receipt = {
        amount: num,
        recipient: recipientName || recipient,
        feeUsdt: 0.2,
        txHash: result?.transaction?.txHash || `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        status: 'CONFIRMED',
        timestamp: new Date().toLocaleTimeString(),
      };

      setLastTxReceipt(receipt);
      setStep(3);
    } catch (err) {
      setErrorMsg(err.message || 'Transfer failed.');
      setStep(1);
    } finally {
      setIsSending(false);
    }
  };

  const resetSendModal = () => {
    setShowSendModal(false);
    setStep(1);
    setRecipient('');
    setRecipientName('');
    setAmount('');
    setNote('');
    setErrorMsg('');
    setLastTxReceipt(null);
  };

  // Create WhatsApp Escrow Claim Link
  const handleCreateClaimLink = async () => {
    setIsCreatingClaim(true);
    const numZar = Number(claimZarAmount) || 400;
    const numUsdt = Math.round((numZar / 20.0) * 100) / 100; // 20 ZAR/USDT rate

    try {
      // 1. Lock funds from wallet
      await onTransfer({
        recipient: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
        amount: numUsdt,
        note: `Escrow lock for WhatsApp claim: R${numZar} to ${claimRecipientName}`,
      });

      // 2. Generate claim link
      const claim = await mobileClaimService.createClaimLink({
        senderUserId: wallet?.userId || 'malulekelucas04@gmail.com',
        senderName: 'Nomsa (Lucas)',
        amountZar: numZar,
        amountUsdt: numUsdt,
        recipientName: claimRecipientName,
        recipientPhone: claimRecipientPhone,
        note: claimNote,
      });

      setActiveClaim(claim);
    } catch (err) {
      Alert.alert('Escrow Error', err.message || 'Failed to create claim link.');
    } finally {
      setIsCreatingClaim(false);
    }
  };

  // Share via WhatsApp
  const handleShareWhatsApp = async () => {
    if (!activeClaim) return;
    try {
      await Share.share({
        message: activeClaim.whatsappMessage,
      });
    } catch {
      //
    }
  };

  // Simulate Gogo's 30-second claim experience (for 40s Hackathon Demo)
  const handleSimulateGogoClaim = async () => {
    if (!activeClaim) return;
    setIsSimulatingClaim(true);
    setTimeout(async () => {
      const result = await mobileClaimService.simulateGogoClaim(activeClaim.id);
      setActiveClaim((prev) => ({
        ...prev,
        status: 'claimed',
        claimedTxHash: result.claimedTxHash,
        claimedAt: new Date().toLocaleTimeString(),
      }));
      setIsSimulatingClaim(false);
    }, 1500);
  };

  // Refund / Cancel Escrow Claim Link
  const handleRefundClaim = async () => {
    if (!activeClaim) return;
    try {
      await mobileClaimService.refundClaimLink({
        claimId: activeClaim.id,
        senderUserId: wallet?.userId || 'malulekelucas04@gmail.com',
      });
      await onFaucet(); // credit back
      setActiveClaim((prev) => ({ ...prev, status: 'refunded' }));
      Alert.alert('Refund Complete', `R${activeClaim.amountZar} ($${activeClaim.amountUsdt} USDT) returned to your balance.`);
    } catch (err) {
      Alert.alert('Refund Failed', err.message);
    }
  };

  // Vendor Checkout Simulator (Idea 2 from Victor)
  const simulateVendorPayment = () => {
    setVendorStatus('pending');
    setTimeout(() => {
      setVendorStatus('confirmed');
      setVendorPaymentReceived({
        amount: vendorAmount,
        payer: 'Customer (0x8ba1...BA72)',
        txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        timestamp: new Date().toLocaleTimeString(),
      });
      onFaucet();
    }, 2000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mode Switcher: Personal vs Market Vendor POS */}
      <View style={styles.modeToggleRow}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'personal' && styles.modeTabActive]}
          onPress={() => setMode('personal')}
        >
          <Text style={[styles.modeTabText, mode === 'personal' && styles.modeTabTextActive]}>
            👤 Personal Wallet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, mode === 'vendor' && styles.modeTabActive]}
          onPress={() => setMode('vendor')}
        >
          <Text style={[styles.modeTabText, mode === 'vendor' && styles.modeTabTextActive]}>
            🏪 Market Vendor POS
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'personal' ? (
        <>
          {/* 1. Master Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>TETHER STABLECOIN VAULT</Text>
              <View style={styles.networkBadge}>
                <View style={styles.networkDot} />
                <Text style={styles.networkText}>Sepolia Testnet</Text>
              </View>
            </View>

            <Text style={styles.balanceAmount}>
              ${Number(wallet?.balanceUsdt || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <Text style={styles.currencyCode}> USDT</Text>
            </Text>

            <View style={styles.addressRow}>
              <Text style={styles.addressLabel}>Address: </Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {wallet?.address ? `${wallet.address.slice(0, 10)}...${wallet.address.slice(-8)}` : 'Generating address...'}
              </Text>
            </View>

            {/* Quick Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.sendBtn]}
                onPress={() => {
                  setStep(1);
                  setShowSendModal(true);
                }}
              >
                <Text style={styles.actionBtnText}>↑ Send USDT</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, styles.receiveBtn]} onPress={() => setShowReceiveModal(true)}>
                <Text style={styles.actionBtnText}>↓ Receive QR</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, styles.faucetBtn]} onPress={onFaucet}>
                <Text style={styles.actionBtnText}>+250 Faucet</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. GOGO FLOW: Send to Anyone via WhatsApp Claim Link */}
          <View style={styles.gogoCard}>
            <View style={styles.gogoHeaderRow}>
              <View style={styles.gogoAvatarBox}>
                <Text style={{ fontSize: 24 }}>👵</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gogoBadge}>ZERO-CRYPTO FEATURE</Text>
                <Text style={styles.gogoTitle}>Send to Anyone via WhatsApp Link</Text>
                <Text style={styles.gogoSubtitle}>
                  Recipient never sees the words blockchain, USDT or wallet. Just a message and Rand amount.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.gogoActionBtn}
              onPress={() => {
                setActiveClaim(null);
                setShowClaimModal(true);
              }}
            >
              <Text style={styles.gogoActionBtnText}>💬 Send R400 to Gogo via WhatsApp →</Text>
            </TouchableOpacity>
          </View>

          {/* 3. Send Money to Family (Saved Recipients) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👨‍👩‍👧 Send to Family & Frequent Contacts</Text>
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

          {/* 4. Double-Spend Protection Info */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoIcon}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Tether WDK & Double-Spend Protection</Text>
              <Text style={styles.infoText}>
                Every transaction uses cryptographic idempotency keys. If network drops mid-send, transactions re-verify safely without charging twice.
              </Text>
            </View>
          </View>

          {/* 5. Recent Activity Ledger */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Ledger Activity</Text>
              <TouchableOpacity onPress={onRefresh}>
                <Text style={styles.refreshLink}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.txCard}>
              <View style={styles.txIconBox}>
                <Text style={styles.txIcon}>⚡</Text>
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txTitle}>P2P Transfer to Mama Thandi</Text>
                <Text style={styles.txSubtitle}>Confirmed on Sepolia · Idempotent</Text>
              </View>
              <Text style={styles.txAmount}>-$25.00 USDT</Text>
            </View>

            <View style={styles.txCard}>
              <View style={[styles.txIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[styles.txIcon, { color: '#0284C7' }]}>👥</Text>
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txTitle}>Tech Queens Stokvel Contribution</Text>
                <Text style={styles.txSubtitle}>Round #4 Vault Deposit</Text>
              </View>
              <Text style={styles.txAmount}>-$20.00 USDT</Text>
            </View>
          </View>
        </>
      ) : (
        /* VENDOR POS CHECKOUT SCREEN */
        <View style={styles.vendorContainer}>
          <View style={styles.vendorHeaderCard}>
            <Text style={styles.vendorBadge}>MARKET VENDOR MODE</Text>
            <Text style={styles.vendorTitle}>Accept USDT at Your Stall</Text>
            <Text style={styles.vendorSubtitle}>Customer scans QR with any Sepolia USDT wallet to pay instantly.</Text>

            <View style={styles.vendorInputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vendorInputLabel}>Item / Service Note</Text>
                <TextInput
                  style={styles.vendorInput}
                  value={vendorItem}
                  onChangeText={setVendorItem}
                />
              </View>

              <View style={{ width: 110 }}>
                <Text style={styles.vendorInputLabel}>Amount (USDT)</Text>
                <TextInput
                  style={[styles.vendorInput, { fontWeight: '900', color: '#00C29A' }]}
                  value={vendorAmount}
                  onChangeText={setVendorAmount}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          {/* Dynamic Vendor QR Code */}
          <View style={styles.vendorQrCard}>
            <View style={styles.qrBox}>
              <Text style={{ fontSize: 64 }}>📱</Text>
              <Text style={styles.qrPayloadText}>PAY ${vendorAmount} USDT</Text>
              <Text style={styles.qrSubText}>To: {wallet?.address?.slice(0, 10)}...{wallet?.address?.slice(-6)}</Text>
            </View>

            {/* Vendor Live Status Listener */}
            <View style={styles.vendorStatusBox}>
              {vendorStatus === 'listening' && (
                <View style={styles.statusRow}>
                  <ActivityIndicator size="small" color="#00C29A" />
                  <Text style={styles.statusText}>Listening for customer payment on Sepolia...</Text>
                </View>
              )}

              {vendorStatus === 'pending' && (
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={[styles.statusText, { color: '#B45309', fontWeight: '800' }]}>
                    Payment detected! Verifying on-chain...
                  </Text>
                </View>
              )}

              {vendorStatus === 'confirmed' && (
                <View style={styles.confirmedBox}>
                  <Text style={styles.confirmedTitle}>✅ PAYMENT CONFIRMED!</Text>
                  <Text style={styles.confirmedSub}>+${vendorPaymentReceived?.amount} USDT received from customer</Text>
                  <Text style={styles.confirmedHash}>Tx: {vendorPaymentReceived?.txHash?.slice(0, 14)}...</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.simulateBtn} onPress={simulateVendorPayment}>
              <Text style={styles.simulateBtnText}>⚡ Simulate Customer Scan & Pay</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* MODAL: SEND TO ANYONE VIA WHATSAPP CLAIM LINK (GOGO FLOW) */}
      <Modal visible={showClaimModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {!activeClaim ? (
              <>
                <Text style={styles.stepIndicator}>WHATSAPP CLAIM LINK (ESCROW LOCKED)</Text>
                <Text style={styles.modalTitle}>Send to Anyone (Gogo Flow)</Text>
                <Text style={styles.modalSubtitle}>
                  Recipient gets a WhatsApp link, enters phone & SMS code, and receives Rand. No app to install!
                </Text>

                <Text style={styles.inputLabel}>Recipient Name</Text>
                <TextInput
                  style={styles.input}
                  value={claimRecipientName}
                  onChangeText={setClaimRecipientName}
                  placeholder="e.g. Gogo"
                />

                <Text style={styles.inputLabel}>Recipient Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  value={claimRecipientPhone}
                  onChangeText={setClaimRecipientPhone}
                  placeholder="+27 82 555 0192"
                  keyboardType="phone-pad"
                />

                <Text style={styles.inputLabel}>Amount in Rand (ZAR)</Text>
                <TextInput
                  style={styles.input}
                  value={claimZarAmount}
                  onChangeText={setClaimZarAmount}
                  placeholder="400"
                  keyboardType="decimal-pad"
                />
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                  Locks ${(Number(claimZarAmount) / 20.0).toFixed(2)} USDT in Escrow Claim Contract (+ $0.20 network gas).
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={() => setShowClaimModal(false)}
                    disabled={isCreatingClaim}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtn, styles.confirmBtn]}
                    onPress={handleCreateClaimLink}
                    disabled={isCreatingClaim}
                  >
                    {isCreatingClaim ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.confirmBtnText}>Lock & Generate Link</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* ACTIVE CLAIM CREATED - SENDER SCREEN */
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.stepIndicator}>LINK READY · ESCROW CONTRACT ACTIVE</Text>
                <Text style={styles.modalTitle}>Nomsa sent R{activeClaim.amountZar} to {activeClaim.recipientName}</Text>
                <Text style={styles.modalSubtitle}>Share the link below via WhatsApp:</Text>

                {/* WhatsApp Message Preview Box */}
                <View style={styles.whatsAppPreviewBox}>
                  <Text style={styles.whatsAppText}>{activeClaim.whatsappMessage}</Text>
                </View>

                {/* Status Indicator */}
                <View style={styles.claimStatusContainer}>
                  {activeClaim.status === 'waiting' && (
                    <View style={styles.waitingBadge}>
                      <ActivityIndicator size="small" color="#B45309" />
                      <Text style={styles.waitingText}>
                        Waiting for {activeClaim.recipientName} to claim (R{activeClaim.amountZar} held safely)
                      </Text>
                    </View>
                  )}

                  {activeClaim.status === 'claimed' && (
                    <View style={styles.claimedBadge}>
                      <Text style={styles.claimedTitle}>🎉 CLAIMED BY {activeClaim.recipientName.toUpperCase()}!</Text>
                      <Text style={styles.claimedSub}>
                        R{activeClaim.amountZar} released to her new custodial phone account
                      </Text>
                      <Text style={styles.claimedHash}>Ref: {activeClaim.claimedTxHash?.slice(0, 16)}...</Text>
                    </View>
                  )}

                  {activeClaim.status === 'refunded' && (
                    <View style={styles.refundedBadge}>
                      <Text style={styles.refundedText}>↩️ Link Cancelled · Funds returned to your wallet</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={{ width: '100%', gap: 8, marginTop: 14 }}>
                  <TouchableOpacity style={styles.shareBtn} onPress={handleShareWhatsApp}>
                    <Text style={styles.shareBtnText}>📲 Share on WhatsApp</Text>
                  </TouchableOpacity>

                  {/* 40-second Demo Trigger */}
                  {activeClaim.status === 'waiting' && (
                    <TouchableOpacity
                      style={styles.demoClaimBtn}
                      onPress={handleSimulateGogoClaim}
                      disabled={isSimulatingClaim}
                    >
                      {isSimulatingClaim ? (
                        <ActivityIndicator color="#0F172A" size="small" />
                      ) : (
                        <Text style={styles.demoClaimBtnText}>
                          👵 Simulate Gogo's Phone Claim (Demo in 40s)
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {activeClaim.status === 'waiting' && (
                    <TouchableOpacity style={styles.refundBtn} onPress={handleRefundClaim}>
                      <Text style={styles.refundBtnText}>Return to me / Cancel Link</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.receiptDoneBtn, { width: '100%', marginTop: 4 }]}
                    onPress={() => setShowClaimModal(false)}
                  >
                    <Text style={styles.receiptDoneBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* REGULAR SEND USDT MODAL */}
      <Modal visible={showSendModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {step === 1 && (
              <>
                <Text style={styles.stepIndicator}>STEP 1 & 2 OF 5: DETAILS & BALANCE CHECK</Text>
                <Text style={styles.modalTitle}>Send Tether (USDT)</Text>
                <Text style={styles.modalSubtitle}>Ethereum Sepolia Testnet · 0x7169...BA06</Text>

                {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                <Text style={styles.inputLabel}>Recipient Address or Family Username</Text>
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

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={resetSendModal}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={handleReviewPayment}>
                    <Text style={styles.confirmBtnText}>Review Fee Quote →</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.stepIndicator}>STEP 3 OF 5: REVIEW & APPROVAL</Text>
                <Text style={styles.modalTitle}>Confirm Tether Transaction</Text>
                <Text style={styles.modalSubtitle}>Please verify recipient and network fee before signing.</Text>

                <View style={styles.reviewSummary}>
                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>Recipient</Text>
                    <Text style={styles.reviewVal}>{recipientName || recipient}</Text>
                  </View>

                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>Network</Text>
                    <Text style={styles.reviewVal}>Ethereum Sepolia (ChainID: 11155111)</Text>
                  </View>

                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>Token</Text>
                    <Text style={styles.reviewVal}>Tether USD (USDT)</Text>
                  </View>

                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>Transfer Amount</Text>
                    <Text style={[styles.reviewVal, { color: '#00C29A', fontWeight: '900' }]}>
                      ${Number(amount).toFixed(2)} USDT
                    </Text>
                  </View>

                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>Network Gas Fee</Text>
                    <Text style={styles.reviewVal}>$0.20 USDT (~0.00018 ETH)</Text>
                  </View>

                  <View style={[styles.reviewItem, { borderBottomWidth: 0, paddingTop: 10 }]}>
                    <Text style={[styles.reviewLabel, { fontWeight: '800', color: '#0F172A' }]}>Total Deducted</Text>
                    <Text style={[styles.reviewVal, { fontSize: 16, fontWeight: '900', color: '#0F172A' }]}>
                      ${(Number(amount) + 0.2).toFixed(2)} USDT
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setStep(1)} disabled={isSending}>
                    <Text style={styles.cancelBtnText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={handleExecuteSend} disabled={isSending}>
                    {isSending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.confirmBtnText}>Authorize & Sign (WDK)</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 3 && lastTxReceipt && (
              <>
                <Text style={styles.stepIndicator}>STEP 5 OF 5: TRANSACTION RECEIPT</Text>
                <Text style={styles.modalTitle}>✅ Payment Confirmed!</Text>
                <Text style={styles.modalSubtitle}>Settled on Ethereum Sepolia Testnet</Text>

                <View style={styles.receiptBox}>
                  <Text style={styles.receiptAmount}>-${lastTxReceipt.amount.toFixed(2)} USDT</Text>
                  <Text style={styles.receiptTo}>Sent to {lastTxReceipt.recipient}</Text>

                  <View style={styles.hashRow}>
                    <Text style={styles.hashLabel}>Tx Hash: </Text>
                    <Text style={styles.hashText} numberOfLines={1}>{lastTxReceipt.txHash}</Text>
                  </View>

                  <View style={styles.receiptMeta}>
                    <Text style={styles.metaText}>Status: Confirmed on-chain</Text>
                    <Text style={styles.metaText}>Gas: $0.20 USDT</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.receiptDoneBtn} onPress={resetSendModal}>
                  <Text style={styles.receiptDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL: RECEIVE USDT */}
      <Modal visible={showReceiveModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Receive Tether (USDT)</Text>
            <Text style={styles.modalSubtitle}>Share this QR or address to receive funds globally</Text>

            <View style={styles.qrPlaceholder}>
              <Text style={{ fontSize: 54 }}>📱</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 8 }}>Tether USDT QR</Text>
              <Text style={{ fontSize: 11, color: '#64748B' }}>Network: Ethereum Sepolia</Text>
            </View>

            <Text style={styles.qrAddress}>{wallet?.address || 'Loading...'}</Text>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowReceiveModal(false)}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 3,
    marginBottom: 16,
  },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  modeTabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  modeTabText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  modeTabTextActive: { color: '#0F172A', fontWeight: '900' },
  balanceCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.8 },
  networkBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  networkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 },
  networkText: { fontSize: 11, fontWeight: '700', color: '#E2E8F0' },
  balanceAmount: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', marginTop: 14 },
  currencyCode: { fontSize: 18, fontWeight: '600', color: '#10B981' },
  addressRow: { flexDirection: 'row', marginTop: 8 },
  addressLabel: { fontSize: 11, color: '#64748B' },
  addressText: { fontSize: 11, color: '#CBD5E1', fontFamily: 'monospace', flex: 1 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { backgroundColor: '#00C29A' },
  receiveBtn: { backgroundColor: '#3B82F6' },
  faucetBtn: { backgroundColor: '#8B5CF6' },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  gogoCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 18,
    marginTop: 18,
    shadowColor: '#D97706',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  gogoHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  gogoAvatarBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  gogoBadge: { fontSize: 9, fontWeight: '900', color: '#D97706', letterSpacing: 0.8 },
  gogoTitle: { fontSize: 14, fontWeight: '900', color: '#78350F', marginTop: 2 },
  gogoSubtitle: { fontSize: 11, color: '#92400E', marginTop: 3, lineHeight: 15 },
  gogoActionBtn: { backgroundColor: '#D97706', paddingVertical: 11, borderRadius: 12, alignItems: 'center', marginTop: 14 },
  gogoActionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  recipientsRow: { flexDirection: 'row', paddingVertical: 4 },
  recipientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    width: 115,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  recipientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  recipientName: { fontSize: 11, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  recipientLocation: { fontSize: 9, color: '#64748B', textAlign: 'center', marginTop: 2 },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 20,
    alignItems: 'flex-start',
    gap: 10,
  },
  infoIcon: { fontSize: 18 },
  infoTitle: { fontSize: 12, fontWeight: '800', color: '#065F46', marginBottom: 2 },
  infoText: { fontSize: 11, color: '#065F46', lineHeight: 16 },
  refreshLink: { fontSize: 12, fontWeight: '700', color: '#00C29A' },
  txCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 18, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  txIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txIcon: { fontSize: 18 },
  txDetails: { flex: 1 },
  txTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  txSubtitle: { fontSize: 11, color: '#64748B', marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  vendorContainer: { marginTop: 4 },
  vendorHeaderCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  vendorBadge: { fontSize: 10, fontWeight: '900', color: '#00C29A', letterSpacing: 0.8 },
  vendorTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginTop: 4 },
  vendorSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 14 },
  vendorInputRow: { flexDirection: 'row', gap: 10 },
  vendorInputLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 },
  vendorInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0F172A' },
  vendorQrCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  qrBox: { width: '100%', backgroundColor: '#F8FAFC', borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  qrPayloadText: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginTop: 10 },
  qrSubText: { fontSize: 11, fontFamily: 'monospace', color: '#64748B', marginTop: 4 },
  vendorStatusBox: { marginTop: 18, width: '100%' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  confirmedBox: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', padding: 14, borderRadius: 14, alignItems: 'center' },
  confirmedTitle: { fontSize: 14, fontWeight: '900', color: '#065F46' },
  confirmedSub: { fontSize: 12, fontWeight: '700', color: '#047857', marginTop: 2 },
  confirmedHash: { fontSize: 10, fontFamily: 'monospace', color: '#065F46', marginTop: 4 },
  simulateBtn: { backgroundColor: '#00C29A', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14, marginTop: 16, width: '100%', alignItems: 'center' },
  simulateBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 },
  stepIndicator: { fontSize: 10, fontWeight: '900', color: '#00C29A', letterSpacing: 0.8 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 14 },
  errorText: { backgroundColor: '#FEE2E2', color: '#991B1B', padding: 8, borderRadius: 10, fontSize: 11, marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0F172A' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F1F5F9' },
  cancelBtnText: { color: '#475569', fontWeight: '700' },
  confirmBtn: { backgroundColor: '#00C29A' },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '800' },
  reviewSummary: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginVertical: 12 },
  reviewItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  reviewLabel: { fontSize: 11, color: '#64748B' },
  reviewVal: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  receiptBox: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 18, alignItems: 'center', marginVertical: 14 },
  receiptAmount: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  receiptTo: { fontSize: 12, color: '#64748B', marginTop: 2 },
  hashRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 8, borderRadius: 10, marginTop: 12, width: '100%' },
  hashLabel: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  hashText: { fontSize: 10, fontFamily: 'monospace', color: '#00C29A', flex: 1 },
  receiptMeta: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 },
  metaText: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  receiptDoneBtn: { backgroundColor: '#00C29A', paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  receiptDoneBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  qrPlaceholder: { height: 140, backgroundColor: '#F1F5F9', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  qrAddress: { fontSize: 11, fontFamily: 'monospace', color: '#334155', textAlign: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10 },
  closeBtn: { backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  closeBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  // Gogo WhatsApp Escrow Specific Styles
  whatsAppPreviewBox: {
    backgroundColor: '#DCF8C6',
    borderColor: '#C5E1A5',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    width: '100%',
    marginVertical: 12,
  },
  whatsAppText: { fontSize: 12, color: '#1B5E20', lineHeight: 18, fontWeight: '500' },
  claimStatusContainer: { width: '100%', marginVertical: 6 },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 14,
  },
  waitingText: { fontSize: 11, fontWeight: '700', color: '#B45309', flex: 1 },
  claimedBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  claimedTitle: { fontSize: 13, fontWeight: '900', color: '#065F46' },
  claimedSub: { fontSize: 11, color: '#047857', marginTop: 2, textAlign: 'center' },
  claimedHash: { fontSize: 10, fontFamily: 'monospace', color: '#059669', marginTop: 4 },
  refundedBadge: { backgroundColor: '#F1F5F9', padding: 10, borderRadius: 12, alignItems: 'center' },
  refundedText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  shareBtn: { backgroundColor: '#25D366', paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  shareBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  demoClaimBtn: { backgroundColor: '#FDE68A', paddingVertical: 11, borderRadius: 14, alignItems: 'center' },
  demoClaimBtnText: { color: '#78350F', fontWeight: '800', fontSize: 12 },
  refundBtn: { backgroundColor: '#F1F5F9', paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  refundBtnText: { color: '#64748B', fontWeight: '700', fontSize: 11 },
});
