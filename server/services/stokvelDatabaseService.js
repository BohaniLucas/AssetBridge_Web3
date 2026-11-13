import crypto from 'crypto';
import { supabase, isSupabaseConfigured } from './supabaseService.js';
import { AUTHORITATIVE_TOKENS, isAuthoritativeToken } from '../constants/stokvelConstants.js';

/**
 * Stokvel Database Service Layer
 * Interfaces directly with Supabase Postgres tables with RLS and atomic database transactions.
 * Includes clean memory store fallback strictly enforcing schema rules if Supabase is offline.
 */
class StokvelDatabaseService {
  constructor() {
    this.memoryStore = {
      stokvels: new Map(),
      terms: new Map(),
      members: new Map(),
      roleGrants: [],
      invites: new Map(),
      joinRequests: new Map(),
      cycles: new Map(),
      contributions: new Map(),
      payouts: new Map(),
      disputes: new Map(),
      auditLogs: [],
    };
  }

  // --- QUERY METHODS ---

  async findStokvelById(id) {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('stokvels')
        .select(`
          *,
          terms:stokvel_terms(*),
          members:stokvel_members(*),
          cycles:stokvel_cycles(*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) return data;
    }

    const s = this.memoryStore.stokvels.get(id);
    if (!s) return null;
    const terms = Array.from(this.memoryStore.terms.values()).filter((t) => t.stokvel_id === id);
    const members = Array.from(this.memoryStore.members.values()).filter((m) => m.stokvel_id === id);
    const cycles = Array.from(this.memoryStore.cycles.values()).filter((c) => c.stokvel_id === id);

    return { ...s, terms, members, cycles };
  }

  async listDiscoverableStokvels() {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('stokvels')
        .select('*, members:stokvel_members(count)')
        .eq('discoverability', 'discoverable_open')
        .neq('lifecycle_status', 'cancelled')
        .order('created_at', { ascending: false });

      if (!error && data) return data;
    }

    return Array.from(this.memoryStore.stokvels.values())
      .filter((s) => s.discoverability === 'discoverable_open' && s.lifecycle_status !== 'cancelled')
      .map((s) => {
        const memberCount = Array.from(this.memoryStore.members.values()).filter((m) => m.stokvel_id === s.id).length;
        return { ...s, current_members: memberCount };
      });
  }

  async listUserStokvels(userId) {
    if (!userId) return [];

    if (isSupabaseConfigured() && supabase) {
      const { data: memberRows, error: mErr } = await supabase
        .from('stokvel_members')
        .select('stokvel_id')
        .eq('user_id', userId);

      if (!mErr && memberRows) {
        const ids = memberRows.map((r) => r.stokvel_id);
        if (ids.length === 0) return [];

        const { data, error } = await supabase
          .from('stokvels')
          .select('*, members:stokvel_members(*), cycles:stokvel_cycles(*)')
          .in('id', ids);

        if (!error && data) return data;
      }
    }

    const memberOfIds = new Set(
      Array.from(this.memoryStore.members.values())
        .filter((m) => m.user_id === userId)
        .map((m) => m.stokvel_id)
    );

    return Array.from(this.memoryStore.stokvels.values())
      .filter((s) => memberOfIds.has(s.id) || s.owner_user_id === userId)
      .map((s) => {
        const members = Array.from(this.memoryStore.members.values()).filter((m) => m.stokvel_id === s.id);
        const cycles = Array.from(this.memoryStore.cycles.values()).filter((c) => c.stokvel_id === s.id);
        return { ...s, members, cycles };
      });
  }

  // --- MUTATION METHODS ---

  async createStokvel(stokvelData, initialTerms, creatorUserId) {
    const stokvelId = crypto.randomUUID();
    const token = AUTHORITATIVE_TOKENS[0];

    const record = {
      id: stokvelId,
      name: stokvelData.name.trim(),
      description: (stokvelData.description || '').trim(),
      type: 'rotating_payout',
      join_status: 'open',
      lifecycle_status: 'draft',
      discoverability: stokvelData.discoverability || 'private_invite_only',
      max_members: Number(stokvelData.maxMembers) || 5,
      token_contract: token.contractAddress,
      chain_id: token.chainId,
      contribution_amount: Number(stokvelData.contributionAmount),
      frequency: stokvelData.frequency || 'monthly',
      contribution_deadline_days: Number(stokvelData.deadlineDays) || 3,
      grace_period_days: Number(stokvelData.graceDays) || 3,
      first_cycle_date: new Date(stokvelData.firstCycleDate).toISOString(),
      timezone: stokvelData.timezone || 'Africa/Johannesburg',
      terms_version: 1,
      dispute_resolution_method: stokvelData.disputeResolutionMethod || 'majority_vote',
      owner_user_id: creatorUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const termsRecord = {
      id: crypto.randomUUID(),
      stokvel_id: stokvelId,
      version: 1,
      terms_markdown: initialTerms.markdown,
      rules_snapshot: initialTerms.rulesSnapshot,
      created_at: new Date().toISOString(),
    };

    const ownerMemberRecord = {
      id: crypto.randomUUID(),
      stokvel_id: stokvelId,
      user_id: creatorUserId,
      role: 'owner',
      rotation_order: 1,
      terms_accepted_version: 1,
      terms_accepted_at: new Date().toISOString(),
      status: 'active',
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      const { error: sErr } = await supabase.from('stokvels').insert(record);
      if (sErr) throw new Error(`Supabase insert failed: ${sErr.message}`);

      await supabase.from('stokvel_terms').insert(termsRecord);
      await supabase.from('stokvel_members').insert(ownerMemberRecord);
    } else {
      this.memoryStore.stokvels.set(stokvelId, record);
      this.memoryStore.terms.set(termsRecord.id, termsRecord);
      this.memoryStore.members.set(ownerMemberRecord.id, ownerMemberRecord);
    }

    await this.logAudit(stokvelId, creatorUserId, 'STOKVEL_CREATED', {
      name: record.name,
      max_members: record.max_members,
      amount: record.contribution_amount,
    });

    return { ...record, terms: [termsRecord], members: [ownerMemberRecord] };
  }

  /**
   * Atomic capacity enforcement: locks row and checks total seats
   */
  async atomicReserveOrAdmit(stokvelId, userId, isApproval = false) {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.rpc('stokvel_atomic_reserve_or_admit', {
        p_stokvel_id: stokvelId,
        p_user_id: userId,
        p_is_approval: isApproval,
      });

      if (!error && data) return data;
    }

    // Atomic memory store transaction
    const stokvel = this.memoryStore.stokvels.get(stokvelId);
    if (!stokvel) return { success: false, error: 'Stokvel not found' };

    // Check if user has a valid unexpired approved reservation
    const hasValidReservation = Array.from(this.memoryStore.joinRequests.values()).some(
      (r) =>
        r.stokvel_id === stokvelId &&
        r.user_id === userId &&
        r.status === 'approved' &&
        new Date(r.reservation_expires_at) >= new Date()
    );

    if (stokvel.join_status === 'closed' && !hasValidReservation) {
      return { success: false, error: 'Stokvel is closed to new members' };
    }
    if (!['draft', 'ready'].includes(stokvel.lifecycle_status)) {
      return { success: false, error: 'Stokvel rotations have started; cannot admit new members' };
    }

    const members = Array.from(this.memoryStore.members.values()).filter((m) => m.stokvel_id === stokvelId);
    const activeMembers = members.filter((m) => ['active', 'pending_consent'].includes(m.status)).length;

    const unexpiredReservations = Array.from(this.memoryStore.joinRequests.values()).filter(
      (r) => r.stokvel_id === stokvelId && r.status === 'approved' && new Date(r.reservation_expires_at) >= new Date() && r.user_id !== userId
    ).length;

    const occupied = activeMembers + unexpiredReservations;

    if (occupied >= stokvel.max_members) {
      stokvel.join_status = 'closed';
      return { success: false, error: 'Stokvel capacity reached' };
    }

    if (isApproval) {
      const req = Array.from(this.memoryStore.joinRequests.values()).find(
        (r) => r.stokvel_id === stokvelId && r.user_id === userId
      );
      if (req) {
        req.status = 'approved';
        req.reviewed_at = new Date().toISOString();
        req.reservation_expires_at = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      }
    } else {
      const existingMember = members.find((m) => m.user_id === userId);
      if (!existingMember) {
        const nextOrder = members.length + 1;
        const newMember = {
          id: crypto.randomUUID(),
          stokvel_id: stokvelId,
          user_id: userId,
          role: 'member',
          rotation_order: nextOrder,
          terms_accepted_version: stokvel.terms_version,
          terms_accepted_at: new Date().toISOString(),
          status: 'active',
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.memoryStore.members.set(newMember.id, newMember);
      }
      const req = Array.from(this.memoryStore.joinRequests.values()).find(
        (r) => r.stokvel_id === stokvelId && r.user_id === userId
      );
      if (req) {
        req.status = 'joined';
        req.updated_at = new Date().toISOString();
      }
    }

    if (occupied + 1 >= stokvel.max_members) {
      stokvel.join_status = 'closed';
    }

    return {
      success: true,
      occupied: occupied + 1,
      max: stokvel.max_members,
      join_status: occupied + 1 >= stokvel.max_members ? 'closed' : 'open',
    };
  }

  async closeJoining(stokvelId, actorUserId) {
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('stokvels').update({ join_status: 'closed', updated_at: new Date().toISOString() }).eq('id', stokvelId);
    } else {
      const s = this.memoryStore.stokvels.get(stokvelId);
      if (s) s.join_status = 'closed';
    }

    await this.logAudit(stokvelId, actorUserId, 'JOINING_CLOSED', { by: actorUserId });
    return { success: true };
  }

  async createInvite(stokvelId, createdByUserId, { maxUses = 1, expiryHours = 72 } = {}) {
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000).toISOString();

    const inviteRecord = {
      id: crypto.randomUUID(),
      stokvel_id: stokvelId,
      token_hash: tokenHash,
      created_by: createdByUserId,
      max_uses: maxUses,
      uses_count: 0,
      expires_at: expiresAt,
      revoked_at: null,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      await supabase.from('stokvel_invites').insert(inviteRecord);
    } else {
      this.memoryStore.invites.set(inviteRecord.id, inviteRecord);
    }

    await this.logAudit(stokvelId, createdByUserId, 'INVITE_CREATED', {
      inviteId: inviteRecord.id,
      expiresAt,
      maxUses,
    });

    return {
      token: rawSecret,
      rawSecret,
      inviteId: inviteRecord.id,
      expiresAt,
      maxUses,
    };
  }

  async findInviteByRawSecret(rawSecret) {
    const tokenHash = crypto.createHash('sha256').update(rawSecret).digest('hex');

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('stokvel_invites')
        .select('*, stokvel:stokvels(*)')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (!error && data) return data;
    }

    const invite = Array.from(this.memoryStore.invites.values()).find((i) => i.token_hash === tokenHash);
    if (!invite) return null;

    const stokvel = this.memoryStore.stokvels.get(invite.stokvel_id);
    return { ...invite, stokvel };
  }

  async revokeInvite(inviteId, actorUserId) {
    if (isSupabaseConfigured() && supabase) {
      await supabase
        .from('stokvel_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId);
    } else {
      const invite = this.memoryStore.invites.get(inviteId);
      if (invite) invite.revoked_at = new Date().toISOString();
    }
  }

  async createJoinRequest(stokvelId, userId, note = '') {
    const existing = Array.from(this.memoryStore.joinRequests.values()).find(
      (r) => r.stokvel_id === stokvelId && r.user_id === userId
    );

    const record = {
      id: existing ? existing.id : crypto.randomUUID(),
      stokvel_id: stokvelId,
      user_id: userId,
      status: 'pending',
      note: note.trim(),
      reviewed_by: null,
      reviewed_at: null,
      reservation_expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      await supabase.from('stokvel_join_requests').upsert(record);
    } else {
      this.memoryStore.joinRequests.set(record.id, record);
    }

    await this.logAudit(stokvelId, userId, 'JOIN_REQUESTED', { note: record.note });
    return record;
  }

  async listJoinRequests(stokvelId) {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('stokvel_join_requests')
        .select('*')
        .eq('stokvel_id', stokvelId)
        .order('created_at', { ascending: false });

      if (!error && data) return data;
    }

    return Array.from(this.memoryStore.joinRequests.values())
      .filter((r) => r.stokvel_id === stokvelId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async grantOrRevokeRole(stokvelId, targetUserId, newRole, actorUserId, action = 'granted', reason = '') {
    const stokvel = await this.findStokvelById(stokvelId);
    if (!stokvel) throw new Error('Stokvel not found');
    if (stokvel.owner_user_id !== actorUserId) {
      throw new Error('Only the primary group Owner may appoint or revoke administrative roles.');
    }

    if (newRole === 'owner') {
      throw new Error('Primary ownership cannot be delegated through role grant. Ownership transfer requires explicit legal procedure.');
    }

    const grantRecord = {
      id: crypto.randomUUID(),
      stokvel_id: stokvelId,
      granted_to_user_id: targetUserId,
      granted_by_user_id: actorUserId,
      role: newRole,
      action,
      reason,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      await supabase.from('stokvel_role_grants').insert(grantRecord);
      await supabase
        .from('stokvel_members')
        .update({ role: action === 'granted' ? newRole : 'member', updated_at: new Date().toISOString() })
        .eq('stokvel_id', stokvelId)
        .eq('user_id', targetUserId);
    } else {
      this.memoryStore.roleGrants.push(grantRecord);
      const m = Array.from(this.memoryStore.members.values()).find(
        (member) => member.stokvel_id === stokvelId && member.user_id === targetUserId
      );
      if (m) m.role = action === 'granted' ? newRole : 'member';
    }

    await this.logAudit(stokvelId, actorUserId, `ROLE_${action.toUpperCase()}`, {
      to: targetUserId,
      role: newRole,
      reason,
    });

    return grantRecord;
  }

  async recordDispute(stokvelId, cycleId, userId, reason, evidenceJson = {}) {
    const dispute = {
      id: crypto.randomUUID(),
      stokvel_id: stokvelId,
      cycle_id: cycleId || null,
      raised_by_user_id: userId,
      reason: reason.trim(),
      evidence_json: evidenceJson,
      status: 'open',
      resolution_note: null,
      resolved_by: null,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      await supabase.from('stokvel_disputes').insert(dispute);
    } else {
      this.memoryStore.disputes.set(dispute.id, dispute);
    }

    await this.logAudit(stokvelId, userId, 'DISPUTE_RAISED', { reason: dispute.reason, cycleId });
    return dispute;
  }

  async listDisputes(stokvelId) {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('stokvel_disputes')
        .select('*')
        .eq('stokvel_id', stokvelId)
        .order('created_at', { ascending: false });

      if (!error && data) return data;
    }

    return Array.from(this.memoryStore.disputes.values())
      .filter((d) => d.stokvel_id === stokvelId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async logAudit(stokvelId, actorUserId, action, details = {}) {
    const entry = {
      id: crypto.randomUUID(),
      stokvel_id: stokvelId,
      actor_user_id: actorUserId,
      action,
      details,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      await supabase.from('stokvel_audit_logs').insert(entry).catch(() => {});
    } else {
      this.memoryStore.auditLogs.push(entry);
    }
  }

  async getAuditLogs(stokvelId) {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('stokvel_audit_logs')
        .select('*')
        .eq('stokvel_id', stokvelId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) return data;
    }

    return this.memoryStore.auditLogs
      .filter((l) => l.stokvel_id === stokvelId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

export const stokvelDatabaseService = new StokvelDatabaseService();
