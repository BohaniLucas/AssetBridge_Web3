export const FX_DESTINATIONS = [
  {
    code: 'tKES',
    name: 'Kenyan Shilling Token',
    country: 'Kenya',
    flag: '🇰🇪',
    ratePerUsd: 129.50,
    symbol: 'KSh',
    mobileChannels: ['M-Pesa', 'Airtel Money', 'Bank Wire'],
  },
  {
    code: 'tZAR',
    name: 'South African Rand Token',
    country: 'South Africa',
    flag: '🇿🇦',
    ratePerUsd: 17.85,
    symbol: 'R',
    mobileChannels: ['Capitec Pay', 'FNB eWallet', 'TymeBank'],
  },
  {
    code: 'tNGN',
    name: 'Nigerian Naira Token',
    country: 'Nigeria',
    flag: '🇳🇬',
    ratePerUsd: 1660.00,
    symbol: '₦',
    mobileChannels: ['OPay', 'PalmPay', 'Direct NIP Transfer'],
  },
];

export const remittanceService = {
  calculateComparison(amountUsd = 100, targetCode = 'tKES') {
    const dest = FX_DESTINATIONS.find(d => d.code === targetCode) || FX_DESTINATIONS[0];
    const amount = Number(amountUsd) || 0;

    // AssetBridge metrics
    const abFee = 0.20; // 20 cents network fee
    const abNetSend = Math.max(0, amount - abFee);
    const abReceived = abNetSend * dest.ratePerUsd;

    // Typical Bank Wire / Western Union / Legacy Remittance Operator
    const bankFixedFee = 12.00; // $12 wire / sending fee
    const bankFxMarkupRate = 0.045; // 4.5% hidden FX markup
    const bankEffectiveRate = dest.ratePerUsd * (1 - bankFxMarkupRate);
    const bankNetSend = Math.max(0, amount - bankFixedFee);
    const bankReceived = bankNetSend * bankEffectiveRate;

    const extraReceivedLocal = Math.max(0, abReceived - bankReceived);
    const extraReceivedUsd = extraReceivedLocal / dest.ratePerUsd;

    return {
      sendAmount: amount,
      dest,
      assetBridge: {
        receivedFormatted: `${dest.symbol} ${abReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        receivedRaw: abReceived,
        fee: `$${abFee.toFixed(2)}`,
        speed: 'Instant (~3s)',
        exchangeRateFormatted: `1 USDT = ${dest.ratePerUsd.toFixed(2)} ${dest.symbol}`,
        hiddenMarkup: '$0.00 (Zero FX Spread)',
        deliveryChannel: 'Direct to Local Token / Mobile Money',
      },
      traditionalBank: {
        receivedFormatted: `${dest.symbol} ${bankReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        receivedRaw: bankReceived,
        fee: `$${bankFixedFee.toFixed(2)}`,
        speed: '3 - 5 Business Days',
        exchangeRateFormatted: `1 USD = ${bankEffectiveRate.toFixed(2)} ${dest.symbol}`,
        hiddenMarkup: `$${(amount * bankFxMarkupRate).toFixed(2)} (4.5% hidden spread)`,
        deliveryChannel: 'SWIFT Correspondent Banking',
      },
      advantage: {
        extraReceivedFormatted: `${dest.symbol} ${extraReceivedLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        extraReceivedUsd: extraReceivedUsd.toFixed(2),
        speedComparison: '1,000x faster settlement',
        lossWithBankPercent: amount > 0 ? (((amount - (bankReceived / dest.ratePerUsd)) / amount) * 100).toFixed(1) : 0,
      }
    };
  }
};

