/**
 * Stokvel / Chama / Ajo Pots Service
 * Handles Rotation & Investment Pots with demo controls, round management, and payouts
 */

let potsDatabase = [
  {
    id: 'pot-friends-stokvel',
    name: 'Friends Stokvel',
    mode: 'rotation', // 'rotation' | 'investment'
    targetAsset: null,
    contributionAmount: 20, // $20 USDT per member
    totalPotSize: 100, // 5 * 20 = $100
    frequency: 'Monthly',
    currentRound: 1,
    totalRounds: 5,
    status: 'active', // 'active' | 'completed' | 'voting'
    description: 'Monthly rotation between 5 college friends for emergency & bulk savings',
    members: [
      { id: 'm1', name: 'Thandi', avatar: '👩🏾', paid: true, payoutOrder: 1, paidAt: '2026-11-08T10:14:00Z', txHash: '0x3a9...f412' },
      { id: 'm2', name: 'Sipho', avatar: '👨🏾', paid: true, payoutOrder: 2, paidAt: '2026-11-08T11:20:00Z', txHash: '0x9b1...c823' },
      { id: 'm3', name: 'Lerato', avatar: '👩🏽', paid: true, payoutOrder: 3, paidAt: '2026-11-09T08:05:00Z', txHash: '0x7e2...a109' },
      { id: 'm4', name: 'Ayo', avatar: '👨🏿', paid: true, payoutOrder: 4, paidAt: '2026-11-09T14:30:00Z', txHash: '0x1d4...88fa' },
      { id: 'm5', name: 'Wanjiru (You)', avatar: '🙋🏾‍♀️', paid: false, payoutOrder: 5, paidAt: null, txHash: null },
    ],
    history: [
      {
        round: 1,
        date: '2026-11-09',
        event: 'Round 1 In Progress',
        recipient: 'Thandi',
        amount: 100,
        status: 'pending_last_contribution',
      }
    ],
  },
  {
    id: 'pot-pan-african-tech-invest',
    name: 'Tech Growth Chama',
    mode: 'investment',
    targetAsset: 'tAAPL',
    contributionAmount: 50,
    totalPotSize: 250,
    frequency: 'Monthly',
    currentRound: 3,
    totalRounds: 12,
    status: 'active',
    description: 'Group investment pot co-purchasing tokenised US tech equities (tAAPL)',
    members: [
      { id: 'm1', name: 'Lucas', avatar: '👨🏾‍💻', paid: true, payoutOrder: 1, voteApproved: true },
      { id: 'm2', name: 'Nhlakanipho', avatar: '👨🏾‍🔬', paid: true, payoutOrder: 2, voteApproved: true },
      { id: 'm3', name: 'Rorisang', avatar: '👩🏾‍💼', paid: true, payoutOrder: 3, voteApproved: true },
      { id: 'm4', name: 'Amara', avatar: '👩🏾', paid: true, payoutOrder: 4, voteApproved: true },
      { id: 'm5', name: 'Tariq', avatar: '👨🏽', paid: false, payoutOrder: 5, voteApproved: false },
    ],
    history: [
      {
        round: 1,
        date: '2026-09-15',
        event: 'Purchased 1.15 tAAPL',
        recipient: 'Group Vault (Split equally)',
        amount: 250,
        txHash: '0x77d...99aa',
        status: 'settled',
      },
      {
        round: 2,
        date: '2026-10-15',
        event: 'Purchased 1.10 tAAPL',
        recipient: 'Group Vault (Split equally)',
        amount: 250,
        txHash: '0x55c...22fe',
        status: 'settled',
      }
    ],
  }
];

class PotService {
  getAllPots() {
    return potsDatabase;
  }

  getPotById(id) {
    return potsDatabase.find(p => p.id === id);
  }

  createPot(potData) {
    const newPot = {
      id: `pot-${Date.now()}`,
      name: potData.name,
      mode: potData.mode || 'rotation',
      targetAsset: potData.targetAsset || (potData.mode === 'investment' ? 'tAAPL' : null),
      contributionAmount: Number(potData.contributionAmount) || 20,
      totalPotSize: (Number(potData.contributionAmount) || 20) * (potData.members?.length || 5),
      frequency: potData.frequency || 'Monthly',
      currentRound: 1,
      totalRounds: potData.members?.length || 5,
      status: 'active',
      description: potData.description || 'Stokvel group savings pot',
      members: potData.members || [
        { id: 'm1', name: 'Member 1 (You)', avatar: '👤', paid: false, payoutOrder: 1 },
        { id: 'm2', name: 'Member 2', avatar: '👤', paid: false, payoutOrder: 2 },
      ],
      history: [],
    };
    potsDatabase.push(newPot);
    return newPot;
  }

