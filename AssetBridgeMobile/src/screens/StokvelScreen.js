import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mobilePotsService } from '../services/potsService';
import { SEPOLIA_USDT_CONTRACT, SEPOLIA_CHAIN_ID } from '../config/api';

export default function StokvelScreen({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'discover'
  const [myPots, setMyPots] = useState([]);
  const [discoverablePots, setDiscoverablePots] = useState([]);
  const [activePotId, setActivePotId] = useState(null);
  const [activePotDetails, setActivePotDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [showJoinByTokenModal, setShowJoinByTokenModal] = useState(false);
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [targetApplyPot, setTargetApplyPot] = useState(null);
  const [applyNote, setApplyNote] = useState('');

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [mine, discoverable] = await Promise.all([
        mobilePotsService.getMyStokvels().catch(() => []),
        mobilePotsService.getDiscoverableStokvels().catch(() => []),
      ]);
      setMyPots(mine);
      setDiscoverablePots(discoverable);

      const targetId = activePotId || (mine.length > 0 ? mine[0].id : null);
      if (targetId) {
        setActivePotId(targetId);
        const details = await mobilePotsService.getStokvelDetails(targetId).catch(() => null);
        setActivePotDetails(details);
      } else {
        setActivePotDetails(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activePotId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectPot = async (id) => {
    setActivePotId(id);
    try {
      const details = await mobilePotsService.getStokvelDetails(id);
      setActivePotDetails(details);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not load group details');
    }
  };

  // Direct Invite Generation
  const handleGenerateInvite = async () => {
    if (!activePotId) return;
    try {
      const res = await mobilePotsService.generateInvite(activePotId, { maxUses: 1, expiryHours: 72 });
      setGeneratedInvite(res);
    } catch (err) {
      Alert.alert('Cannot Generate Invite', err.message || 'Permission denied.');
    }
  };

  // Preview direct invite token
  const handlePreviewToken = async () => {
    if (!inviteTokenInput.trim()) {
      Alert.alert('Missing Code', 'Please enter an invitation token.');
      return;
    }
    setPreviewLoading(true);
    try {
      const preview = await mobilePotsService.previewInvite(inviteTokenInput.trim());
      setPreviewData(preview);
    } catch (err) {
      Alert.alert('Invalid Invite', err.message || 'The invitation is invalid, expired, or revoked.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Explicitly accept invite
  const handleAcceptInvite = async () => {
    if (!previewData) return;
    try {
      await mobilePotsService.acceptInvite(inviteTokenInput.trim(), previewData.termsVersion);
      Alert.alert('Welcome!', `You have explicitly accepted the terms and joined ${previewData.name}.`);
      setShowJoinByTokenModal(false);
      setInviteTokenInput('');
      setPreviewData(null);
      await loadData();
    } catch (err) {
      Alert.alert('Could Not Join', err.message || 'Failed to complete admission.');
    }
  };

  // Apply to discoverable open group
  const handleApplyToJoin = async () => {
    if (!targetApplyPot) return;
    try {
      await mobilePotsService.requestToJoin(targetApplyPot.id, applyNote.trim());
      Alert.alert('Application Submitted', 'The group Owner or Co-admin will review your application.');
      setShowApplyModal(false);
      setApplyNote('');
      await loadData();
    } catch (err) {
      Alert.alert('Application Failed', err.message || 'Could not submit join application.');
    }
  };

  // Review pending join request
  const handleReviewRequest = async (stokvelId, reqId, status) => {
    try {
      await mobilePotsService.reviewJoinRequest(stokvelId, reqId, status);
      Alert.alert('Request Updated', `Applicant was ${status}.`);
      await loadData();
    } catch (err) {
      Alert.alert('Review Failed', err.message || 'Could not process review.');
    }
  };

  // Accept approved terms
  const handleAcceptApprovedTerms = async (stokvelId, termsVersion) => {
    try {
      await mobilePotsService.acceptApprovedTerms(stokvelId, termsVersion);
      Alert.alert('Success', 'Terms accepted! You are now an active member.');
      await loadData();
    } catch (err) {
      Alert.alert('Admission Failed', err.message || 'Could not accept terms.');
    }
  };

  // Submit dispute notice
  const handleRaiseDispute = async () => {
    if (!disputeReason.trim() || disputeReason.trim().length < 5) {
      Alert.alert('Invalid Dispute', 'Please provide a dispute explanation of at least 5 characters.');
      return;
    }
    try {
      await mobilePotsService.raiseDispute(activePotId, { reason: disputeReason.trim() });
      Alert.alert('Dispute Logged', 'Your formal dispute notice has been submitted to group administration.');
      setShowDisputeModal(false);
      setDisputeReason('');
      await loadData();
    } catch (err) {
      Alert.alert('Could Not File Dispute', err.message || 'Failed to submit notice.');
    }
  };

  // View audit log
  const handleOpenAudit = async () => {
    if (!activePotId) return;
    try {
      const logs = await mobilePotsService.getAuditTrail(activePotId);
      setAuditLogs(logs);
      setShowAuditModal(true);
    } catch (err) {
      Alert.alert('Audit Restricted', err.message || 'Only enrolled members may view the audit trail.');
    }
  };

  const isOwnerOrCoAdmin =
    activePotDetails?.user_role === 'owner' || activePotDetails?.user_role === 'co_admin';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      
      <View style={styles.heroBanner}>
        <View style={styles.scopeTag}>
          <Ionicons name="repeat" size={14} color="#00E676" />
          <Text style={styles.scopeTagText}>Rotating Payout Stokvel (ROSCA) Only</Text>
        </View>
        <Text style={styles.heroTitle}>Rotating Group Savings</Text>
        <Text style={styles.heroSub}>
          Save together with trusted family and friends. Non-custodial, testnet-governed rotation rounds where each member contributes equally and receives one full pool in rotation.
        </Text>
      </View>

      
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => onNavigate('CreatePot')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color="#0F172A" />
          <Text style={styles.createBtnText}>Create Rotating Stokvel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.joinTokenBtn}
          onPress={() => {
            setInviteTokenInput('');
            setPreviewData(null);
            setShowJoinByTokenModal(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="qr-code-outline" size={16} color="#0F172A" />
          <Text style={styles.joinTokenBtnText}>Join via Invite</Text>
        </TouchableOpacity>
      </View>

      
      <View style={styles.tabToggleRow}>
        <TouchableOpacity
          style={[styles.tabToggleBtn, activeTab === 'my' && styles.tabToggleBtnActive]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabToggleText, activeTab === 'my' && styles.tabToggleTextActive]}>
            My Stokvels ({myPots.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabToggleBtn, activeTab === 'discover' && styles.tabToggleBtnActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabToggleText, activeTab === 'discover' && styles.tabToggleTextActive]}>
            Discover Open Groups ({discoverablePots.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#0F172A" />
          <Text style={styles.loadingText}>Loading Stokvels…</Text>
        </View>
      ) : activeTab === 'discover' ? (
        /* DISCOVERABLE GROUPS VIEW */
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionHeading}>Open for Membership Applications</Text>
          <Text style={styles.sectionSub}>
            Discoverable groups accept applications. Once approved by the Owner or Co-admin, you must explicitly accept the group’s immutable terms to be admitted.
          </Text>

          {discoverablePots.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="compass-outline" size={32} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Open Groups Currently</Text>
              <Text style={styles.emptySub}>
                Be the first to create a discoverable rotating group for your community!
              </Text>
            </View>
          ) : (
            discoverablePots.map((pot) => {
              const expectedPool = Math.round(pot.max_members * Number(pot.contribution_amount) * 100) / 100;
              const isFull = pot.join_status === 'closed';

              return (
                <View key={pot.id} style={styles.discoverCard}>
                  <View style={styles.discoverCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.discoverName}>{pot.name}</Text>
                      <Text style={styles.discoverDesc}>{pot.description || 'Community Rotating Payout Group'}</Text>
                    </View>
                    <View style={[styles.statusBadge, isFull ? styles.statusBadgeClosed : styles.statusBadgeOpen]}>
                      <Text style={[styles.statusBadgeText, isFull ? styles.statusBadgeTextClosed : styles.statusBadgeTextOpen]}>
                        {isFull ? 'Capacity Reached' : 'Open for Joining'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.discoverStatsGrid}>
                    <View style={styles.discoverStatItem}>
                      <Text style={styles.discoverStatLabel}>Contribution</Text>
                      <Text style={styles.discoverStatVal}>${pot.contribution_amount} USDT</Text>
                      <Text style={styles.discoverStatSub}>{pot.frequency}</Text>
                    </View>
                    <View style={styles.discoverStatItem}>
                      <Text style={styles.discoverStatLabel}>Expected Pool (N×C)</Text>
                      <Text style={[styles.discoverStatVal, { color: '#059669' }]}>${expectedPool.toFixed(2)} USDT</Text>
                      <Text style={styles.discoverStatSub}>{pot.max_members} members</Text>
                    </View>
                    <View style={styles.discoverStatItem}>
                      <Text style={styles.discoverStatLabel}>Network</Text>
                      <Text style={styles.discoverStatVal}>Sepolia USDT</Text>
                      <Text style={styles.discoverStatSub}>ERC-20</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.applyBtn, isFull && styles.applyBtnDisabled]}
                    disabled={isFull}
                    onPress={() => {
                      setTargetApplyPot(pot);
                      setApplyNote('');
                      setShowApplyModal(true);
                    }}
                  >
                    <Ionicons name="paper-plane-outline" size={16} color={isFull ? '#94A3B8' : '#FFFFFF'} />
                    <Text style={[styles.applyBtnText, isFull && styles.applyBtnTextDisabled]}>
                      {isFull ? 'Group Closed' : 'Apply to Join Group'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      ) : (
        /* MY STOKVELS VIEW */
        <View style={styles.sectionWrap}>
          {myPots.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={36} color="#94A3B8" />
              <Text style={styles.emptyTitle}>You Haven’t Joined Any Stokvels</Text>
              <Text style={styles.emptySub}>
                Create your own rotating group or join an existing one using an invitation link or by applying in the Discover tab.
              </Text>
            </View>
          ) : (
            <>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.potsNav} contentContainerStyle={{ gap: 10 }}>
                {myPots.map((p) => {
                  const isSel = p.id === activePotId;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.potPill, isSel && styles.potPillActive]}
                      onPress={() => handleSelectPot(p.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.potPillText, isSel && styles.potPillTextActive]}>{p.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {activePotDetails && (
                <View style={styles.potDetailCard}>
                  
                  <View style={styles.potDetailHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailTitle}>{activePotDetails.name}</Text>
                      <Text style={styles.detailSub}>
                        Rotating Payout ROSCA · Terms v{activePotDetails.terms_version}
                      </Text>
                    </View>
                    <View style={styles.badgeCol}>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>Role: {(activePotDetails.user_role || 'member').toUpperCase()}</Text>
                      </View>
                      <View style={[styles.statusBadge, styles.statusBadgeOpen]}>
                        <Text style={[styles.statusBadgeText, styles.statusBadgeTextOpen]}>
                          {(activePotDetails.lifecycle_status || 'draft').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  
                  {activePotDetails.my_request?.status === 'approved' && (
                    <View style={styles.reservationBanner}>
                      <Ionicons name="time-outline" size={18} color="#D97706" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reservationTitle}>Seat Reserved! Action Required</Text>
                        <Text style={styles.reservationSub}>
                          Your application was approved. You must explicitly review and accept terms before your 48h reservation expires.
                        </Text>
                        <TouchableOpacity
                          style={styles.reservationActionBtn}
                          onPress={() => handleAcceptApprovedTerms(activePotDetails.id, activePotDetails.terms_version)}
                        >
                          <Text style={styles.reservationActionText}>Accept Immutable Terms & Enter</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Contribution</Text>
                      <Text style={styles.statVal}>${activePotDetails.contribution_amount}</Text>
                      <Text style={styles.statUnit}>USDT / {activePotDetails.frequency}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Expected Pool (N×C)</Text>
                      <Text style={[styles.statVal, { color: '#059669' }]}>
                        ${Math.round(activePotDetails.max_members * Number(activePotDetails.contribution_amount) * 100) / 100}
                      </Text>
                      <Text style={styles.statUnit}>USDT before gas</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Active Members</Text>
                      <Text style={styles.statVal}>
                        {(activePotDetails.members || []).length}/{activePotDetails.max_members}
                      </Text>
                      <Text style={styles.statUnit}>{activePotDetails.join_status === 'closed' ? 'Closed' : 'Open'}</Text>
                    </View>
                  </View>

                  
                  <View style={styles.financialGuardBox}>
                    <Ionicons name="information-circle-outline" size={18} color="#0369A1" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.financialGuardTitle}>Testnet Non-Custodial Safety</Text>
                      <Text style={styles.financialGuardText}>
                        Contributions and payouts are disabled until real WDK signing and on-chain verification are integrated. No simulated settlement or mock balances are generated.
                      </Text>
                    </View>
                  </View>

                  
                  <View style={styles.quickActionGrid}>
                    {isOwnerOrCoAdmin && (
                      <TouchableOpacity
                        style={styles.actionPill}
                        onPress={() => {
                          setShowInviteModal(true);
                          handleGenerateInvite();
                        }}
                      >
                        <Ionicons name="person-add-outline" size={15} color="#0F172A" />
                        <Text style={styles.actionPillText}>Invite Link</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.actionPill}
                      onPress={() => setShowTermsModal(true)}
                    >
                      <Ionicons name="document-text-outline" size={15} color="#0F172A" />
                      <Text style={styles.actionPillText}>Terms & Rules</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionPill}
                      onPress={handleOpenAudit}
                    >
                      <Ionicons name="list-outline" size={15} color="#0F172A" />
                      <Text style={styles.actionPillText}>Audit Trail</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionPill}
                      onPress={() => setShowDisputeModal(true)}
                    >
                      <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
                      <Text style={[styles.actionPillText, { color: '#EF4444' }]}>File Dispute</Text>
                    </TouchableOpacity>
                  </View>

                  
                  {isOwnerOrCoAdmin && (activePotDetails.join_requests || []).filter((r) => r.status === 'pending').length > 0 && (
                    <View style={styles.reviewInbox}>
                      <Text style={styles.inboxTitle}>Pending Join Applications</Text>
                      {(activePotDetails.join_requests || [])
                        .filter((r) => r.status === 'pending')
                        .map((req) => (
                          <View key={req.id} style={styles.inboxItem}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.applicantUser}>Applicant: {req.user_id.slice(0, 8)}...</Text>
                              <Text style={styles.applicantNote}>{req.note || 'No applicant note provided'}</Text>
                            </View>
                            <View style={styles.inboxActions}>
                              <TouchableOpacity
                                style={styles.approveBtn}
                                onPress={() => handleReviewRequest(activePotDetails.id, req.id, 'approved')}
                              >
                                <Text style={styles.approveBtnText}>Approve</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.declineBtn}
                                onPress={() => handleReviewRequest(activePotDetails.id, req.id, 'declined')}
                              >
                                <Text style={styles.declineBtnText}>Decline</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                    </View>
                  )}

                  
                  <View style={styles.rosterSection}>
                    <Text style={styles.rosterHeading}>Rotation Order & Schedule</Text>
                    <Text style={styles.rosterSub}>
                      Every member contributes in each cycle. One member receives the lump-sum pool in their designated rotation slot.
                    </Text>

                    {(activePotDetails.schedule || []).map((slot, index) => {
                      const member = (activePotDetails.members || []).find((m) => m.rotation_order === slot.cycleNumber);
                      return (
                        <View key={slot.cycleNumber} style={styles.scheduleRow}>
                          <View style={styles.cycleBadge}>
                            <Text style={styles.cycleBadgeText}>#{slot.cycleNumber}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.scheduleBeneficiary}>
                              {member ? `Member (${member.user_id.slice(0, 8)}...)` : `Unassigned Slot ${slot.cycleNumber}`}
                            </Text>
                            <Text style={styles.scheduleDate}>
                              Due: {slot.cutoffDate?.slice(0, 10)} · Disburse: {slot.payoutDate?.slice(0, 10)}
                            </Text>
                          </View>
                          <View style={styles.slotAmountWrap}>
                            <Text style={styles.slotAmount}>${slot.expectedPool} USDT</Text>
                            <Text style={styles.slotStatus}>Scheduled</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      )}

      
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Direct Member Invitation</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Share this secure, high-entropy invite link. Invitees will preview the terms constitution and must explicitly accept before being admitted.
            </Text>

            {generatedInvite ? (
              <View style={styles.inviteDisplayBox}>
                <Text style={styles.tokenLabel}>INVITATION TOKEN</Text>
                <TextInput
                  style={styles.tokenText}
                  value={generatedInvite.token}
                  editable={false}
                  selectTextOnFocus
                />
                <Text style={styles.tokenMeta}>
                  Expires in 72 hours · Single use · Hashed storage
                </Text>
              </View>
            ) : (
              <ActivityIndicator color="#0F172A" style={{ marginVertical: 20 }} />
            )}

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setShowInviteModal(false)}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      
      <Modal visible={showJoinByTokenModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join Rotating Stokvel</Text>
              <TouchableOpacity onPress={() => setShowJoinByTokenModal(false)}>
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {!previewData ? (
              <>
                <Text style={styles.modalSub}>
                  Paste the invitation token provided by the Group Owner or Co-admin. You will be able to review all terms before joining.
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Paste 64-character token..."
                  placeholderTextColor="#94A3B8"
                  value={inviteTokenInput}
                  onChangeText={setInviteTokenInput}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.modalDoneBtn, previewLoading && { opacity: 0.7 }]}
                  onPress={handlePreviewToken}
                  disabled={previewLoading}
                >
                  <Text style={styles.modalDoneText}>{previewLoading ? 'Verifying Link…' : 'Preview Group Terms'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                <View style={styles.previewBox}>
                  <Text style={styles.previewGroup}>{previewData.name}</Text>
                  <Text style={styles.previewSub}>
                    Expected Pool: ${previewData.expectedPool} USDT · {previewData.frequency}
                  </Text>
                  <View style={styles.previewTermsCard}>
                    <Text style={styles.termsBody}>{previewData.termsMarkdown}</Text>
                  </View>
                </View>

                <View style={styles.dualModalBtns}>
                  <TouchableOpacity
                    style={[styles.modalDoneBtn, { flex: 1, backgroundColor: '#059669' }]}
                    onPress={handleAcceptInvite}
                  >
                    <Text style={styles.modalDoneText}>Accept Terms & Join</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalDoneBtn, { flex: 1, backgroundColor: '#E2E8F0' }]}
                    onPress={() => setPreviewData(null)}
                  >
                    <Text style={[styles.modalDoneText, { color: '#0F172A' }]}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      
      <Modal visible={showApplyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply to Join</Text>
              <TouchableOpacity onPress={() => setShowApplyModal(false)}>
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Apply to join {targetApplyPot?.name}. The group Owner or Co-admin will review your application. If approved, a seat is reserved for 48 hours for your terms acceptance.
            </Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Introduce yourself or leave an application note (optional)..."
              placeholderTextColor="#94A3B8"
              multiline
              value={applyNote}
              onChangeText={setApplyNote}
            />
            <TouchableOpacity style={styles.modalDoneBtn} onPress={handleApplyToJoin}>
              <Text style={styles.modalDoneText}>Submit Application</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      
      <Modal visible={showTermsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Immutable Stokvel Constitution</Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)}>
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.termsBody}>
                {activePotDetails?.terms_markdown || 'No terms constitution record available.'}
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setShowTermsModal(false)}>
              <Text style={styles.modalDoneText}>Close Terms</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      
      <Modal visible={showAuditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Immutable Audit Trail</Text>
              <TouchableOpacity onPress={() => setShowAuditModal(false)}>
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {auditLogs.length === 0 ? (
                <Text style={styles.modalSub}>No audit events recorded yet.</Text>
              ) : (
                auditLogs.map((log) => (
                  <View key={log.id} style={styles.auditRow}>
                    <Text style={styles.auditAction}>{log.action}</Text>
                    <Text style={styles.auditDate}>{log.created_at?.slice(0, 19).replace('T', ' ')}</Text>
                    <Text style={styles.auditActor}>Actor: {log.actor_user_id || 'System'}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setShowAuditModal(false)}>
              <Text style={styles.modalDoneText}>Close Audit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      
      <Modal visible={showDisputeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>File Formal Dispute Notice</Text>
              <TouchableOpacity onPress={() => setShowDisputeModal(false)}>
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              If an on-chain status or schedule slot is contested, submit a formal dispute notice. This will be logged on the group audit trail.
            </Text>
            <TextInput
              style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Describe the issue, cycle number, and reason for the dispute..."
              placeholderTextColor="#94A3B8"
              multiline
              value={disputeReason}
              onChangeText={setDisputeReason}
            />
            <TouchableOpacity style={[styles.modalDoneBtn, { backgroundColor: '#EF4444' }]} onPress={handleRaiseDispute}>
              <Text style={styles.modalDoneText}>Submit Dispute Notice</Text>
            </TouchableOpacity>
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
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  scopeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  scopeTagText: { color: '#00E676', fontSize: 11, fontWeight: '700' },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  heroSub: { color: '#94A3B8', fontSize: 12, lineHeight: 18 },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  createBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E676',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 6,
  },
  createBtnText: { color: '#0A0F1C', fontSize: 13, fontWeight: '700' },
  joinTokenBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 6,
  },
  joinTokenBtnText: { color: '#0F172A', fontSize: 13, fontWeight: '700' },

  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tabToggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabToggleBtnActive: { backgroundColor: '#FFFFFF' },
  tabToggleText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tabToggleTextActive: { color: '#0F172A', fontWeight: '800' },

  loadingBox: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#64748B', fontSize: 13, marginTop: 10, fontWeight: '600' },

  sectionWrap: { marginBottom: 20 },
  sectionHeading: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#64748B', marginBottom: 14, lineHeight: 16 },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 10, marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 16 },

  discoverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  discoverCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  discoverName: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  discoverDesc: { fontSize: 12, color: '#64748B' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeOpen: { backgroundColor: '#ECFDF5' },
  statusBadgeClosed: { backgroundColor: '#FEF2F2' },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  statusBadgeTextOpen: { color: '#059669' },
  statusBadgeTextClosed: { color: '#DC2626' },

  discoverStatsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  discoverStatItem: { flex: 1, alignItems: 'center' },
  discoverStatLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  discoverStatVal: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  discoverStatSub: { fontSize: 10, color: '#94A3B8', marginTop: 1 },

  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  applyBtnDisabled: { backgroundColor: '#E2E8F0' },
  applyBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  applyBtnTextDisabled: { color: '#94A3B8' },

  potsNav: { flexDirection: 'row', marginBottom: 14 },
  potPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  potPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  potPillText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  potPillTextActive: { color: '#FFFFFF' },

  potDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  potDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  detailTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  detailSub: { fontSize: 12, color: '#64748B' },
  badgeCol: { alignItems: 'flex-end', gap: 4 },
  roleBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { fontSize: 9, fontWeight: '800', color: '#475569' },

  reservationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  reservationTitle: { fontSize: 12, fontWeight: '800', color: '#92400E', marginBottom: 2 },
  reservationSub: { fontSize: 11, color: '#B45309', lineHeight: 15, marginBottom: 8 },
  reservationActionBtn: {
    backgroundColor: '#92400E',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  reservationActionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 26, backgroundColor: '#E2E8F0' },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#64748B', marginBottom: 2 },
  statVal: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  statUnit: { fontSize: 9, color: '#94A3B8', marginTop: 2 },

  financialGuardBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  financialGuardTitle: { fontSize: 11, fontWeight: '700', color: '#0369A1', marginBottom: 2 },
  financialGuardText: { fontSize: 10, color: '#0284C7', lineHeight: 14 },

  quickActionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionPillText: { fontSize: 11, fontWeight: '700', color: '#334155' },

  reviewInbox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  inboxTitle: { fontSize: 12, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  inboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  applicantUser: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  applicantNote: { fontSize: 10, color: '#64748B' },
  inboxActions: { flexDirection: 'row', gap: 6 },
  approveBtn: { backgroundColor: '#059669', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  approveBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  declineBtn: { backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  declineBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  rosterSection: { marginTop: 4 },
  rosterHeading: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  rosterSub: { fontSize: 11, color: '#64748B', marginBottom: 12 },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cycleBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cycleBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  scheduleBeneficiary: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  scheduleDate: { fontSize: 10, color: '#64748B', marginTop: 2 },
  slotAmountWrap: { alignItems: 'flex-end' },
  slotAmount: { fontSize: 12, fontWeight: '800', color: '#059669' },
  slotStatus: { fontSize: 9, color: '#94A3B8' },

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
    marginBottom: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalSub: { fontSize: 12, color: '#64748B', lineHeight: 17, marginBottom: 14 },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 14,
  },
  modalDoneBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  modalDoneText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  dualModalBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },

  inviteDisplayBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  tokenLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 4 },
  tokenText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  tokenMeta: { fontSize: 10, color: '#94A3B8' },

  previewBox: { marginBottom: 12 },
  previewGroup: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  previewSub: { fontSize: 12, color: '#64748B', marginBottom: 10 },
  previewTermsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  termsBody: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  auditRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  auditAction: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  auditDate: { fontSize: 10, color: '#94A3B8' },
  auditActor: { fontSize: 10, color: '#64748B' },
});
