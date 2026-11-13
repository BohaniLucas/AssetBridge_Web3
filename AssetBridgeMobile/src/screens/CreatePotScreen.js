import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SEPOLIA_USDT_CONTRACT, SEPOLIA_CHAIN_ID } from '../config/api';
import { offlineStorage } from '../services/offlineStorage';

export default function CreatePotScreen({ onBack, onSave, draftKey = 'create-stokvel:anonymous' }) {
  const [potName, setPotName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('20');
  const [maxMembers, setMaxMembers] = useState('5');
  const [frequency, setFrequency] = useState('monthly');
  const [discoverability, setDiscoverability] = useState('discoverable_open');
  const [deadlineDays, setDeadlineDays] = useState('3');
  const [graceDays, setGraceDays] = useState('2');
  const [timezone, setTimezone] = useState('Africa/Johannesburg');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    let active = true;
    offlineStorage.get(draftKey).then((draft) => {
      if (!active || !draft) return;
      setPotName(draft.potName || '');
      setDescription(draft.description || '');
      setAmount(draft.amount || '20');
      setMaxMembers(draft.maxMembers || '5');
      setFrequency(draft.frequency || 'monthly');
      setDiscoverability(draft.discoverability || 'discoverable_open');
      setDeadlineDays(draft.deadlineDays || '3');
      setGraceDays(draft.graceDays || '2');
      setTimezone(draft.timezone || 'Africa/Johannesburg');
    }).finally(() => { if (active) setDraftReady(true); });
    return () => { active = false; };
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    offlineStorage.set(draftKey, {
      potName, description, amount, maxMembers, frequency,
      discoverability, deadlineDays, graceDays, timezone,
    });
  }, [draftKey, draftReady, potName, description, amount, maxMembers, frequency, discoverability, deadlineDays, graceDays, timezone]);

  // Pool math: N members * C contribution
  const parsedAmount = Number(amount) || 0;
  const parsedMembers = Number(maxMembers) || 0;
  const expectedPool = Math.round(parsedAmount * parsedMembers * 100) / 100;

  const handleSubmit = async () => {
    if (!potName.trim() || potName.trim().length < 3) {
      Alert.alert('Invalid Name', 'Please enter a Stokvel name of at least 3 characters.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Contribution', 'Please enter a contribution amount greater than zero.');
      return;
    }

    if (!Number.isInteger(parsedMembers) || parsedMembers < 2 || parsedMembers > 50) {
      Alert.alert('Invalid Member Capacity', 'Target membership must be an integer between 2 and 50 members.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: potName.trim(),
        description: description.trim(),
        type: 'rotating_payout',
        contributionAmount: parsedAmount,
        maxMembers: parsedMembers,
        frequency,
        discoverability,
        firstCycleDate: new Date().toISOString(),
        contributionDeadlineDays: Number(deadlineDays) || 3,
        gracePeriodDays: Number(graceDays) || 2,
        timezone,
      };

      await onSave?.(payload);
      await offlineStorage.remove(draftKey);
      Alert.alert('Stokvel Created', 'Your Rotating Payout Stokvel has been created under immutable terms.', [
        { text: 'OK', onPress: () => onBack?.() },
      ]);
    } catch (error) {
      Alert.alert('Could Not Create Stokvel', error.message || 'Please check your inputs and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Rotating Stokvel</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.scopeNotice}>
          <Ionicons name="shield-checkmark" size={18} color="#059669" />
          <View style={{ flex: 1 }}>
            <Text style={styles.scopeNoticeTitle}>Rotating Payout Stokvel (ROSCA) Only</Text>
            <Text style={styles.scopeNoticeText}>
              Investment, lending, and grocery stokvel types are disabled until audited vaults are integrated. Every member contributes equally each round and receives one scheduled payout in rotation.
            </Text>
          </View>
        </View>

        
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
            <Text style={styles.sectionTitle}>Group Information</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Stokvel Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Soshanguve Monthly Circle"
              placeholderTextColor="#94A3B8"
              value={potName}
              onChangeText={setPotName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description / Purpose (Optional)</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              placeholder="Brief note on group goals or community focus..."
              placeholderTextColor="#94A3B8"
              multiline
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Discoverability Mode</Text>
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentBtn, discoverability === 'discoverable_open' && styles.segmentBtnActive]}
                onPress={() => setDiscoverability('discoverable_open')}
              >
                <Ionicons name="globe-outline" size={16} color={discoverability === 'discoverable_open' ? '#0F172A' : '#64748B'} />
                <Text style={[styles.segmentText, discoverability === 'discoverable_open' && styles.segmentTextActive]}>
                  Discoverable
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, discoverability === 'private_invite_only' && styles.segmentBtnActive]}
                onPress={() => setDiscoverability('private_invite_only')}
              >
                <Ionicons name="lock-closed-outline" size={16} color={discoverability === 'private_invite_only' ? '#0F172A' : '#64748B'} />
                <Text style={[styles.segmentText, discoverability === 'private_invite_only' && styles.segmentTextActive]}>
                  Private (Invite Only)
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              {discoverability === 'discoverable_open'
                ? 'Appears in group directory. Applicants require Owner/Co-admin approval before accepting terms.'
                : 'Hidden from directory. Requires a direct, high-entropy invite link to preview and join.'}
            </Text>
          </View>
        </View>

        
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
            <Text style={styles.sectionTitle}>Financial Rules & Rotation</Text>
          </View>

          
          <View style={styles.tokenBadge}>
            <Ionicons name="link-outline" size={16} color="#0284C7" />
            <View style={{ flex: 1 }}>
              <Text style={styles.tokenBadgeTitle}>Provisional Sepolia USDT Allowlist</Text>
              <Text style={styles.tokenBadgeCode}>
                Contract: {SEPOLIA_USDT_CONTRACT.slice(0, 10)}...{SEPOLIA_USDT_CONTRACT.slice(-6)} · Chain {SEPOLIA_CHAIN_ID}
              </Text>
            </View>
          </View>

          <View style={styles.twoColRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Contribution (USDT)</Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="20"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Target Members (N)</Text>
              <TextInput
                style={styles.input}
                placeholder="5"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={maxMembers}
                onChangeText={setMaxMembers}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Rotation Frequency</Text>
            <View style={styles.segmentRow}>
              {['monthly', 'biweekly', 'weekly'].map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[styles.segmentBtn, frequency === freq && styles.segmentBtnActive]}
                  onPress={() => setFrequency(freq)}
                >
                  <Text style={[styles.segmentText, frequency === freq && styles.segmentTextActive]}>
                    {freq === 'biweekly' ? 'Bi-Weekly' : freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          
          <View style={styles.poolMathBox}>
            <View style={styles.poolMathHeader}>
              <Text style={styles.poolMathLabel}>EXPECTED CYCLE POOL (N × C)</Text>
              <Text style={styles.poolMathFormula}>
                {parsedMembers || 0} members × ${parsedAmount || 0} USDT
              </Text>
            </View>
            <Text style={styles.poolMathValue}>${expectedPool.toFixed(2)} USDT</Text>
            <Text style={styles.poolMathDisclaimer}>
              Before disclosed network gas fees. Each member contributes even during their own payout cycle. Exactly 1 round of {parsedMembers || 0} cycles completes the rotation.
            </Text>
          </View>

          
          <View style={styles.calendarRuleBox}>
            <Ionicons name="calendar-outline" size={16} color="#475569" />
            <View style={{ flex: 1 }}>
              <Text style={styles.calendarRuleTitle}>Short-Month & Grace Period Rules</Text>
              <Text style={styles.calendarRuleText}>
                Cutoff: {deadlineDays} days after cycle open. Grace window: {graceDays} days. For monthly dates falling on the 29th–31st, cutoffs automatically clamp to the last day of shorter months.
              </Text>
            </View>
          </View>
        </View>

        
        <TouchableOpacity
          style={styles.termsTriggerBtn}
          onPress={() => setShowTermsModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="document-text-outline" size={18} color="#0F172A" />
          <Text style={styles.termsTriggerText}>Review Immutable Terms & Constitution</Text>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, isSaving && { opacity: 0.7 }]}
          onPress={handleSubmit}
          activeOpacity={0.9}
          disabled={isSaving}
        >
          <Text style={styles.submitBtnText}>
            {isSaving ? 'Creating Stokvel…' : `Create Stokvel ($${expectedPool.toFixed(0)} Pool)`}
          </Text>
          <Ionicons name={isSaving ? 'hourglass-outline' : 'arrow-forward'} size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      
      <Modal visible={showTermsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Stokvel Constitution Terms</Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.termsBody}>
                {`# AssetBridge Rotating Stokvel Constitution\n\n` +
                  `1. Group: ${potName.trim() || 'Untitled Stokvel'}\n` +
                  `2. Operating Type: Rotating Payout Stokvel (ROSCA)\n` +
                  `3. Agreed Contribution: $${parsedAmount.toFixed(2)} USDT per cycle\n` +
                  `4. Membership Capacity: ${parsedMembers} members (including primary Owner)\n` +
                  `5. Expected Cycle Pool: $${expectedPool.toFixed(2)} USDT before network gas fees\n` +
                  `6. Frequency: ${frequency} cycles\n` +
                  `7. Equal Obligation: Every member contributes in all cycles, including their payout cycle\n` +
                  `8. Short-Month Rule: Clamps to last calendar day in shorter months\n` +
                  `9. Non-Custodial Testnet: Financial writes remain disabled until real WDK signing and on-chain verification are integrated.`}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setShowTermsModal(false)}
            >
              <Text style={styles.modalDoneText}>Close & Return</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F4F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16 },

  scopeNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  scopeNoticeTitle: { fontSize: 13, fontWeight: '700', color: '#065F46', marginBottom: 2 },
  scopeNoticeText: { fontSize: 12, color: '#047857', lineHeight: 17 },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  helperText: { fontSize: 11, color: '#64748B', marginTop: 4, lineHeight: 15 },

  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentBtnActive: { backgroundColor: '#FFFFFF', borderColor: '#0F172A' },
  segmentText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  segmentTextActive: { color: '#0F172A', fontWeight: '700' },

  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  tokenBadgeTitle: { fontSize: 12, fontWeight: '700', color: '#0369A1' },
  tokenBadgeCode: { fontSize: 10, color: '#0284C7', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  twoColRow: { flexDirection: 'row', gap: 12 },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: { fontSize: 16, fontWeight: '700', color: '#64748B', marginRight: 4 },
  amountInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#0F172A', fontWeight: '700' },

  poolMathBox: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
    marginBottom: 12,
  },
  poolMathHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  poolMathLabel: { color: '#00E676', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  poolMathFormula: { color: '#94A3B8', fontSize: 11, fontWeight: '500' },
  poolMathValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginVertical: 4 },
  poolMathDisclaimer: { color: '#94A3B8', fontSize: 11, lineHeight: 16 },

  calendarRuleBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  calendarRuleTitle: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 2 },
  calendarRuleText: { fontSize: 11, color: '#64748B', lineHeight: 16 },

  termsTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    padding: 16,
  },
  termsTriggerText: { fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1, marginLeft: 10 },

  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
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
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  modalCloseBtn: { padding: 4 },
  termsBody: { fontSize: 13, color: '#334155', lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  modalDoneBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  modalDoneText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
