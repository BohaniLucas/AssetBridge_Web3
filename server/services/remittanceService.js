/**
 * Remittance & P2P Service
 * Provides "Send Home in Local Currency" with comparison vs typical bank wire across Worldwide Destinations
 */

import { marketDataService } from './marketDataService.js';

const FX_RATES = {
  // Africa
  tKES: { name: 'Kenyan Shilling', rate: 129.50, iso: 'KES', symbol: 'KSh', flag: '🇰🇪', country: 'Kenya', region: 'Africa', mobileChannels: ['M-Pesa', 'Airtel Money'] },
  tZAR: { name: 'South African Rand', rate: 17.85, iso: 'ZAR', symbol: 'R', flag: '🇿🇦', country: 'South Africa', region: 'Africa', mobileChannels: ['Capitec Pay', 'FNB eWallet'] },
  tNGN: { name: 'Nigerian Naira', rate: 1660.00, iso: 'NGN', symbol: '₦', flag: '🇳🇬', country: 'Nigeria', region: 'Africa', mobileChannels: ['OPay', 'PalmPay'] },
  tGHS: { name: 'Ghanaian Cedi', rate: 15.40, iso: 'GHS', symbol: 'GH₵', flag: '🇬🇭', country: 'Ghana', region: 'Africa', mobileChannels: ['MTN MoMo', 'Telecel Cash'] },
  tUGX: { name: 'Ugandan Shilling', rate: 3680.00, iso: 'UGX', symbol: 'USh', flag: '🇺🇬', country: 'Uganda', region: 'Africa', mobileChannels: ['MTN MoMo', 'Airtel Money'] },
  tRWF: { name: 'Rwandan Franc', rate: 1395.00, iso: 'RWF', symbol: 'FRw', flag: '🇷🇼', country: 'Rwanda', region: 'Africa', mobileChannels: ['MTN MoMo Rwanda'] },
  tEGP: { name: 'Egyptian Pound', rate: 49.20, iso: 'EGP', symbol: 'E£', flag: '🇪🇬', country: 'Egypt', region: 'Africa', mobileChannels: ['Vodafone Cash', 'InstaPay'] },

  // Americas
  tUSD: { name: 'United States Dollar', rate: 1.00, iso: 'USD', symbol: '$', flag: '🇺🇸', country: 'United States', region: 'Americas', mobileChannels: ['FedNow Instant', 'ACH Direct'] },
  tCAD: { name: 'Canadian Dollar', rate: 1.39, iso: 'CAD', symbol: 'CA$', flag: '🇨🇦', country: 'Canada', region: 'Americas', mobileChannels: ['Interac e-Transfer'] },
  tBRL: { name: 'Brazilian Real', rate: 5.75, iso: 'BRL', symbol: 'R$', flag: '🇧🇷', country: 'Brazil', region: 'Americas', mobileChannels: ['Pix Instant Pay'] },
  tMXN: { name: 'Mexican Peso', rate: 20.15, iso: 'MXN', symbol: 'Mex$', flag: '🇲🇽', country: 'Mexico', region: 'Americas', mobileChannels: ['SPEI Instant', 'OXXO Pay'] },

  // Europe & UK
  tGBP: { name: 'British Pound', rate: 0.79, iso: 'GBP', symbol: '£', flag: '🇬🇧', country: 'United Kingdom', region: 'Europe & UK', mobileChannels: ['Faster Payments (FPS)', 'Revolut Pay'] },
  tEUR: { name: 'Euro', rate: 0.93, iso: 'EUR', symbol: '€', flag: '🇪🇺', country: 'Eurozone (EU)', region: 'Europe & UK', mobileChannels: ['SEPA Instant Credit', 'iDEAL'] },
  tCHF: { name: 'Swiss Franc', rate: 0.88, iso: 'CHF', symbol: 'CHF', flag: '🇨🇭', country: 'Switzerland', region: 'Europe & UK', mobileChannels: ['SIC Instant', 'TWINT Pay'] },

  // Asia-Pacific
  tINR: { name: 'Indian Rupee', rate: 84.35, iso: 'INR', symbol: '₹', flag: '🇮🇳', country: 'India', region: 'Asia-Pacific', mobileChannels: ['UPI Instant Pay', 'IMPS'] },
  tPHP: { name: 'Philippine Peso', rate: 58.70, iso: 'PHP', symbol: '₱', flag: '🇵🇭', country: 'Philippines', region: 'Asia-Pacific', mobileChannels: ['GCash', 'Maya Mobile'] },
  tAED: { name: 'UAE Dirham', rate: 3.67, iso: 'AED', symbol: 'AED', flag: '🇦🇪', country: 'United Arab Emirates', region: 'Asia-Pacific', mobileChannels: ['Aani Instant Pay'] },
  tSGD: { name: 'Singapore Dollar', rate: 1.34, iso: 'SGD', symbol: 'S$', flag: '🇸🇬', country: 'Singapore', region: 'Asia-Pacific', mobileChannels: ['PayNow', 'FAST'] },
  tJPY: { name: 'Japanese Yen', rate: 153.20, iso: 'JPY', symbol: '¥', flag: '🇯🇵', country: 'Japan', region: 'Asia-Pacific', mobileChannels: ['Zengin Real-Time', 'PayPay'] },
};

