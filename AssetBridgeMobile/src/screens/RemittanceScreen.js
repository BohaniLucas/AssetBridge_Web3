import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import {
  remittanceService,
  generateIdempotencyKey,
} from '../services/remittanceService';

const FLOW_TABS = [
  { id: 'app_to_app', label: 'InterLink User', sub: 'By @username' },
  { id: 'gogo_claim', label: 'Gogo Claim Link', sub: 'No app needed' },
  { id: 'phone_payout', label: 'Bank / PayShap', sub: 'ShapID Proxy' },
];

const AMOUNT_PRESETS = ['10', '25', '50', '100'];

export default function RemittanceScreen() {
  const [flowType, setFlowType] = useState('app_to_app');
  const [corridors, setCorridors] = useState([]);
  const [selectedCorridorCode, setSelectedCorridorCode] = useState('APP-USDT');
  const [selectedRailId, setSelectedRailId] = useState('sepolia_usdt_erc20');
  const [sendAmount, setSendAmount] = useState('25');

  // Recipient fields (never prefilled with sample personal data)
  const [recipientUsername, setRecipientUsername] = useState('');
  const [verifiedRecipient, setVerifiedRecipient] = useState(null);
  const [isResolvingUser, setIsResolvingUser] = useState(false);

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [transferNote, setTransferNote] = useState('');

  // Quote & State Machine
  const [lockedQuote, setLockedQuote] = useState(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState(null);
  const [createdClaimResult, setCreatedClaimResult] = useState(null);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [fundingTxHashInput, setFundingTxHashInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History & Claims
  const [userTransfers, setUserTransfers] = useState([]);
  const [senderClaims, setSenderClaims] = useState([]);
  const [formError, setFormError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showCorridorModal, setShowCorridorModal] = useState(false);

  // Public Gogo Claim Receiver Modal (for testing/verifying a claim link on mobile)
  const [showReceiverClaimModal, setShowReceiverClaimModal] = useState(false);
  const [receiverClaimId, setReceiverClaimId] = useState('');
  const [receiverLang, setReceiverLang] = useState('en');
  const [publicClaimData, setPublicClaimData] = useState(null);
  const [receiverStep, setReceiverStep] = useState(1);
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverToken, setReceiverToken] = useState('');
  const [receiverOtp, setReceiverOtp] = useState('');
  const [receiverDevOtp, setReceiverDevOtp] = useState('');
  const [receiverSessionToken, setReceiverSessionToken] = useState('');
  const [receiverError, setReceiverError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [dests, transfers, claims] = await Promise.all([
        remittanceService.fetchDestinations(),
        remittanceService.listTransfers(),
        remittanceService.getSenderClaims(),
      ]);
      if (dests.length > 0) setCorridors(dests);
      setUserTransfers(transfers);
      setSenderClaims(claims);
    } catch (err) {
      setFormError(err.message || 'Unable to load remittance corridors.');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectFlow = (modeId) => {
    setFlowType(modeId);
    setFormError('');
    setStatusMessage('');
    setLockedQuote(null);
    setActiveTransfer(null);
    setCreatedClaimResult(null);
    setRiskAcknowledged(false);

    if (modeId === 'app_to_app') {
      setSelectedCorridorCode('APP-USDT');
      setSelectedRailId('sepolia_usdt_erc20');
    } else if (modeId === 'gogo_claim') {
      setSelectedCorridorCode('ZA-ZAR');
      setSelectedRailId('za_gogo_claim');
    } else {
      setSelectedCorridorCode('ZA-ZAR');
      setSelectedRailId('za_payshap_proxy');
    }
  };

  const currentCorridor =
    corridors.find((c) => c.corridorCode === selectedCorridorCode) || corridors[0] || null;

  const filteredCorridors = corridors.filter((c) =>
    flowType === 'app_to_app' ? c.corridorCode === 'APP-USDT' : c.corridorCode !== 'APP-USDT'
  );

  const handleVerifyUsername = async () => {
    setFormError('');
    setVerifiedRecipient(null);
    if (!recipientUsername.trim()) {
      setFormError('Enter an InterLink @username to verify.');
      return;
    }
    setIsResolvingUser(true);
    try {
      const resolved = await remittanceService.resolveUsername(recipientUsername.trim());
      setVerifiedRecipient(resolved);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsResolvingUser(false);
    }
  };

  const handleRequestQuote = async () => {
    setFormError('');
    setStatusMessage('');
    setActiveTransfer(null);
    setCreatedClaimResult(null);

    if (flowType === 'app_to_app' && !verifiedRecipient) {
      setFormError('Verify the recipient @username before requesting a quote.');
      return;
    }
    if (flowType !== 'app_to_app') {
      if (!recipientName.trim() || recipientName.trim().length < 2) {
        setFormError('Enter the recipient’s full name.');
        return;
      }
      if (!recipientPhone.trim()) {
        setFormError('Enter the recipient’s mobile phone number.');
        return;
      }
    }

    setIsQuoting(true);
    try {
      const quote = await remittanceService.createQuote({
        flowType,
        corridorCode: selectedCorridorCode,
        payoutRail: selectedRailId,
        sendAmountUsdt: sendAmount,
      });
      setLockedQuote(quote);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsQuoting(false);
    }
  };

  const handleCreateIntentOrClaim = async () => {
    if (!lockedQuote) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      const idempotencyKey = generateIdempotencyKey(flowType);

      if (flowType === 'gogo_claim') {
        const res = await remittanceService.createGogoClaimLink({
          quoteId: lockedQuote.id,
          idempotencyKey,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          note: transferNote.trim(),
          riskAcknowledged,
        });
        setCreatedClaimResult(res.claim);
        setActiveTransfer(res.transfer);
        setStatusMessage(
          'One-time Gogo claim reference created. Fund the transfer on Sepolia to make it claimable.'
        );
      } else {
        const res = await remittanceService.createTransferIntent({
          quoteId: lockedQuote.id,
          idempotencyKey,
          recipientUsername: verifiedRecipient?.username || recipientUsername.trim(),
          recipientName: verifiedRecipient?.displayName || recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          note: transferNote.trim(),
        });
        setActiveTransfer(res.transfer);
      }
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveTransfer = async () => {
    if (!activeTransfer) return;
    setFormError('');
    setIsSubmitting(true);
    try {
      const res = await remittanceService.approveTransfer(activeTransfer.id, {
        riskAcknowledged,
      });
      setActiveTransfer(res.transfer);
      setStatusMessage(
        'Transfer approved. Submit your 32-byte Sepolia ERC-20 funding transaction hash below.'
      );
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTransfer = async (transferId) => {
    setFormError('');
    setIsSubmitting(true);
    try {
      const res = await remittanceService.cancelTransfer(transferId);
      if (activeTransfer?.id === transferId) {
        setActiveTransfer(res.transfer);
      }
      setStatusMessage('Transfer cancelled prior to funding.');
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmFunding = async () => {
    if (!activeTransfer) return;
    setFormError('');
    if (!fundingTxHashInput.trim()) {
      setFormError('Enter a 32-byte Sepolia transaction hash (0x...) to verify funding.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await remittanceService.confirmBlockchainFunding(activeTransfer.id, {
        txHash: fundingTxHashInput.trim(),
      });
      setActiveTransfer(res.transfer);
      setStatusMessage(`On-chain funding verified! Status: ${res.transfer.status.toUpperCase()}`);
      setFundingTxHashInput('');
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefundClaim = async (claimId) => {
    setFormError('');
    setIsSubmitting(true);
    try {
      const res = await remittanceService.refundClaimLink(claimId);
      Alert.alert('Claim Updated', res.message || 'Claim cancelled/refunded.');
      await loadData();
    } catch (err) {
      Alert.alert('Refund Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareClaimDetails = async (claimObj) => {
    try {
      await Share.share({
        message: `InterLink Gogo Claim Reference: ${claimObj.id}\nLink (No secret in URL): ${claimObj.safeClaimUrl}\nShare the separate one-time claim code only with ${claimObj.recipientName}.`,
      });
    } catch {
      // Share dismissed
    }
  };

  // --- Public Receiver Modal Handlers ---
  const openReceiverModalForClaim = async (claimId, initialLang = 'en') => {
    setReceiverClaimId(claimId);
    setReceiverLang(initialLang);
    setReceiverStep(1);
    setReceiverError('');
    setReceiverDevOtp('');
    setShowReceiverClaimModal(true);
    try {
      const summary = await remittanceService.getPublicClaim(claimId, initialLang);
      setPublicClaimData(summary);
    } catch (err) {
      setReceiverError(err.message);
    }
  };

  const handleReceiverRequestOtp = async () => {
    setReceiverError('');
    try {
      const res = await remittanceService.requestClaimOtp(receiverClaimId, {
        claimToken: receiverToken.trim(),
        phoneNumber: receiverPhone.trim(),
      });
      if (res._devTestOtpOnly) {
        setReceiverDevOtp(res._devTestOtpOnly);
      }
      setReceiverStep(2);
    } catch (err) {
      setReceiverError(err.message);
    }
  };

  const handleReceiverVerifyOtp = async () => {
    setReceiverError('');
    try {
      const res = await remittanceService.verifyClaimOtp(receiverClaimId, {
        otpCode: receiverOtp.trim(),
      });
      setReceiverSessionToken(res.verificationSessionToken);
      const updated = await remittanceService.getPublicClaim(receiverClaimId, receiverLang);
      setPublicClaimData(updated);
      setReceiverStep(3);
    } catch (err) {
      setReceiverError(err.message);
    }
  };

  const handleReceiverConfirmPayout = async () => {
    setReceiverError('');
    try {
      await remittanceService.confirmClaimPayout(receiverClaimId, {
        verificationSessionToken: receiverSessionToken,
        payoutMethod: 'za_payshap_proxy',
      });
      const updated = await remittanceService.getPublicClaim(receiverClaimId, receiverLang);
      setPublicClaimData(updated);
      setReceiverStep(4);
    } catch (err) {
      setReceiverError(err.message);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SEPOLIA TESTNET · MAINNET FUNDS DISABLED</Text>
        </View>
        <Text style={styles.heroTitle}>Remittance & Gogo Claims</Text>
        <Text style={styles.heroSub}>
          Send to a verified InterLink @username, create a one-time OTP-protected Gogo claim link, or check regulated local payout availability.
        </Text>
      </View>

      {/* Flow Mode Selector */}
      <View style={styles.flowTabsRow}>
        {FLOW_TABS.map((t) => {
          const isSel = flowType === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.flowTabBtn, isSel && styles.flowTabBtnActive]}
              onPress={() => handleSelectFlow(t.id)}
            >
              <Text style={[styles.flowTabTitle, isSel && styles.flowTabTitleActive]}>
                {t.label}
              </Text>
              <Text style={[styles.flowTabSub, isSel && styles.flowTabSubActive]}>
                {t.sub}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main Configuration Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Corridor & Payout Rail</Text>
        <TouchableOpacity
          style={styles.selectorBtn}
          onPress={() => setShowCorridorModal(true)}
        >
          <View style={styles.destLeft}>
            <View style={styles.destIsoBadge}>
              <Text style={styles.destIsoBadgeText}>{currentCorridor?.isoCountry || 'GLOBAL'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.destCountry}>
                {currentCorridor?.country || 'Loading…'} ({currentCorridor?.currency || '—'})
              </Text>
              <Text style={styles.destStatus}>
                {currentCorridor?.availabilityLabel || 'Checking availability…'}
              </Text>
            </View>
          </View>
          <Text style={styles.selectorArrow}>Change ▼</Text>
        </TouchableOpacity>

        {/* Flow A: AssetBridge Username Lookup */}
        {flowType === 'app_to_app' ? (
          <View style={styles.recipientSection}>
            <Text style={styles.sectionTitle}>2. Verify Recipient @Username</Text>
            <View style={styles.usernameRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={recipientUsername}
                onChangeText={(txt) => {
                  setRecipientUsername(txt);
                  setVerifiedRecipient(null);
                }}
                placeholder="@nomsa"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={handleVerifyUsername}
                disabled={isResolvingUser}
              >
                {isResolvingUser ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.verifyBtnText}>Verify</Text>
                )}
              </TouchableOpacity>
            </View>

            {verifiedRecipient && (
              <View style={styles.verifiedBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.verifiedTitle}>
                    Verified: {verifiedRecipient.displayName} ({verifiedRecipient.username})
                  </Text>
                </View>
                <Text style={styles.verifiedSub}>
                  Rail: {verifiedRecipient.settlementAsset} ({verifiedRecipient.settlementNetwork})
                </Text>
                <Text style={styles.disclosureText}>
                  {verifiedRecipient.fiatPayoutDisclosure}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.recipientSection}>
            <Text style={styles.sectionTitle}>2. Recipient Details</Text>
            {currentCorridor?.rails?.[0]?.proxyDisclosure ? (
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>
                  {currentCorridor.rails[0].proxyDisclosure}
                </Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Recipient Full Name</Text>
            <TextInput
              style={styles.input}
              value={recipientName}
              onChangeText={(txt) => {
                setRecipientName(txt);
                setLockedQuote(null);
              }}
              placeholder="Enter recipient full name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>
              {flowType === 'phone_payout'
                ? 'Registered PayShap ShapID Phone (+27...)'
                : 'Recipient Mobile Phone (+27...)'}
            </Text>
            <TextInput
              style={styles.input}
              value={recipientPhone}
              onChangeText={(txt) => {
                setRecipientPhone(txt);
                setLockedQuote(null);
              }}
              placeholder="+27 82 000 0000"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />
          </View>
        )}

        {/* Amount Input */}
        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>3. Send Amount (USDT)</Text>
        <View style={styles.amountInputRow}>
          <Text style={styles.currencyPrefix}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={sendAmount}
            onChangeText={(txt) => {
              setSendAmount(txt.replace(/[^0-9.]/g, ''));
              setLockedQuote(null);
            }}
            keyboardType="numeric"
            placeholder="25.00"
            placeholderTextColor="#94A3B8"
          />
          <View style={styles.usdtTag}>
            <Text style={styles.usdtTagText}>USDT</Text>
          </View>
        </View>

        <View style={styles.presetsRow}>
          {AMOUNT_PRESETS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.presetBtn, sendAmount === p && styles.presetBtnActive]}
              onPress={() => {
                setSendAmount(p);
                setLockedQuote(null);
              }}
            >
              <Text style={[styles.presetText, sendAmount === p && styles.presetTextActive]}>
                ${p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Reference / Note (Optional)</Text>
        <TextInput
          style={styles.input}
          value={transferNote}
          onChangeText={setTransferNote}
          placeholder="e.g. Monthly groceries support"
          placeholderTextColor="#94A3B8"
        />

        {formError ? <Text style={styles.errText}>{formError}</Text> : null}
        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

        <TouchableOpacity
          style={[styles.quoteBtn, isQuoting && { opacity: 0.7 }]}
          onPress={handleRequestQuote}
          disabled={isQuoting}
        >
          {isQuoting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.quoteBtnText}>Get Locked 5-Minute Quote</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Locked Quote Review & Approval Card */}
      {lockedQuote && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Locked Quote Review</Text>
          <Text style={styles.sectionSub}>
            Expires {new Date(lockedQuote.expiresAt).toLocaleTimeString()} · Source:{' '}
            {lockedQuote.rateSource}
          </Text>

          <View style={styles.quoteBox}>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>You Send</Text>
              <Text style={styles.quoteVal}>
                ${lockedQuote.sendAmountFormatted} {lockedQuote.sendCurrency}
              </Text>
            </View>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Platform / Escrow Fee</Text>
              <Text style={styles.quoteVal}>
                ${lockedQuote.feeAmountFormatted} {lockedQuote.sendCurrency}
              </Text>
            </View>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Exchange Rate</Text>
              <Text style={styles.quoteVal}>
                1 USDT = {lockedQuote.fxRateDisplay} {lockedQuote.receiveCurrency}
              </Text>
            </View>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Payout Rail</Text>
              <Text style={styles.quoteVal}>{lockedQuote.payoutRailName}</Text>
            </View>
            <View style={[styles.quoteRow, styles.quoteRowTotal]}>
              <Text style={styles.quoteTotalLabel}>Estimated Recipient Amount</Text>
              <Text style={styles.quoteTotalVal}>
                {lockedQuote.receiveSymbol} {lockedQuote.receiveAmountFormatted}{' '}
                {lockedQuote.receiveCurrency}
              </Text>
            </View>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{lockedQuote.availabilityDisclosure}</Text>
          </View>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setRiskAcknowledged(!riskAcknowledged)}
          >
            <View style={[styles.checkbox, riskAcknowledged && styles.checkboxChecked]}>
              {riskAcknowledged && <Ionicons name="checkmark" size={14} color="#0A0F1C" />}
            </View>
            <Text style={styles.checkboxText}>
              I have verified the recipient’s identity, reviewed the fee and rate, and understand that on-chain transfers are irreversible once funded.
            </Text>
          </TouchableOpacity>

          {!activeTransfer && (
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!riskAcknowledged ||
                  isSubmitting ||
                  (flowType === 'phone_payout' && !lockedQuote.fiatPayoutExecutable)) && {
                  opacity: 0.5,
                },
              ]}
              disabled={
                !riskAcknowledged ||
                isSubmitting ||
                (flowType === 'phone_payout' && !lockedQuote.fiatPayoutExecutable)
              }
              onPress={handleCreateIntentOrClaim}
            >
              <Text style={styles.sendBtnText}>
                {flowType === 'phone_payout' && !lockedQuote.fiatPayoutExecutable
                  ? 'Not Available Yet (PayShap Partner Unconfigured)'
                  : isSubmitting
                  ? 'Processing…'
                  : flowType === 'gogo_claim'
                  ? 'Approve & Create One-Time Gogo Claim Link'
                  : 'Initialize Transfer Intent'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Active Transfer State Machine & One-Time Claim Display */}
      {activeTransfer && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Transfer Status: {activeTransfer.status.toUpperCase()}
          </Text>
          <Text style={styles.sectionSub}>ID: {activeTransfer.id}</Text>

          {createdClaimResult && (
            <View style={styles.claimSecretBox}>
              <Text style={styles.claimSecretTitle}>
                One-Time Gogo Claim Reference (Shown Once Only)
              </Text>
              <Text style={styles.claimSecretSub}>
                {createdClaimResult.securityWarning}
              </Text>
              <Text style={styles.claimMonoLabel}>
                Claim ID: {createdClaimResult.id}
              </Text>
              {createdClaimResult.oneTimeClaimCode && (
                <Text style={styles.claimCodeHighlight}>
                  Secret Claim Code: {createdClaimResult.oneTimeClaimCode}
                </Text>
              )}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => handleShareClaimDetails(createdClaimResult)}
                >
                  <Text style={styles.secondaryBtnText}>Share Link</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primarySmallBtn}
                  onPress={() => openReceiverModalForClaim(createdClaimResult.id)}
                >
                  <Text style={styles.primarySmallBtnText}>Open Gogo Receiver View</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTransfer.status === 'awaiting_sender_approval' && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => handleCancelTransfer(activeTransfer.id)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.authorizeBtn}
                onPress={handleApproveTransfer}
              >
                <Text style={styles.authorizeBtnText}>Approve Final Terms</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeTransfer.status === 'pending' && (
            <View style={styles.fundingBox}>
              <Text style={styles.fieldLabel}>
                Submit 32-Byte Sepolia Funding Tx Hash (0x...)
              </Text>
              <TextInput
                style={styles.input}
                value={fundingTxHashInput}
                onChangeText={setFundingTxHashInput}
                placeholder="0x..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => handleCancelTransfer(activeTransfer.id)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.authorizeBtn}
                  onPress={handleConfirmFunding}
                >
                  <Text style={styles.authorizeBtnText}>Verify On-Chain Receipt</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Sender Gogo Claim Links Tracking */}
      {senderClaims.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Gogo Claim Links</Text>
          {senderClaims.map((clm) => (
            <View key={clm.id} style={styles.historyItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>
                  {clm.recipientName} ({clm.recipientPhoneMasked}) · {clm.status.toUpperCase()}
                </Text>
                <Text style={styles.historySub}>
                  ${clm.sendAmountFormatted} USDT → {clm.receiveSymbol}
                  {clm.receiveAmountFormatted} {clm.receiveCurrency}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={styles.smallTagBtn}
                  onPress={() => openReceiverModalForClaim(clm.id)}
                >
                  <Text style={styles.smallTagBtnText}>Gogo View</Text>
                </TouchableOpacity>
                {!['claimed', 'refunded', 'cancelled'].includes(clm.status) && (
                  <TouchableOpacity
                    style={[styles.smallTagBtn, { backgroundColor: '#FEE2E2' }]}
                    onPress={() => handleRefundClaim(clm.id)}
                  >
                    <Text style={[styles.smallTagBtnText, { color: '#991B1B' }]}>Refund</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Corridor Selection Modal */}
      <Modal visible={showCorridorModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Destination Corridor</Text>
              <TouchableOpacity onPress={() => setShowCorridorModal(false)}>
                <Ionicons name="close" size={20} color="#0A0F1C" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {filteredCorridors.map((c) => (
                <TouchableOpacity
                  key={c.corridorCode}
                  style={[
                    styles.destOption,
                    selectedCorridorCode === c.corridorCode && styles.destOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedCorridorCode(c.corridorCode);
                    if (c.rails?.[0]) setSelectedRailId(c.rails[0].id);
                    setLockedQuote(null);
                    setShowCorridorModal(false);
                  }}
                >
                  <View style={styles.destIsoBadge}>
                    <Text style={styles.destIsoBadgeText}>{c.isoCountry || c.corridorCode.slice(0, 2)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.destOptName}>
                      {c.country} ({c.currency})
                    </Text>
                    <Text style={styles.destOptRail}>{c.availabilityLabel}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Public Receiver Gogo Claim Verification Modal */}
      <Modal visible={showReceiverClaimModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gogo Claim Verification</Text>
              <TouchableOpacity onPress={() => setShowReceiverClaimModal(false)}>
                <Ionicons name="close" size={20} color="#0A0F1C" />
              </TouchableOpacity>
            </View>

            {/* Language Selector for Plain-Language AI Guide */}
            <View style={styles.langRow}>
              {['en', 'zu', 'st', 'af'].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.langBtn, receiverLang === l && styles.langBtnActive]}
                  onPress={() => openReceiverModalForClaim(receiverClaimId, l)}
                >
                  <Text
                    style={[
                      styles.langBtnText,
                      receiverLang === l && styles.langBtnTextActive,
                    ]}
                  >
                    {l.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={{ maxHeight: 440 }}>
              {publicClaimData?.aiGuidance && (
                <View style={styles.aiGuideBox}>
                  <Text style={styles.aiGuideTitle}>
                    Gogo Guide ({publicClaimData.aiGuidance.languageName})
                  </Text>
                  <Text style={styles.aiGuideText}>
                    {publicClaimData.aiGuidance.plainLanguageSummary}
                  </Text>
                  <Text style={styles.aiBoundaryText}>
                    {publicClaimData.aiGuidance.aiSafetyBoundary}
                  </Text>
                </View>
              )}

              {receiverError ? (
                <Text style={styles.errText}>{receiverError}</Text>
              ) : null}

              {receiverStep === 1 && (
                <View>
                  <Text style={styles.fieldLabel}>Your Mobile Phone (+27...)</Text>
                  <TextInput
                    style={styles.input}
                    value={receiverPhone}
                    onChangeText={setReceiverPhone}
                    placeholder="+27 82 000 0000"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text style={styles.fieldLabel}>One-Time Secret Claim Code</Text>
                  <TextInput
                    style={styles.input}
                    value={receiverToken}
                    onChangeText={setReceiverToken}
                    placeholder="Paste secret claim code"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={handleReceiverRequestOtp}
                  >
                    <Text style={styles.sendBtnText}>Send 6-Digit SMS Code</Text>
                  </TouchableOpacity>
                </View>
              )}

              {receiverStep === 2 && (
                <View>
                  {receiverDevOtp ? (
                    <Text style={styles.statusText}>
                      [Dev Test Mode OTP]: {receiverDevOtp}
                    </Text>
                  ) : null}
                  <Text style={styles.fieldLabel}>Enter 6-Digit SMS Code</Text>
                  <TextInput
                    style={styles.input}
                    value={receiverOtp}
                    onChangeText={setReceiverOtp}
                    placeholder="6-digit code"
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={handleReceiverVerifyOtp}
                  >
                    <Text style={styles.sendBtnText}>Verify OTP</Text>
                  </TouchableOpacity>
                </View>
              )}

              {receiverStep === 3 && publicClaimData && (
                <View>
                  <Text style={styles.sectionTitle}>Plain-Language Payout Review</Text>
                  <Text style={styles.verifiedSub}>
                    Sender: {publicClaimData.senderDisplayName} · Amount:{' '}
                    {publicClaimData.receiveSymbol}
                    {publicClaimData.receiveAmountFormatted}{' '}
                    {publicClaimData.receiveCurrency}
                  </Text>
                  <TouchableOpacity
                    style={[styles.sendBtn, { marginTop: 12 }]}
                    onPress={handleReceiverConfirmPayout}
                  >
                    <Text style={styles.sendBtnText}>Confirm PayShap Payout</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F4F8' },
  contentContainer: { padding: 16, paddingBottom: 40 },
  heroBanner: {
    backgroundColor: '#101936',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  badgeText: { color: '#FCD34D', fontSize: 10, fontWeight: '800' },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  heroSub: { color: '#CBD5E1', fontSize: 12, lineHeight: 17 },
  flowTabsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  flowTabBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  flowTabBtnActive: {
    backgroundColor: '#EAF9F3',
    borderColor: '#00C29A',
  },
  flowTabTitle: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  flowTabTitleActive: { color: '#065F46' },
  flowTabSub: { fontSize: 10, color: '#64748B', marginTop: 2 },
  flowTabSubActive: { color: '#047857' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  sectionSub: { fontSize: 11, color: '#64748B', marginTop: 2, marginBottom: 10 },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  destLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  destFlag: { fontSize: 22, marginRight: 10 },
  destIsoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destIsoBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00E676',
    letterSpacing: 0.5,
  },
  destCountry: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  destStatus: { fontSize: 11, color: '#047857', marginTop: 2 },
  selectorArrow: { fontSize: 12, color: '#00C29A', fontWeight: '700' },
  recipientSection: { marginTop: 4 },
  usernameRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  verifyBtn: {
    backgroundColor: '#101936',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  verifiedBox: {
    backgroundColor: '#EAF9F3',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedTitle: { fontSize: 12, fontWeight: '800', color: '#065F46' },
  verifiedSub: { fontSize: 11, color: '#047857', marginTop: 2 },
  disclosureText: { fontSize: 11, color: '#92400E', marginTop: 6 },
  infoBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  infoBannerText: { fontSize: 11, color: '#1E3A8A', lineHeight: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#334155', marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 6,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 10,
  },
  currencyPrefix: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginRight: 6 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '800', color: '#0F172A', paddingVertical: 8 },
  usdtTag: { backgroundColor: '#E6F4EA', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  usdtTagText: { fontSize: 11, fontWeight: '800', color: '#0F9D58' },
  presetsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  presetBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  presetBtnActive: { backgroundColor: '#101936' },
  presetText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  presetTextActive: { color: '#FFFFFF' },
  errText: { color: '#DC2626', fontSize: 12, fontWeight: '600', marginVertical: 8 },
  statusText: { color: '#047857', fontSize: 12, fontWeight: '600', marginVertical: 8 },
  quoteBtn: {
    backgroundColor: '#101936',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  quoteBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  quoteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quoteLabel: { fontSize: 12, color: '#64748B' },
  quoteVal: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  quoteRowTotal: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, marginTop: 4 },
  quoteTotalLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  quoteTotalVal: { fontSize: 16, fontWeight: '900', color: '#065F46' },
  warningBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: { fontSize: 11, color: '#92400E', lineHeight: 16 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginVertical: 12 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#00C29A', borderColor: '#00C29A' },
  checkboxMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  checkboxText: { flex: 1, fontSize: 11, color: '#475569', lineHeight: 16 },
  sendBtn: {
    backgroundColor: '#00C29A',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  sendBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  claimSecretBox: {
    backgroundColor: '#EAF9F3',
    borderRadius: 14,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#00C29A',
  },
  claimSecretTitle: { fontSize: 13, fontWeight: '800', color: '#065F46' },
  claimSecretSub: { fontSize: 11, color: '#047857', marginVertical: 4 },
  claimMonoLabel: { fontSize: 11, fontWeight: '700', color: '#0F172A', marginTop: 4 },
  claimCodeHighlight: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 8,
    marginVertical: 6,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  primarySmallBtn: {
    flex: 1,
    backgroundColor: '#101936',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  primarySmallBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  authorizeBtn: {
    flex: 2,
    backgroundColor: '#00C29A',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  authorizeBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  fundingBox: { marginTop: 8 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  historySub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  smallTagBtn: {
    backgroundColor: '#EAF9F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallTagBtnText: { fontSize: 11, fontWeight: '700', color: '#065F46' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  closeBtnText: { fontSize: 18, fontWeight: '800', color: '#64748B' },
  destOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  destOptionActive: { backgroundColor: '#EAF9F3', borderColor: '#00C29A', borderWidth: 1 },
  destFlagBig: { fontSize: 24 },
  destOptName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  destOptRail: { fontSize: 11, color: '#64748B' },
  langRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  langBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  langBtnActive: { backgroundColor: '#101936' },
  langBtnText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  langBtnTextActive: { color: '#FFFFFF' },
  aiGuideBox: {
    backgroundColor: '#EAF9F3',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  aiGuideTitle: { fontSize: 12, fontWeight: '800', color: '#065F46' },
  aiGuideText: { fontSize: 11, color: '#047857', marginTop: 4, lineHeight: 16 },
  aiBoundaryText: { fontSize: 10, color: '#64748B', marginTop: 4, fontStyle: 'italic' },
});
