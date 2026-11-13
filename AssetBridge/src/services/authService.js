/**
 * Authentication Service (Hardened)
 * Strictly verifies User and Administrator sessions with authoritative backend API (/api/auth/me).
 * Prevents client-side role tampering, XSS session impersonation, and unverified local admin promotion.
 */

import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

const USER_SESSION_KEY = 'assetbridge_user_session';
const ADMIN_SESSION_KEY = 'assetbridge_admin_session';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Validates a Bearer token with the backend.
 * The backend verifies the cryptographic JWT signature with Supabase
 * and derives identity & role strictly from server-controlled app_metadata.
 */
async function verifyTokenWithServer(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return json?.data?.user || null;
  } catch {
    return null;
  }
}

export const authService = {
  isConfigured() {
    return isSupabaseConfigured();
  },

  /**
   * User Registration (Always creates role: USER)
   */
  async signUp(email, password, fullName = '') {
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, fullName: fullName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      if (!data.data?.token) {
        return { user: data.data?.user || null, session: null, requiresEmailConfirmation: true, provider: 'supabase' };
      }

      const session = {
        user: data.data.user,
        token: data.data.token,
      };
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
      return { user: data.data.user, session, provider: 'backend_authoritative' };
    } catch (err) {
      throw new Error(`Account creation failed. ${err.message}`, { cause: err });
    }
  },

  /**
   * User Sign-In (Normal User flow)
   */
  async signIn(email, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid email or password.');
      }

      const user = data.data.user;
      const session = {
        user,
        token: data.data.token,
      };

      if (user.role === 'ADMIN') {
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      } else {
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
      }

      return { user, session, provider: 'backend_authoritative' };
    } catch (err) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
      throw new Error(`Sign-in failed. ${err.message}`, { cause: err });
    }
  },

  /**
   * Dedicated Administrator Sign-In
   * Calls /api/auth/admin-login.
   * Authoritatively verifies that the account possesses the ADMIN role in Supabase app_metadata.
   */
  async signInAdmin(email, password) {
    const res = await fetch(`${API_BASE}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const msg = data.message || 'Access Denied: Administrator authentication failed.';
      throw new Error(msg);
    }

    const adminUser = data.data.user;
    if (adminUser.role !== 'ADMIN') {
      throw new Error('Access Denied: This account does not possess administrator privileges.');
    }

    const adminSession = {
      user: adminUser,
      token: data.data.token,
      authenticatedAt: new Date().toISOString(),
    };

    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminSession));
    return { user: adminUser, session: adminSession };
  },

  /**
   * Get Current Normal User
   * Authoritatively verifies the stored token against /auth/me before trusting identity.
   */
  async getCurrentUser() {
    const stored = localStorage.getItem(USER_SESSION_KEY);
    if (!stored) return null;
    try {
      const session = JSON.parse(stored);
      if (!session?.token) {
        localStorage.removeItem(USER_SESSION_KEY);
        return null;
      }
      const verifiedUser = await verifyTokenWithServer(session.token);
      if (!verifiedUser) {
        localStorage.removeItem(USER_SESSION_KEY);
        return null;
      }
      // Update session with verified server details
      session.user = verifiedUser;
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
      return verifiedUser;
    } catch {
      localStorage.removeItem(USER_SESSION_KEY);
      return null;
    }
  },

  /**
   * Get Current Administrator
   * Authoritatively verifies the stored token against /auth/me.
   * Requires verified user.role === 'ADMIN'. Never trusts client-stored JSON roles.
   */
  async getCurrentAdmin() {
    const stored = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return null;
    try {
      const session = JSON.parse(stored);
      if (!session?.token) {
        localStorage.removeItem(ADMIN_SESSION_KEY);
        return null;
      }
      const verifiedUser = await verifyTokenWithServer(session.token);
      if (!verifiedUser || verifiedUser.role !== 'ADMIN') {
        localStorage.removeItem(ADMIN_SESSION_KEY);
        return null;
      }
      session.user = verifiedUser;
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      return verifiedUser;
    } catch {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
  },

  saveAdminSession(user, token = null) {
    if (user?.role !== 'ADMIN') {
      throw new Error('Only a server-authenticated administrator can create an admin session.');
    }
    const existing = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || '{}');
    const verifiedToken = token || existing.token;
    if (!verifiedToken) {
      throw new Error('Administrator session is missing its verified access token.');
    }
    const session = {
      user,
      token: verifiedToken,
      authenticatedAt: new Date().toISOString(),
    };
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  },

  getUserToken() {
    try {
      const session = JSON.parse(localStorage.getItem(USER_SESSION_KEY) || '{}');
      return session.token || null;
    } catch {
      return null;
    }
  },

  getAdminToken() {
    try {
      const session = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || '{}');
      return session.token || null;
    } catch {
      return null;
    }
  },

  signOutUser() {
    localStorage.removeItem(USER_SESSION_KEY);
  },

  signOutAdmin() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  },

  /**
   * Safe sign out:
   * 1. Invokes /auth/logout on backend to revoke session server-side.
   * 2. Safely clears local credentials.
   * 3. Honestly reports revocation status.
   */
  async signOut() {
    let serverRevocationConfirmed = false;
    const token = this.getUserToken() || this.getAdminToken();

    try {
      if (token) {
        const res = await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          serverRevocationConfirmed = Boolean(json?.data?.serverRevoked);
        }
      }
      if (isSupabaseConfigured() && supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
    } catch {
      serverRevocationConfirmed = false;
    } finally {
      this.signOutUser();
      this.signOutAdmin();
    }

    return {
      success: true,
      serverRevocationConfirmed,
      warning: serverRevocationConfirmed
        ? null
        : 'Could not confirm server-side token revocation over the network. Local credentials were removed; please sign in again.',
    };
  },

  onAuthStateChange(callback) {
    if (isSupabaseConfigured() && supabase) {
      return supabase.auth.onAuthStateChange(callback);
    }
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};
export default authService;
