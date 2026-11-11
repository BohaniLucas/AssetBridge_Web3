import React, { useState } from 'react';
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
} from 'react-native';

export default function WalletScreen({ wallet, onRefresh, onTransfer, onFaucet }) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSend = async () => {
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
    if (num > (wallet?.balanceUsdt || 0)) {
      setErrorMsg(`Insufficient balance. Available: $${wallet?.balanceUsdt} USDT`);
      return;
    }

    setIsSending(true);
    try {
      await onTransfer({ recipient, amount: num, note });
      setShowSendModal(false);
      setRecipient('');
      setAmount('');
      setNote('');
      Alert.alert('Transfer Successful', `Sent $${num.toFixed(2)} USDT on Ethereum Sepolia!`);
    } catch (err) {
      setErrorMsg(err.message || 'Transfer failed.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Master Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>TETHER STABLECOIN VAULT</Text>
          <View style={styles.networkBadge}>
            <View style={styles.networkDot} />
            <Text style={styles.networkText}>Sepolia</Text>
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

        {/* 3 Quick Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.sendBtn]} onPress={() => setShowSendModal(true)}>
            <Text style={styles.actionBtnText}>↑ Send</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.receiveBtn]} onPress={() => setShowReceiveModal(true)}>
            <Text style={styles.actionBtnText}>↓ Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.faucetBtn]} onPress={onFaucet}>
            <Text style={styles.actionBtnText}>+250 Faucet</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Quick Security Info */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoIcon}>🔒</Text>
        <Text style={styles.infoText}>
          Connected to smart contract 0x7169...BA06. 100% backed 1:1 on Ethereum Sepolia testnet.
        </Text>
      </View>

      {/* 3. Recent Transactions Ledger */}
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
            <Text style={styles.txTitle}>P2P Transfer</Text>
            <Text style={styles.txSubtitle}>Confirmed on Sepolia</Text>
          </View>
          <Text style={styles.txAmount}>-$50.00 USDT</Text>
        </View>

        <View style={styles.txCard}>
          <View style={[styles.txIconBox, { backgroundColor: '#E0F2FE' }]}>
            <Text style={[styles.txIcon, { color: '#0284C7' }]}>👥</Text>
          </View>
          <View style={styles.txDetails}>
            <Text style={styles.txTitle}>Chama Contribution</Text>
            <Text style={styles.txSubtitle}>Nairobi Founders Pot</Text>
          </View>
          <Text style={styles.txAmount}>-$20.00 USDT</Text>
        </View>
      </View>

      {/* MODAL: SEND USDT */}
      <Modal visible={showSendModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send Tether (USDT)</Text>
            <Text style={styles.modalSubtitle}>Instant P2P settlement with $0.20 network fee</Text>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <Text style={styles.inputLabel}>Recipient Wallet or Username</Text>
            <TextInput
              style={styles.input}
              placeholder="0x... or user@assetbridge.africa"
              value={recipient}
              onChangeText={setRecipient}
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
              placeholder="Dinner split, invoice, etc."
              value={note}
              onChangeText={setNote}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setShowSendModal(false)}
                disabled={isSending}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={handleSend}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Authorize Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: RECEIVE USDT */}
      <Modal visible={showReceiveModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Receive Tether (USDT)</Text>
            <Text style={styles.modalSubtitle}>Share this address to receive funds globally</Text>

            <View style={styles.qrPlaceholder}>
              <Text style={{ fontSize: 48 }}>📱</Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>QR Code Payload</Text>
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
  sendBtn: { backgroundColor: '#10B981' },
  receiveBtn: { backgroundColor: '#3B82F6' },
  faucetBtn: { backgroundColor: '#8B5CF6' },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  infoBanner: { flexDirection: 'row', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 16, alignItems: 'center' },
  infoIcon: { fontSize: 16, marginRight: 8 },
  infoText: { fontSize: 11, color: '#065F46', flex: 1, lineHeight: 16, fontWeight: '500' },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  refreshLink: { fontSize: 12, fontWeight: '700', color: '#059669' },
  txCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 18, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  txIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txIcon: { fontSize: 18 },
  txDetails: { flex: 1 },
  txTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  txSubtitle: { fontSize: 11, color: '#64748B', marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 14 },
  errorText: { backgroundColor: '#FEE2E2', color: '#991B1B', padding: 8, borderRadius: 10, fontSize: 11, marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0F172A' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F1F5F9' },
  cancelBtnText: { color: '#475569', fontWeight: '700' },
  confirmBtn: { backgroundColor: '#10B981' },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '800' },
  qrPlaceholder: { height: 130, backgroundColor: '#F1F5F9', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  qrAddress: { fontSize: 11, fontFamily: 'monospace', color: '#334155', textAlign: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10 },
  closeBtn: { backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  closeBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});

