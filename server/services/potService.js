import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { walletService } from './walletService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const POTS_STORE_PATH = path.join(__dirname, '../data/pots.json');

const INITIAL_POTS = [
  {
    id: 'pot-friends-stokvel',
    name: 'Friends Stokvel',
    mode: 'rotation',
    targetAsset: null,
    contributionAmount: 20,
    totalPotSize: 100,
    frequency: 'Monthly',
    currentRound: 1,
    totalRounds: 5,
    status: 'active',
    inviteCode: 'STOK-FRND-8821',
    description: 'Monthly rotation between 5 college friends for emergency & bulk savings',
    members: [
      { id: 'm1', name: 'Thandi', avatar: 'av-1', paid: true, payoutOrder: 1, paidAt: '2026-11-08T10:14:00Z', txHash: '0x3a9e4726bf6201cba64f89d34e21a7c5b08df1278149e6fbc24a91083de21c9a' },
      { id: 'm2', name: 'Sipho', avatar: 'av-2', paid: true, payoutOrder: 2, paidAt: '2026-11-08T11:20:00Z', txHash: '0x9b1d59103e5c9a1b4d0812746bc3e2849f1a23847e908123456789abcdef0123' },
      { id: 'm3', name: 'Lerato', avatar: 'av-3', paid: true, payoutOrder: 3, paidAt: '2026-11-09T08:05:00Z', txHash: '0x7e2a90103e5c9a1b4d0812746bc3e2849f1a23847e908123456789abcdef4411' },
      { id: 'm4', name: 'Ayo', avatar: 'av-4', paid: true, payoutOrder: 4, paidAt: '2026-11-09T14:30:00Z', txHash: '0x1d4e88fa3e5c9a1b4d0812746bc3e2849f1a23847e908123456789abcdef9922' },
      { id: 'm5', name: 'You', avatar: 'av-user', paid: false, payoutOrder: 5, paidAt: null, txHash: null, isUserSlot: true },
    ],
    history: [
      {
        round: 0,
        date: '2026-11-01',
        event: 'Tether Smart Escrow Contract Deployed',
        recipient: 'Multi-Sig Escrow Vault',
        amount: 0,
        txHash: '0x8f2d59103e5c9a1b4d0812746bc3e2849f1a23847e908123456789abcdef0123',
        status: 'settled',
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
    inviteCode: 'CHAM-TECH-1044',
    description: 'Group investment pot co-purchasing tokenised US tech equities (tAAPL)',
    members: [
      { id: 'm1', name: 'Lucas', avatar: 'av-1', paid: true, payoutOrder: 1, voteApproved: true },
      { id: 'm2', name: 'Nhlakanipho', avatar: 'av-2', paid: true, payoutOrder: 2, voteApproved: true },
      { id: 'm3', name: 'Rorisang', avatar: 'av-3', paid: true, payoutOrder: 3, voteApproved: true },
      { id: 'm4', name: 'Amara', avatar: 'av-4', paid: true, payoutOrder: 4, voteApproved: true },
      { id: 'm5', name: 'You', avatar: 'av-user', paid: false, payoutOrder: 5, voteApproved: false, isUserSlot: true },
    ],
    history: [
      {
        round: 1,
        date: '2026-09-15',
        event: 'Purchased 1.05 tAAPL',
        recipient: 'Group Equity Vault (Split equally)',
        amount: 250,
        txHash: '0x77d459103e5c9a1b4d0812746bc3e2849f1a23847e908123456789abcdef3311',
        status: 'settled',
      },
      {
        round: 2,
        date: '2026-10-15',
        event: 'Purchased 1.08 tAAPL',
        recipient: 'Group Equity Vault (Split equally)',
        amount: 250,
        txHash: '0x55ca59103e5c9a1b4d0812746bc3e2849f1a23847e908123456789abcdef5522',
        status: 'settled',
      }
    ],
  }
];

class PotService {
  constructor() {
    this.pots = this.loadPots();
  }

  loadPots() {
    if (fs.existsSync(POTS_STORE_PATH)) {
      try {
        return JSON.parse(fs.readFileSync(POTS_STORE_PATH, 'utf-8'));
      } catch {
        return JSON.parse(JSON.stringify(INITIAL_POTS));
      }
    }
    this.savePots(INITIAL_POTS);
    return JSON.parse(JSON.stringify(INITIAL_POTS));
  }

  savePots(potsData = this.pots) {
    try {
      fs.writeFileSync(POTS_STORE_PATH, JSON.stringify(potsData, null, 2), 'utf-8');
    } catch (err) {
      console.error('[PotService] Error persisting pots:', err.message);
    }
  }

  getAllPots() {
    return this.pots;
  }

  getPotById(id) {
    return this.pots.find((p) => p.id === id);
  }

  createPot(potData, creatorUserId = 'demo_user') {
    if (!potData.name) throw new Error('Pot name is required.');

    const amount = Number(potData.contributionAmount) || 20;
    const mode = potData.mode === 'investment' ? 'investment' : 'rotation';
    const targetAsset = mode === 'investment' ? (potData.targetAsset || 'tAAPL') : null;
    const initialMemberCount = 5;

    const creatorName = creatorUserId.includes('@') ? creatorUserId.split('@')[0] : 'You';

    const newPot = {
      id: `pot-${Date.now()}`,
      name: potData.name,
      mode,
      targetAsset,
      contributionAmount: amount,
      totalPotSize: amount * initialMemberCount,
      frequency: potData.frequency || 'Monthly',
      currentRound: 1,
      totalRounds: initialMemberCount,
      status: 'active',
      inviteCode: `POT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      description: potData.description || 'Community savings & investment pot',
      members: [
        { id: 'm1', name: `${creatorName} (Admin)`, avatar: 'av-admin', paid: false, payoutOrder: 1, userId: creatorUserId, isUserSlot: true },
        { id: 'm2', name: 'Awaiting Member 2', avatar: 'av-pending', paid: false, payoutOrder: 2 },
        { id: 'm3', name: 'Awaiting Member 3', avatar: 'av-pending', paid: false, payoutOrder: 3 },
        { id: 'm4', name: 'Awaiting Member 4', avatar: 'av-pending', paid: false, payoutOrder: 4 },
        { id: 'm5', name: 'Awaiting Member 5', avatar: 'av-pending', paid: false, payoutOrder: 5 },
      ],
      history: [
        {
          round: 0,
          date: new Date().toLocaleDateString(),
          event: 'Pot Smart Vault Created',
          recipient: 'Tether Escrow',
          amount: 0,
          txHash: ethers.hexlify(ethers.randomBytes(32)),
          status: 'settled',
        }
      ],
      createdAt: new Date().toISOString(),
    };

    this.pots.unshift(newPot);
    this.savePots();

    walletService.logAudit('STOKVEL_POT_CREATED', creatorUserId, { potId: newPot.id, name: newPot.name });
    walletService.addNotification(creatorUserId, 'Stokvel Pot Created', `Created ${newPot.name} with invite code ${newPot.inviteCode}`, 'success');

    return newPot;
  }

  /**
   * Real authoritative contribution: checks and deducts caller's Tether USDT balance
   */
  async contribute(potId, contributingUserId) {
    const pot = this.getPotById(potId);
    if (!pot) throw new Error('Stokvel pot not found.');

    // 1. Verify and deduct caller's Tether balance
    const userWallet = walletService.getOrCreateWallet(contributingUserId);
    if (userWallet.balanceUsdt < pot.contributionAmount) {
      throw new Error(
        `Insufficient Tether USDT balance. Required: $${pot.contributionAmount} USDT, Available: $${userWallet.balanceUsdt.toFixed(2)} USDT.`
      );
    }

    // Identify user member slot
    const userName = contributingUserId.includes('@') ? contributingUserId.split('@')[0] : 'You';
    let member = pot.members.find(
      (m) => (m.userId && m.userId.toLowerCase() === contributingUserId.toLowerCase()) || m.isUserSlot || m.id === 'm5'
    );

    if (!member) {
      member = pot.members.find((m) => !m.paid);
    }

    if (member && member.paid) {
      throw new Error('Your contribution for this round has already been recorded.');
    }

    // Deduct funds on backend walletService
    userWallet.balanceUsdt = Math.round((userWallet.balanceUsdt - pot.contributionAmount) * 100) / 100;
    const realTxHash = ethers.hexlify(ethers.randomBytes(32));

    if (member) {
      member.name = `${userName} (You)`;
      member.userId = contributingUserId;
      member.paid = true;
      member.paidAt = new Date().toISOString();
      member.txHash = realTxHash;
    }

    // Check if all members paid -> trigger round payout or asset purchase
    const paidCount = pot.members.filter((m) => m.paid).length;
    const isRoundComplete = paidCount === pot.members.length;
    let payoutEvent = null;

    if (isRoundComplete) {
      const payoutTx = ethers.hexlify(ethers.randomBytes(32));
      const scheduledBeneficiary = pot.members.find((m) => m.payoutOrder === pot.currentRound) || pot.members[0];

      if (pot.mode === 'rotation') {
        // Disburse funds to beneficiary
        if (scheduledBeneficiary.userId) {
          const beneficiaryWallet = walletService.getOrCreateWallet(scheduledBeneficiary.userId);
          beneficiaryWallet.balanceUsdt = Math.round((beneficiaryWallet.balanceUsdt + pot.totalPotSize) * 100) / 100;
          walletService.addNotification(
            scheduledBeneficiary.userId,
            'Stokvel Payout Disbursed!',
            `You received your round payout of $${pot.totalPotSize} USDT from ${pot.name}`,
            'success',
            { potId: pot.id, round: pot.currentRound }
          );
        }

        pot.history.unshift({
          round: pot.currentRound,
          date: new Date().toLocaleDateString(),
          event: `Round ${pot.currentRound} Rotation Payout to ${scheduledBeneficiary.name}`,
          recipient: scheduledBeneficiary.name,
          amount: pot.totalPotSize,
          txHash: payoutTx,
          status: 'settled',
        });

        payoutEvent = {
          round: pot.currentRound,
          recipient: scheduledBeneficiary.name,
          amount: pot.totalPotSize,
          mode: 'rotation',
          txHash: payoutTx,
        };
      } else {
        // Investment Pot: purchase tokenized equity
        const sharesPurchased = (pot.totalPotSize / 236.40).toFixed(3);
        pot.history.unshift({
          round: pot.currentRound,
          date: new Date().toLocaleDateString(),
          event: `Purchased ${sharesPurchased} ${pot.targetAsset} for Group Vault`,
          recipient: `Group Vault (${sharesPurchased} shares)`,
          amount: pot.totalPotSize,
          txHash: payoutTx,
          status: 'settled',
        });

        payoutEvent = {
          round: pot.currentRound,
          recipient: 'Group Equity Vault',
          amount: pot.totalPotSize,
          asset: pot.targetAsset,
          mode: 'investment',
          sharesPurchased,
          txHash: payoutTx,
        };
      }

      // Advance round and reset paid flags for next rotation
      pot.currentRound = pot.currentRound < pot.totalRounds ? pot.currentRound + 1 : 1;
      pot.members.forEach((m) => {
        m.paid = false;
        m.paidAt = null;
        m.txHash = null;
      });
    }

    this.savePots();

    walletService.logAudit('STOKVEL_CONTRIBUTION', contributingUserId, {
      potId: pot.id,
      amount: pot.contributionAmount,
      txHash: realTxHash,
    });

    walletService.addNotification(
      contributingUserId,
      'Contribution Confirmed',
      `Paid $${pot.contributionAmount} USDT to ${pot.name} (Round ${pot.currentRound})`,
      'success',
      { txHash: realTxHash }
    );

    return {
      success: true,
      pot,
      txHash: realTxHash,
      isRoundComplete,
      payoutEvent,
      message: `Contributed $${pot.contributionAmount} USDT successfully to ${pot.name}`,
    };
  }

  joinPotByInviteCode(inviteCode, userId) {
    const pot = this.pots.find((p) => p.inviteCode?.toUpperCase() === inviteCode?.trim().toUpperCase());
    if (!pot) throw new Error('Invalid or unrecognised pot invitation code.');

    const userName = userId.includes('@') ? userId.split('@')[0] : 'Member';
    const openSlot = pot.members.find((m) => !m.userId && m.name.includes('Awaiting'));

    if (!openSlot) {
      throw new Error('This pot already has a full complement of members.');
    }

    openSlot.name = userName;
    openSlot.userId = userId;
    openSlot.avatar = 'av-user';
    this.savePots();

    walletService.logAudit('STOKVEL_JOINED', userId, { potId: pot.id, inviteCode });
    walletService.addNotification(userId, 'Joined Stokvel Pot', `You successfully joined ${pot.name}`, 'success');

    return pot;
  }

  voteInvestment(potId, userId, approved = true) {
    const pot = this.getPotById(potId);
    if (!pot) throw new Error('Pot not found.');
    if (pot.mode !== 'investment') throw new Error('Voting is only available on Investment Club pots.');

    const member = pot.members.find((m) => m.userId === userId || m.isUserSlot);
    if (!member) throw new Error('Member not found in this pot.');

    member.voteApproved = Boolean(approved);
    this.savePots();

    return { success: true, pot };
  }
}

export const potService = new PotService();
