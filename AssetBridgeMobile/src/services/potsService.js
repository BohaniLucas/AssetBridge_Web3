import { API_BASE_URL } from '../config/api';
import { mobileAuthService } from './authService';

const getHeaders = async (includeAuth = true) => {
  const headers = { 'Content-Type': 'application/json' };
  if (includeAuth) {
    const token = await mobileAuthService.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const errorMsg = data.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }
  return data.data;
};

class MobilePotsService {
  /**
   * List discoverable open stokvel groups
   */
  async getDiscoverableStokvels() {
    const headers = await getHeaders(false);
    const res = await fetch(`${API_BASE_URL}/stokvels`, { headers });
    return handleResponse(res);
  }

  /**
   * List user's joined/created stokvels
   */
  async getMyStokvels() {
    const headers = await getHeaders(true);
    const res = await fetch(`${API_BASE_URL}/stokvels/my`, { headers });
    return handleResponse(res);
  }

  /**
   * Get full stokvel details (schedule, roster, terms)
   */
  async getStokvelDetails(stokvelId) {
    const headers = await getHeaders(true);
    const res = await fetch(`${API_BASE_URL}/stokvels/${stokvelId}`, { headers });
    return handleResponse(res);
  }

  /**
   * Create rotating payout stokvel
   */
  async createStokvel(formData) {
    const headers = await getHeaders(true);
    const res = await fetch(`${API_BASE_URL}/stokvels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...formData,
        type: 'rotating_payout', // Rotating payout ROSCA only
      }),
    });
    return handleResponse(res);
  }

  /**
   * Generate direct invite token
   */
  async generateInvite(stokvelId, options = {}) {
    const headers = await getHeaders(true);
    const res = await fetch(`${API_BASE_URL}/stokvels/${stokvelId}/invites`, {
      method: 'POST',
      headers,
      body: JSON.stringify(options),
    });
    return handleResponse(res);
  }

  /**
   * Preview invite without auto-joining
   */
  async previewInvite(token) {
    const headers = await getHeaders(false);
    const res = await fetch(`${API_BASE_URL}/stokvels/invites/${encodeURIComponent(token)}/preview`, {
      headers,
    });
    return handleResponse(res);
  }

  /**
   * Explicitly accept invite with verified terms version
   */
  async acceptInvite(token, acceptedTermsVersion) {
    const headers = await getHeaders(true);
    const res = await fetch(`${API_BASE_URL}/stokvels/invites/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ acceptedTermsVersion }),
    });
    return handleResponse(res);
  }

  /**
   * Apply to join discoverable group
   */
  async requestToJoin(stokvelId, note = '') {
    const headers = await getHeaders(true);
    const res = await fetch(`${API_BASE_URL}/stokvels/${stokvelId}/join-requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ note }),
    });
    return handleResponse(res);
  }

  /**
   * Review application (Owner or Co-admin)
   */
  async reviewJoinRequest(stokvelId, reqId, status) {
    const headers = await getHeaders(true);
    const res = await fetch(`${API_BASE_URL}/stokvels/${stokvelId}/join-requests/${reqId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    return handleResponse(res);
  }

  /**
   * Approved applicant accepts terms to become active
   */
  async acceptApprovedTerms(stokvelId, acceptedTermsVersion) {
    const headers = await getHeaders(true);
    const res = await fetch(`${API_BASE_URL}/stokvels/${stokvelId}/accept-terms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ acceptedTermsVersion }),
    });
    return handleResponse(res);
  }

  /**
   * Raise formal dispute notice
   */
  async raiseDispute(stokvelId, disputeData) {
    const headers = await getHeaders(true);
    const res = await fetch(`${API_BASE_URL}/stokvels/${stokvelId}/disputes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(disputeData),
    });
    return handleResponse(res);
  }

  /**
   * Fetch immutable audit trail
   */
  async getAuditTrail(stokvelId) {
    const headers = await getHeaders(true);
    const res = await fetch(`${API_BASE_URL}/stokvels/${stokvelId}/audit`, {
      headers,
    });
    return handleResponse(res);
  }

  /**
   * Non-custodial financial write safety guard:
   * Keep contribution and payout financial writes disabled until real WDK signing and on-chain verification are integrated.
   */
  async contributeToPot() {
    throw new Error(
      'Rotating stokvel contribution payments are disabled until real WDK signing and on-chain verification are integrated. No test or simulated payments are permitted.'
    );
  }

  async payout() {
    throw new Error(
      'Rotating stokvel pool payouts are disabled until real WDK signing and on-chain verification are integrated. No test or simulated payouts are permitted.'
    );
  }

  // Backward compatibility alias for existing code
  async getPots() {
    return this.getMyStokvels().catch(() => []);
  }

  async createPot(data) {
    return this.createStokvel(data);
  }
}

export const mobilePotsService = new MobilePotsService();
