import {
  isAuthoritativeToken,
  calculateSchedule,
  STOKVEL_ROLES,
  LIFECYCLE_STATUSES,
  JOIN_STATUSES,
} from '../constants/stokvelConstants.js';
import { stokvelDatabaseService } from './stokvelDatabaseService.js';

class StokvelService {
  /**
   * Generates immutable terms markdown and rules snapshot for a given configuration
   */
  generateTermsContent({
    name,
    contributionAmount,
    frequency,
    maxMembers,
    tokenSymbol = 'USDT',
    deadlineDays = 3,
    graceDays = 3,
    disputeMethod = 'majority_vote',
    timezone = 'Africa/Johannesburg',
  }) {
    const totalPool = Math.round(Number(contributionAmount) * Number(maxMembers) * 1000000) / 1000000;

    const markdown = `# AssetBridge Rotating Stokvel Constitution & Rules

## 1. Group Identity & Type
- **Stokvel Name**: ${name}
- **Operating Type**: Rotating Payout Stokvel (ROSCA)
- **Target Membership Capacity**: ${maxMembers} members (including the primary Group Owner)

## 2. Financial Terms & Pool Calculation
- **Agreed Contribution**: $${Number(contributionAmount).toFixed(2)} ${tokenSymbol} per member, every cycle.
- **Cycle Frequency**: ${frequency}
- **Expected Cycle Pool**: $${totalPool.toFixed(2)} ${tokenSymbol} (${maxMembers} members × $${Number(contributionAmount).toFixed(2)} ${tokenSymbol}), before disclosed network gas fees.
- **Participation Obligation**: Every enrolled member must contribute the agreed amount every cycle, including during the cycle in which they receive their scheduled payout.

## 3. Schedule, Grace Period & Calendar Rules
- **Contribution Window**: ${deadlineDays} days from cycle open date at 18:00 (${timezone}).
- **Grace Period**: ${graceDays} calendar days following the contribution cutoff.
- **Month-End Rule**: For monthly cycles with dates falling on the 29th–31st, in shorter months (e.g., February, April), the due cutoff automatically resolves to the final calendar day of that month.
- **Cycle Completion**: One complete round comprises exactly ${maxMembers} cycles, ensuring every active member receives one scheduled lump-sum payout in agreed sequence.

## 4. Fair Treatment & Missed Payments
- **No Automatic Fines**: AssetBridge does not apply automatic compounding penalties, fines, or balance seizures.
- **Transparent Notice & Appeals**: If a contribution is overdue, the member enters a formal grace window and may file a dispute notice with supporting evidence if an on-chain status is contested.
- **Shortfall Handling**: If required funds do not arrive, the payout is marked as shortfall and held pending resolution; a payout is never falsely marked as completed.

## 5. Decision-Making & Rule Amendments
- **Dispute Resolution Method**: ${disputeMethod}
- **Terms Immutability**: Any modification to active contribution amounts, rotation rosters, or token parameters requires fresh, explicit consent from all active members before applying to a future round.
`;

    const rulesSnapshot = {
      name,
      contributionAmount: Number(contributionAmount),
      frequency,
      maxMembers: Number(maxMembers),
      expectedPool: totalPool,
      deadlineDays: Number(deadlineDays),
      graceDays: Number(graceDays),
      disputeMethod,
      timezone,
    };

    return { markdown, rulesSnapshot };
  }

  /**
   * Validates and creates a new rotating payout stokvel
   */
  async createStokvel(data, creatorUserId) {
    if (!creatorUserId) throw new Error('Authentication required to create a stokvel.');
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 3) {
      throw new Error('Stokvel name must be at least 3 characters long.');
    }

    if (data.type && data.type !== 'rotating_payout') {
      throw new Error('Only Rotating Payout Stokvels are currently supported.');
    }

