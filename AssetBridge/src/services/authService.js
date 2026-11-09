import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

const MOCK_STORAGE_KEY = 'assetbridge_user_session';

export const authService = {
  isConfigured() {
    return isSupabaseConfigured();
  },

  async signUp(email, password, fullName = '') {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      if (error) throw error;
      return { user: data.user, session: data.session, provider: 'supabase' };
    }

    // Demo / fallback mode for local testing before user sets keys
    const mockUser = {
      id: `usr_${Date.now()}`,
      email,
      user_metadata: {
        full_name: fullName || email.split('@')[0],
      },
      created_at: new Date().toISOString(),
    };
    const mockSession = {
      access_token: 'mock_jwt_token_assetbridge',
      user: mockUser,
    };
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockSession));
    return { user: mockUser, session: mockSession, provider: 'local_demo' };
  },

  async signIn(email, password) {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { user: data.user, session: data.session, provider: 'supabase' };
    }

    // Demo / fallback mode
    const mockUser = {
      id: 'demo_user_101',
      email: email || 'zoia@assetbridge.africa',
      user_metadata: {
        full_name: email.includes('@') ? email.split('@')[0] : 'Zoia M.',
      },
    };
    const mockSession = {
      access_token: 'mock_jwt_token_assetbridge',
      user: mockUser,
    };
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockSession));
    return { user: mockUser, session: mockSession, provider: 'local_demo' };
  },

  async signOut() {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(MOCK_STORAGE_KEY);
  },

  async getCurrentUser() {
    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase.auth.getUser();
      if (data?.user) return data.user;
    }

    const stored = localStorage.getItem(MOCK_STORAGE_KEY);
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

  onAuthStateChange(callback) {
    if (isSupabaseConfigured() && supabase) {
      return supabase.auth.onAuthStateChange(callback);
    }
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
};

