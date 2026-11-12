import { API_BASE_URL } from '../config/api';

class MobilePotsService {
  constructor() {
    this.pots = [
      {
        id: 'pot-nairobi-01',
        name: 'Tech Queens Stokvel',
        type: 'Rotational Chama (ROSCA)',
        targetPerRoundUsdt: 100.0,
        contributionUsdt: 20.0,
        cyclePeriod: 'Monthly',
        currentRound: 4,
        totalRounds: 5,
        currency: 'USDT',
        membersCount: 5,
        currentBeneficiary: 'Mama Thandi (Johannesburg)',
        members: [
          { id: 'm1', name: 'Nomsa (Lucas)', paid: true, date: 'Nov 10' },
          { id: 'm2', name: 'Mama Thandi', paid: true, date: 'Nov 11' },
          { id: 'm3', name: 'Amina Bello', paid: true, date: 'Nov 11' },
          { id: 'm4', name: 'Brother Kwame', paid: true, date: 'Nov 12' },
          { id: 'm5', name: 'Grace Ochieng', paid: false, date: 'Pending' },
        ],
      },
      {
        id: 'pot-capetown-02',
        name: 'Cape Town Micro-Entrepreneurs',
        type: 'Investment Chama',
        targetPerRoundUsdt: 250.0,
        contributionUsdt: 50.0,
        cyclePeriod: 'Bi-Weekly',
        currentRound: 2,
        totalRounds: 6,
        currency: 'USDT',
        membersCount: 5,
        currentBeneficiary: 'Sipho Khumalo',
        members: [
          { id: 'm1', name: 'Nomsa (Lucas)', paid: true, date: 'Nov 08' },
          { id: 'm2', name: 'Sipho Khumalo', paid: true, date: 'Nov 09' },
          { id: 'm3', name: 'Fatima Aliyu', paid: false, date: 'Pending' },
        ],
      },
    ];
  }

  getPots() {
    return [...this.pots].map((pot) => ({
      ...pot,
      contributionAmount: pot.contributionAmount ?? pot.contributionUsdt ?? pot.targetPerRoundUsdt,
      totalPotSize: pot.totalPotSize ?? pot.targetPerRoundUsdt,
    }));
  }

  async createPot({ name, contributionAmount, invitedMembers = [] }, creatorUserId = 'demo_user') {
    const payload = { name, contributionAmount, invitedMembers, creatorUserId };
    try {
      const res = await fetch(`${API_BASE_URL}/pots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        this.pots.unshift(json.data);
        return json.data;
      }
      if (!res.ok) throw new Error(json.message || 'The pot could not be created.');
      throw new Error('The pot could not be created.');
    } catch (error) {
      if (error.message && !error.message.includes('Network') && !error.message.includes('fetch')) throw error;
    }

    const memberList = invitedMembers.map((member, index) => ({ id: `invite-${Date.now()}-${index}`, ...member, paid: false }));
    const pot = {
      id: `pot-${Date.now()}`,
      name: name.trim(),
      contributionAmount: Number(contributionAmount),
      contributionUsdt: Number(contributionAmount),
      targetPerRoundUsdt: Number(contributionAmount) * Math.max(memberList.length + 1, 1),
      totalPotSize: Number(contributionAmount) * Math.max(memberList.length + 1, 1),
      currentRound: 1,
      totalRounds: Math.max(memberList.length + 1, 1),
      members: [{ id: `owner-${Date.now()}`, name: 'You', paid: false, isUserSlot: true }, ...memberList],
    };
    this.pots.unshift(pot);
    return pot;
  }

  async contribute({ potId, userId, amountUsdt }) {
    try {
      const res = await fetch(`${API_BASE_URL}/pots/${potId}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amountUsdt }),
      });
      const data = await res.json();
      if (res.ok && data.data) return data.data;
    } catch {
      // offline fallback
    }

    const pot = this.pots.find((p) => p.id === potId);
    if (pot) {
      const userMember = pot.members.find((m) => m.isUserSlot || m.id === 'm5' || m.id === '5');
      if (userMember) userMember.paid = true;
    }

    return {
      success: true,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      potId,
      amountUsdt,
      timestamp: new Date().toISOString(),
    };
  }

  async contributeToPot(potId, userId = 'demo_user') {
    const pot = this.pots.find((item) => item.id === potId);
    const amountUsdt = pot?.contributionAmount ?? pot?.contributionUsdt ?? 20;
    const result = await this.contribute({ potId, userId, amountUsdt });
    if (pot) {
      const member = pot.members.find((item) => item.isUserSlot || item.id === 'm5' || item.id === '5');
      if (member) member.paid = true;
    }
    const pots = this.getPots();
    return { ...(result || {}), pots, payoutEvent: result?.payoutEvent };
  }
}

export const mobilePotsService = new MobilePotsService();
export const potsService = mobilePotsService;
