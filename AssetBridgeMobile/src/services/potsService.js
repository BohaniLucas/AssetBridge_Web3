class MobilePotsService {
  constructor() { this.pots = []; }

  getPots() {
    return [...this.pots];
  }

  async createPot() {
    throw new Error('Stokvel creation is unavailable until authenticated membership and an audited vault contract are integrated.');
  }

  async contribute() {
    throw new Error('Stokvel contributions are disabled until a verified on-chain group vault is integrated. No funds were moved.');
  }

  async contributeToPot() {
    return this.contribute();
  }
}

export const mobilePotsService = new MobilePotsService();
export const potsService = mobilePotsService;

