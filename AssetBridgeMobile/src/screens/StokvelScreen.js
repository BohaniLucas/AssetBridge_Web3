import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mobilePotsService } from '../services/potsService';

export default function StokvelScreen({ onNavigate }) {
  const [pots, setPots] = useState([]);
  const [activePotId, setActivePotId] = useState('friends-stokvel');
  const [isContributing, setIsContributing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutWinner, setPayoutWinner] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const loadPots = async () => {
    try {
      const data = await mobilePotsService.getPots();
      setPots(data);
      if (data.length > 0 && !data.some((p) => p.id === activePotId)) {
        setActivePotId(data[0].id);
      }
    } catch {
      // Keep state
    }
  };

  useEffect(() => {
    loadPots();
  }, []);

  const activePot = pots.find((p) => p.id === activePotId) || pots[0] || {
    id: 'friends-stokvel',
    name: 'Friends Stokvel',
    mode: 'rotation',
    contributionAmount: 20,
    totalPotSize: 100,
    totalRounds: 5,
    currentRound: 1,
    members: [],
    inviteCode: 'POT-STOK-1001',
  };

  const paidCount = activePot.members?.filter((m) => m.paid)?.length || 0;
  const totalMembers = activePot.members?.length || 1;
  const progressPercent = Math.round((paidCount / totalMembers) * 100);
  const userMember = activePot.members?.find((m) => m.isUserSlot || m.id === '5' || m.id === 'm5');
  const hasUserContributed = Boolean(userMember?.paid);

  const handleContribute = async () => {
    setIsContributing(true);
    setStatusMsg('');
    try {
      const res = await mobilePotsService.contributeToPot(activePot.id);
      setPots(res.pots);
      setStatusMsg(`Successfully contributed $${activePot.contributionAmount} USDT!`);
      if (res.payoutEvent) {
        setPayoutWinner(res.payoutEvent.winnerName);
        setShowPayoutModal(true);
      }
    } catch (err) {
      Alert.alert('Contribution Failed', err.message || 'Error sending contribution');
    } finally {
      setIsContributing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      
      {/* 1. HERO BANNER */}
      <View style={styles.heroBanner}>
        <Text style={styles.heroTitle}>Rotating Group Savings</Text>
        <Text style={styles.heroSub}>
          Save together with trusted family and friends. Smart contracts automatically collect and disburse payouts.
        </Text>
      </View>

      {/* 2. POT SELECTOR NAV & NEW POT BUTTON */}
      <View style={styles.navHeaderRow}>
        <Text style={styles.sectionTitle}>Your Active Pots</Text>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.potsNav} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
        
        {/* 🔥 Redesigned "New Pot" Button */}
        <TouchableOpacity style={styles.createPotBtn} onPress={() => onNavigate('CreatePot')} activeOpacity={0.8}>
          <View style={styles.createPotIconWrap}>
            <Ionicons name="add" size={18} color="#0F172A" />
          </View>
          <Text style={styles.createPotBtnText}>Create Pot</Text>
        </TouchableOpacity>

        {pots.map((p) => {
          const isSel = p.id === activePotId;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.potPill, isSel && styles.potPillActive]}
              onPress={() => { setActivePotId(p.id); setStatusMsg(''); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.potPillText, isSel && styles.potPillTextActive]}>{p.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 3. ACTIVE POT DETAILS CARD */}
      <View style={[styles.potCard, styles.shadowSm]}>
        <View style={styles.potCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.potName}>{activePot.name}</Text>
            <Text style={styles.potType}>
              Rotational ROSCA · Round {activePot.currentRound} of {activePot.totalRounds}
            </Text>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={() => setShowShareModal(true)} activeOpacity={0.7}>
            <Text style={styles.shareBtnText}>Invite 🔗</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Contribution</Text>
            <Text style={styles.statVal}>${activePot.contributionAmount}</Text>
            <Text style={styles.statUnit}>USDT / round</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Pot Payout</Text>
            <Text style={[styles.statVal, { color: '#059669' }]}>${activePot.totalPotSize}</Text>
            <Text style={styles.statUnit}>USDT lump sum</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Paid Members</Text>
            <Text style={styles.statVal}>{paidCount}/{totalMembers}</Text>
            <Text style={styles.statUnit}>{progressPercent}% collected</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {statusMsg ? (
          <View style={styles.successCallout}>
            <Text style={styles.successCalloutText}>{statusMsg}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.contributeBtn, hasUserContributed && styles.contributeBtnDisabled, isContributing && { opacity: 0.8 }]}
          onPress={handleContribute}
          disabled={hasUserContributed || isContributing}
          activeOpacity={0.8}
        >
          {isContributing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : hasUserContributed ? (
            <Text style={styles.contributeBtnTextDisabled}>✓ Paid for Round {activePot.currentRound}</Text>
          ) : (
            <Text style={styles.contributeBtnText}>
              Contribute ${activePot.contributionAmount} USDT
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* --- Rest of StokvelScreen (Members List & Info Card) remains exactly the same --- */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F4F8' },
  contentContainer: { padding: 16, paddingBottom: 40 },
  shadowSm: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 3 },
  
  heroBanner: { backgroundColor: '#0F172A', borderRadius: 24, padding: 24, marginBottom: 24, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 6 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5 },
  heroSub: { color: '#94A3B8', fontSize: 13, lineHeight: 20, fontWeight: '500' },

  navHeaderRow: { marginBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  
  potsNav: { flexDirection: 'row', marginBottom: 24 },
  
  /* --- NEW PREMIUM ADD BUTTON --- */
  createPotBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingLeft: 6, paddingRight: 16, paddingVertical: 6, borderRadius: 20, gap: 8 },
  createPotIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  createPotBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  potPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center' },
  potPillActive: { backgroundColor: '#E2E8F0', borderColor: '#CBD5E1' },
  potPillText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  potPillTextActive: { color: '#0F172A' },

  /* --- POT CARD --- */
  potCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#E8EDF3' },
  potCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  potName: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  potType: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  shareBtn: { backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  shareBtnText: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  statsRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, marginBottom: 20, alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  statVal: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  statUnit: { fontSize: 10, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  progressContainer: { marginBottom: 24 },
  progressTrack: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 },
  successCallout: { backgroundColor: '#ECFDF5', padding: 12, borderRadius: 12, marginBottom: 16 },
  successCalloutText: { color: '#065F46', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  contributeBtn: { backgroundColor: '#0F172A', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  contributeBtnDisabled: { backgroundColor: '#F1F5F9' },
  contributeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  contributeBtnTextDisabled: { color: '#94A3B8', fontSize: 15, fontWeight: '700' },
});
