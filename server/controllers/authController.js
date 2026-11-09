import { supabase, isSupabaseConfigured } from '../services/supabaseService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export const signUp = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    if (!isSupabaseConfigured()) {
      // Graceful fallback for local development before user enters keys into .env
      return successResponse(res, {
        user: {
          id: `demo-usr-${Date.now()}`,
          email,
          user_metadata: { full_name: fullName || 'Demo User' },
        },
        session: {
          access_token: 'mock-jwt-token-configure-supabase-in-env',
          token_type: 'bearer',
        },
        note: 'Supabase keys not configured in backend .env yet. Mock session granted for UI demonstration.',
      }, 'Account registered successfully', 201);
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return errorResponse(res, error.message, 400);
    }

    return successResponse(res, data, 'User signed up successfully via Supabase', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    if (!isSupabaseConfigured()) {
      return successResponse(res, {
        user: {
          id: 'demo-user-1',
          email,
          user_metadata: { full_name: 'Zoia M.' },
        },
        session: {
          access_token: 'mock-jwt-token-configure-supabase-in-env',
          token_type: 'bearer',
        },
        note: 'Supabase keys not configured in backend .env yet. Mock session granted for UI demonstration.',
      }, 'Logged in successfully (Demo mode)');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return errorResponse(res, error.message, 401);
    }

    return successResponse(res, data, 'Logged in successfully via Supabase');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getProfile = async (req, res) => {
  return successResponse(res, {
    username: 'zoia_m',
    fullName: 'Zoia M.',
    walletAddress: '0x884a...12be',
    balances: {
      tUSDT: 17643.41,
      tAAPL: 1.25,
      tKES: 12950.00,
      tZAR: 2500.00,
    }
  });
};

