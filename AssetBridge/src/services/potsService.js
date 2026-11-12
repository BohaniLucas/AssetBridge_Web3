export const potsService = {
  getPots() {
    return [];
  },

  async fetchPotsFromBackend() {
    return [];
  },

  savePots() {},

  async contributeToPot() {
    throw new Error('Stokvel contributions are disabled until a verified group vault and on-chain payout rules are integrated. No contribution was recorded.');
  },

  async joinPot() {
    throw new Error('Stokvel membership is unavailable until authenticated membership and vault state are implemented.');
  },

  async voteInvestment() {
    throw new Error('Stokvel votes are unavailable until server-authoritative membership and voting rules are implemented.');
  },

  createPot() {
    throw new Error('Stokvel creation is disabled until authenticated membership and an audited group vault are integrated.');
  },
};
