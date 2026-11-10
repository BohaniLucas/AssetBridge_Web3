import { INITIAL_STOKVEL_POTS } from '../utils/constants';
import { activityService } from './activityService';

const POTS_STORAGE_KEY = 'assetbridge_stokvel_pots';
const potsStorageKey = (userId) => `${POTS_STORAGE_KEY}:${userId || 'demo'}`;

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

  savePots(pots, userId) {
    localStorage.setItem(potsStorageKey(userId), JSON.stringify(pots));
  },

  resetDemo(userId) {
    const initialPots = JSON.parse(JSON.stringify(INITIAL_STOKVEL_POTS));
    localStorage.setItem(potsStorageKey(userId), JSON.stringify(initialPots));
    return initialPots;
  },

  contributeToPot(potId, memberId = '5', userId) {
    const pots = this.getPots(userId);
    const pot = pots.find(p => p.id === potId);
    if (!pot) return null;

    const member = pot.members.find(m => m.id === memberId);
    if (!member || member.paid) return { pot, alreadyPaid: true };

    member.paid = true;
    member.paidAt = new Date().toISOString();
    const paidCount = pot.members.filter(m => m.paid).length;
    const isCompleted = paidCount === pot.members.length;
    let payoutEvent = null;

    if (isCompleted) {
      const recipientMember = pot.members.find(m => m.payoutOrder === pot.currentRound) || pot.members[0];
      payoutEvent = {
        round: pot.currentRound,
        recipient: recipientMember.name,
        amount: pot.totalPot,
        mode: pot.mode,
        asset: pot.mode === 'investment' ? pot.targetAsset : 'USDT',
        txHash: `demo-${Date.now()}`,
        simulated: true,
      };

      pot.payoutHistory.unshift({
        round: pot.currentRound,
        date: new Date().toLocaleString(),
        beneficiary: pot.mode === 'rotation' ? `${recipientMember.name} (demo payout)` : `${pot.targetAsset} (demo purchase)`,
        amount: `$${pot.totalPot}`,
        tx: payoutEvent.txHash,
      });
    }

    this.savePots(pots, userId);
    activityService.addActivity({
      type: 'stokvel_contribution',
      title: `Demo contribution recorded · ${pot.name}`,
      detail: `$${pot.contributionAmount} USDT · Round ${pot.currentRound}${isCompleted ? ' · demo round completed' : ''}`,
      status: 'simulated',
      reference: `demo-${Date.now()}`,
    }, userId);
    return { pot, isCompleted, payoutEvent, pots };
  },

  advanceNextRound(potId, userId) {
    const pots = this.getPots(userId);
    const pot = pots.find(p => p.id === potId);
    if (!pot) return null;

    pot.currentRound = (pot.currentRound % pot.totalRounds) + 1;
    
    // Set up members for the new round: 4 paid, 1 pending for demo
    pot.members.forEach((m, idx) => {
      m.recipient = m.payoutOrder === pot.currentRound;
      m.paid = idx < pot.members.length - 1; // 4 of 5 paid
    });

    this.savePots(pots, userId);
    return { pot, pots };
  },

  createPot(newPotData, userId) {
    const pots = this.getPots(userId);
    const newPot = {
      id: `pot-${Date.now()}`,
      name: newPotData.name || 'New Savings Pot',
      mode: newPotData.mode || 'rotation',
      targetAsset: newPotData.targetAsset || 'tAAPL',
      tagline: newPotData.mode === 'rotation' ? 'Rotational Stokvel' : 'Investment Club',
      contributionAmount: Number(newPotData.contributionAmount) || 20,
      currency: 'USDT',
      totalPot: (Number(newPotData.contributionAmount) || 20) * 5,
      frequency: newPotData.frequency || 'Monthly',
      currentRound: 1,
      totalRounds: 5,
      members: [
        { id: '1', name: 'You (Organizer)', avatar: '🙋🏾‍♂️', paid: true, payoutOrder: 1, recipient: true },
        { id: '2', name: 'Thandi', avatar: '👩🏾', paid: false, payoutOrder: 2, recipient: false },
        { id: '3', name: 'Sipho', avatar: '👨🏾', paid: false, payoutOrder: 3, recipient: false },
        { id: '4', name: 'Lerato', avatar: '👩🏽', paid: false, payoutOrder: 4, recipient: false },
        { id: '5', name: 'Ayo', avatar: '👨🏿', paid: false, payoutOrder: 5, recipient: false },
      ],
      payoutHistory: [],
    };
    pots.push(newPot);
    this.savePots(pots, userId);
    return newPot;
  }
};

