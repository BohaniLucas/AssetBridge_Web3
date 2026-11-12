import { supabase, isSupabaseConfigured } from '../services/supabaseService.js';
import { walletService } from '../services/walletService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export const signUp = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    if (!isSupabaseConfigured() || !supabase) {
      return errorResponse(res, 'Account creation is unavailable because Supabase Auth is not configured.', 503);
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || '' } },
    });
    if (error) return errorResponse(res, error.message, 400);
    const authUser = data.user;
    const user = {
      id: authUser.id,
      email: authUser.email,
      fullName: authUser.user_metadata?.full_name || '',
      role: 'USER',
    };
    walletService.recordAuditLog('USER_REGISTERED', user.email, { role: 'USER' });

    return successResponse(res, {
      user,
      wallet: null,
      token: data.session?.access_token || null,
      session: data.session ? { access_token: data.session.access_token, token_type: 'bearer' } : null,
      requiresEmailConfirmation: !data.session,
    }, data.session ? 'Account registered successfully' : 'Check your email to confirm your account before signing in.', 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 400);
  }
};

export const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    if (!isSupabaseConfigured() || !supabase) {
      return errorResponse(res, 'Sign-in is unavailable because Supabase Auth is not configured.', 503);
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) return errorResponse(res, 'Invalid email or password.', 401);
    const authUser = data.user;
    const user = {
      id: authUser.id,
      email: authUser.email,
      fullName: authUser.user_metadata?.full_name || '',
      role: authUser.app_metadata?.role === 'ADMIN' ? 'ADMIN' : 'USER',
    };

    walletService.recordAuditLog('USER_LOGIN_SUCCESS', user.email, {
      role: user.role,
    });

    return successResponse(res, {
      user,
      wallet: null,
      token: data.session.access_token,
      session: {
        access_token: data.session.access_token,
        token_type: 'bearer',
      },
    }, 'Logged in successfully');
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 401);
  }
};

/**
 * Dedicated Administrator Login Endpoint
 * Authoritatively verifies that the account possesses the ADMIN role on the backend.
 * Rejects normal users with a 403 Forbidden Access Denied error.
 */
export const adminSignIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    if (!isSupabaseConfigured() || !supabase) {
      return errorResponse(res, 'Admin sign-in is unavailable because Supabase Auth is not configured.', 503);
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) return errorResponse(res, 'Invalid email or password.', 401);
    if (data.user.app_metadata?.role !== 'ADMIN') {
      return errorResponse(res, 'Access denied: administrator role is not assigned by the server.', 403);
    }
    const user = {
      id: data.user.id,
      email: data.user.email,
      fullName: data.user.user_metadata?.full_name || '',
      role: 'ADMIN',
    };

    walletService.recordAuditLog('ADMIN_LOGIN_SUCCESS', user.email, {
      role: 'ADMIN',
      portal: 'ADMIN_PORTAL',
    });

    return successResponse(res, {
      user,
      token: data.session.access_token,
      session: {
        access_token: data.session.access_token,
        token_type: 'bearer',
      },
    }, 'Administrator authenticated successfully');
  } catch (err) {
    const status = err.statusCode || 401;
    return errorResponse(res, err.message, status);
  }
};

export const getProfile = async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return errorResponse(res, 'Authentication required', 401);
    }

    const role = req.user?.role || 'USER';

    return successResponse(res, {
      user: {
        id: req.user?.id,
        email,
        fullName: req.user?.fullName || email.split('@')[0],
        role,
      },
      wallet: null,
    }, 'User profile retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};
