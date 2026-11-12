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
    return [...this.pots];
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
      const userMember = pot.members.find((m) => m.name.includes('Nomsa') || m.name.includes('Lucas'));
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
}

export const mobilePotsService = new MobilePotsService();

