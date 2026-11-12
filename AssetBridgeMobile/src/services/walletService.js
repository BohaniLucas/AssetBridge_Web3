import { API_BASE_URL, SEPOLIA_USDT_CONTRACT } from '../config/api';

class MobileWalletService {
  constructor() {
    this.memoryCache = {};
    this.pendingIdempotencyKeys = new Set();
    this.savedRecipients = [
      {
        id: 'rec-1',
        name: 'Mama Thandi',
        identifier: 'thandi@assetbridge.africa',
        address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
        avatar: '👩‍🦱',
        location: 'Johannesburg, ZA',
        recentNote: 'Monthly family allowance',
      },
      {
        id: 'rec-2',
        name: 'Brother Kwame',
        identifier: 'kwame@assetbridge.africa',
        address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        avatar: '👨‍🦱',
        location: 'Nairobi, KE',
        recentNote: 'School fees split',
      },
      {
        id: 'rec-3',
        name: 'Amina Bello',
        identifier: 'amina@assetbridge.africa',
        address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        avatar: '👧',
        location: 'Lagos, NG',
        recentNote: 'Groceries split',
      },
      {
        id: 'rec-4',
        name: 'Fresh Market Stall #4',
        identifier: 'vendor@assetbridge.africa',
        address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        avatar: '🏪',
        location: 'Kibera Market, KE',
        recentNote: 'Vendor QR checkout',
      },
    ];
  }

  getSavedRecipients() {
    return [...this.savedRecipients];
  }

  async getFeeQuote() {
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/fee-quote`);
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch {
      // offline fallback
    }

    return {
      network: 'Ethereum Sepolia (ChainID: 11155111)',
      token: 'Tether USD (USDT)',
      contractAddress: SEPOLIA_USDT_CONTRACT,
      gasPriceGwei: 12.5,
      estimatedGas: 65000,
      feeUsdt: 0.2,
      feeEth: 0.00018,
      settlementTimeSeconds: 12,
      idempotencySupported: true,
      timestamp: new Date().toISOString(),
    };
  }

  async getOrCreateWallet(userId = 'malulekelucas04@gmail.com') {
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (res.ok && json.data) {
        this.memoryCache[userId] = json.data;
        return json.data;
      }
    } catch {
      // Backend offline fallback
    }

    if (this.memoryCache[userId]) return this.memoryCache[userId];

    const fallbackWallet = {
      userId,
      address: '0x4f0b819D2E527B13D774925dfc477284600be09f',
      balanceUsdt: 1000.0,
      network: 'Ethereum Sepolia',
      contractAddress: SEPOLIA_USDT_CONTRACT,
      assetSymbol: 'USDT',
    };
    this.memoryCache[userId] = fallbackWallet;
    return fallbackWallet;
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
      if (err.message && !err.message.includes('Network') && !err.message.includes('fetch')) {
        throw err;
      }
    }

    // Offline simulation with idempotency safety
    const wallet = await this.getOrCreateWallet(senderUserId);
    if (wallet.balanceUsdt < numAmount + 0.2) {
      throw new Error(`Insufficient funds. Required: $${(numAmount + 0.2).toFixed(2)} USDT ($0.20 fee), Available: $${wallet.balanceUsdt.toFixed(2)} USDT`);
    }

    wallet.balanceUsdt = Math.round((wallet.balanceUsdt - (numAmount + 0.2)) * 100) / 100;
    const tx = {
      id: `tx-${Date.now()}`,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      type: 'p2p_transfer',
      amountUsdt: numAmount,
      feeUsdt: 0.2,
      senderUserId,
      recipientAddress: recipientAddressOrUsername,
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      note,
      idempotencyKey: key,
    };
    return { transaction: tx, senderWallet: wallet };
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
    } catch {
      // offline fallback
    }

    const wallet = await this.getOrCreateWallet(userId);
    wallet.balanceUsdt = Math.round((wallet.balanceUsdt + 250) * 100) / 100;
    return { wallet };
  }

  async getTransactions(userId) {
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/${encodeURIComponent(userId)}/transactions`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) return json.data;
    } catch {
      // offline
    }
    return [
      {
        id: 'tx-1',
        txHash: '0x8f2d59103e5c9a1b4d0812746bc3e2849f1a23847e908123456789abcdef0123',
        type: 'p2p_transfer',
        amountUsdt: 50.0,
        status: 'confirmed',
        recipientAddress: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'tx-2',
        txHash: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc7169d38820dfd117c3fa1f22',
        type: 'stokvel_contribution',
        amountUsdt: 20.0,
        status: 'confirmed',
        recipientAddress: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
    ];
  }
}

export const mobileWalletService = new MobileWalletService();

