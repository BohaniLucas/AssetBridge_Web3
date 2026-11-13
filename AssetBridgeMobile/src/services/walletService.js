import { API_BASE_URL } from '../config/api';
import { mobileAuthService } from './authService';
import { offlineStorage } from './offlineStorage';

const authHeaders = async () => {
  const token = await mobileAuthService.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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
      const res = await fetch(`${API_BASE_URL}/wallet/fee-quote`, { headers: await authHeaders() });
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
      const res = await fetch(`${API_BASE_URL}/wallet/${encodeURIComponent(userId)}`, { headers: await authHeaders() });
      const json = await res.json();
      if (res.ok && json.data) {
        this.memoryCache[userId] = json.data;
        await offlineStorage.set(`wallet:${userId}`, json.data);
        return json.data;
      }
    } catch (error) {
      const cachedWallet = await offlineStorage.get(`wallet:${userId}`);
      if (cachedWallet) {
        this.memoryCache[userId] = cachedWallet;
        return { ...cachedWallet, isOfflineCache: true };
      }
      throw new Error(`Unable to load your wallet. No local/demo balance is available. ${error.message}`);
    }

    if (this.memoryCache[userId]) return this.memoryCache[userId];
    const cachedWallet = await offlineStorage.get(`wallet:${userId}`);
    if (cachedWallet) {
      this.memoryCache[userId] = cachedWallet;
      return { ...cachedWallet, isOfflineCache: true };
    }
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
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
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

  async transferUsdt({ senderUserId, recipient, amount, note = '' }) {
    return this.transfer({
      senderUserId,
      recipientAddressOrUsername: recipient,
      amountUsdt: amount,
      note,
    });
  }

  async getWallet(userId) {
    return this.getOrCreateWallet(userId);
  }

  async getTransactions(userId) {
    if (!userId) return [];
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/${encodeURIComponent(userId)}/transactions`, { headers: await authHeaders() });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        await offlineStorage.set(`transactions:${userId}`, json.data);
        return json.data;
      }
      return (await offlineStorage.get(`transactions:${userId}`)) || [];
    } catch {
      return (await offlineStorage.get(`transactions:${userId}`)) || [];
    }
  }
}

export const mobileWalletService = new MobileWalletService();
export const walletService = mobileWalletService;

