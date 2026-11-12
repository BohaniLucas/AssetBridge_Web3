import { API_BASE_URL } from '../config/api';

class MobileWalletService {
  constructor() {
    this.memoryCache = {};
    this.pendingIdempotencyKeys = new Set();
  }

  getSavedRecipients() {
    return [];
  }

  async getFeeQuote() {
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/fee-quote`);
      const json = await res.json();
      if (res.ok && json.data) return json.data;
      throw new Error(json.message || 'Fee quote request failed.');
    } catch (error) {
      throw new Error(`Unable to retrieve a live fee quote. Check your connection and retry. ${error.message}`);
    }
  }

  async getOrCreateWallet(userId) {
    if (!userId) throw new Error('Sign in to load your wallet.');
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (res.ok && json.data) {
        this.memoryCache[userId] = json.data;
        return json.data;
      }
    } catch (error) {
      throw new Error(`Unable to load your wallet. No local/demo balance is available. ${error.message}`);
    }

    if (this.memoryCache[userId]) return this.memoryCache[userId];
    throw new Error('Wallet service returned no wallet.');
  }

  generateIdempotencyKey() {
    return `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async transfer({ senderUserId, recipientAddressOrUsername, amountUsdt, note = '', idempotencyKey = '' }) {
    const numAmount = Number(amountUsdt);
    const key = idempotencyKey || this.generateIdempotencyKey();

    try {
      const res = await fetch(`${API_BASE_URL}/wallet/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId,
          recipientIdentifier: recipientAddressOrUsername,
          recipientAddressOrUsername,
          amountUsdt: numAmount,
          note,
          idempotencyKey: key,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        this.pendingIdempotencyKeys.delete(key);
        return json.data;
      }
      throw new Error(json.message || 'Transfer failed on backend');
    } catch (err) {
      throw new Error(`Payment service unavailable or rejected the request. No local payment was recorded. ${err.message}`);
    }
  }

  async claimFaucet(userId) {
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/faucet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amountUsdt: 250 }),
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
      throw new Error(json.message || 'Faucet request failed.');
    } catch (error) {
      throw new Error(`Test token faucet unavailable. No balance was added. ${error.message}`);
    }
  }

  async getWallet(userId = 'demo_user') {
    return this.getOrCreateWallet(userId).catch(() => null);
  }

  async getTransactions(userId) {
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/${encodeURIComponent(userId)}/transactions`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) return json.data;
      throw new Error(json.message || 'Transaction history request failed.');
    } catch (error) {
      throw new Error(`Unable to load transaction history. ${error.message}`);
    }
  }
}

export const mobileWalletService = new MobileWalletService();
export const walletService = mobileWalletService;


