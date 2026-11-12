import { ethers } from 'ethers';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const walletClientService = {
  /**
   * Retrieves or creates a cryptographically verified Tether (EVM/ERC-20) wallet for the user.
   */
  async getOrCreateWallet() {
    throw new Error('No user-controlled wallet is connected. This app does not create or store wallet keys in web storage.');
  },

  /**
   * Execute an authoritative P2P Tether transfer
   */
  async sendTether() {
    throw new Error('P2P payments are disabled until a user-controlled wallet signs transactions and the network confirms them. No payment was sent.');
  },

  /**
   * Create a Payment Request
   */
  async createPaymentRequest() {
    throw new Error('Payment requests are unavailable until authenticated request ownership and chain settlement are implemented.');
  },

  /**
   * Create shareable payment link
   */
  async createPaymentLink() {
    throw new Error('Payment links are unavailable until an authenticated escrow and on-chain claim flow are implemented.');
  },

  /**
   * Fetch payment link by ID
   */
  async getPaymentLink(linkId) {
    try {
      const res = await fetch(`${API_BASE}/wallet/payment-link/${encodeURIComponent(linkId)}`);
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch {
      // offline fallback
    }
    return null;
  },

  /**
   * Pay payment link
   */
  async payPaymentLink() {
    throw new Error('Payment links are disabled. No payment was submitted.');
  },

  /**
   * Create split payment
   */
  async createSplitPayment() {
    throw new Error('Split payments are unavailable until group ownership and on-chain settlement are implemented.');
  },

  /**
   * Contribute to split payment
   */
  async contributeSplitPayment() {
    throw new Error('Split contributions are disabled until on-chain settlement is integrated. No contribution was recorded.');
  },

  /**
   * Fetch split payments
   */
  async getSplitPayments(userId) {
    try {
      const res = await fetch(`${API_BASE}/wallet/${encodeURIComponent(userId)}/split-payments`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) return json.data;
    } catch {
      // offline
    }
    return [];
  },

  /**
   * Faucet testnet credit
   */
  async claimFaucet() {
    throw new Error('No app-managed faucet credit is available. Use a verified network faucet; no balance was added.');
  },

  /**
   * Fetch live notifications
   */
  async getNotifications(userId) {
    try {
      const res = await fetch(`${API_BASE}/wallet/${encodeURIComponent(userId)}/notifications`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) return json.data;
    } catch {
      // offline
    }
    return [];
  },

  async markNotificationRead(notifId, userId) {
    try {
      await fetch(`${API_BASE}/wallet/notifications/${encodeURIComponent(notifId)}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch {
      // offline
    }
  },

  /**
   * Fetch Admin Console overview with mandatory Administrator authorization
   */
  async getAdminOverview(adminToken = null) {
    try {
      const token = adminToken || JSON.parse(localStorage.getItem('assetbridge_admin_session') || '{}').token;
      const res = await fetch(`${API_BASE}/admin/overview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch {
      // offline
    }
    return null;
  },

  async getAdminUsers(adminToken = null) {
    try {
      const token = adminToken || JSON.parse(localStorage.getItem('assetbridge_admin_session') || '{}').token;
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch {
      // offline
    }
    return [];
  },

  async updateAdminUserStatus() {
    throw new Error('Account status updates must be performed through Supabase Admin Auth.');
  },

  async getAdminTransactions(adminToken = null) {
    try {
      const token = adminToken || JSON.parse(localStorage.getItem('assetbridge_admin_session') || '{}').token;
      const res = await fetch(`${API_BASE}/admin/transactions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch {
      // offline
    }
    return [];
  },

  async getAdminAuditLogs(adminToken = null) {
    try {
      const token = adminToken || JSON.parse(localStorage.getItem('assetbridge_admin_session') || '{}').token;
      const res = await fetch(`${API_BASE}/admin/audit-logs`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch {
      // offline
    }
    return [];
  },

  async toggleCircuitBreaker() {
    throw new Error('Circuit breaker state is unavailable until it is backed by server-side operational controls.');
  },

  async getAdminSettings(adminToken = null) {
    try {
      const token = adminToken || JSON.parse(localStorage.getItem('assetbridge_admin_session') || '{}').token;
      const res = await fetch(`${API_BASE}/admin/settings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch {
      // offline
    }
    return null;
  },

  async getAdminStokvels(adminToken = null) {
    try {
      const token = adminToken || JSON.parse(localStorage.getItem('assetbridge_admin_session') || '{}').token;
      const res = await fetch(`${API_BASE}/admin/stokvels`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch {
      // offline
    }
    return [];
  },

  /**
   * Verify transaction on-chain / ledger
   */
  async verifyTx(txHash) {
    try {
      const res = await fetch(`${API_BASE}/wallet/verify-tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch (error) {
      throw new Error(`Transaction status is unavailable. ${error.message}`, { cause: error });
    }
    throw new Error('Transaction status service returned no network verification.');
  },

  isValidAddress(address) {
    return ethers.isAddress(address);
  },

  truncateAddress(address) {
    if (!address) return '';
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  },
};
