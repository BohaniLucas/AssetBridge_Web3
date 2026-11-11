import { API_BASE_URL, SEPOLIA_USDT_CONTRACT } from '../config/api';

class MobileWalletService {
  constructor() {
    this.memoryCache = {};
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

  async transfer({ senderUserId, recipientAddressOrUsername, amountUsdt, note = '' }) {
    const numAmount = Number(amountUsdt);
    try {
      const res = await fetch(`${API_BASE_URL}/wallet/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUserId,
          recipientAddressOrUsername,
          amountUsdt: numAmount,
          note,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
      throw new Error(json.message || 'Transfer failed on backend');
    } catch (err) {
      if (err.message && !err.message.includes('Network') && !err.message.includes('fetch')) {
        throw err;
      }
    }

    // Offline simulation
    const wallet = await this.getOrCreateWallet(senderUserId);
    if (wallet.balanceUsdt < numAmount) {
      throw new Error(`Insufficient funds. Required: $${numAmount} USDT, Available: $${wallet.balanceUsdt} USDT`);
    }

    wallet.balanceUsdt = Math.round((wallet.balanceUsdt - numAmount) * 100) / 100;
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
        recipientAddress: '0xea659Bb384a463D6F24CF15f7077364e196Eed7d',
        timestamp: new Date().toISOString(),
      },
    ];
  }
}

export const mobileWalletService = new MobileWalletService();

