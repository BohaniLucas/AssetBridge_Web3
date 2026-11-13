import { API_BASE_URL } from '../config/api.js';
import { sessionLockService } from './sessionLockService.js';

const SESSION_KEY = 'assetbridge_mobile_auth_session';
const OFFLINE_UNLOCK_VERIFIER_KEY = 'assetbridge_offline_unlock_v1';

let customAuthStorageAdapter = null;
let customAuthFetchAdapter = null;
let expoSecureStorePromise = null;
let expoCryptoPromise = null;

export function setAuthStorageAdapter(adapter) {
  customAuthStorageAdapter = adapter;
}

export function setAuthFetchAdapter(fetchFn) {
  customAuthFetchAdapter = fetchFn;
}

async function getAuthStorage() {
  if (customAuthStorageAdapter) return customAuthStorageAdapter;
  if (!expoSecureStorePromise) {
    expoSecureStorePromise = import('expo-secure-store').catch(() => null);
  }
  return expoSecureStorePromise;
}

async function isStorageAvailable() {
  const store = await getAuthStorage();
  if (!store) return false;
  if (typeof store.isAvailableAsync === 'function') {
    return await store.isAvailableAsync();
  }
  return typeof store.getItemAsync === 'function';
}

function getFetch() {
  return customAuthFetchAdapter || fetch;
}

/**
 * Computes a SHA-256 hex digest using expo-crypto on React Native or WebCrypto/Node crypto in tests.
 */
async function sha256Hex(input) {
  if (!expoCryptoPromise) {
    expoCryptoPromise = import('expo-crypto').catch(() => null);
  }
  const expoCrypto = await expoCryptoPromise;
  if (expoCrypto?.digestStringAsync && expoCrypto?.CryptoDigestAlgorithm?.SHA256) {
    return await expoCrypto.digestStringAsync(
      expoCrypto.CryptoDigestAlgorithm.SHA256,
      String(input)
    );
  }
  if (globalThis.crypto?.subtle) {
    const encoded = new TextEncoder().encode(String(input));
    const buf = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  throw new Error('Cryptographic digest unavailable.');
}

/**
 * Decodes the JWT payload to check if the token has an explicit `exp` timestamp that has passed.
 */
export function isJwtTokenExpired(token, nowMs = Date.now()) {
  if (!token || typeof token !== 'string') return true;
  const parts = token.split('.');
  // Non-JWT developer test tokens do not have 3 base64 segments
  if (parts.length !== 3) return false;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const jsonStr =
      typeof globalThis.atob === 'function'
        ? globalThis.atob(padded)
        : typeof globalThis.Buffer !== 'undefined'
        ? globalThis.Buffer.from(padded, 'base64').toString('utf-8')
        : null;
    if (!jsonStr) return false;
    const payload = JSON.parse(jsonStr);
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000 <= nowMs;
    }
    return false;
  } catch {
    return false;
  }
}

export function isNetworkUnreachableError(error) {
  if (!error) return false;
  if (typeof error.status === 'number' && error.status > 0) {
    return false;
  }
  return true;
}

