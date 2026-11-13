import { authService } from './authService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = (includeAuth = true) => {
  const headers = { 'Content-Type': 'application/json' };
  if (includeAuth) {
    const token = authService.getUserToken() || authService.getAdminToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const potsService = {
  /**
   * List discoverable open stokvel groups (public/unauthenticated or authenticated)
   */
  async getDiscoverableStokvels() {
    const res = await fetch(`${API_BASE}/stokvels`, { headers: getHeaders(false) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch discoverable stokvels');
    return data.data || [];
  },

  /**
   * List the authenticated user's joined or owned stokvel groups
   */
  async getMyStokvels() {
    const res = await fetch(`${API_BASE}/stokvels/my`, { headers: getHeaders(true) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch your stokvels');
    return data.data || [];
  },

  /**
   * Get full stokvel details including roster, schedule, and immutable terms
   */
  async getStokvelDetails(stokvelId) {
    const res = await fetch(`${API_BASE}/stokvels/${stokvelId}`, { headers: getHeaders(true) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load stokvel details');
    return data.data;
  },

  /**
   * Create a new rotating payout stokvel
   */
  async createStokvel(formData) {
    const res = await fetch(`${API_BASE}/stokvels`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({
        ...formData,
        type: 'rotating_payout', // Strictly rotating payout only
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create rotating stokvel');
    return data.data;
  },

  /**
   * Generate a secure direct invitation link with single-use or multi-use token
   */
  async generateInvite(stokvelId, options = {}) {
    const res = await fetch(`${API_BASE}/stokvels/${stokvelId}/invites`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(options),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to generate invitation link');
    return data.data;
  },

  /**
   * Preview terms and schedule for an invitation token without auto-joining
   */
  async previewInvite(token) {
    const res = await fetch(`${API_BASE}/stokvels/invites/${encodeURIComponent(token)}/preview`, {
      headers: getHeaders(false),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to preview invite');
    return data.data;
  },

  /**
   * Explicitly accept invitation and sign immutable terms
   */
  async acceptInvite(token, acceptedTermsVersion) {
    const res = await fetch(`${API_BASE}/stokvels/invites/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ acceptedTermsVersion }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to accept invitation');
    return data.data;
  },

  /**
   * Apply to join a discoverable open group
   */
  async requestToJoin(stokvelId, note = '') {
    const res = await fetch(`${API_BASE}/stokvels/${stokvelId}/join-requests`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to submit join request');
    return data.data;
  },

  /**
   * Review applicant join request (Owner or Co-admin only)
   */
  async reviewJoinRequest(stokvelId, reqId, status) {
    const res = await fetch(`${API_BASE}/stokvels/${stokvelId}/join-requests/${reqId}`, {
      method: 'PATCH',
      headers: getHeaders(true),
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Failed to ${status} request`);
    return data.data;
  },

  /**
   * Approved applicant explicitly accepts immutable terms to become an active member
   */
  async acceptApprovedTerms(stokvelId, acceptedTermsVersion) {
    const res = await fetch(`${API_BASE}/stokvels/${stokvelId}/accept-terms`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ acceptedTermsVersion }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to accept terms');
    return data.data;
  },

  /**
   * Submit formal dispute notice
   */
  async raiseDispute(stokvelId, disputeData) {
    const res = await fetch(`${API_BASE}/stokvels/${stokvelId}/disputes`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(disputeData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to submit dispute notice');
    return data.data;
  },

  /**
   * Fetch immutable audit trail for group members
   */
  async getAuditTrail(stokvelId) {
    const res = await fetch(`${API_BASE}/stokvels/${stokvelId}/audit`, {
      headers: getHeaders(true),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load audit trail');
    return data.data;
  },

  /**
   * Financial writes remain strictly disabled per policy
   */
  async contributeToPot() {
    throw new Error(
      'Rotating stokvel contribution payments are disabled until real WDK signing and on-chain verification are integrated. No test or simulated payments are permitted.'
    );
  },

  async payout() {
    throw new Error(
      'Rotating stokvel pool payouts are disabled until real WDK signing and on-chain verification are integrated. No test or simulated payouts are permitted.'
    );
  },

  // Legacy compatibility helpers
  async getPots() {
    return this.getMyStokvels().catch(() => []);
  },
  async fetchPotsFromBackend() {
    return this.getMyStokvels().catch(() => []);
  },
};
