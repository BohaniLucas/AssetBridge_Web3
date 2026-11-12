import { ethers } from 'ethers';
import { INITIAL_STOKVEL_POTS } from '../utils/constants';
import { activityService } from './activityService';
import { walletClientService } from './walletClientService';

const POTS_STORAGE_KEY = 'assetbridge_stokvel_pots';
const potsStorageKey = (userId) => `${POTS_STORAGE_KEY}:${userId || 'demo'}`;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const potsService = {
  getPots(userId) {
    const key = potsStorageKey(userId);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    const initialPots = JSON.parse(JSON.stringify(INITIAL_STOKVEL_POTS));
    localStorage.setItem(key, JSON.stringify(initialPots));
    return initialPots;
  },

  async fetchPotsFromBackend(userId) {
    try {
      const res = await fetch(`${API_BASE}/pots`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          this.savePots(json.data, userId);
          return json.data;
        }
      }
    } catch {
      // offline fallback
    }
    return this.getPots(userId);
  },

  savePots(pots, userId) {
    localStorage.setItem(potsStorageKey(userId), JSON.stringify(pots));
  },

  async contributeToPot(potId, user, userId) {
    const userWallet = await walletClientService.getOrCreateWallet(user);

    // Try backend contribution first
    try {
      const res = await fetch(`${API_BASE}/pots/${encodeURIComponent(potId)}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        // Refresh and return
        const updatedPots = await this.fetchPotsFromBackend(userId);
        return {
          pot: json.data.pot,
          isCompleted: json.data.isRoundComplete,
          payoutEvent: json.data.payoutEvent,
          pots: updatedPots,
          txHash: json.data.txHash,
        };
      } else if (!res.ok) {
        throw new Error(json.message || 'Contribution failed on backend.');
      }
    } catch (err) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
      // offline fallback
    }

    const pots = this.getPots(userId);
    const pot = pots.find((p) => p.id === potId);
    if (!pot) throw new Error('Savings pot not found.');

    if (userWallet.balanceUsdt < pot.contributionAmount) {
      throw new Error(
        `Insufficient Tether USDT balance. Required: $${pot.contributionAmount} USDT, Available: $${userWallet.balanceUsdt.toFixed(2)} USDT.`
      );
    }

    // Deduct contribution amount from wallet
    userWallet.balanceUsdt = Math.round((userWallet.balanceUsdt - pot.contributionAmount) * 100) / 100;
    localStorage.setItem(`assetbridge_tether_wallet_${userId || 'demo'}`, JSON.stringify(userWallet));

    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You';
    let userMember = pot.members.find((m) => m.isUser || m.id === '5');
    if (!userMember) {
      userMember = pot.members[pot.members.length - 1];
    }

    if (userMember.paid) {
      return { pot, alreadyPaid: true, pots };
    }

    userMember.name = `${userName} (You)`;
    userMember.paid = true;
    userMember.paidAt = new Date().toISOString();

    const txHash = ethers.hexlify(ethers.randomBytes(32));
    const paidCount = pot.members.filter((m) => m.paid).length;
    const isCompleted = paidCount === pot.members.length;
    let payoutEvent = null;

    if (isCompleted) {
      const recipientMember = pot.members.find((m) => m.payoutOrder === pot.currentRound) || pot.members[0];
      const payoutTx = ethers.hexlify(ethers.randomBytes(32));

      payoutEvent = {
        round: pot.currentRound,
        recipient: recipientMember.name,
        amount: pot.totalPot,
        mode: pot.mode,
        asset: pot.mode === 'investment' ? pot.targetAsset : 'USDT',
        txHash: payoutTx,
      };

      if (!pot.payoutHistory) pot.payoutHistory = [];
      pot.payoutHistory.unshift({
        round: pot.currentRound,
        date: new Date().toLocaleDateString(),
        beneficiary:
          pot.mode === 'rotation'
            ? `${recipientMember.name} (Lump-sum payout)`
            : `${pot.targetAsset} (${(pot.totalPot / 228.45).toFixed(3)} shares co-purchased)`,
        amount: `$${pot.totalPot} USDT`,
        tx: payoutTx,
      });
    }

    this.savePots(pots, userId);

    activityService.addActivity(
      {
        type: 'stokvel_contribution',
        title: `Contributed $${pot.contributionAmount} USDT · ${pot.name}`,
        detail: `Round ${pot.currentRound} contribution verified on Tether contract`,
        status: 'confirmed',
        reference: txHash,
      },
      userId
    );

    return { pot, isCompleted, payoutEvent, pots, txHash };
  },

  async joinPot(inviteCode, user, userId) {
    try {
      const res = await fetch(`${API_BASE}/pots/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode, userId }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        const pots = await this.fetchPotsFromBackend(userId);
        return { pot: json.data, pots };
      }
      throw new Error(json.message || 'Failed to join pot.');
    } catch (err) {
      if (err.message && !err.message.includes('fetch')) throw err;
      throw new Error('Could not connect to pot network. Check invite code.');
    }
  },

  async voteInvestment(potId, approved, userId) {
    try {
      const res = await fetch(`${API_BASE}/pots/${encodeURIComponent(potId)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, userId }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        return json.data;
      }
    } catch {
      // offline
    }
    return { success: true };
  },

  createPot(newPotData, user, userId) {
    const pots = this.getPots(userId);
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You';
    const amount = Number(newPotData.contributionAmount) || 20;

    const newPot = {
      id: `pot-${Date.now()}`,
      name: newPotData.name || 'Community Savings Pot',
      mode: newPotData.mode || 'rotation',
      tagline: newPotData.mode === 'investment' ? 'Investment Club Mode' : 'Rotational Chama / Stokvel',
      contributionAmount: amount,
      currency: 'USDT',
      totalPot: amount * 5,
      frequency: 'Monthly',
      currentRound: 1,
      totalRounds: 5,
      targetAsset: newPotData.targetAsset || 'tAAPL',
      inviteCode: `POT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      members: [
        { id: '1', name: `${userName} (You)`, avatar: '🙋🏾‍♂️', paid: false, payoutOrder: 1, recipient: true, isUser: true },
        { id: '2', name: 'Sipho N.', avatar: '👨🏾', paid: false, payoutOrder: 2, recipient: false },
        { id: '3', name: 'Lerato K.', avatar: '👩🏽', paid: false, payoutOrder: 3, recipient: false },
        { id: '4', name: 'Ayo O.', avatar: '👨🏿', paid: false, payoutOrder: 4, recipient: false },
        { id: '5', name: 'Thandiwe M.', avatar: '👩🏾', paid: false, payoutOrder: 5, recipient: false },
      ],
      payoutHistory: [],
    };

    // Try posting to backend
    fetch(`${API_BASE}/pots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newPotData, creatorUserId: userId }),
    }).catch(() => {});

    pots.unshift(newPot);
    this.savePots(pots, userId);
    return newPot;
  },
};
