import { NativeModules, Platform } from 'react-native';

const DEFAULT_FALLBACK_URL =
  Platform.OS === 'android' ? 'http://192.168.0.249:5000/api' : 'http://localhost:5000/api';

/**
 * Automatically extracts your PC's current Wi-Fi IPv4 address from the active Expo Metro
 * bundle URL (`NativeModules.SourceCode.scriptURL`), so when your Wi-Fi router changes
 * your PC's DHCP IP (e.g. 192.168.0.240 -> 192.168.0.249), the app connects automatically
 * without needing manual .env edits.
 */
function resolveApiBaseUrl() {
  const envUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/$/, '');

  // If a production HTTPS URL is configured, always use it as-is
  if (envUrl.startsWith('https://')) {
    return envUrl;
  }

  // Try to read the live host IP that the phone used to reach the Expo Metro bundler
  const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
  const match = scriptURL.match(/^https?:\/\/(\d+\.\d+\.\d+\.\d+):\d+/i);
  if (match && match[1]) {
    const metroHostIp = match[1];
    // Ignore localhost/loopback on physical devices
    if (metroHostIp !== '127.0.0.1' && metroHostIp !== '0.0.0.0') {
      return `http://${metroHostIp}:5000/api`;
    }
  }

  return envUrl || DEFAULT_FALLBACK_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

// Sepolia verified Tether USDT ERC-20 contract
export const SEPOLIA_USDT_CONTRACT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';
export const SEPOLIA_CHAIN_ID = 11155111;