  /**
   * Simulates contributing to a pot (e.g. 5th member pays)
   */
  contribute(potId, memberId) {
    const pot = this.getPotById(potId);
    if (!pot) throw new Error('Pot not found');

    const member = pot.members.find(m => m.id === memberId || m.name.includes('(You)'));
    if (!member) throw new Error('Member not in pot');

    if (member.paid) {
      return { pot, alreadyPaid: true, message: `${member.name} has already contributed for this round.` };
    }

    // Mark member paid
    member.paid = true;
    member.paidAt = new Date().toISOString();
    member.txHash = '0x' + Math.random().toString(16).substring(2, 10) + '...' + Math.random().toString(16).substring(2, 6);

    // Check if round completed
    const paidCount = pot.members.filter(m => m.paid).length;
    const isRoundComplete = paidCount === pot.members.length;
    let payoutDetails = null;

    if (isRoundComplete) {
      // Current round payout recipient
      const currentRecipient = pot.members.find(m => m.payoutOrder === pot.currentRound) || pot.members[0];
      
      payoutDetails = {
        round: pot.currentRound,
        recipient: currentRecipient.name,
        amount: pot.totalPotSize,
        mode: pot.mode,
        asset: pot.mode === 'investment' ? pot.targetAsset : 'USDT',
        txHash: '0x' + Math.random().toString(16).substring(2, 12),
        message: pot.mode === 'rotation' 
          ? `🎉 Round ${pot.currentRound} Complete! ${currentRecipient.name} received +$${pot.totalPotSize} USDT directly to their wallet!`
          : `🚀 Round ${pot.currentRound} Complete! Group contract co-purchased tokenised ${pot.targetAsset} worth $${pot.totalPotSize}!`,
      };

      pot.history.unshift({
        round: pot.currentRound,
        date: new Date().toISOString().split('T')[0],
        event: pot.mode === 'rotation' ? `Payout to ${currentRecipient.name}` : `Purchased ${pot.targetAsset}`,
        recipient: currentRecipient.name,
        amount: pot.totalPotSize,
        txHash: payoutDetails.txHash,
        status: 'settled',
      });
    }

    return { pot, member, isRoundComplete, payoutDetails };
  }

  /**
   * Fast-forward to the next round for demonstration
   */
  advanceNextRound(potId) {
    const pot = this.getPotById(potId);
    if (!pot) throw new Error('Pot not found');

    if (pot.currentRound >= pot.totalRounds) {
      pot.currentRound = 1; // loop back for continuous demo
    } else {
      pot.currentRound += 1;
    }

    // Reset member payment status for new round with demo state: 4 of 5 paid
    pot.members.forEach((m, idx) => {
      if (idx < pot.members.length - 1) {
        m.paid = true;
        m.paidAt = new Date().toISOString();
        m.txHash = '0x' + Math.random().toString(16).substring(2, 8);
      } else {
        m.paid = false;
        m.paidAt = null;
        m.txHash = null;
      }
    });

    const nextRecipient = pot.members.find(m => m.payoutOrder === pot.currentRound);

    return {
      pot,
      message: `Advanced to Round ${pot.currentRound}. Next recipient: ${nextRecipient?.name || 'Group'}`,
    };
  }

  resetDemoPot(potId = 'pot-friends-stokvel') {
    const pot = this.getPotById(potId);
    if (!pot) return null;
    pot.currentRound = 1;
    pot.members = [
      { id: 'm1', name: 'Thandi', avatar: '👩🏾', paid: true, payoutOrder: 1, paidAt: '2026-11-08T10:14:00Z', txHash: '0x3a9...f412' },
      { id: 'm2', name: 'Sipho', avatar: '👨🏾', paid: true, payoutOrder: 2, paidAt: '2026-11-08T11:20:00Z', txHash: '0x9b1...c823' },
      { id: 'm3', name: 'Lerato', avatar: '👩🏽', paid: true, payoutOrder: 3, paidAt: '2026-11-09T08:05:00Z', txHash: '0x7e2...a109' },
      { id: 'm4', name: 'Ayo', avatar: '👨🏿', paid: true, payoutOrder: 4, paidAt: '2026-11-09T14:30:00Z', txHash: '0x1d4...88fa' },
      { id: 'm5', name: 'Wanjiru (You)', avatar: '🙋🏾‍♀️', paid: false, payoutOrder: 5, paidAt: null, txHash: null },
    ];
    return pot;
  }
}

export const potService = new PotService();

