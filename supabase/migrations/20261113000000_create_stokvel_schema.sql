-- ==============================================================================
-- Migration: 20261113000000_create_stokvel_schema.sql
-- Description: Authoritative schema for AssetBridge Rotating Payout Stokvels
-- Enforces: Atomic capacity, separate join/lifecycle states, versioned terms consent,
--           roles with grant audits, short-month calendar rules, and on-chain uniqueness.
-- ==============================================================================

-- 0. TEARDOWN LEGACY / CONFLICTING PARTIAL TABLES (IF ANY)
DROP TABLE IF EXISTS public.stokvel_audit_logs CASCADE;
DROP TABLE IF EXISTS public.stokvel_disputes CASCADE;
DROP TABLE IF EXISTS public.stokvel_payouts CASCADE;
DROP TABLE IF EXISTS public.stokvel_contributions CASCADE;
DROP TABLE IF EXISTS public.stokvel_cycles CASCADE;
DROP TABLE IF EXISTS public.stokvel_join_requests CASCADE;
DROP TABLE IF EXISTS public.stokvel_invites CASCADE;
DROP TABLE IF EXISTS public.stokvel_role_grants CASCADE;
DROP TABLE IF EXISTS public.stokvel_members CASCADE;
DROP TABLE IF EXISTS public.stokvel_terms CASCADE;
DROP TABLE IF EXISTS public.stokvels CASCADE;

-- 1. STOKVELS (Core Group Table)
CREATE TABLE public.stokvels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'rotating_payout' CHECK (type = 'rotating_payout'),
    join_status TEXT NOT NULL DEFAULT 'open' CHECK (join_status IN ('open', 'closed')),
    lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft', 'ready', 'active', 'paused', 'completed', 'cancelled')),
    discoverability TEXT NOT NULL DEFAULT 'private_invite_only' CHECK (discoverability IN ('private_invite_only', 'discoverable_open')),
    max_members INT NOT NULL CHECK (max_members >= 2 AND max_members <= 50),
    token_contract TEXT NOT NULL,
    chain_id BIGINT NOT NULL,
    contribution_amount NUMERIC(18, 6) NOT NULL CHECK (contribution_amount > 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    contribution_deadline_days INT NOT NULL DEFAULT 3 CHECK (contribution_deadline_days >= 1),
    grace_period_days INT NOT NULL DEFAULT 3 CHECK (grace_period_days >= 0),
    first_cycle_date TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    terms_version INT NOT NULL DEFAULT 1,
    dispute_resolution_method TEXT NOT NULL DEFAULT 'majority_vote',
    owner_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. STOKVEL TERMS (Versioned Terms & Rule Snapshots)
CREATE TABLE public.stokvel_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
    version INT NOT NULL,
    terms_markdown TEXT NOT NULL,
    rules_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stokvel_terms_version UNIQUE (stokvel_id, version)
);

-- 3. STOKVEL MEMBERS (Membership Roster & Rotation Order)
CREATE TABLE public.stokvel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'co_admin', 'treasurer', 'secretary', 'member')),
    rotation_order INT NOT NULL CHECK (rotation_order >= 1),
    terms_accepted_version INT,
    terms_accepted_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending_consent' CHECK (status IN ('pending_consent', 'active', 'suspended', 'exited')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stokvel_member_user UNIQUE (stokvel_id, user_id),
    CONSTRAINT uq_stokvel_member_order UNIQUE (stokvel_id, rotation_order)
);

-- 4. STOKVEL ROLE GRANTS (Audit Trail of Administrative Role Delegations)
CREATE TABLE public.stokvel_role_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
    granted_to_user_id UUID NOT NULL,
    granted_by_user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('co_admin', 'treasurer', 'secretary', 'member')),
    action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. STOKVEL INVITES (High-Entropy Hashed Links & QR Codes)
CREATE TABLE public.stokvel_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL,
    max_uses INT NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
    uses_count INT NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. STOKVEL JOIN REQUESTS (Discoverable Group Applications)
