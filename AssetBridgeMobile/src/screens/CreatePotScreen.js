import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CreatePotScreen({ onBack, onSave }) {
  const [potName, setPotName] = useState('');
  const [amount, setAmount] = useState('20');
  
  // Start with one empty member slot
  const [members, setMembers] = useState([{ id: '1', name: '', contact: '' }]);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddMember = () => {
    const newId = (members.length + 1).toString();
    setMembers([...members, { id: newId, name: '', contact: '' }]);
  };

  const handleRemoveMember = (idToRemove) => {
    setMembers(members.filter(m => m.id !== idToRemove));
  };

  const updateMember = (id, field, value) => {
    setMembers(members.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSubmit = async () => {
    if (!potName.trim()) {
      Alert.alert('Missing Info', 'Please enter a name for your Stokvel.');
      return;
    }
    
    const contributionAmount = Number(amount);
    if (!Number.isFinite(contributionAmount) || contributionAmount <= 0) {
      Alert.alert('Invalid contribution', 'Enter a contribution amount greater than zero.');
      return;
    }

    const validMembers = members.filter(m => m.name.trim() !== '');
    setIsSaving(true);
    try {
      await onSave?.({
        name: potName.trim(),
        contributionAmount,
        invitedMembers: validMembers.map(({ name, contact }) => ({ name: name.trim(), contact: contact.trim() })),
      });
      Alert.alert('Success', 'Your Stokvel pot was created and invites are ready.', [
        { text: 'OK', onPress: () => onBack?.() },
      ]);
    } catch (error) {
      Alert.alert('Could not create pot', error.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Pot</Text>
        <View style={{ width: 40 }} /> {/* Spacer to center title */}
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Step 1: Pot Details */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
            <Text style={styles.sectionTitle}>Pot Details</Text>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Stokvel Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. December Holiday Fund"
              placeholderTextColor="#94A3B8"
              value={potName}
              onChangeText={setPotName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contribution per Round (USDT)</Text>
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
        </View>

        {/* Step 2: Add Members */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
            <Text style={styles.sectionTitle}>Invite Members</Text>
          </View>
          <Text style={styles.sectionSub}>Add the details of people you want in the rotation.</Text>

          {members.map((member, index) => (
            <View key={member.id} style={styles.memberFormRow}>
              <View style={styles.memberInputs}>
                <TextInput
                  style={[styles.input, { marginBottom: 8 }]}
                  placeholder="Full Name"
                  placeholderTextColor="#94A3B8"
                  value={member.name}
                  onChangeText={(val) => updateMember(member.id, 'name', val)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="WhatsApp Number or Email"
                  placeholderTextColor="#94A3B8"
                  value={member.contact}
                  onChangeText={(val) => updateMember(member.id, 'contact', val)}
                />
              </View>
              {members.length > 1 && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveMember(member.id)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addMemberBtn} onPress={handleAddMember} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={20} color="#10B981" />
            <Text style={styles.addMemberBtnText}>Add Another Member</Text>
          </TouchableOpacity>
        </View>
        
        {/* Bottom padding for scroll */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Sticky Bottom Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submitBtn, isSaving && { opacity: 0.7 }]} onPress={handleSubmit} activeOpacity={0.9} disabled={isSaving}>
          <Text style={styles.submitBtnText}>{isSaving ? 'Creating Pot…' : 'Create Pot & Send Invites'}</Text>
          <Ionicons name={isSaving ? 'hourglass-outline' : 'arrow-forward'} size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA' },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderRadius: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16 },

  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  sectionSub: { fontSize: 13, color: '#64748B', fontWeight: '500', marginBottom: 20, marginTop: -10, paddingLeft: 40 },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0F172A', fontWeight: '500' },
  
  amountInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 16 },
  currencySymbol: { fontSize: 18, fontWeight: '700', color: '#94A3B8', marginRight: 4 },
  amountInput: { flex: 1, paddingVertical: 14, fontSize: 18, color: '#0F172A', fontWeight: '700' },

  memberFormRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  memberInputs: { flex: 1 },
  removeBtn: { padding: 12, marginLeft: 8, backgroundColor: '#FEF2F2', borderRadius: 12 },

  addMemberBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, backgroundColor: '#ECFDF5', borderRadius: 16, borderWidth: 1, borderColor: '#A7F3D0', borderStyle: 'dashed', marginTop: 8 },
  addMemberBtnText: { fontSize: 14, fontWeight: '700', color: '#059669' },

  footer: { backgroundColor: '#FFFFFF', padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  submitBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 16, paddingVertical: 18, gap: 10 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
