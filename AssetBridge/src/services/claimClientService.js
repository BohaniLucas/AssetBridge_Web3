import { authService } from './authService';
import { generateIdempotencyKey } from './remittanceService';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/claims`;

function getAuthHeaders() {
  const token = authService.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const claimClientService = {
  /**
   * Authenticated Sender: Create a one-time Gogo claim reference from a locked quote.
   * Never sends senderUserId from the client; identity is derived from the verified Bearer token.
   */
  async createClaimLink({
    quoteId,
    idempotencyKey,
    recipientName,
    recipientPhone,
    note,
    riskAcknowledged = false,
  }) {
    const res = await fetch(`${API_BASE}/create`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        quoteId,
        idempotencyKey: idempotencyKey || generateIdempotencyKey('claim'),
        recipientName,
        recipientPhone,
        note,
        riskAcknowledged,
        originUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to create Gogo claim link.');
    }
    return data.data;
  },

  /**
   * Authenticated Sender: List all claim links created by the current user.
   */
  async getSenderClaims() {
    try {
      const res = await fetch(`${API_BASE}/sender`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.data)) return data.data;
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Authenticated Sender: Cancel or refund an unclaimed Gogo link.
   */
  async refundClaimLink(claimId) {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(claimId)}/refund`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to cancel or refund claim link.');
    }
    return data.data;
  },

  /**
   * Public Receiver Entry Point: Read limited claim summary & plain-language AI guidance.
   */
  async getPublicClaim(claimId, lang = 'en') {
    const res = await fetch(
      `${API_BASE}/public/${encodeURIComponent(claimId)}?lang=${encodeURIComponent(lang)}`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Claim link not found or expired.');
    }
    return data.data;
  },

  /**
   * Public Receiver Step 1: Verify one-time claim token + recipient phone number to request OTP.
   */
  async requestClaimOtp(claimId, { claimToken, phoneNumber }) {
    const res = await fetch(`${API_BASE}/public/${encodeURIComponent(claimId)}/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimToken, phoneNumber }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to verify claim code and phone number.');
    }
    return data.data;
  },

  /**
   * Public Receiver Step 2: Submit the 6-digit OTP code.
   */
  async verifyClaimOtp(claimId, { otpCode }) {
    const res = await fetch(`${API_BASE}/public/${encodeURIComponent(claimId)}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otpCode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'OTP verification failed.');
    }
    return data.data;
  },

  /**
   * Public Receiver Step 3: Confirm payout method after OTP verification.
   */
  async confirmClaimPayout(
    claimId,
    { verificationSessionToken, payoutMethod, recipientWalletAddress }
  ) {
    const res = await fetch(`${API_BASE}/public/${encodeURIComponent(claimId)}/confirm-payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationSessionToken,
        payoutMethod,
        recipientWalletAddress,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Payout confirmation could not be completed.');
    }
    return data.data;
  },
};
