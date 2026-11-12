const API_BASE = `${import.meta.env.VITE_API_URL || ''}/claims`;

export const claimClientService = {
  async createClaimLink({ senderUserId, senderName, amountZar, amountUsdt, recipientName, recipientPhone, note }) {
    try {
      const res = await fetch(`${API_BASE}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId,
          senderName,
          amountZar,
          amountUsdt,
          recipientName,
          recipientPhone,
          note,
          originUrl: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create claim link');
      return data.data;
    } catch (err) {
      throw new Error(`Claim links are unavailable. No funds were moved. ${err.message}`, { cause: err });
    }
  },

  async getClaimLink(claimId) {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(claimId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Claim link not found');
      return data.data;
    } catch (err) {
      throw new Error(`Claim link unavailable. ${err.message}`, { cause: err });
    }
  },

  async claimMoney({ claimId, secretCode, phoneNumber, smsCode, pin }) {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(claimId)}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretCode, phoneNumber, smsCode, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to claim funds');
      return data.data;
    } catch (err) {
      throw new Error(`Claim could not be verified. No funds were released. ${err.message}`, { cause: err });
    }
  },

  async refundClaimLink({ claimId, senderUserId }) {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(claimId)}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderUserId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to refund claim link');
    return data.data;
  },

  async getSenderClaims(userId) {
    try {
      const res = await fetch(`${API_BASE}/sender/${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.data)) return data.data;
      return [];
    } catch {
      return [];
    }
  },
};