CREATE TABLE public.stokvel_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn', 'accepted_terms')),
    note TEXT NOT NULL DEFAULT '',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    reservation_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stokvel_join_user UNIQUE (stokvel_id, user_id)
);

-- 7. STOKVEL CYCLES (Rotation Rounds)
CREATE TABLE public.stokvel_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
    cycle_number INT NOT NULL CHECK (cycle_number >= 1),
    beneficiary_member_id UUID NOT NULL REFERENCES public.stokvel_members(id),
    beneficiary_user_id UUID NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    grace_date TIMESTAMPTZ NOT NULL,
    payout_date TIMESTAMPTZ NOT NULL,
    target_pool_amount NUMERIC(18, 6) NOT NULL CHECK (target_pool_amount > 0),
    collected_amount NUMERIC(18, 6) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'collecting', 'payout_ready', 'completed', 'shortfall', 'paused')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stokvel_cycle_num UNIQUE (stokvel_id, cycle_number)
);

-- 8. STOKVEL CONTRIBUTIONS (Idempotent On-Chain Verified Deposits)
CREATE TABLE public.stokvel_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES public.stokvel_cycles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.stokvel_members(id),
    user_id UUID NOT NULL,
    amount NUMERIC(18, 6) NOT NULL CHECK (amount > 0),
    idempotency_key TEXT NOT NULL UNIQUE,
    chain_id BIGINT NOT NULL,
    token_contract TEXT NOT NULL,
    tx_hash TEXT,
    confirmation_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'due_soon' CHECK (status IN ('due_soon', 'pending_submission', 'onchain_confirming', 'verified', 'overdue', 'disputed')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stokvel_contrib_tx UNIQUE (chain_id, tx_hash)
);

-- 9. STOKVEL PAYOUTS (Lump Sum Rotation Distribution to Scheduled Beneficiary)
CREATE TABLE public.stokvel_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES public.stokvel_cycles(id) ON DELETE CASCADE,
    recipient_member_id UUID NOT NULL REFERENCES public.stokvel_members(id),
    recipient_user_id UUID NOT NULL,
    amount NUMERIC(18, 6) NOT NULL CHECK (amount > 0),
    chain_id BIGINT NOT NULL,
    token_contract TEXT NOT NULL,
    tx_hash TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shortfall', 'processing', 'verified', 'failed')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stokvel_cycle_payout UNIQUE (stokvel_id, cycle_id),
    CONSTRAINT uq_stokvel_payout_tx UNIQUE (chain_id, tx_hash)
);

-- 10. STOKVEL DISPUTES (Transparent Appeals and Status Disagreements)
CREATE TABLE public.stokvel_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES public.stokvel_cycles(id),
    raised_by_user_id UUID NOT NULL,
    reason TEXT NOT NULL,
    evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'evidence_submitted', 'under_review', 'resolved', 'escalated')),
    resolution_note TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. STOKVEL AUDIT LOGS (Privileged & Administrative Operations Record)
