import { Platform } from 'react-native';

/**
 * Mobile API Configuration
 * Automatically resolves localhost according to execution environment:
 * - Android Emulator uses 10.0.2.2
 * - iOS Simulator uses localhost
 * - Physical mobile devices can set their computer's LAN IP address
 */
const DEV_LAN_IP = 'localhost'; // Change to your local machine IP (e.g. 192.168.1.x) when testing on a physical phone

export const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:5000/api',
  ios: 'http://localhost:5000/api',
  default: `http://${DEV_LAN_IP}:5000/api`,
});

export const SEPOLIA_USDT_CONTRACT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';
export const SEPOLIA_NETWORK = 'Ethereum Sepolia';