class RemittanceService {
  getAllDestinations() {
    const liveRates = marketDataService.forexCache.rates?.rates;

    return Object.entries(FX_RATES).map(([code, data]) => {
      const realRate = liveRates && data.iso && liveRates[data.iso] ? liveRates[data.iso] : data.rate;
      return {
        code,
        name: data.name,
        country: data.country,
        flag: data.flag,
        region: data.region,
        ratePerUsd: parseFloat(Number(realRate).toFixed(4)),
        symbol: data.symbol,
        mobileChannels: data.mobileChannels,
      };
    });
  }

  calculateTransferQuote(sendAmountUsdt = 100, targetCurrency = 'tKES') {
    const fxInfo = FX_RATES[targetCurrency] || FX_RATES.tKES;
    const amount = Number(sendAmountUsdt);
    const liveRates = marketDataService.forexCache.rates?.rates;
    const effectiveRate = liveRates && fxInfo.iso && liveRates[fxInfo.iso] ? liveRates[fxInfo.iso] : fxInfo.rate;

    // AssetBridge metrics:
    const assetBridgeFee = 0.20; // 20 cents USDT fee
    const assetBridgeSpeed = 'Instant (~3 seconds)';
    const assetBridgeRate = effectiveRate; // 0% hidden FX markup
    const assetBridgeReceived = (amount - assetBridgeFee) * assetBridgeRate;

    // Traditional Bank Transfer / Legacy Money Transfer Operator (MTO) metrics:
    const bankTransferFixedFee = 15.00; // $15 flat wire fee
    const bankFxMarkupPercent = 0.045; // 4.5% FX spread hidden fee
    const bankEffectiveRate = fxInfo.rate * (1 - bankFxMarkupPercent);
    const bankTotalFeeEquivalent = bankTransferFixedFee + (amount * bankFxMarkupPercent);
    const bankReceived = Math.max(0, (amount - bankTransferFixedFee) * bankEffectiveRate);
    const bankSpeed = '3 - 5 business days';

    const savingsUsd = (assetBridgeReceived - bankReceived) / fxInfo.rate;
    const savingsPercent = Math.round((savingsUsd / amount) * 100);

    return {
      sendAmount: amount,
      sendCurrency: 'USDT',
      targetCurrency,
      currencyName: fxInfo.name,
      currencySymbol: fxInfo.symbol,
      flag: fxInfo.flag,
      country: fxInfo.country,
      region: fxInfo.region,
      marketRate: fxInfo.rate,
      assetBridge: {
        feeUsd: assetBridgeFee,
        effectiveRate: assetBridgeRate,
        receivedAmount: Number(assetBridgeReceived.toFixed(2)),
        formattedReceived: `${fxInfo.symbol} ${assetBridgeReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        speed: assetBridgeSpeed,
        network: 'Testnet Stablecoin Settlement',
        hiddenCosts: '$0.00 hidden markup',
      },
      traditionalBank: {
        feeUsd: bankTransferFixedFee,
        fxMarkupPercent: '4.5%',
        effectiveRate: Number(bankEffectiveRate.toFixed(2)),
        receivedAmount: Number(bankReceived.toFixed(2)),
        formattedReceived: `${fxInfo.symbol} ${bankReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        speed: bankSpeed,
        hiddenCosts: `$${(amount * bankFxMarkupPercent).toFixed(2)} FX hidden markup`,
        totalCostUsd: Number(bankTotalFeeEquivalent.toFixed(2)),
      },
      advantage: {
        receiverGetsExtraFormatted: `${fxInfo.symbol} ${(assetBridgeReceived - bankReceived).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        savingsUsd: Number(savingsUsd.toFixed(2)),
        savingsPercent: Math.max(0, savingsPercent),
        speedComparison: '1000x faster than SWIFT/wire',
      }
    };
  }

  executeTransfer(transferData) {
    const quote = this.calculateTransferQuote(transferData.sendAmount, transferData.targetCurrency);
    const txHash = '0x' + Math.random().toString(16).substring(2, 14);
    
    return {
      success: true,
      transaction: {
        id: `tx-${Date.now()}`,
        sender: transferData.senderUsername || 'You (0x884a...12be)',
        recipient: transferData.recipient || '+254 712 345 678',
        sendAmountUsdt: quote.sendAmount,
        receivedAmountLocal: quote.assetBridge.receivedAmount,
        targetCurrency: quote.targetCurrency,
        formattedReceived: quote.assetBridge.formattedReceived,
        exchangeRate: quote.marketRate,
        feeUsdt: quote.assetBridge.feeUsd,
        settlementTime: '3.2s',
        txHash,
        status: 'completed',
        timestamp: new Date().toISOString(),
      }
    };
  }
}

export const remittanceService = new RemittanceService();
