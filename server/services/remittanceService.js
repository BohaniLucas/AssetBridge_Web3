/**
 * Remittance & P2P Service
 * Provides "Send Home in Local Currency" with comparison vs typical bank wire
 */

const FX_RATES = {
  tKES: { name: 'Kenyan Shilling', rate: 129.50, symbol: 'KSh', flag: '🇰🇪' },
  tZAR: { name: 'South African Rand', rate: 17.85, symbol: 'R', flag: '🇿🇦' },
  tNGN: { name: 'Nigerian Naira', rate: 1660.00, symbol: '₦', flag: '🇳🇬' },
  tGHS: { name: 'Ghanaian Cedi', rate: 15.40, symbol: 'GH₵', flag: '🇬🇭' },
};

class RemittanceService {
  calculateTransferQuote(sendAmountUsdt = 100, targetCurrency = 'tKES') {
    const fxInfo = FX_RATES[targetCurrency] || FX_RATES.tKES;
    const amount = Number(sendAmountUsdt);

    // AssetBridge metrics:
    const assetBridgeFee = 0.20; // 20 cents USDT testnet fee
    const assetBridgeSpeed = 'Instant (~3 seconds)';
    const assetBridgeRate = fxInfo.rate; // 0% hidden FX markup
    const assetBridgeReceived = (amount - assetBridgeFee) * assetBridgeRate;

    // Traditional Bank Transfer / Legacy Money Transfer Operator (MTO) metrics:
    const bankTransferFixedFee = 12.00; // $12 flat fee
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
        sender: transferData.senderUsername || 'You (0x92f...3b1)',
        recipient: transferData.recipient || 'M-Pesa / Mobile Wallet (+254 712 345 678)',
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

