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
import { potsService } from '../services/potsService';

export default function StokvelScreen() {
  const [pots, setPots] = useState([]);
  const [activePotId, setActivePotId] = useState(null);
  const [isContributing, setIsContributing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutWinner, setPayoutWinner] = useState('');
  const [newPotName, setNewPotName] = useState('');
  const [newPotAmount, setNewPotAmount] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    let isActive = true;
    Promise.resolve(potsService.getPots())
      .then((data) => { if (isActive) setPots(data); })
      .catch(() => {});
    return () => { isActive = false; };
  }, []);

  const activePot = pots.find((p) => p.id === activePotId) || pots[0] || {
    id: null,
    name: 'No stokvel connected',
    mode: 'rotation',
    contributionAmount: 0,
    totalPotSize: 0,
    totalRounds: 0,
    currentRound: 0,
    members: [],
    inviteCode: null,
  };

  const paidCount = activePot.members?.filter((m) => m.paid)?.length || 0;
  const totalMembers = activePot.members?.length || 0;
  const progressPercent = totalMembers ? Math.round((paidCount / totalMembers) * 100) : 0;

  const userMember = null;
  const hasUserContributed = Boolean(userMember?.paid);

  const handleContribute = async () => {
    setIsContributing(true);
    setStatusMsg('');

    try {
      const res = await potsService.contributeToPot(activePot.id);
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

  const handleCreatePot = async () => {
    if (!newPotName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for the pot');
      return;
    }

    try {
      const created = await potsService.createPot({
        name: newPotName,
        mode: 'rotation',
        contributionAmount: Number(newPotAmount) || 20,
      });
      setPots((prev) => [created, ...prev]);
      setActivePotId(created.id);
      setShowCreateModal(false);
      setNewPotName('');
      Alert.alert('Pot Created', `Created ${created.name} successfully!`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not create pot');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* Hero Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>COMMUNITY STOKVELS & CHAMA POTS</Text>
        </View>
        <Text style={styles.heroTitle}>Rotating Group Savings</Text>
        <Text style={styles.heroSub}>
          Stokvel screens are prepared, but a verified group vault is not connected yet. Contributions and payouts are disabled.
        </Text>
      </View>

      {/* Pot Selector Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.potsNav}>
        {pots.map((p) => {
          const isSel = p.id === activePotId;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.potPill, isSel && styles.potPillActive]}
              onPress={() => {
                setActivePotId(p.id);
                setStatusMsg('');
              }}
            >
              <Text style={[styles.potPillText, isSel && styles.potPillTextActive]}>{p.name}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.newPotPill} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.newPotPillText}>+ New Pot</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Active Pot Card */}
      <View style={styles.potCard}>
        <View style={styles.potCardHeader}>
          <View>
            <Text style={styles.potName}>{activePot.name}</Text>
            <Text style={styles.potType}>
              Rotational ROSCA · Round {activePot.currentRound} of {activePot.totalRounds}
            </Text>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={() => setShowShareModal(true)}>
            <Text style={styles.shareBtnText}>Invite Code 🔗</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Per Member</Text>
            <Text style={styles.statVal}>${activePot.contributionAmount}</Text>
            <Text style={styles.statUnit}>USDT / round</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Pot Payout</Text>
            <Text style={[styles.statVal, { color: '#00C29A' }]}>${activePot.totalPotSize}</Text>
            <Text style={styles.statUnit}>USDT lump sum</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Members Paid</Text>
            <Text style={styles.statVal}>{paidCount} / {totalMembers}</Text>
            <Text style={styles.statUnit}>{progressPercent}% collected</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
        </View>

        {/* Status Callout */}
        {statusMsg ? (
          <View style={styles.successCallout}>
            <Text style={styles.successCalloutText}>{statusMsg}</Text>
          </View>
        ) : null}

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.contributeBtn,
            hasUserContributed && styles.contributeBtnDisabled,
            isContributing && { opacity: 0.7 },
          ]}
          onPress={handleContribute}
          disabled={hasUserContributed || isContributing}
        >
          {isContributing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : hasUserContributed ? (
            <Text style={styles.contributeBtnText}>✓ Contribution recorded for Round {activePot.currentRound}</Text>
          ) : (
            <Text style={styles.contributeBtnText}>
              Contribute ${activePot.contributionAmount} USDT to Round {activePot.currentRound}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Circle Members Section */}
      <View style={styles.membersSection}>
        <Text style={styles.sectionTitle}>Pot Members & Rotational Payout Turn</Text>
        <Text style={styles.sectionSub}>Payouts cycle sequentially each round</Text>

        <View style={styles.memberList}>
          {activePot.members?.map((m, idx) => {
            const isTurn = m.turn === activePot.currentRound;
            return (
              <View key={m.id || idx} style={[styles.memberItem, isTurn && styles.memberItemActive]}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>
                    {(m.name || 'M').charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>
                      {m.name} {m.isUserSlot ? '(You)' : ''}
                    </Text>
                    {isTurn && (
                      <View style={styles.turnBadge}>
                        <Text style={styles.turnBadgeText}>RECEIVING POT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.memberTurnSub}>Payout Turn: Round {m.turn}</Text>
                </View>

                <View style={styles.memberStatus}>
                  {m.paid ? (
                    <View style={styles.paidBadge}>
                      <Text style={styles.paidBadgeText}>✓ Paid ${m.amount || activePot.contributionAmount}</Text>
                    </View>
                  ) : (
                    <View style={styles.waitingBadge}>
                      <Text style={styles.waitingBadgeText}>Pending</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* How Stokvel Works */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How Rotating Stokvels Work</Text>
        <Text style={styles.infoText}>
          1. Every member contributes a fixed amount (e.g. $20 USDT) each round.{'\n'}
          2. The full pot (${activePot.totalPotSize} USDT) would pay out to that round&apos;s recipient when a verified vault is available.{'\n'}
          3. Payout cycles through every member until the circle completes, fully audited by smart contract.
        </Text>
      </View>

      {/* Share / Invite Modal */}
      <Modal visible={showShareModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Invite Members to {activePot.name}</Text>
            <Text style={styles.modalSub}>Share this private circle code with friends or family</Text>

            <View style={styles.codeBox}>
          <Text style={styles.codeText}>{activePot.inviteCode || 'No invite code available'}</Text>
            </View>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                setShowShareModal(false);
                Alert.alert('Code Copied', `Invite code ${activePot.inviteCode} copied to clipboard!`);
              }}
            >
              <Text style={styles.actionBtnText}>Copy Invite Code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowShareModal(false)}>
              <Text style={styles.closeBtnLabel}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Pot Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Create New Stokvel / Chama</Text>
            <Text style={styles.modalSub}>Start a rotational group savings circle with friends</Text>

            <Text style={styles.inputLabel}>Pot Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newPotName}
              onChangeText={setNewPotName}
              placeholder="e.g. Holiday Family Pot"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Contribution per Round (USDT)</Text>
            <TextInput
              style={styles.modalInput}
              value={newPotAmount}
              onChangeText={setNewPotAmount}
              keyboardType="numeric"
              placeholder="20"
              placeholderTextColor="#94A3B8"
            />

            <TouchableOpacity style={styles.actionBtn} onPress={handleCreatePot}>
              <Text style={styles.actionBtnText}>Create Pot</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowCreateModal(false)}>
              <Text style={styles.closeBtnLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Payout Celebration Modal */}
      <Modal visible={showPayoutModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.celebrationBox}>
            <Text style={styles.celebrateEmoji}>🎉 💰 🚀</Text>
            <Text style={styles.celebrateTitle}>Pot Round Complete!</Text>
            <Text style={styles.celebrateSub}>
              All members have contributed! The total pot of ${activePot.totalPotSize} USDT has been automatically disbursed to:
            </Text>
            <Text style={styles.winnerHighlight}>{payoutWinner || 'Round Recipient'}</Text>

            <TouchableOpacity
              style={[styles.actionBtn, { marginTop: 20 }]}
              onPress={() => setShowPayoutModal(false)}
            >
              <Text style={styles.actionBtnText}>Celebrate & Continue</Text>
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
  potsNav: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  potPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  potPillActive: {
    backgroundColor: '#101936',
    borderColor: '#101936',
  },
  potPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  potPillTextActive: {
    color: '#FFFFFF',
  },
  newPotPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#EAF9F3',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
  },
  newPotPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00C29A',
  },
  potCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  potCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  potName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  potType: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  shareBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  statVal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  statUnit: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00C29A',
    borderRadius: 4,
  },
  successCallout: {
    backgroundColor: '#EAF9F3',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  successCalloutText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  contributeBtn: {
    backgroundColor: '#00C29A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#00C29A',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  contributeBtnDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  contributeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  membersSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  memberList: {
    gap: 10,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  memberItemActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  turnBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  turnBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  memberTurnSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  memberStatus: {
    alignItems: 'flex-end',
  },
  paidBadge: {
    backgroundColor: '#EAF9F3',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  paidBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00C29A',
  },
  waitingBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  waitingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  infoCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    padding: 16,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
  },
  celebrationBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  celebrateEmoji: {
    fontSize: 44,
    marginBottom: 10,
  },
  celebrateTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  celebrateSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  winnerHighlight: {
    fontSize: 22,
    fontWeight: '900',
    color: '#00C29A',
    backgroundColor: '#EAF9F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },
  codeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#101936',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 14,
    color: '#0F172A',
  },
  actionBtn: {
    backgroundColor: '#00C29A',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  closeBtnLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
});

