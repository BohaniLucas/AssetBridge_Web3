/**
 * Web Remittance Client Service
 *
 * Delegates all FX quotes, corridor availability, username resolution,
 * payment state transitions, and on-chain funding verification to the backend.
 * Contains zero hardcoded FX rates, fake savings claims, or sample personal data.
 */

import { authService } from './authService';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/remittance`;

function getAuthHeaders() {
  const token = authService.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function generateIdempotencyKey(prefix = 'remit') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export const REGIONS = ['All', 'App-to-App', 'Africa', 'Europe & UK'];

export const remittanceService = {
  async fetchDestinations() {
    const res = await fetch(`${API_BASE}/destinations`, {
      headers: { Accept: 'application/json' },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Unable to load remittance corridors from backend.');
    }
    return Array.isArray(json.data) ? json.data : [];
  },

  async resolveUsername(username) {
    const clean = String(username || '').trim();
    if (!clean) throw new Error('Enter an AssetBridge username.');
    const res = await fetch(
      `${API_BASE}/resolve-user?username=${encodeURIComponent(clean)}`,
      { headers: getAuthHeaders() }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Could not verify username.');
    }
    return json.data;
  },

  async createQuote({ flowType, corridorCode, payoutRail, sendAmountUsdt }) {
    const res = await fetch(`${API_BASE}/quotes`, {
      method: 'POST',
      headers: getAuthHeaders(),
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
    const res = await fetch(`${API_BASE}/transfers`, {
      method: 'POST',
      headers: getAuthHeaders(),
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
    const res = await fetch(`${API_BASE}/transfers/${encodeURIComponent(transferId)}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ riskAcknowledged }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Transfer approval failed.');
    }
    return json.data;
  },

  async cancelTransfer(transferId) {
    const res = await fetch(`${API_BASE}/transfers/${encodeURIComponent(transferId)}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Failed to cancel transfer.');
    }
    return json.data;
  },

  async confirmBlockchainFunding(transferId, { txHash }) {
    const res = await fetch(
      `${API_BASE}/transfers/${encodeURIComponent(transferId)}/confirm-funding`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
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
    const res = await fetch(`${API_BASE}/transfers/${encodeURIComponent(transferId)}/refund`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Refund request failed.');
    }
    return json.data;
  },

  async listTransfers() {
    const res = await fetch(`${API_BASE}/transfers`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    return Array.isArray(json.data) ? json.data : [];
  },

  async getTransfer(transferId) {
    const res = await fetch(`${API_BASE}/transfers/${encodeURIComponent(transferId)}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Transfer not found.');
    }
    return json.data;
  },
};
