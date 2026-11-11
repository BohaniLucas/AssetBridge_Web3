import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { mobileRemittanceService, MOBILE_DESTINATIONS } from '../services/remittanceService';

export default function RemittanceScreen({ wallet, onSendRemittance }) {
  const [amount, setAmount] = useState('100');
  const [selectedCurrency, setSelectedCurrency] = useState('tKES');
  const [recipientPhone, setRecipientPhone] = useState('+254 712 345 678');
  const [isSending, setIsSending] = useState(false);

  const quote = mobileRemittanceService.calculateComparison(amount, selectedCurrency);
  const currentDest = MOBILE_DESTINATIONS.find((d) => d.code === selectedCurrency) || MOBILE_DESTINATIONS[0];

  const handleSend = async () => {
    const num = Number(amount);
    if (!num || num <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    if (num > (wallet?.balanceUsdt || 0)) {
      Alert.alert('Insufficient Balance', `You need $${num.toFixed(2)} USDT, but have $${wallet?.balanceUsdt || 0} USDT.`);
      return;
    }

    setIsSending(true);
    try {
      await onSendRemittance({
        amountUsdt: num,
        recipient: recipientPhone,
        currencyCode: selectedCurrency,
        receivedFormatted: quote.receivedFormatted,
      });
      Alert.alert(
        'Remittance Dispatched',
        `Successfully sent $${num} USDT! Recipient receives ${quote.receivedFormatted} via ${currentDest.rail}.`
      );
    } catch (err) {
      Alert.alert('Failed', err.message || 'Transfer failed.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Send Home in Local Currency</Text>
        <Text style={styles.subtitle}>Direct mobile money payout with 0% hidden FX markup</Text>
      </View>

      {/* Destination Country Chips */}
      <Text style={styles.sectionLabel}>CHOOSE DESTINATION</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {MOBILE_DESTINATIONS.map((dest) => {
          const isSelected = selectedCurrency === dest.code;
          return (
            <TouchableOpacity
              key={dest.code}
              style={[styles.destChip, isSelected && styles.destChipActive]}
              onPress={() => setSelectedCurrency(dest.code)}
            >
              <Text style={[styles.destChipText, isSelected && styles.destChipTextActive]}>
                {dest.iso} {dest.country}
              </Text>
              <Text style={[styles.destRailText, isSelected && styles.destRailTextActive]}>
                {dest.rail}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Amount Input */}
      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>You Send (USDT)</Text>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="100"
        />

        {/* Live Conversion Pill */}
        <View style={styles.conversionPill}>
          <Text style={styles.conversionText}>
            ⚡ Converted: <Text style={styles.conversionHighlight}>{quote.receivedFormatted}</Text>
          </Text>
          <Text style={styles.fxTag}>0% Markup</Text>
        </View>
      </View>

      {/* Recipient Phone */}
      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>Recipient {currentDest.rail} Number</Text>
        <TextInput
          style={styles.phoneInput}
          value={recipientPhone}
          onChangeText={setRecipientPhone}
          keyboardType="phone-pad"
        />
      </View>

      {/* Bank Comparison Card */}
      <View style={styles.comparisonCard}>
        <Text style={styles.compTitle}>Why send with AssetBridge?</Text>
        <View style={styles.compRow}>
          <View style={styles.compCol}>
            <Text style={styles.compLabel}>AssetBridge</Text>
            <Text style={styles.compVal}>{quote.receivedFormatted}</Text>
            <Text style={styles.compFee}>Fee: $0.20 USDT · Instant</Text>
          </View>
          <View style={styles.compCol}>
            <Text style={styles.compLabel}>Traditional Bank</Text>
            <Text style={[styles.compVal, { color: '#64748B' }]}>{quote.bankReceivedFormatted}</Text>
            <Text style={styles.compFee}>Fee: $15.00 · 3-5 days</Text>
          </View>
        </View>
        <View style={styles.savedBanner}>
          <Text style={styles.savedText}>You save +${quote.extraSavedUsd} USD compared to bank wires</Text>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.sendBtn, isSending && { opacity: 0.7 }]}
        onPress={handleSend}
        disabled={isSending}
      >
        <Text style={styles.sendBtnText}>
          {isSending ? 'Settling on Sepolia…' : `Send ${quote.receivedFormatted}`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 3 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 8 },
  chipRow: { flexDirection: 'row', marginBottom: 16 },
  destChip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8 },
  destChipActive: { backgroundColor: '#00C29A', borderColor: '#00C29A' },
  destChipText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  destChipTextActive: { color: '#FFFFFF' },
  destRailText: { fontSize: 10, color: '#64748B', marginTop: 2 },
  destRailTextActive: { color: '#E6FFFA' },
  inputCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  amountInput: { fontSize: 28, fontWeight: '900', color: '#0F172A', marginTop: 6 },
  phoneInput: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 6 },
  conversionPill: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 10, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: '#DCFCE7' },
  conversionText: { fontSize: 12, color: '#166534', fontWeight: '600' },
  conversionHighlight: { fontWeight: '900', color: '#15803D' },
  fxTag: { fontSize: 10, fontWeight: '800', backgroundColor: '#DCFCE7', color: '#166534', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  comparisonCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  compTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  compRow: { flexDirection: 'row', justifyContent: 'space-between' },
  compCol: { flex: 1 },
  compLabel: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  compVal: { fontSize: 16, fontWeight: '900', color: '#059669', marginTop: 4 },
  compFee: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  savedBanner: { backgroundColor: '#ECFDF5', padding: 8, borderRadius: 10, marginTop: 12 },
  savedText: { fontSize: 11, fontWeight: '700', color: '#065F46', textAlign: 'center' },
  sendBtn: { backgroundColor: '#00C29A', paddingVertical: 15, borderRadius: 18, alignItems: 'center', shadowColor: '#00C29A', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
  sendBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});

