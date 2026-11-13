-- ==============================================================================
-- Migration: 20261113010000_create_remittance_and_claims_schema.sql
-- Description: Authoritative schema for AssetBridge Remittance & Gogo Claim Flows
-- Enforces: Integer minor-unit accounting, persistent payment state machine,
--           idempotency keys, hashed claim tokens & OTPs, attempt limits,
--           webhook replay protection, and recoverable refund states.
-- ==============================================================================
-- 1. REMITTANCE QUOTES
CREATE TABLE IF NOT EXISTS public.remittance_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    flow_type TEXT NOT NULL CHECK (flow_type IN ('app_to_app', 'gogo_claim', 'phone_payout')),
    corridor_code TEXT NOT NULL,
    destination_country TEXT NOT NULL,
    payout_rail TEXT NOT NULL,
    send_amount_minor BIGINT NOT NULL CHECK (send_amount_minor > 0),
    send_currency TEXT NOT NULL DEFAULT 'USDT',
    fee_amount_minor BIGINT NOT NULL CHECK (fee_amount_minor >= 0),
    net_send_amount_minor BIGINT NOT NULL CHECK (net_send_amount_minor > 0),
    fx_rate_scaled BIGINT NOT NULL CHECK (fx_rate_scaled > 0),
    fx_rate_display NUMERIC(18, 6) NOT NULL CHECK (fx_rate_display > 0),
    receive_amount_minor BIGINT NOT NULL CHECK (receive_amount_minor > 0),
    receive_currency TEXT NOT NULL,
    rate_source TEXT NOT NULL,
    rate_type TEXT NOT NULL CHECK (rate_type IN ('executable_partner', 'reference_only', 'par_1_to_1')),
    rate_timestamp TIMESTAMPTZ NOT NULL,
    is_executable BOOLEAN NOT NULL DEFAULT false,
    quote_signature TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remittance_quotes_user ON public.remittance_quotes(user_id);

-- 2. REMITTANCE TRANSFERS (Persistent Payment State Machine)
CREATE TABLE IF NOT EXISTS public.remittance_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    sender_user_id UUID NOT NULL,
    sender_email TEXT,
    flow_type TEXT NOT NULL CHECK (flow_type IN ('app_to_app', 'gogo_claim', 'phone_payout')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (
        status IN (
            'draft',
            'quoted',
            'awaiting_sender_approval',
            'funded',
            'pending',
            'payout_pending',
            'paid',
            'failed',
            'cancelled',
            'expired',
            'refund_pending',
            'refunded',
            'manual_review'
        )
    ),
    quote_id UUID NOT NULL REFERENCES public.remittance_quotes(id),
    corridor_code TEXT NOT NULL,
    destination_country TEXT NOT NULL,
    payout_rail TEXT NOT NULL,
    recipient_user_id UUID,
    recipient_username TEXT,
    recipient_display_name TEXT NOT NULL,
    recipient_phone_hash TEXT,
    recipient_phone_masked TEXT,
    recipient_wallet_address TEXT,
    send_amount_minor BIGINT NOT NULL CHECK (send_amount_minor > 0),
    send_currency TEXT NOT NULL DEFAULT 'USDT',
    fee_amount_minor BIGINT NOT NULL CHECK (fee_amount_minor >= 0),
    receive_amount_minor BIGINT NOT NULL CHECK (receive_amount_minor > 0),
    receive_currency TEXT NOT NULL,
    fx_rate_display NUMERIC(18, 6) NOT NULL,
    blockchain_network TEXT NOT NULL DEFAULT 'Sepolia',
    token_contract TEXT,
    escrow_or_recipient_address TEXT,
    funding_tx_hash TEXT UNIQUE,
    funding_confirmations INT NOT NULL DEFAULT 0,
    required_confirmations INT NOT NULL DEFAULT 1,
    provider_name TEXT,
    provider_reference TEXT UNIQUE,
    provider_status TEXT,
    refund_tx_hash TEXT UNIQUE,
    failure_reason TEXT,
    risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    risk_acknowledged BOOLEAN NOT NULL DEFAULT false,
    status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    note TEXT NOT NULL DEFAULT '',
    approved_at TIMESTAMPTZ,
    funded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remittance_transfers_sender ON public.remittance_transfers(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_remittance_transfers_recipient ON public.remittance_transfers(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_remittance_transfers_status ON public.remittance_transfers(status);

-- 3. GOGO CLAIMS (Non-App Recipient Escrow Claims)
CREATE TABLE IF NOT EXISTS public.gogo_claims (
    id TEXT PRIMARY KEY,
    transfer_id UUID NOT NULL UNIQUE REFERENCES public.remittance_transfers(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL,
    sender_display_name TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_phone_e164_hash TEXT NOT NULL,
    recipient_phone_masked TEXT NOT NULL,
    claim_token_hash TEXT NOT NULL UNIQUE,
    otp_code_hash TEXT,
    otp_expires_at TIMESTAMPTZ,
    otp_attempts INT NOT NULL DEFAULT 0 CHECK (otp_attempts >= 0),
    max_otp_attempts INT NOT NULL DEFAULT 5,
    claim_attempts INT NOT NULL DEFAULT 0 CHECK (claim_attempts >= 0),
    max_claim_attempts INT NOT NULL DEFAULT 5,
    otp_verified_at TIMESTAMPTZ,
    otp_session_token_hash TEXT,
    selected_payout_method TEXT,
    payout_destination_masked TEXT,
    status TEXT NOT NULL DEFAULT 'awaiting_funding' CHECK (
        status IN (
            'awaiting_funding',
            'claimable',
            'otp_sent',
            'verified',
            'payout_pending',
            'claimed',
            'cancelled',
            'refund_pending',
            'refunded',
            'expired',
            'locked'
        )
    ),
    expires_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    audit_trail JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gogo_claims_sender ON public.gogo_claims(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_gogo_claims_status ON public.gogo_claims(status);

-- 4. REMITTANCE WEBHOOK EVENTS (Idempotency & Replay Prevention)
CREATE TABLE IF NOT EXISTS public.remittance_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL UNIQUE,
    transfer_id UUID REFERENCES public.remittance_transfers(id),
    event_type TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all remittance tables (Backend accesses via service role or verified policies)
ALTER TABLE public.remittance_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittance_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gogo_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittance_webhook_events ENABLE ROW LEVEL SECURITY;
