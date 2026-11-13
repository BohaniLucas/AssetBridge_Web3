import { Platform } from 'react-native';

// Default to your local PC Wi-Fi IP so physical phones can reach the backend.
// Android Emulator uses 10.0.2.2.
const DEV_API_URL = 'http://192.168.0.240:5000/api';

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || DEV_API_URL).replace(/\/$/, '');

// Sepolia verified Tether USDT ERC-20 contract
export const SEPOLIA_USDT_CONTRACT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';
export const SEPOLIA_CHAIN_ID = 11155111;