    const maxMembers = Number(data.maxMembers);
    if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 50) {
      throw new Error('Membership capacity must be an integer between 2 and 50 members.');
    }

    const contribution = Number(data.contributionAmount);
    if (!Number.isFinite(contribution) || contribution <= 0) {
      throw new Error('Contribution amount must be greater than zero.');
    }

    if (!data.firstCycleDate || isNaN(new Date(data.firstCycleDate).getTime())) {
      throw new Error('A valid first cycle start date is required.');
    }

    const terms = this.generateTermsContent({
      name: data.name.trim(),
      contributionAmount: contribution,
      frequency: data.frequency || 'monthly',
      maxMembers,
      deadlineDays: data.deadlineDays,
      graceDays: data.graceDays,
      disputeMethod: data.disputeResolutionMethod,
      timezone: data.timezone,
    });

    return stokvelDatabaseService.createStokvel(data, terms, creatorUserId);
  }

  async getStokvelDetails(id, requestingUserId) {
    const stokvel = await stokvelDatabaseService.findStokvelById(id);
    if (!stokvel) throw new Error('Stokvel group not found.');

    const isOwner = stokvel.owner_user_id === requestingUserId;
    const userMember = (stokvel.members || []).find((m) => m.user_id === requestingUserId);
    const isDiscoverable = stokvel.discoverability === 'discoverable_open' && stokvel.lifecycle_status !== 'cancelled';

    if (!isOwner && !userMember && !isDiscoverable) {
      throw new Error('Access denied: private stokvel group.');
    }

    // Compute expected schedule preview
    const schedulePreview = calculateSchedule({
      startDate: stokvel.first_cycle_date,
      frequency: stokvel.frequency,
      memberCount: stokvel.max_members,
      contributionAmount: stokvel.contribution_amount,
      timezone: stokvel.timezone,
      deadlineDays: stokvel.contribution_deadline_days,
      graceDays: stokvel.grace_period_days,
    });

    return {
      ...stokvel,
      userRole: isOwner ? STOKVEL_ROLES.OWNER : userMember ? userMember.role : null,
      isEnrolled: Boolean(userMember),
      termsAccepted: userMember ? userMember.terms_accepted_version === stokvel.terms_version : false,
      schedulePreview,
      totalPoolPerCycle: Math.round(stokvel.max_members * Number(stokvel.contribution_amount) * 1000000) / 1000000,
    };
  }

  async listDiscoverableStokvels() {
    return stokvelDatabaseService.listDiscoverableStokvels();
  }

  async listUserStokvels(userId) {
    return stokvelDatabaseService.listUserStokvels(userId);
  }

  /**
   * Direct invite generation: produces high-entropy token, stores hash
   */
  async generateInvite(stokvelId, actorUserId, options = {}) {
    const stokvel = await stokvelDatabaseService.findStokvelById(stokvelId);
    if (!stokvel) throw new Error('Stokvel not found.');

    const member = (stokvel.members || []).find((m) => m.user_id === actorUserId);
    const isAuthorized = stokvel.owner_user_id === actorUserId || (member && member.role === STOKVEL_ROLES.CO_ADMIN);

    if (!isAuthorized) {
      throw new Error('Only the Group Owner or an authorized Co-admin may issue invitation links.');
    }

    if (stokvel.join_status === JOIN_STATUSES.CLOSED) {
      throw new Error('Stokvel is closed to new members; cannot create an invite.');
    }

    return stokvelDatabaseService.createInvite(stokvelId, actorUserId, options);
  }

  /**
   * Previews invite terms without automatically joining the user
   */
  async previewInvite(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') throw new Error('Invalid invite token.');

    const invite = await stokvelDatabaseService.findInviteByRawSecret(rawToken);
    if (!invite) throw new Error('Invitation link is invalid, expired, or was revoked.');

    if (invite.revoked_at) throw new Error('This invitation link has been revoked by the group administration.');
    if (new Date(invite.expires_at) < new Date()) throw new Error('This invitation link has expired.');
    if (invite.uses_count >= invite.max_uses) throw new Error('This invitation link has reached its maximum uses.');

    const stokvel = invite.stokvel;
    if (!stokvel) throw new Error('Associated stokvel record could not be found.');

    const schedule = calculateSchedule({
      startDate: stokvel.first_cycle_date,
      frequency: stokvel.frequency,
      memberCount: stokvel.max_members,
      contributionAmount: stokvel.contribution_amount,
      timezone: stokvel.timezone,
      deadlineDays: stokvel.contribution_deadline_days,
      graceDays: stokvel.grace_period_days,
    });

    const latestTerms = (stokvel.terms || []).sort((a, b) => b.version - a.version)[0] || {
      terms_markdown: 'Standard Rotating Payout Terms',
      version: 1,
    };

    return {
      inviteId: invite.id,
      stokvelId: stokvel.id,
      name: stokvel.name,
      description: stokvel.description,
      type: stokvel.type,
      joinStatus: stokvel.join_status,
      maxMembers: stokvel.max_members,
      contributionAmount: stokvel.contribution_amount,
      frequency: stokvel.frequency,
      timezone: stokvel.timezone,
      expectedPool: Math.round(stokvel.max_members * Number(stokvel.contribution_amount) * 1000000) / 1000000,
      tokenSymbol: 'USDT',
      chainId: stokvel.chain_id,
      schedule,
      termsVersion: latestTerms.version,
      termsMarkdown: latestTerms.terms_markdown,
    };
  }

  /**
   * Explicitly accepts direct invite and signs terms version
   */
  async acceptInvite(rawToken, userId, acceptedTermsVersion) {
    const preview = await this.previewInvite(rawToken);

    if (Number(acceptedTermsVersion) !== Number(preview.termsVersion)) {
      throw new Error('You must review and explicitly accept the current version of the stokvel terms.');
    }

    // Atomic capacity check & admission
    const admission = await stokvelDatabaseService.atomicReserveOrAdmit(preview.stokvelId, userId, false);
    if (!admission.success) {
      throw new Error(admission.error || 'Unable to join stokvel: capacity reached.');
    }

    return {
      success: true,
      stokvelId: preview.stokvelId,
      message: `You have successfully joined ${preview.name} as an active member.`,
    };
  }

  /**
   * Request to join a discoverable group
   */
  async requestToJoin(stokvelId, userId, note = '') {
    const stokvel = await stokvelDatabaseService.findStokvelById(stokvelId);
    if (!stokvel) throw new Error('Stokvel not found.');

    if (stokvel.discoverability !== 'discoverable_open') {
      throw new Error('This group is private and does not accept open join applications.');
    }

    if (stokvel.join_status === JOIN_STATUSES.CLOSED) {
      throw new Error('This group is currently closed to new applications.');
    }

    const isMember = (stokvel.members || []).some((m) => m.user_id === userId);
    if (isMember) throw new Error('You are already an enrolled member of this stokvel.');

    return stokvelDatabaseService.createJoinRequest(stokvelId, userId, note);
  }

  /**
   * Review join application (approve / decline)
   */
  async reviewJoinRequest(stokvelId, requestId, status, reviewerUserId) {
    if (!['approved', 'declined'].includes(status)) {
      throw new Error("Review decision must be 'approved' or 'declined'.");
    }

    const stokvel = await stokvelDatabaseService.findStokvelById(stokvelId);
    if (!stokvel) throw new Error('Stokvel not found.');

    const member = (stokvel.members || []).find((m) => m.user_id === reviewerUserId);
    const isAuthorized = stokvel.owner_user_id === reviewerUserId || (member && member.role === STOKVEL_ROLES.CO_ADMIN);

    if (!isAuthorized) {
      throw new Error('Only the Group Owner or an authorized Co-admin may review join applications.');
    }

    const requests = await stokvelDatabaseService.listJoinRequests(stokvelId);
    const request = requests.find((r) => r.id === requestId);
    if (!request) throw new Error('Join request not found.');

    if (status === 'approved') {
      // Reserve seat atomically
      const reserve = await stokvelDatabaseService.atomicReserveOrAdmit(stokvelId, request.user_id, true);
      if (!reserve.success) {
        throw new Error(reserve.error || 'Cannot approve request: group capacity has been reached.');
      }
    } else {
      request.status = 'declined';
      request.reviewed_by = reviewerUserId;
      request.reviewed_at = new Date().toISOString();
    }

    await stokvelDatabaseService.logAudit(stokvelId, reviewerUserId, `REQUEST_${status.toUpperCase()}`, {
      requestId,
      applicantUserId: request.user_id,
    });

    return { success: true, status };
  }

  /**
   * Applicant accepts terms after approval to become an active member
   */
  async acceptApprovedTerms(stokvelId, userId, acceptedTermsVersion) {
    const stokvel = await stokvelDatabaseService.findStokvelById(stokvelId);
    if (!stokvel) throw new Error('Stokvel not found.');

    const requests = await stokvelDatabaseService.listJoinRequests(stokvelId);
    const req = requests.find((r) => r.user_id === userId && r.status === 'approved');

    if (!req) {
      throw new Error('No approved join application was found for your account.');
    }

    if (req.reservation_expires_at && new Date(req.reservation_expires_at) < new Date()) {
      throw new Error('Your seat reservation has expired. Please apply again.');
    }

    if (Number(acceptedTermsVersion) !== Number(stokvel.terms_version)) {
      throw new Error('Terms have been updated. Please review and accept the current version.');
    }

    // Convert seat reservation into active member
    const admission = await stokvelDatabaseService.atomicReserveOrAdmit(stokvelId, userId, false);
    if (!admission.success) throw new Error(admission.error || 'Seat capacity limit reached.');

    req.status = 'accepted_terms';
    await stokvelDatabaseService.logAudit(stokvelId, userId, 'TERMS_ACCEPTED_POST_APPROVAL', {
      version: acceptedTermsVersion,
    });

    return { success: true, message: 'Terms accepted. Membership is now active.' };
  }

  async closeJoining(stokvelId, actorUserId) {
    const stokvel = await stokvelDatabaseService.findStokvelById(stokvelId);
    if (!stokvel) throw new Error('Stokvel not found.');

    if (stokvel.owner_user_id !== actorUserId) {
      throw new Error('Only the Group Owner may close member admissions.');
    }

    return stokvelDatabaseService.closeJoining(stokvelId, actorUserId);
  }

  async manageRole(stokvelId, targetUserId, newRole, actorUserId, action = 'granted', reason = '') {
    return stokvelDatabaseService.grantOrRevokeRole(stokvelId, targetUserId, newRole, actorUserId, action, reason);
  }

  async raiseDispute(stokvelId, userId, { cycleId, reason, evidenceJson }) {
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      throw new Error('A detailed dispute description of at least 5 characters is required.');
    }

    return stokvelDatabaseService.recordDispute(stokvelId, cycleId, userId, reason, evidenceJson);
  }

  async getAuditTrail(stokvelId, userId) {
    const stokvel = await stokvelDatabaseService.findStokvelById(stokvelId);
    if (!stokvel) throw new Error('Stokvel not found.');

    const isMember = (stokvel.members || []).some((m) => m.user_id === userId) || stokvel.owner_user_id === userId;
    if (!isMember) throw new Error('Audit trail is restricted to enrolled group members.');

    return stokvelDatabaseService.getAuditLogs(stokvelId);
  }
}

export const stokvelService = new StokvelService();

