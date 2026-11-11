import { API_BASE_URL } from '../config/api';

export const MOBILE_DESTINATIONS = [
  { code: 'tKES', iso: 'KE', name: 'Kenyan Shilling', country: 'Kenya', rate: 129.50, symbol: 'KSh', rail: 'M-Pesa' },
  { code: 'tZAR', iso: 'ZA', name: 'South African Rand', country: 'South Africa', rate: 17.85, symbol: 'R', rail: 'Capitec Pay' },
  { code: 'tNGN', iso: 'NG', name: 'Nigerian Naira', country: 'Nigeria', rate: 1660.00, symbol: '₦', rail: 'OPay' },
  { code: 'tGHS', iso: 'GH', name: 'Ghanaian Cedi', country: 'Ghana', rate: 15.40, symbol: 'GH₵', rail: 'MTN MoMo' },
  { code: 'tUGX', iso: 'UG', name: 'Ugandan Shilling', country: 'Uganda', rate: 3680.00, symbol: 'USh', rail: 'Airtel Money' },
  { code: 'tRWF', iso: 'RW', name: 'Rwandan Franc', country: 'Rwanda', rate: 1395.00, symbol: 'FRw', rail: 'MTN MoMo' },
  { code: 'tEGP', iso: 'EG', name: 'Egyptian Pound', country: 'Egypt', rate: 49.20, symbol: 'E£', rail: 'Vodafone Cash' },
  { code: 'tGBP', iso: 'GB', name: 'British Pound', country: 'United Kingdom', rate: 0.79, symbol: '£', rail: 'FPS Instant' },
  { code: 'tEUR', iso: 'EU', name: 'Euro', country: 'Eurozone', rate: 0.93, symbol: '€', rail: 'SEPA Instant' },
  { code: 'tBRL', iso: 'BR', name: 'Brazilian Real', country: 'Brazil', rate: 5.75, symbol: 'R$', rail: 'Pix Instant' },
];

export const mobileRemittanceService = {
  getDestinations() {
    return MOBILE_DESTINATIONS;
  },

  calculateComparison(amountUsd = 100, targetCode = 'tKES') {
    const dest = MOBILE_DESTINATIONS.find((d) => d.code === targetCode) || MOBILE_DESTINATIONS[0];
    const amount = Number(amountUsd) || 0;

    // AssetBridge metrics: 20 cents flat fee, 0% FX markup
    const abFee = 0.20;
    const abNet = Math.max(0, amount - abFee);
    const abReceived = abNet * dest.rate;

    // Legacy Bank Wire: $15 fee, 4.5% markup
    const bankFee = 15.00;
    const bankRate = dest.rate * (1 - 0.045);
    const bankNet = Math.max(0, amount - bankFee);
    const bankReceived = bankNet * bankRate;

    const extraSavedLocal = Math.max(0, abReceived - bankReceived);
    const extraSavedUsd = extraSavedLocal / dest.rate;

    return {
      sendAmount: amount,
      dest,
      receivedFormatted: `${dest.symbol} ${abReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      fee: `$${abFee.toFixed(2)} USDT`,
      rateFormatted: `1 USDT = ${dest.rate.toFixed(2)} ${dest.symbol}`,
      bankReceivedFormatted: `${dest.symbol} ${bankReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      bankFee: `$${bankFee.toFixed(2)}`,
      extraSavedUsd: extraSavedUsd.toFixed(2),
    };
  },
};