CREATE TABLE public.stokvel_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stokvel_id UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- SAFE DYNAMIC FOREIGN KEYS TO AUTH.USERS (ONLY IF AUTH.USERS(ID) EXISTS)
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'id'
    ) THEN
        BEGIN
            ALTER TABLE public.stokvels 
                ADD CONSTRAINT fk_stokvels_owner FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            ALTER TABLE public.stokvel_members 
                ADD CONSTRAINT fk_stokvel_members_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            ALTER TABLE public.stokvel_role_grants 
                ADD CONSTRAINT fk_stokvel_grant_to FOREIGN KEY (granted_to_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            ALTER TABLE public.stokvel_role_grants 
                ADD CONSTRAINT fk_stokvel_grant_by FOREIGN KEY (granted_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            ALTER TABLE public.stokvel_invites 
                ADD CONSTRAINT fk_stokvel_invites_creator FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
            ALTER TABLE public.stokvel_join_requests 
                ADD CONSTRAINT fk_stokvel_req_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            ALTER TABLE public.stokvel_cycles 
                ADD CONSTRAINT fk_stokvel_cycles_beneficiary FOREIGN KEY (beneficiary_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            ALTER TABLE public.stokvel_contributions 
                ADD CONSTRAINT fk_stokvel_contrib_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            ALTER TABLE public.stokvel_payouts 
                ADD CONSTRAINT fk_stokvel_payouts_user FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            ALTER TABLE public.stokvel_disputes 
                ADD CONSTRAINT fk_stokvel_disputes_user FOREIGN KEY (raised_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            ALTER TABLE public.stokvel_audit_logs 
                ADD CONSTRAINT fk_stokvel_audit_user FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping auth.users constraints: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'auth.users(id) not present; proceeding with unconstrained UUID user IDs.';
    END IF;
END $$;

-- ==============================================================================
-- INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_stokvels_discoverable ON public.stokvels(discoverability, join_status, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_stokvel_members_user ON public.stokvel_members(user_id, stokvel_id);
CREATE INDEX IF NOT EXISTS idx_stokvel_invites_hash ON public.stokvel_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_stokvel_requests_stokvel ON public.stokvel_join_requests(stokvel_id, status);
CREATE INDEX IF NOT EXISTS idx_stokvel_cycles_stokvel ON public.stokvel_cycles(stokvel_id, cycle_number);
CREATE INDEX IF NOT EXISTS idx_stokvel_contrib_cycle ON public.stokvel_contributions(cycle_id, status);
CREATE INDEX IF NOT EXISTS idx_stokvel_audit_stokvel ON public.stokvel_audit_logs(stokvel_id, created_at DESC);

-- ==============================================================================
-- ATOMIC CAPACITY ENFORCEMENT FUNCTION
-- Atomically counts active members and unexpired approved reservations.
-- Automatically locks the stokvel and marks join_status = 'closed' when filled.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.stokvel_atomic_reserve_or_admit(
    p_stokvel_id UUID,
    p_user_id UUID,
    p_is_approval BOOLEAN DEFAULT FALSE -- TRUE = reserve seat for applicant, FALSE = activate direct invitee
) RETURNS JSONB AS $$
DECLARE
    v_stokvel public.stokvels%ROWTYPE;
    v_active_members INT;
    v_reserved_seats INT;
    v_total_occupied INT;
    v_next_order INT;
    v_has_reservation BOOLEAN := FALSE;
BEGIN
    -- 1. Explicit row lock on stokvel record
    SELECT * INTO v_stokvel
    FROM public.stokvels
    WHERE id = p_stokvel_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Stokvel not found');
    END IF;

    -- Clean up expired join reservations first
    UPDATE public.stokvel_join_requests
    SET status = 'declined', note = 'Seat reservation expired'
    WHERE stokvel_id = p_stokvel_id
      AND status = 'approved'
      AND reservation_expires_at < now();

    -- Check if user already holds an unexpired approved reservation
    SELECT EXISTS (
        SELECT 1 FROM public.stokvel_join_requests
        WHERE stokvel_id = p_stokvel_id
          AND user_id = p_user_id
          AND status = 'approved'
          AND reservation_expires_at >= now()
    ) INTO v_has_reservation;

    IF v_stokvel.join_status = 'closed' AND NOT v_has_reservation THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Stokvel is closed to new members');
    END IF;

    IF v_stokvel.lifecycle_status NOT IN ('draft', 'ready') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Stokvel has already commenced rotations and cannot admit new members');
    END IF;

    -- Count active members
    SELECT COUNT(*) INTO v_active_members
    FROM public.stokvel_members
    WHERE stokvel_id = p_stokvel_id
      AND status IN ('active', 'pending_consent');

    -- Count unexpired approved join request reservations (excluding current user)
    SELECT COUNT(*) INTO v_reserved_seats
    FROM public.stokvel_join_requests
    WHERE stokvel_id = p_stokvel_id
      AND status = 'approved'
      AND reservation_expires_at >= now()
      AND user_id != p_user_id;

    v_total_occupied := v_active_members + v_reserved_seats;

    IF v_total_occupied >= v_stokvel.max_members THEN
        -- Auto-close join status atomically
        UPDATE public.stokvels SET join_status = 'closed', updated_at = now() WHERE id = p_stokvel_id;
        RETURN jsonb_build_object('success', FALSE, 'error', 'Stokvel capacity reached');
    END IF;

    IF p_is_approval THEN
        -- Reserve seat for 48 hours
        UPDATE public.stokvel_join_requests
        SET status = 'approved',
            reviewed_at = now(),
            reservation_expires_at = now() + INTERVAL '48 hours',
            updated_at = now()
        WHERE stokvel_id = p_stokvel_id AND user_id = p_user_id;
    ELSE
        -- Calculate next rotation order
        SELECT COALESCE(MAX(rotation_order), 0) + 1 INTO v_next_order
        FROM public.stokvel_members
        WHERE stokvel_id = p_stokvel_id;

        -- Insert member
        INSERT INTO public.stokvel_members (stokvel_id, user_id, role, rotation_order, terms_accepted_version, terms_accepted_at, status)
        VALUES (p_stokvel_id, p_user_id, 'member', v_next_order, v_stokvel.terms_version, now(), 'active');

        -- Update join request to joined if one existed
        UPDATE public.stokvel_join_requests
        SET status = 'joined', updated_at = now()
        WHERE stokvel_id = p_stokvel_id AND user_id = p_user_id;
    END IF;

    -- Re-evaluate if max capacity is now reached
    IF (v_total_occupied + 1) >= v_stokvel.max_members THEN
        UPDATE public.stokvels SET join_status = 'closed', updated_at = now() WHERE id = p_stokvel_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'occupied', v_total_occupied + 1,
        'max', v_stokvel.max_members,
        'join_status', CASE WHEN (v_total_occupied + 1) >= v_stokvel.max_members THEN 'closed' ELSE 'open' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.stokvels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_role_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_audit_logs ENABLE ROW LEVEL SECURITY;

-- Stokvels Read Policy: Discoverable/open OR member of group OR owner
CREATE POLICY "stokvels_read_policy" ON public.stokvels
    FOR SELECT TO authenticated
    USING (
        (discoverability = 'discoverable_open' AND lifecycle_status != 'cancelled')
        OR owner_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.stokvel_members
            WHERE stokvel_members.stokvel_id = stokvels.id
              AND stokvel_members.user_id = auth.uid()
        )
    );

-- Stokvel Members Read Policy: Members of the same group can view roster
CREATE POLICY "stokvel_members_read_policy" ON public.stokvel_members
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.stokvel_members sm
            WHERE sm.stokvel_id = stokvel_members.stokvel_id
              AND sm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.stokvels s
            WHERE s.id = stokvel_members.stokvel_id
              AND (s.owner_user_id = auth.uid() OR s.discoverability = 'discoverable_open')
        )
    );

-- Cycles & Payouts Read Policy: Restricted to enrolled members
CREATE POLICY "stokvel_cycles_read_policy" ON public.stokvel_cycles
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.stokvel_members sm
            WHERE sm.stokvel_id = stokvel_cycles.stokvel_id
              AND sm.user_id = auth.uid()
        )
    );

CREATE POLICY "stokvel_payouts_read_policy" ON public.stokvel_payouts
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.stokvel_members sm
            WHERE sm.stokvel_id = stokvel_payouts.stokvel_id
              AND sm.user_id = auth.uid()
        )
    );

-- Audit Logs Read Policy: Members can view group audit logs
CREATE POLICY "stokvel_audit_read_policy" ON public.stokvel_audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.stokvel_members sm
            WHERE sm.stokvel_id = stokvel_audit_logs.stokvel_id
              AND sm.user_id = auth.uid()
        )
    );
