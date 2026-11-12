class MobileClaimService {
  async createClaimLink() {
    throw new Error('Claim links are disabled until an audited on-chain escrow and authenticated claim flow is integrated. No funds were moved.');
  }

  async refundClaimLink() {
    throw new Error('Refunds are disabled until escrow contract state is verified from the network. No local refund was recorded.');
  }

  async simulateGogoClaim() {
    throw new Error('Demo claims are disabled. A real receiver verification and on-chain release flow is required.');
  }
}

export const mobileClaimService = new MobileClaimService();

