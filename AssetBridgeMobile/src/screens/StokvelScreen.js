import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { mobilePotsService } from '../services/potsService';

export default function StokvelScreen({ wallet, onContribute }) {
  const [pots, setPots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mobilePotsService.getPots().then((data) => {
      setPots(data);
      setLoading(false);
    });
  }, []);

  const handleContribute = async (pot) => {
    const contributionAmount = 20; // 20 USDT per member
    if ((wallet?.balanceUsdt || 0) < contributionAmount) {
      Alert.alert('Insufficient Balance', `You need $${contributionAmount} USDT to contribute, but have $${wallet?.balanceUsdt || 0} USDT.`);
      return;
    }

    try {
      await onContribute({ potId: pot.id, amountUsdt: contributionAmount });
      // Update UI state
      setPots((prev) =>
        prev.map((p) => {
          if (p.id === pot.id) {
            return {
              ...p,
              members: p.members.map((m) => (m.name.includes('You') ? { ...m, hasContributedThisRound: true } : m)),
            };
          }
          return p;
        })
      );
      Alert.alert('Contribution Recorded', `Contributed $${contributionAmount} USDT to ${pot.name}!`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Contribution failed.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Stokvel & Chama Pots</Text>
        <Text style={styles.subtitle}>Community rotational savings & tokenised group vaults</Text>
      </View>

      {pots.map((pot) => {
        const contributedCount = pot.members.filter((m) => m.hasContributedThisRound).length;
        const totalCount = pot.members.length;
        const userHasContributed = pot.members.some((m) => m.name.includes('You') && m.hasContributedThisRound);

        return (
          <View key={pot.id} style={styles.potCard}>
            <View style={styles.potHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.potName}>{pot.name}</Text>
                <Text style={styles.potStrategy}>
                  Strategy: {pot.strategy === 'rotation' ? 'Rotational Payout' : 'Investment Vault'}
                </Text>
              </View>
              <View style={styles.roundBadge}>
                <Text style={styles.roundText}>Round {pot.currentRound}/{pot.totalRounds}</Text>
              </View>
            </View>

            {/* Target and progress */}
            <View style={styles.metricsRow}>
              <View>
                <Text style={styles.metricLabel}>POT TARGET</Text>
                <Text style={styles.metricVal}>${pot.targetAmountUsdt} USDT</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.metricLabel}>CONTRIBUTORS</Text>
                <Text style={styles.metricVal}>{contributedCount}/{totalCount} Paid</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${(contributedCount / totalCount) * 100}%` }]} />
            </View>

            {/* Members status */}
            <View style={styles.membersBox}>
              <Text style={styles.membersTitle}>Round Contributors:</Text>
              {pot.members.map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={[styles.memberStatus, member.hasContributedThisRound && styles.memberPaid]}>
                    {member.hasContributedThisRound ? '✓ Paid $20' : 'Pending'}
                  </Text>
                </View>
              ))}
            </View>

            {/* Contribution Button */}
            <TouchableOpacity
              style={[styles.contributeBtn, userHasContributed && styles.contributeBtnDone]}
              disabled={userHasContributed}
              onPress={() => handleContribute(pot)}
            >
              <Text style={styles.contributeBtnText}>
                {userHasContributed ? '✓ You Contributed This Round' : 'Contribute $20.00 USDT'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 3 },
  potCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  potHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  potName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  potStrategy: { fontSize: 11, color: '#64748B', marginTop: 2 },
  roundBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  roundText: { fontSize: 10, fontWeight: '800', color: '#475569' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  metricLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  metricVal: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  progressBarBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, marginVertical: 12, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00C29A', borderRadius: 4 },
  membersBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginVertical: 10 },
  membersTitle: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 6 },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  memberName: { fontSize: 11, color: '#334155' },
  memberStatus: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  memberPaid: { color: '#059669' },
  contributeBtn: { backgroundColor: '#00C29A', paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  contributeBtnDone: { backgroundColor: '#E2E8F0' },
  contributeBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});

