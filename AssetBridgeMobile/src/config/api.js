import { NativeModules, Platform } from 'react-native';

const DEFAULT_SERVER_PORT = '5001';
const DEFAULT_FALLBACK_URL =
  Platform.OS === 'android' ? `http://192.168.0.249:${DEFAULT_SERVER_PORT}/api` : `http://localhost:${DEFAULT_SERVER_PORT}/api`;

const CUSTOM_API_URL_STORAGE_KEY = 'interlink_custom_api_url_v1';

let cachedCustomUrl = null;

function extractPortFromEnv() {
  const envUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  const match = envUrl.match(/:(\d+)(?:\/|$)/);
  return match && match[1] ? match[1] : DEFAULT_SERVER_PORT;
}

/**
 * Resolves the default API base URL using:
 * 1. An explicitly configured HTTPS production URL.
 * 2. The active Expo Metro bundler host IP (if physical phone is connected via Metro).
 * 3. EXPO_PUBLIC_API_URL environment variable.
 * 4. DEFAULT_FALLBACK_URL (current Wi-Fi IPv4 address + port 5001).
 */
export function resolveApiBaseUrl() {
  if (cachedCustomUrl) {
    return cachedCustomUrl;
  }

  const envUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/$/, '');

  // If a production HTTPS URL is configured, always use it
  if (envUrl.startsWith('https://')) {
    return envUrl;
  }

  const serverPort = extractPortFromEnv();

  // Try to read the live host IP that the phone used to reach the Expo Metro bundler
  const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
  const match = scriptURL.match(/^https?:\/\/(\d+\.\d+\.\d+\.\d+):\d+/i);
  if (match && match[1]) {
    const metroHostIp = match[1];
    // Ignore localhost/loopback on physical devices
    if (metroHostIp !== '127.0.0.1' && metroHostIp !== '0.0.0.0') {
      return `http://${metroHostIp}:${serverPort}/api`;
    }
  }

  return envUrl || DEFAULT_FALLBACK_URL;
}

export let API_BASE_URL = resolveApiBaseUrl();

export function getApiBaseUrl() {
  return API_BASE_URL;
}

/**
 * Loads any persisted user-configured API URL from device storage on launch.
 */
export async function initApiBaseUrl() {
  try {
    const SecureStore = await import('expo-secure-store').catch(() => null);
    if (SecureStore?.getItemAsync) {
      const saved = await SecureStore.getItemAsync(CUSTOM_API_URL_STORAGE_KEY);
      if (saved && typeof saved === 'string' && saved.startsWith('http')) {
        cachedCustomUrl = saved.trim().replace(/\/$/, '');
        API_BASE_URL = cachedCustomUrl;
        return API_BASE_URL;
      }
    }
  } catch {}
  API_BASE_URL = resolveApiBaseUrl();
  return API_BASE_URL;
}

/**
 * Sets and persists a custom server URL or IP address (e.g. "192.168.0.249" or "http://192.168.0.249:5001/api").
 */
export async function setCustomApiBaseUrl(input) {
  let clean = (input || '').trim().replace(/\/$/, '');
  if (!clean) {
    return await resetApiBaseUrl();
  }

  // Handle plain IP inputs like "192.168.0.249" or "192.168.0.249:5001"
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    const hasPort = clean.includes(':');
    clean = `http://${clean}${hasPort ? '' : `:${DEFAULT_SERVER_PORT}`}`;
  }

  if (!clean.endsWith('/api')) {
    clean = `${clean}/api`;
  }

  cachedCustomUrl = clean;
  API_BASE_URL = clean;

  try {
    const SecureStore = await import('expo-secure-store').catch(() => null);
    if (SecureStore?.setItemAsync) {
      await SecureStore.setItemAsync(CUSTOM_API_URL_STORAGE_KEY, clean);
    }
  } catch {}

  return API_BASE_URL;
}

/**
 * Resets the server URL back to the default auto-detected configuration.
 */
export async function resetApiBaseUrl() {
  cachedCustomUrl = null;
  API_BASE_URL = resolveApiBaseUrl();

  try {
    const SecureStore = await import('expo-secure-store').catch(() => null);
    if (SecureStore?.deleteItemAsync) {
      await SecureStore.deleteItemAsync(CUSTOM_API_URL_STORAGE_KEY);
    }
  } catch {}

  return API_BASE_URL;
}

/**
 * Tests live reachability to the server's /health endpoint with a 4-second timeout.
 */
export async function testServerConnectivity(targetUrl) {
  const base = (targetUrl || API_BASE_URL).replace(/\/$/, '');
  const testUrl = base.endsWith('/api') ? `${base}/health` : `${base}/api/health`;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;

  try {
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (timer) clearTimeout(timer);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, status: res.status, data, url: testUrl };
    }
    return {
      ok: false,
      status: res.status,
      message: `Server returned HTTP ${res.status}`,
      url: testUrl,
    };
  } catch (err) {
    if (timer) clearTimeout(timer);
    const isTimeout = err?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      message: isTimeout ? 'Connection timed out (4s). Check server port and Wi-Fi.' : (err?.message || 'Failed to connect'),
      url: testUrl,
    };
  }
}

// Sepolia verified Tether USDT ERC-20 contract
export const SEPOLIA_USDT_CONTRACT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';
export const SEPOLIA_CHAIN_ID = 11155111;