const jsonRequest = async (path, body, accessToken, method) => {
  const fetchImpl = getFetch();
  let response;
  try {
    response = await fetchImpl(`${API_BASE_URL}${path}`, {
      method: method || (body ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (networkErr) {
    const err = new Error(
      networkErr?.message || 'Unable to reach the InterLink server. Check your internet connection.'
    );
    err.isOfflineError = true;
    throw err;
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(
      result.message || 'The request could not be completed. Check your connection and try again.'
    );
    error.status = response.status;
    throw error;
  }
  return result.data;
};

const persistSession = async (session) => {
  if (await isStorageAvailable()) {
    const store = await getAuthStorage();
    await store.setItemAsync(SESSION_KEY, JSON.stringify(session));
  }
};

async function saveOfflineUnlockVerifier(user, password) {
  if (!user?.id || !user?.email || !password) return;
  if (!(await isStorageAvailable())) return;
  try {
    const store = await getAuthStorage();
    const salt = `il_salt_${user.id.toLowerCase()}_${Date.now().toString(36)}`;
    const hash = await sha256Hex(`${salt}:${user.email.toLowerCase()}:${password}`);
    await store.setItemAsync(
      OFFLINE_UNLOCK_VERIFIER_KEY,
      JSON.stringify({
        userId: user.id,
        email: user.email.toLowerCase(),
        salt,
        hash,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Best-effort offline unlock verifier
  }
}

async function verifyOfflineUnlockPassword(user, password) {
  if (!user?.id || !user?.email || !password) return false;
  if (!(await isStorageAvailable())) return false;
  try {
    const store = await getAuthStorage();
    const raw = await store.getItemAsync(OFFLINE_UNLOCK_VERIFIER_KEY);
    if (!raw) return false;
    const verifier = JSON.parse(raw);
    if (
      !verifier?.salt ||
      !verifier?.hash ||
      String(verifier.userId).toLowerCase() !== String(user.id).toLowerCase()
    ) {
      return false;
    }
    const candidate = await sha256Hex(`${verifier.salt}:${user.email.toLowerCase()}:${password}`);
    return candidate === verifier.hash;
  } catch {
    return false;
  }
}

export const mobileAuthService = {
  async signIn(email, password) {
    const data = await jsonRequest('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
    if (!data?.user || !data?.token) {
      throw new Error('Sign-in did not return a valid session. Please try again.');
    }
    const nowIso = new Date().toISOString();
    const session = {
      user: data.user,
      token: data.token,
      refreshToken: data.refreshToken || null,
      offline: false,
      lastVerifiedAt: nowIso,
      savedAt: nowIso,
    };
    await persistSession(session);
    await saveOfflineUnlockVerifier(data.user, password);
    sessionLockService.recordActivity();
    await sessionLockService.unlock();
    return session;
  },

  async signUp({ fullName, email, password }) {
    const data = await jsonRequest('/auth/signup', {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
    if (data?.token && data?.user) {
      const nowIso = new Date().toISOString();
      const session = {
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken || null,
        offline: false,
        lastVerifiedAt: nowIso,
        savedAt: nowIso,
      };
      await persistSession(session);
      await saveOfflineUnlockVerifier(data.user, password);
      sessionLockService.recordActivity();
      await sessionLockService.unlock();
      return { ...session, requiresEmailConfirmation: false };
    }
    return { user: data?.user || null, token: null, requiresEmailConfirmation: true };
  },

  /**
   * Restores the user's session on app startup.
   *
   * Offline-safe design:
   * - Never equates network unreachability ("offline") with "logged out".
   * - If `/auth/me` fails with 401/403 or the stored JWT `exp` claim is expired, clears the session.
   * - If `/auth/me` fails because the network is offline (`!error.status`) and a valid non-expired
   *   session with `user.id` and `user.email` exists in SecureStore, restores the session with
   *   `offline: true` and preserves the local lock policy (`sessionLockService`).
   */
  async restoreSession() {
    if (!(await isStorageAvailable())) return null;
    const store = await getAuthStorage();
    const saved = await store.getItemAsync(SESSION_KEY);
    if (!saved) return null;

    let session;
    try {
      session = JSON.parse(saved);
      if (!session?.token || !session?.user?.id) {
        throw new Error('Session is incomplete.');
      }
    } catch {
      await store.deleteItemAsync(SESSION_KEY).catch(() => {});
      await sessionLockService.clear();
      return null;
    }

    // Check if JWT is expired and no refresh token is available
    const tokenExpired = isJwtTokenExpired(session.token);

    try {
      let activeSession = session;
      let profile;
      try {
        profile = await jsonRequest('/auth/me', null, session.token);
      } catch (error) {
        if (error.status !== 401 || !session.refreshToken) throw error;
        const refreshed = await jsonRequest('/auth/refresh', {
          refreshToken: session.refreshToken,
        });
        activeSession = {
          ...session,
          token: refreshed.token,
          refreshToken: refreshed.refreshToken || session.refreshToken,
        };
        profile = await jsonRequest('/auth/me', null, activeSession.token);
      }

      const nowIso = new Date().toISOString();
      const restored = {
        ...activeSession,
        user: profile.user,
        offline: false,
        lastVerifiedAt: nowIso,
      };
      await persistSession(restored);

      await sessionLockService.init();
      if (sessionLockService.hasIdleExpired()) {
        await sessionLockService.lock();
      }

      return restored;
    } catch (error) {
      // Explicit server rejection (401/403) -> clear session and require sign-in
      if (error.status === 401 || error.status === 403) {
        await store.deleteItemAsync(SESSION_KEY).catch(() => {});
        await sessionLockService.clear();
        return null;
      }

      // Network unreachable while offline -> check if local JWT is still within its validity window
      if (isNetworkUnreachableError(error)) {
        if (tokenExpired) {
          await store.deleteItemAsync(SESSION_KEY).catch(() => {});
          await sessionLockService.clear();
          return null;
        }

        await sessionLockService.init();
        if (sessionLockService.hasIdleExpired()) {
          await sessionLockService.lock();
        }

        return {
          ...session,
          offline: true,
          lastVerifiedAt: session.lastVerifiedAt || session.savedAt || null,
        };
      }

      return null;
    }
  },

  /**
   * Re-verifies the active session against `/auth/me` when connectivity changes or user refreshes.
   * Returns `{ status: 'online', session }`, `{ status: 'offline', session }`, or `{ status: 'revoked', session: null }`.
   */
  async reconcileSessionConnectivity() {
    const restored = await this.restoreSession();
    if (!restored) {
      return { status: 'revoked', session: null };
    }
    return {
      status: restored.offline ? 'offline' : 'online',
      session: restored,
    };
  },

  /**
   * Re-authenticates user with password to unlock session without full logout.
   * Supports offline local unlock verification if `/auth/login` is unreachable due to no network
   * and a salted SHA-256 verifier was stored during the user's online login.
   */
  async reauthenticate(password) {
    if (!(await isStorageAvailable())) throw new Error('Secure storage unavailable.');
    const store = await getAuthStorage();
    const saved = await store.getItemAsync(SESSION_KEY);
    if (!saved) throw new Error('No active session to re-authenticate.');
    const session = JSON.parse(saved);
    const email = session.user?.email;
    if (!email) throw new Error('Account email not found in session.');

    try {
      const data = await jsonRequest('/auth/login', { email, password });
      if (!data?.user || !data?.token) {
        throw new Error('Reauthentication failed.');
      }
      const nowIso = new Date().toISOString();
      const updated = {
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken || session.refreshToken,
        offline: false,
        lastVerifiedAt: nowIso,
        savedAt: session.savedAt || nowIso,
      };
      await persistSession(updated);
      await saveOfflineUnlockVerifier(data.user, password);
      await sessionLockService.unlock();
      return updated;
    } catch (error) {
      if (isNetworkUnreachableError(error)) {
        const verifiedOffline = await verifyOfflineUnlockPassword(session.user, password);
        if (verifiedOffline) {
          await sessionLockService.unlock();
          return {
            ...session,
            offline: true,
          };
        }
        throw new Error(
          'Offline unlock failed: Incorrect password or no offline unlock verifier found on this device.'
        );
      }
      throw error;
    }
  },

  /**
   * Signs out the user:
   * 1. Attempts to revoke server-side session via /auth/logout.
   * 2. Clears local SecureStore credentials safely regardless of network outcome.
   * 3. Honestly reports whether server revocation could be confirmed.
   */
  async signOut() {
    let serverRevocationConfirmed = false;

    try {
      const token = await this.getAccessToken();
      if (token) {
        const res = await jsonRequest('/auth/logout', {}, token);
        serverRevocationConfirmed = Boolean(res?.serverRevoked);
      }
    } catch {
      serverRevocationConfirmed = false;
    } finally {
      if (await isStorageAvailable()) {
        const store = await getAuthStorage();
        await store.deleteItemAsync(SESSION_KEY).catch(() => {});
        await store.deleteItemAsync(OFFLINE_UNLOCK_VERIFIER_KEY).catch(() => {});
      }
      await sessionLockService.clear();
    }

    return {
      success: true,
      serverRevocationConfirmed,
      warning: serverRevocationConfirmed
        ? null
        : 'Could not confirm server-side token revocation over the network. Local credentials were removed; re-authentication is required on this device.',
    };
  },

  /**
   * Updates user profile (fullName and/or password).
   */
  async updateProfile({ fullName, password }) {
    const token = await this.getAccessToken();
    if (!token) throw new Error('Authentication required');

    const body = {};
    if (fullName) body.fullName = fullName.trim();
    if (password) body.password = password;

    const res = await jsonRequest('/auth/profile', body, token, 'PUT');
    if (!res?.user) {
      throw new Error(res?.message || 'Failed to update profile');
    }

    if (await isStorageAvailable()) {
      const store = await getAuthStorage();
      const raw = await store.getItemAsync(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        session.user = {
          ...session.user,
          ...res.user,
        };
        await store.setItemAsync(SESSION_KEY, JSON.stringify(session));
      }
    }

    if (password) {
      await saveOfflineUnlockVerifier(res.user, password);
    }

    return res.user;
  },

  async getAccessToken() {
    if (!(await isStorageAvailable())) return null;
    const store = await getAuthStorage();
    const saved = await store.getItemAsync(SESSION_KEY);
    try {
      return saved ? JSON.parse(saved).token || null : null;
    } catch {
      return null;
    }
  },
};
