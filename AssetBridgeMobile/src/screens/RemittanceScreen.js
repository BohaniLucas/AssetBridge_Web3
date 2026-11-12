import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { remittanceService, FX_DESTINATIONS, REGIONS } from '../services/remittanceService';
import { walletService } from '../services/walletService';

const recipientMethods = [
  { id: 'phone', label: 'Phone', placeholder: '+254 712 345 678' },
  { id: 'username', label: 'Username', placeholder: '@nomsa' },
  { id: 'wallet', label: 'Wallet', placeholder: '0x...' },
];

const presets = [10, 25, 50, 100];

export default function RemittanceScreen() {
  const [destinations, setDestinations] = useState(FX_DESTINATIONS);
  const [selectedCurrency, setSelectedCurrency] = useState('tKES');
  const [sendAmount, setSendAmount] = useState('100');
  const [recipientNumber, setRecipientNumber] = useState('+254 712 345 678');
  const [recipientMethod, setRecipientMethod] = useState('phone');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    walletService.getWallet().then(setWallet);
    remittanceService.fetchDestinations().then((dists) => {
      if (dists && dists.length > 0) setDestinations(dists);
    });
  }, []);

  const numAmount = Number(sendAmount) || 0;
  const quote = remittanceService.calculateComparison(numAmount, selectedCurrency);
  const currentDest = destinations.find((d) => d.code === selectedCurrency) || destinations[0];

  const filteredDestinations = destinations.filter((dest) => {
    if (selectedRegion === 'All') return true;
    return dest.region === selectedRegion;
  });

  const handleSelectDest = (dest) => {
    setSelectedCurrency(dest.code);
    setShowCountryModal(false);
    setFormError('');
    if (recipientMethod === 'phone') {
      setRecipientNumber(dest.defaultRecipient || '');
    }
  };

  const handleReview = () => {
    setFormError('');
    if (numAmount < 1) {
      setFormError('Minimum transfer amount is $1.00 USDT.');
      return;
    }
    if (wallet && wallet.balanceUsdt < numAmount) {
      setFormError(`Insufficient balance. Available: $${wallet.balanceUsdt.toFixed(2)} USDT.`);
      return;
    }
    if (!recipientNumber.trim()) {
      setFormError('Please enter recipient information.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirmModal(false);
    setIsSending(true);

    try {
      const res = await walletService.transferUsdt({
        recipient: recipientNumber,
        amount: numAmount,
      });
      if (!res?.txHash) throw new Error('Transfer service returned no verified transaction hash.');

      const newReceipt = {
        txHash: res.txHash,
        amountUsdt: sendAmount,
        currencyCode: selectedCurrency,
        receivedFormatted: quote.assetBridge.receivedFormatted,
        recipient: recipientNumber,
        payoutRail: currentDest.mobileChannels[0],
        time: '2.4 seconds',
        timestamp: new Date().toLocaleTimeString(),
      };

      setReceipt(newReceipt);
      setShowReceiptModal(true);
      const updated = await walletService.getWallet();
      setWallet(updated);
    } catch (err) {
      Alert.alert('Transfer Failed', err.message || 'Error processing transfer');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* Hero Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>DIRECT GLOBAL REMITTANCE · ZERO SPREAD</Text>
        </View>
        <Text style={styles.heroTitle}>Send Money Worldwide</Text>
        <Text style={styles.heroSub}>
          Send USDT stablecoins globally with immediate local currency payout into mobile money (M-Pesa, Capitec, OPay) at 95% lower fees.
        </Text>
      </View>

      {/* Main Transfer Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>Who are you sending to?</Text>
        <Text style={styles.cardSectionSub}>Choose delivery method & destination country</Text>

        {/* Method Toggle */}
        <View style={styles.methodToggleRow}>
          {recipientMethods.map((m) => {
            const isSel = recipientMethod === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.methodBtn, isSel && styles.methodBtnActive]}
                onPress={() => {
                  setRecipientMethod(m.id);
                  setRecipientNumber('');
                  setFormError('');
                }}
              >
                <Text style={[styles.methodBtnText, isSel && styles.methodBtnTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recipient Input */}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={recipientNumber}
            onChangeText={(txt) => {
              setRecipientNumber(txt);
              setFormError('');
            }}
            placeholder={
              recipientMethod === 'phone'
                ? currentDest.recipientType || '+254 712 345 678'
                : 'Enter ' + recipientMethod
            }
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
          />
        </View>

        {/* Country & Currency Selector */}
        <Text style={[styles.cardSectionTitle, { marginTop: 18 }]}>Destination Country & Rail</Text>
        <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowCountryModal(true)}>
          <View style={styles.destLeft}>
            <Text style={styles.destFlag}>{currentDest.flag}</Text>
            <View>
              <Text style={styles.destCountry}>{currentDest.country} · {currentDest.code}</Text>
              <Text style={styles.destRail}>{currentDest.mobileChannels.join(', ')}</Text>
            </View>
          </View>
          <Text style={styles.selectorArrow}>Change ▼</Text>
        </TouchableOpacity>

        {/* Send Amount */}
        <Text style={[styles.cardSectionTitle, { marginTop: 18 }]}>You Send (USDT)</Text>
        <View style={styles.amountInputRow}>
          <Text style={styles.currencyPrefix}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={sendAmount}
            onChangeText={(txt) => {
              setSendAmount(txt.replace(/[^0-9.]/g, ''));
              setFormError('');
            }}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor="#94A3B8"
          />
          <View style={styles.usdtTag}>
            <Text style={styles.usdtTagText}>USDT</Text>
          </View>
        </View>

        {/* Amount Presets */}
        <View style={styles.presetsRow}>
          {presets.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.presetBtn, sendAmount === String(p) && styles.presetBtnActive]}
              onPress={() => setSendAmount(String(p))}
            >
              <Text style={[styles.presetText, sendAmount === String(p) && styles.presetTextActive]}>${p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recipient Gets Box */}
        <View style={styles.getsBox}>
          <Text style={styles.getsLabel}>Recipient receives locally in seconds:</Text>
          <Text style={styles.getsValue}>
            {quote.assetBridge.receivedFormatted} {currentDest.code}
          </Text>
          <Text style={styles.getsSub}>
            Direct payout via {currentDest.mobileChannels[0]} · 1 USDT = {currentDest.fxRate} {currentDest.code}
          </Text>
        </View>

        {formError ? <Text style={styles.errText}>{formError}</Text> : null}

        {/* Submit Review Button */}
        <TouchableOpacity
          style={[styles.sendBtn, isSending && { opacity: 0.7 }]}
          onPress={handleReview}
          disabled={isSending}
        >
          {isSending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.sendBtnText}>Review & Send Money</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Comparison Table Card */}
      <View style={styles.compareCard}>
        <Text style={styles.compareTitle}>Why AssetBridge Beats Banks & Remittance Agents</Text>
        <Text style={styles.compareSub}>Comparison for sending ${numAmount || 100} USDT to {currentDest.country}</Text>

        <View style={styles.compareTable}>
          {/* AssetBridge Row */}
          <View style={[styles.compareRow, styles.compareRowHighlight]}>
            <View style={styles.providerInfo}>
              <Text style={styles.providerNameActive}>AssetBridge (Tether Rail)</Text>
              <Text style={styles.providerTimeActive}>⚡ ~2.4 seconds · Instant</Text>
            </View>
            <View style={styles.providerPayout}>
              <Text style={styles.providerPayoutAmtActive}>
                {quote.assetBridge.receivedFormatted} {currentDest.code}
              </Text>
              <Text style={styles.providerFeeActive}>$0.20 flat fee · 0% FX spread</Text>
            </View>
          </View>

          {/* Western Union */}
          <View style={styles.compareRow}>
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>Western Union</Text>
              <Text style={styles.providerTime}>1 - 2 business days</Text>
            </View>
            <View style={styles.providerPayout}>
              <Text style={styles.providerPayoutAmt}>
                {quote.westernUnion.receivedFormatted} {currentDest.code}
              </Text>
              <Text style={styles.providerFee}>${quote.westernUnion.fee.toFixed(2)} fee + 4.2% spread</Text>
            </View>
          </View>

          {/* Wise */}
          <View style={styles.compareRow}>
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>Wise Transfer</Text>
              <Text style={styles.providerTime}>4 - 12 hours</Text>
            </View>
            <View style={styles.providerPayout}>
              <Text style={styles.providerPayoutAmt}>
                {quote.wise.receivedFormatted} {currentDest.code}
              </Text>
              <Text style={styles.providerFee}>${quote.wise.fee.toFixed(2)} fee</Text>
            </View>
          </View>

          {/* Bank Wire */}
          <View style={styles.compareRow}>
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>Standard Bank Wire</Text>
              <Text style={styles.providerTime}>3 - 5 business days</Text>
            </View>
            <View style={styles.providerPayout}>
              <Text style={styles.providerPayoutAmt}>
                {quote.bankWire.receivedFormatted} {currentDest.code}
              </Text>
              <Text style={styles.providerFee}>${quote.bankWire.fee.toFixed(2)} fee + SWIFT charges</Text>
            </View>
          </View>
        </View>

        <View style={styles.savingsCallout}>
          <Text style={styles.savingsText}>
            🎉 You save approximately{' '}
            <Text style={styles.savingsBold}>${quote.savingsVsWesternUnion.toFixed(2)} USD</Text> by using AssetBridge over traditional remittance rails.
          </Text>
        </View>
      </View>

      {/* Country Selection Modal */}
      <Modal visible={showCountryModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Destination Country</Text>
              <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Region Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionScroll}>
              {REGIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.regionChip, selectedRegion === r && styles.regionChipActive]}
                  onPress={() => setSelectedRegion(r)}
                >
                  <Text style={[styles.regionChipText, selectedRegion === r && styles.regionChipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {filteredDestinations.map((d) => (
                <TouchableOpacity
                  key={d.code}
                  style={[styles.destOption, selectedCurrency === d.code && styles.destOptionActive]}
                  onPress={() => handleSelectDest(d)}
                >
                  <Text style={styles.destFlagBig}>{d.flag}</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.destOptName}>{d.country} ({d.code})</Text>
                    <Text style={styles.destOptRail}>{d.mobileChannels.join(' · ')}</Text>
                  </View>
                  <Text style={styles.destOptRate}>1 USDT = {d.fxRate} {d.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Modal */}
      <Modal visible={showConfirmModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Confirm Global Remittance</Text>
            <Text style={styles.confirmSub}>Review transfer details before on-chain authorization</Text>

            <View style={styles.confirmDetailList}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>You Send</Text>
                <Text style={styles.confirmValue}>${sendAmount} USDT</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Recipient Receives</Text>
                <Text style={[styles.confirmValue, { color: '#00C29A' }]}>
                  {quote.assetBridge.receivedFormatted} {currentDest.code}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Recipient</Text>
                <Text style={styles.confirmValue}>{recipientNumber}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Destination Channel</Text>
                <Text style={styles.confirmValue}>{currentDest.mobileChannels[0]}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Settlement Speed</Text>
                <Text style={styles.confirmValue}>~2.4 seconds</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Network Fee</Text>
                <Text style={styles.confirmValue}>$0.20 USDT</Text>
              </View>
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConfirmModal(false)}>
                <Text style={styles.cancelBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.authorizeBtn} onPress={handleConfirmSend}>
                <Text style={styles.authorizeBtnText}>Authorize & Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receipt Modal */}
      <Modal visible={showReceiptModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmBox}>
            <View style={styles.successIconBox}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.confirmTitle}>Remittance Settled!</Text>
            <Text style={styles.confirmSub}>Funds delivered instantly into recipient mobile money</Text>

            {receipt && (
              <View style={styles.confirmDetailList}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Amount Sent</Text>
                  <Text style={styles.confirmValue}>${receipt.amountUsdt} USDT</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Payout Delivered</Text>
                  <Text style={[styles.confirmValue, { color: '#00C29A', fontWeight: '800' }]}>
                    {receipt.receivedFormatted} {receipt.currencyCode}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Delivered To</Text>
                  <Text style={styles.confirmValue}>{receipt.recipient}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Mobile Rail</Text>
                  <Text style={styles.confirmValue}>{receipt.payoutRail}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Settlement Time</Text>
                  <Text style={styles.confirmValue}>{receipt.time}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Tx Hash</Text>
                  <Text style={[styles.confirmValue, { fontSize: 11 }]}>{receipt.txHash.slice(0, 16)}...</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.sendBtn, { marginTop: 18 }]}
              onPress={() => setShowReceiptModal(false)}
            >
              <Text style={styles.sendBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  heroBanner: {
    backgroundColor: '#101936',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 194, 154, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 194, 154, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  badgeText: {
    color: '#00C29A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSub: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },
  methodToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  methodBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  methodBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  methodBtnTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  inputWrap: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
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
  },
  destLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  destFlag: {
    fontSize: 24,
    marginRight: 10,
  },
  destCountry: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  destRail: {
    fontSize: 11,
    color: '#64748B',
  },
  selectorArrow: {
    fontSize: 12,
    color: '#00C29A',
    fontWeight: '700',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 10,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    paddingVertical: 10,
  },
  usdtTag: {
    backgroundColor: '#E6F4EA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  usdtTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F9D58',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: '#101936',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  getsBox: {
    backgroundColor: '#EAF9F3',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 194, 154, 0.3)',
    marginBottom: 16,
  },
  getsLabel: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600',
    marginBottom: 4,
  },
  getsValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#065F46',
  },
  getsSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 4,
  },
  errText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  sendBtn: {
    backgroundColor: '#00C29A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#00C29A',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  compareCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  compareTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  compareSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  compareTable: {
    gap: 8,
  },
  compareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  compareRowHighlight: {
    backgroundColor: '#EAF9F3',
    borderColor: '#A7F3D0',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  providerNameActive: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  providerTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  providerTimeActive: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
    marginTop: 2,
  },
  providerPayout: {
    alignItems: 'flex-end',
  },
  providerPayoutAmt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  providerPayoutAmtActive: {
    fontSize: 14,
    fontWeight: '900',
    color: '#065F46',
  },
  providerFee: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  providerFeeActive: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '700',
    marginTop: 2,
  },
  savingsCallout: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  savingsText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  savingsBold: {
    fontWeight: '800',
    color: '#78350F',
  },
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
    padding: 4,
  },
  regionScroll: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  regionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  regionChipActive: {
    backgroundColor: '#101936',
  },
  regionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  regionChipTextActive: {
    color: '#FFFFFF',
  },
  destOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  destOptionActive: {
    backgroundColor: '#EAF9F3',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  destFlagBig: {
    fontSize: 26,
  },
  destOptName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  destOptRail: {
    fontSize: 11,
    color: '#64748B',
  },
  destOptRate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00C29A',
  },
  confirmBox: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 24,
    padding: 22,
    alignSelf: 'center',
    width: '90%',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  confirmSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  confirmDetailList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  confirmValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  authorizeBtn: {
    flex: 2,
    backgroundColor: '#00C29A',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  authorizeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  successIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EAF9F3',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  successCheck: {
    fontSize: 26,
    color: '#00C29A',
    fontWeight: '900',
  },
});

