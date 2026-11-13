import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';
import { sessionLockService } from './sessionLockService';

const SESSION_KEY = 'assetbridge_mobile_auth_session';

const jsonRequest = async (path, body, accessToken) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || 'The request could not be completed. Check your connection and try again.');
    error.status = response.status;
    throw error;
  }
  return result.data;
};

const persistSession = async (session) => {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  }
};

export const mobileAuthService = {
  async signIn(email, password) {
    const data = await jsonRequest('/auth/login', { email: email.trim().toLowerCase(), password });
    if (!data?.user || !data?.token) {
      throw new Error('Sign-in did not return a valid session. Please try again.');
    }
    const session = { user: data.user, token: data.token, refreshToken: data.refreshToken || null };
    await persistSession(session);
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
      const session = { user: data.user, token: data.token, refreshToken: data.refreshToken || null };
      await persistSession(session);
      sessionLockService.recordActivity();
      await sessionLockService.unlock();
      return { ...session, requiresEmailConfirmation: false };
    }
    return { user: data?.user || null, token: null, requiresEmailConfirmation: true };
  },

  async restoreSession() {
    if (!(await SecureStore.isAvailableAsync())) return null;
    const saved = await SecureStore.getItemAsync(SESSION_KEY);
    if (!saved) return null;
    try {
      const session = JSON.parse(saved);
      if (!session?.token) throw new Error('Session is incomplete.');
      let activeSession = session;
      let profile;
      try {
        profile = await jsonRequest('/auth/me', null, session.token);
      } catch (error) {
        if (error.status !== 401 || !session.refreshToken) throw error;
        const refreshed = await jsonRequest('/auth/refresh', { refreshToken: session.refreshToken });
        activeSession = { ...session, token: refreshed.token, refreshToken: refreshed.refreshToken };
        profile = await jsonRequest('/auth/me', null, activeSession.token);
      }
      const restored = { ...activeSession, user: profile.user };
      await persistSession(restored);

      // Check if session lock was engaged or idle time expired during app shutdown
      await sessionLockService.init();
      if (sessionLockService.hasIdleExpired()) {
        await sessionLockService.lock();
      }

      return restored;
    } catch (error) {
      if (error.status === 401 || error.message === 'Session is incomplete.') {
        await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
        await sessionLockService.clear();
      }
      return null;
    }
  },

  /**
   * Re-authenticates user with password to unlock session without full logout.
   */
  async reauthenticate(password) {
    if (!(await SecureStore.isAvailableAsync())) throw new Error('Secure storage unavailable.');
    const saved = await SecureStore.getItemAsync(SESSION_KEY);
    if (!saved) throw new Error('No active session to re-authenticate.');
    const session = JSON.parse(saved);
    const email = session.user?.email;
    if (!email) throw new Error('Account email not found in session.');

    const data = await jsonRequest('/auth/login', { email, password });
    if (!data?.user || !data?.token) {
      throw new Error('Reauthentication failed.');
    }
    const updated = { user: data.user, token: data.token, refreshToken: data.refreshToken || session.refreshToken };
    await persistSession(updated);
    await sessionLockService.unlock();
    return updated;
  },

  /**
   * Signs out the user:
   * 1. Attempts to revoke server-side session via /auth/logout.
   * 2. Clears local SecureStore credentials safely regardless of network outcome.
   * 3. Honestly reports whether server revocation could be confirmed.
   */
  async signOut() {
    let serverRevocationConfirmed = false;
    let revocationError = null;

    try {
      const token = await this.getAccessToken();
      if (token) {
        const res = await jsonRequest('/auth/logout', {}, token);
        serverRevocationConfirmed = Boolean(res?.serverRevoked);
      }
    } catch (err) {
      serverRevocationConfirmed = false;
      revocationError = err.message || 'Server unreachable';
    } finally {
      if (await SecureStore.isAvailableAsync()) {
        await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
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

  async getAccessToken() {
    if (!(await SecureStore.isAvailableAsync())) return null;
    const saved = await SecureStore.getItemAsync(SESSION_KEY);
    try {
      return saved ? JSON.parse(saved).token || null : null;
    } catch {
      return null;
    }
  },
};
