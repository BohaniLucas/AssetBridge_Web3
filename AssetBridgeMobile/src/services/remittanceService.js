/**
 * Mobile Remittance & Gogo Claim Client Service
 *
 * Uses the backend as the single source of business logic.
 * Includes Bearer token authentication on every protected call.
 * Zero hardcoded FX rates, fake savings claims, or sample personal data.
 */

import { API_BASE_URL } from '../config/api';
import { mobileAuthService } from './authService';
import { offlineStorage } from './offlineStorage';

async function userCacheKey(name) {
  const session = await mobileAuthService.getStoredSession();
  return `remittance:${name}:${session?.user?.id || 'anonymous'}`;
}

async function getAuthHeaders() {
  const token = await mobileAuthService.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function generateIdempotencyKey(prefix = 'mob_remit') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export const REGIONS = ['All', 'App-to-App', 'Africa', 'Europe & UK'];

export const remittanceService = {
  async fetchDestinations() {
    try {
      const res = await fetch(`${API_BASE_URL}/remittance/destinations`, {
        headers: { Accept: 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Unable to load remittance corridors from backend.');
      const destinations = Array.isArray(json.data) ? json.data : [];
      await offlineStorage.set('remittance:destinations', destinations);
      return destinations;
    } catch (error) {
      const cached = await offlineStorage.get('remittance:destinations');
      if (cached) return cached;
      throw error;
    }
  },

  async resolveUsername(username) {
    const clean = String(username || '').trim();
    if (!clean) throw new Error('Enter an AssetBridge username.');
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${API_BASE_URL}/remittance/resolve-user?username=${encodeURIComponent(clean)}`,
      { headers }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Could not verify username.');
    }
    return json.data;
  },

  async createQuote({ flowType, corridorCode, payoutRail, sendAmountUsdt }) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/remittance/quotes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        flowType,
        corridorCode,
        payoutRail,
        sendAmountUsdt: String(sendAmountUsdt),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to generate remittance quote.');
    }
    return json.data;
  },

  async createTransferIntent({
    quoteId,
    idempotencyKey,
    recipientUsername,
    recipientName,
    recipientPhone,
    note,
  }) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/remittance/transfers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        quoteId,
        idempotencyKey: idempotencyKey || generateIdempotencyKey('tx'),
        recipientUsername,
        recipientName,
        recipientPhone,
        note,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Could not initialize transfer intent.');
    }
    return json.data;
  },

  async approveTransfer(transferId, { riskAcknowledged = false } = {}) {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${API_BASE_URL}/remittance/transfers/${encodeURIComponent(transferId)}/approve`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ riskAcknowledged }),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Transfer approval failed.');
    }
    return json.data;
  },

  async cancelTransfer(transferId) {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${API_BASE_URL}/remittance/transfers/${encodeURIComponent(transferId)}/cancel`,
      {
        method: 'POST',
        headers,
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to cancel transfer.');
    }
    return json.data;
  },

  async confirmBlockchainFunding(transferId, { txHash }) {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${API_BASE_URL}/remittance/transfers/${encodeURIComponent(transferId)}/confirm-funding`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ txHash }),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'On-chain funding verification failed.');
    }
    return json.data;
  },

  async refundTransfer(transferId, { reason = 'Sender requested refund' } = {}) {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${API_BASE_URL}/remittance/transfers/${encodeURIComponent(transferId)}/refund`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Refund request failed.');
    }
    return json.data;
  },

  async listTransfers() {
    const cacheKey = await userCacheKey('transfers');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/remittance/transfers`, { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Unable to load transfer history.');
      const transfers = Array.isArray(json.data) ? json.data : [];
      await offlineStorage.set(cacheKey, transfers);
      return transfers;
    } catch {
      return (await offlineStorage.get(cacheKey)) || [];
    }
  },

  // --- Gogo Claim Link Management (Authenticated Sender + Public Receiver) ---
  async createGogoClaimLink({
    quoteId,
    idempotencyKey,
    recipientName,
    recipientPhone,
    note,
    riskAcknowledged = false,
  }) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/claims/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        quoteId,
        idempotencyKey: idempotencyKey || generateIdempotencyKey('claim'),
        recipientName,
        recipientPhone,
        note,
        riskAcknowledged,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to create Gogo claim link.');
    }
    return json.data;
  },

  async getSenderClaims() {
    const cacheKey = await userCacheKey('claims');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/claims/sender`, { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Unable to load claim history.');
      const claims = Array.isArray(json.data) ? json.data : [];
      await offlineStorage.set(cacheKey, claims);
      return claims;
    } catch {
      return (await offlineStorage.get(cacheKey)) || [];
    }
  },

  async refundClaimLink(claimId) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/claims/${encodeURIComponent(claimId)}/refund`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to cancel or refund claim link.');
    }
    return json.data;
  },

  async getPublicClaim(claimId, lang = 'en') {
    const res = await fetch(
      `${API_BASE_URL}/claims/public/${encodeURIComponent(claimId)}?lang=${encodeURIComponent(lang)}`
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Claim link not found or expired.');
    }
    return json.data;
  },

  async requestClaimOtp(claimId, { claimToken, phoneNumber }) {
    const res = await fetch(`${API_BASE_URL}/claims/public/${encodeURIComponent(claimId)}/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimToken, phoneNumber }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to verify claim code and phone number.');
    }
    return json.data;
  },

  async verifyClaimOtp(claimId, { otpCode }) {
    const res = await fetch(`${API_BASE_URL}/claims/public/${encodeURIComponent(claimId)}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otpCode }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'OTP verification failed.');
    }
    return json.data;
  },

  async confirmClaimPayout(
    claimId,
    { verificationSessionToken, payoutMethod, recipientWalletAddress }
  ) {
    const res = await fetch(`${API_BASE_URL}/claims/public/${encodeURIComponent(claimId)}/confirm-payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationSessionToken,
        payoutMethod,
        recipientWalletAddress,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Payout confirmation could not be completed.');
    }
    return json.data;
  },
};

export const mobileRemittanceService = remittanceService;
