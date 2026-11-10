export const FX_DESTINATIONS = [
  // --- Africa ---
  {
    code: 'tKES',
    name: 'Kenyan Shilling',
    country: 'Kenya',
    flag: '🇰🇪',
    region: 'Africa',
    ratePerUsd: 129.50,
    symbol: 'KSh',
    mobileChannels: ['M-Pesa', 'Airtel Money'],
    recipientType: 'M-Pesa Phone Number (+254...)',
    defaultRecipient: '+254 712 345 678',
  },
  {
    code: 'tZAR',
    name: 'South African Rand',
    country: 'South Africa',
    flag: '🇿🇦',
    region: 'Africa',
    ratePerUsd: 17.85,
    symbol: 'R',
    mobileChannels: ['Capitec Pay', 'FNB eWallet'],
    recipientType: 'Capitec / Bank Phone (+27...)',
    defaultRecipient: '+27 82 123 4567',
  },
  {
    code: 'tNGN',
    name: 'Nigerian Naira',
    country: 'Nigeria',
    flag: '🇳🇬',
    region: 'Africa',
    ratePerUsd: 1660.00,
    symbol: '₦',
    mobileChannels: ['OPay', 'PalmPay'],
    recipientType: 'OPay / Account Number (+234...)',
    defaultRecipient: '+234 801 234 5678',
  },
  {
    code: 'tGHS',
    name: 'Ghanaian Cedi',
    country: 'Ghana',
    flag: '🇬🇭',
    region: 'Africa',
    ratePerUsd: 15.40,
    symbol: 'GH₵',
    mobileChannels: ['MTN MoMo', 'Telecel Cash'],
    recipientType: 'MTN Mobile Money (+233...)',
    defaultRecipient: '+233 24 123 4567',
  },
  {
    code: 'tUGX',
    name: 'Ugandan Shilling',
    country: 'Uganda',
    flag: '🇺🇬',
    region: 'Africa',
    ratePerUsd: 3680.00,
    symbol: 'USh',
    mobileChannels: ['MTN MoMo', 'Airtel Money'],
    recipientType: 'Airtel / MTN Mobile (+256...)',
    defaultRecipient: '+256 701 234 567',
  },
  {
    code: 'tRWF',
    name: 'Rwandan Franc',
    country: 'Rwanda',
    flag: '🇷🇼',
    region: 'Africa',
    ratePerUsd: 1395.00,
    symbol: 'FRw',
    mobileChannels: ['MTN MoMo Rwanda'],
    recipientType: 'MoMo Number (+250...)',
    defaultRecipient: '+250 788 123 456',
  },
  {
    code: 'tEGP',
    name: 'Egyptian Pound',
    country: 'Egypt',
    flag: '🇪🇬',
    region: 'Africa',
    ratePerUsd: 49.20,
    symbol: 'E£',
    mobileChannels: ['Vodafone Cash', 'InstaPay'],
    recipientType: 'InstaPay / Mobile (+20...)',
    defaultRecipient: '+20 100 123 4567',
  },

  // --- Americas ---
  {
    code: 'tUSD',
    name: 'United States Dollar',
    country: 'United States',
    flag: '🇺🇸',
    region: 'Americas',
    ratePerUsd: 1.00,
    symbol: '$',
    mobileChannels: ['FedNow Instant', 'ACH Direct'],
    recipientType: 'Routing & Account / Email / Phone',
    defaultRecipient: 'alex.smith@gmail.com',
  },
  {
    code: 'tCAD',
    name: 'Canadian Dollar',
    country: 'Canada',
    flag: '🇨🇦',
    region: 'Americas',
    ratePerUsd: 1.39,
    symbol: 'CA$',
    mobileChannels: ['Interac e-Transfer'],
    recipientType: 'Interac Email / Mobile',
    defaultRecipient: 'sarah.m@interac.ca',
  },
  {
    code: 'tBRL',
    name: 'Brazilian Real',
    country: 'Brazil',
    flag: '🇧🇷',
    region: 'Americas',
    ratePerUsd: 5.75,
    symbol: 'R$',
    mobileChannels: ['Pix Instant Pay'],
    recipientType: 'Pix Key (CPF / Email / Phone)',
    defaultRecipient: '123.456.789-00',
  },
  {
    code: 'tMXN',
    name: 'Mexican Peso',
    country: 'Mexico',
    flag: '🇲🇽',
    region: 'Americas',
    ratePerUsd: 20.15,
    symbol: 'Mex$',
    mobileChannels: ['SPEI Instant'],
    recipientType: 'CLABE 18-digits / Mobile',
    defaultRecipient: '012180001234567890',
  },

  // --- Europe & UK ---
  {
    code: 'tGBP',
    name: 'British Pound',
    country: 'United Kingdom',
    flag: '🇬🇧',
    region: 'Europe & UK',
    ratePerUsd: 0.79,
    symbol: '£',
    mobileChannels: ['Faster Payments (FPS)', 'Revolut'],
    recipientType: 'Sort Code (6-digits) & Account (8-digits)',
    defaultRecipient: '40-47-84 71234567',
  },
  {
    code: 'tEUR',
    name: 'Euro',
    country: 'Eurozone (EU)',
    flag: '🇪🇺',
    region: 'Europe & UK',
    ratePerUsd: 0.93,
    symbol: '€',
    mobileChannels: ['SEPA Instant Credit', 'iDEAL'],
    recipientType: 'IBAN (e.g. DE89...)',
    defaultRecipient: 'DE89 3704 0044 0532 0130 00',
  },
  {
    code: 'tCHF',
    name: 'Swiss Franc',
    country: 'Switzerland',
    flag: '🇨🇭',
    region: 'Europe & UK',
    ratePerUsd: 0.88,
    symbol: 'CHF',
    mobileChannels: ['SIC Instant', 'TWINT Pay'],
    recipientType: 'TWINT Mobile / Swiss IBAN',
    defaultRecipient: '+41 79 123 45 67',
  },

  // --- Asia-Pacific ---
  {
    code: 'tINR',
    name: 'Indian Rupee',
    country: 'India',
    flag: '🇮🇳',
    region: 'Asia-Pacific',
    ratePerUsd: 84.35,
    symbol: '₹',
    mobileChannels: ['UPI Instant Pay', 'IMPS'],
    recipientType: 'UPI ID (e.g. name@okhdfcbank)',
    defaultRecipient: 'aarav.sharma@upi',
  },
  {
    code: 'tPHP',
    name: 'Philippine Peso',
    country: 'Philippines',
    flag: '🇵🇭',
    region: 'Asia-Pacific',
    ratePerUsd: 58.70,
    symbol: '₱',
    mobileChannels: ['GCash', 'Maya Mobile'],
    recipientType: 'GCash / Maya Phone (+63...)',
    defaultRecipient: '+63 917 123 4567',
  },
  {
    code: 'tAED',
    name: 'UAE Dirham',
    country: 'United Arab Emirates',
    flag: '🇦🇪',
    region: 'Asia-Pacific',
    ratePerUsd: 3.67,
    symbol: 'AED',
    mobileChannels: ['Aani Instant Pay'],
    recipientType: 'Aani Mobile / IBAN (+971...)',
    defaultRecipient: '+971 50 123 4567',
  },
  {
    code: 'tSGD',
    name: 'Singapore Dollar',
    country: 'Singapore',
    flag: '🇸🇬',
    region: 'Asia-Pacific',
    ratePerUsd: 1.34,
    symbol: 'S$',
    mobileChannels: ['PayNow', 'FAST'],
    recipientType: 'PayNow NRIC / Mobile (+65...)',
    defaultRecipient: '+65 9123 4567',
  },
  {
    code: 'tJPY',
    name: 'Japanese Yen',
    country: 'Japan',
    flag: '🇯🇵',
    region: 'Asia-Pacific',
    ratePerUsd: 153.20,
    symbol: '¥',
    mobileChannels: ['Zengin Real-Time', 'PayPay'],
    recipientType: 'Account & Branch Code',
    defaultRecipient: 'Branch 001 · Acc 1234567',
  },
];

export const REGIONS = ['All', 'Africa', 'Europe & UK', 'Americas', 'Asia-Pacific'];

export const remittanceService = {
  async fetchDestinations() {
    try {
      const res = await fetch('http://localhost:5000/api/remittance/destinations');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch {
      // Fallback cleanly to built-in worldwide catalog
    }
    return FX_DESTINATIONS;
  },

  calculateComparison(amountUsd = 100, targetCode = 'tKES') {
    const dest = FX_DESTINATIONS.find(d => d.code === targetCode) || FX_DESTINATIONS[0];
    const amount = Number(amountUsd) || 0;

    // AssetBridge metrics
    const abFee = 0.20; // 20 cents network fee
    const abNetSend = Math.max(0, amount - abFee);
    const abReceived = abNetSend * dest.ratePerUsd;

    // Typical Bank Wire / Western Union / Legacy Remittance Operator
    const bankFixedFee = 15.00; // $15 average global wire / sending fee
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
        deliveryChannel: `Direct to ${dest.mobileChannels?.[0] || 'Local Bank / Wallet'}`,
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
