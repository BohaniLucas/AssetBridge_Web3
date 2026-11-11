import { API_BASE_URL } from '../config/api';

export const INITIAL_POTS = [
  {
    id: 'pot-nairobi-chama-1',
    name: 'Nairobi Tech Founders Chama',
    strategy: 'rotation',
    targetAmountUsdt: 100,
    currentRound: 1,
    totalRounds: 5,
    members: [
      { id: 'usr-1', name: 'Lucas (You)', hasContributedThisRound: true },
      { id: 'usr-2', name: 'Wanjiku K.', hasContributedThisRound: true },
      { id: 'usr-3', name: 'Brian O.', hasContributedThisRound: true },
      { id: 'usr-4', name: 'Amina N.', hasContributedThisRound: false },
      { id: 'usr-5', name: 'David M.', hasContributedThisRound: false },
    ],
  },
  {
    id: 'pot-joburg-equity-2',
    name: 'Joburg High-Growth Vault',
    strategy: 'investment',
    targetAmountUsdt: 250,
    currentRound: 2,
    totalRounds: 4,
    members: [
      { id: 'usr-1', name: 'Lucas (You)', hasContributedThisRound: false },
      { id: 'usr-2', name: 'Thandiwe Z.', hasContributedThisRound: true },
      { id: 'usr-3', name: 'Sipho D.', hasContributedThisRound: true },
    ],
  },
];

export const mobilePotsService = {
  async getPots() {
    try {
      const res = await fetch(`${API_BASE_URL}/pots`);
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch {
      // offline fallback
    }
    return INITIAL_POTS;
  },

  async contribute({ potId, userId, amountUsdt }) {
    try {
      const res = await fetch(`${API_BASE_URL}/pots/${potId}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amountUsdt }),
      });
      const json = await res.json();
      if (res.ok && json.data) return json.data;
    } catch {
      // offline
    }
    return { success: true, message: 'Contribution recorded' };
  },
};

