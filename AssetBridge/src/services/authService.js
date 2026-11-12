/**
 * Authentication Service
 * Strictly separates User Authentication and Administrator Authentication.
 * Backed by authoritative backend API verification with dual session isolation.
 */

import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

const USER_SESSION_KEY = 'assetbridge_user_session';
const ADMIN_SESSION_KEY = 'assetbridge_admin_session';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
        body: JSON.stringify({ email, password, fullName }),
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
      throw new Error(`Account creation failed. No local account was created. ${err.message}`, { cause: err });
    }
  },

  /**
   * User Sign-In (Restricted to USER role flow)
   */
  async signIn(email, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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

      throw new Error(`Sign-in failed. Local demo authentication is disabled. ${err.message}`, { cause: err });
    }
  },

  /**
   * Dedicated Administrator Sign-In
   * Calls /api/auth/admin-login.
   * Authoritatively rejects non-admin accounts.
   */
  async signInAdmin(email, password) {
    const res = await fetch(`${API_BASE}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const msg = data.message || 'Access Denied: Administrator authentication failed.';
      throw new Error(msg);
    }

    const adminUser = data.data.user;
    if (adminUser.role !== 'ADMIN') {
      throw new Error('Access Denied: This account does not have administrator privileges.');
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
   */
  async getCurrentUser() {
    const stored = localStorage.getItem(USER_SESSION_KEY);
    if (stored) {
      try {
        const session = JSON.parse(stored);
        return session.user;
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * Get Current Administrator
   */
  async getCurrentAdmin() {
    const stored = localStorage.getItem(ADMIN_SESSION_KEY);
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.user && session.user.role === 'ADMIN') {
          return session.user;
        }
      } catch {
        return null;
      }
    }
    return null;
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

  async signOut() {
    this.signOutUser();
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // continue
      }
    }
  },

  onAuthStateChange(callback) {
    if (isSupabaseConfigured() && supabase) {
      return supabase.auth.onAuthStateChange(callback);
    }
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};
