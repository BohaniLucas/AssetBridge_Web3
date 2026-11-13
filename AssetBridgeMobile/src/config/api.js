export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
export const apiConfigurationError = API_BASE_URL
  ? ''
  : 'Set EXPO_PUBLIC_API_URL to the deployed API URL before using account services.';

export const SEPOLIA_USDT_CONTRACT = (process.env.EXPO_PUBLIC_SEPOLIA_USDT_CONTRACT_ADDRESS || '').trim();
const usdtDecimalsValue = (process.env.EXPO_PUBLIC_SEPOLIA_USDT_DECIMALS || '').trim();
const parsedUsdtDecimals = /^\d+$/.test(usdtDecimalsValue)
  ? Number(usdtDecimalsValue)
  : null;
export const SEPOLIA_USDT_DECIMALS = Number.isSafeInteger(parsedUsdtDecimals)
  && parsedUsdtDecimals <= 255
  ? parsedUsdtDecimals
  : null;
export const SEPOLIA_CHAIN_ID = 11155111;
