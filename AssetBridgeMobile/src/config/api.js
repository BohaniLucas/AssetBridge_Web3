import { Platform } from 'react-native';

// On Android Emulator, localhost is 10.0.2.2; on iOS / Web it is localhost.
const DEV_API_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:5000/api'
  : 'http://localhost:5000/api';

export const API_BASE_URL = DEV_API_URL;

// Sepolia verified Tether USDT ERC-20 contract
export const SEPOLIA_USDT_CONTRACT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';
export const SEPOLIA_CHAIN_ID = 11155111;

