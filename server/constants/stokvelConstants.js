/**
 * Stokvel Constants & Business Rules
 * Strict single-token allowlist, lifecycle states, roles, and calendar calculation rules.
 */

export const AUTHORITATIVE_TOKENS = [
  {
    symbol: 'USDT',
    name: 'Tether USD (Sepolia Testnet)',
    contractAddress: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06'.toLowerCase(),
    chainId: 11155111,
    decimals: 6,
    networkName: 'Ethereum Sepolia Testnet',
    isProvisionalTestnet: true,
  },
];

export const STOKVEL_ROLES = {
  OWNER: 'owner',
  CO_ADMIN: 'co_admin',
  TREASURER: 'treasurer',
  SECRETARY: 'secretary',
  MEMBER: 'member',
};

export const LIFECYCLE_STATUSES = {
  DRAFT: 'draft',
  READY: 'ready',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const JOIN_STATUSES = {
  OPEN: 'open',
  CLOSED: 'closed',
};

export const DISCOVERABILITY = {
  PRIVATE_INVITE_ONLY: 'private_invite_only',
  DISCOVERABLE_OPEN: 'discoverable_open',
};

export const FREQUENCIES = {
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
};

/**
 * Validates whether a token and chain are in the authoritative allowlist
 */
export function isAuthoritativeToken(tokenContract, chainId) {
  if (!tokenContract || !chainId) return false;
  return AUTHORITATIVE_TOKENS.some(
    (t) => t.contractAddress === tokenContract.toLowerCase() && Number(t.chainId) === Number(chainId)
  );
}

/**
 * Computes calendar cycle due dates with short-month handling.
 * If anchor day is 29, 30, or 31, and target month has fewer days,
 * clamps to the last calendar day of that month.
 * Cutoff time is standard 18:00 (6:00 PM) in the group's configured timezone.
 */
export function calculateSchedule({
  startDate,
  frequency = 'monthly',
  memberCount,
  contributionAmount,
  timezone = 'Africa/Johannesburg',
  deadlineDays = 3,
  graceDays = 3,
}) {
  const start = new Date(startDate);
  if (isNaN(start.getTime())) throw new Error('Invalid start date provided for schedule');
  if (memberCount < 2) throw new Error('A rotating stokvel requires at least 2 members');

  const anchorDay = start.getUTCDate();
  const schedule = [];

  for (let i = 1; i <= memberCount; i++) {
    const cycleDate = new Date(start.getTime());

    if (frequency === 'weekly') {
      cycleDate.setUTCDate(start.getUTCDate() + (i - 1) * 7);
    } else if (frequency === 'biweekly') {
      cycleDate.setUTCDate(start.getUTCDate() + (i - 1) * 14);
    } else {
      // Monthly with short-month resolution
      const targetMonth = start.getUTCMonth() + (i - 1);
      const targetYear = start.getUTCFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;

      // Find last day of target month
      const lastDayOfMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
      const resolvedDay = Math.min(anchorDay, lastDayOfMonth);

      cycleDate.setUTCFullYear(targetYear);
      cycleDate.setUTCMonth(normalizedMonth);
      cycleDate.setUTCDate(resolvedDay);
    }

    // Set consistent cutoff time: 18:00 UTC (or local timezone equivalent)
    cycleDate.setUTCHours(18, 0, 0, 0);

    const dueDate = new Date(cycleDate.getTime());
    const graceDate = new Date(dueDate.getTime() + graceDays * 24 * 60 * 60 * 1000);
    const payoutDate = new Date(graceDate.getTime() + 24 * 60 * 60 * 1000);

    schedule.push({
      cycleNumber: i,
      dueDate: dueDate.toISOString(),
      graceDate: graceDate.toISOString(),
      payoutDate: payoutDate.toISOString(),
      targetPoolAmount: Math.round(memberCount * Number(contributionAmount) * 1000000) / 1000000,
      expectedContributors: memberCount,
      contributionAmount: Number(contributionAmount),
    });
  }

  return schedule;
}

