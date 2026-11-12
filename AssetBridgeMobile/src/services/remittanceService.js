class MobileRemittanceService {
  constructor() {
    this.destinations = [
      {
        id: 'dest-ke',
        country: 'Kenya',
        flag: '🇰🇪',
        currency: 'KES',
        fxRatePerUsd: 129.5,
        defaultProvider: 'M-Pesa Safaricom',
        providers: ['M-Pesa Safaricom', 'Airtel Money', 'Equity Bank'],
        bankSpread: '4.8%',
        assetBridgeFee: '0% Spread (Mid-market)',
        deliveryTime: 'Instant (< 15 seconds)',
      },
      {
        id: 'dest-za',
        country: 'South Africa',
        flag: '🇿🇦',
        currency: 'ZAR',
        fxRatePerUsd: 18.25,
        defaultProvider: 'Capitec PayShap',
        providers: ['Capitec PayShap', 'FNB eWallet', 'Standard Bank'],
        bankSpread: '5.2%',
        assetBridgeFee: '0% Spread (Mid-market)',
        deliveryTime: 'Instant (< 30 seconds)',
      },
      {
        id: 'dest-ng',
        country: 'Nigeria',
        flag: '🇳🇬',
        currency: 'NGN',
        fxRatePerUsd: 1540.0,
        defaultProvider: 'OPay Wallet',
        providers: ['OPay Wallet', 'PalmPay', 'Kuda Bank', 'GTBank'],
        bankSpread: '6.5%',
        assetBridgeFee: '0% Spread (Mid-market)',
        deliveryTime: 'Instant (< 10 seconds)',
      },
      {
        id: 'dest-gh',
        country: 'Ghana',
        flag: '🇬🇭',
        currency: 'GHS',
        fxRatePerUsd: 15.8,
        defaultProvider: 'MTN Mobile Money',
        providers: ['MTN Mobile Money', 'Vodafone Cash', 'Ecobank'],
        bankSpread: '4.9%',
        assetBridgeFee: '0% Spread (Mid-market)',
        deliveryTime: 'Instant (< 20 seconds)',
      },
    ];
  }

  getDestinations() {
    return [...this.destinations];
  }

  calculateQuote(amountUsdt, destinationId) {
    const dest = this.destinations.find((d) => d.id === destinationId) || this.destinations[0];
    const num = Number(amountUsdt) || 0;
    const localReceived = num * dest.fxRatePerUsd;
    const traditionalBankReceived = localReceived * 0.948; // traditional banks take ~5.2% FX markup
    const extraReceived = localReceived - traditionalBankReceived;

    return {
      amountUsdt: num,
      destination: dest,
      localReceived: Math.round(localReceived * 100) / 100,
      traditionalBankReceived: Math.round(traditionalBankReceived * 100) / 100,
      extraReceived: Math.round(extraReceived * 100) / 100,
      feeUsdt: 0.2, // flat $0.20 Sepolia gas
    };
  }

  async sendRemittance() {
    throw new Error('Remittance is disabled until a live rate source, payout provider, and network-verified settlement flow are integrated. No payment was submitted.');
  }
}

export const mobileRemittanceService = new MobileRemittanceService();

