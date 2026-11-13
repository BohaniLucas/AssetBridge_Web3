import { supabase, isSupabaseConfigured } from '../services/supabaseService.js';
import { walletService } from '../services/walletService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';
import { isDevTestAccountEnabled } from '../middlewares/authMiddleware.js';

export const signUp = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    // Developer Test Account gated strictly behind development environment flag
    if (
      isDevTestAccountEnabled() &&
      email?.trim().toLowerCase() === 'test@assetbridge.africa' &&
      (password === 'AssetBridge2026!' || password?.trim() === 'AssetBridge2026!')
    ) {
      const user = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test@assetbridge.africa',
        fullName: fullName || 'Test User',
        role: 'USER',
      };
      const token = 'assetbridge_test_token_00000000-0000-0000-0000-000000000001';
      const refreshToken = 'assetbridge_test_refresh_token';
      return successResponse(res, {
        user,
        wallet: null,
        token,
        refreshToken,
        session: { access_token: token, refresh_token: refreshToken, token_type: 'bearer' },
        requiresEmailConfirmation: false,
      }, 'Account registered successfully', 201);
    }

    if (!isSupabaseConfigured() || !supabase) {
      return errorResponse(res, 'Account creation is unavailable because Supabase Auth is not configured.', 503);
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName || '' } },
    });
    if (error) {
      // Return generic response to prevent user enumeration
      return errorResponse(res, 'Unable to register account. If you already have an account, please sign in.', 400);
    }
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
      refreshToken: data.session?.refresh_token || null,
      session: data.session ? { access_token: data.session.access_token, refresh_token: data.session.refresh_token, token_type: 'bearer' } : null,
      requiresEmailConfirmation: !data.session,
    }, data.session ? 'Account registered successfully' : 'Check your email to confirm your account before signing in.', 201);
  } catch (err) {
    return errorResponse(res, 'Registration request failed.', 400);
  }
};

export const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    // Developer Test Account gated strictly behind development environment flag
    if (
      isDevTestAccountEnabled() &&
      email?.trim().toLowerCase() === 'test@assetbridge.africa' &&
      (password === 'AssetBridge2026!' || password?.trim() === 'AssetBridge2026!')
    ) {
      const user = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test@assetbridge.africa',
        fullName: 'Test User',
        role: 'USER',
      };
      const token = 'assetbridge_test_token_00000000-0000-0000-0000-000000000001';
      const refreshToken = 'assetbridge_test_refresh_token';

      walletService.recordAuditLog('TEST_USER_LOGIN', user.email, { role: user.role });

      return successResponse(res, {
        user,
        wallet: null,
        token,
        refreshToken,
        session: {
          access_token: token,
          refresh_token: refreshToken,
          token_type: 'bearer',
        },
      }, 'Logged in successfully');
    }

    if (!isSupabaseConfigured() || !supabase) {
      return errorResponse(res, 'Sign-in is unavailable because Supabase Auth is not configured.', 503);
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user || !data.session) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }
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
      refreshToken: data.session.refresh_token,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: 'bearer',
      },
    }, 'Logged in successfully');
  } catch (err) {
    return errorResponse(res, 'Invalid email or password.', 401);
  }
};

export const refreshAuthSession = async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken;
    if (!refreshToken) return errorResponse(res, 'A refresh token is required.', 400);

    // Support developer test session ONLY in development when explicitly enabled
    if (isDevTestAccountEnabled() && refreshToken === 'assetbridge_test_refresh_token') {
      const user = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test@assetbridge.africa',
        fullName: 'Test User',
        role: 'USER',
      };
      const token = 'assetbridge_test_token_00000000-0000-0000-0000-000000000001';
      return successResponse(res, {
        user,
        token,
        refreshToken: 'assetbridge_test_refresh_token',
      }, 'Session refreshed');
    }

    if (!isSupabaseConfigured() || !supabase) {
      return errorResponse(res, 'Session refresh is unavailable because Supabase Auth is not configured.', 503);
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) {
      return errorResponse(res, 'Your session expired. Please sign in again.', 401);
    }

    return successResponse(res, {
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '',
        role: data.user.app_metadata?.role === 'ADMIN' ? 'ADMIN' : 'USER',
      },
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
    }, 'Session refreshed');
  } catch (err) {
    return errorResponse(res, 'Session refresh failed. Please sign in again.', 401);
  }
};

/**
 * Dedicated Administrator Login Endpoint
 * Authoritatively verifies that the account possesses the ADMIN role in Supabase app_metadata.
 * Rejects normal users and invalid credentials with generic safe responses.
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user || !data.session) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }
    if (data.user.app_metadata?.role !== 'ADMIN') {
      walletService.recordAuditLog('UNAUTHORIZED_ADMIN_LOGIN_ATTEMPT', data.user.email, {
        reason: 'Missing ADMIN app_metadata role',
      });
      return errorResponse(res, 'Access denied: Administrator privileges required.', 403);
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
    return errorResponse(res, 'Invalid email or password.', 401);
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
    return errorResponse(res, 'Unable to retrieve user profile.', 500);
  }
};

/**
 * Updates user profile information (e.g. fullName and optionally password).
 */
export const updateProfile = async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return errorResponse(res, 'Authentication required', 401);
    }

    const { fullName, password } = req.body || {};
    let updatedFullName = req.user?.fullName;

    if (password && password.length < 8) {
      return errorResponse(res, 'Password must be at least 8 characters long.', 400);
    }

    if (isSupabaseConfigured() && supabase) {
      const updatePayload = {};
      if (fullName) {
        updatePayload.data = { full_name: fullName.trim() };
      }
      if (password) {
        updatePayload.password = password;
      }
      if (Object.keys(updatePayload).length > 0) {
        const { data, error } = await supabase.auth.updateUser(updatePayload);
        if (error) {
          return errorResponse(res, error.message, 400);
        }
        if (data?.user?.user_metadata?.full_name) {
          updatedFullName = data.user.user_metadata.full_name;
        }
      }
    } else {
      if (fullName) {
        updatedFullName = fullName.trim();
      }
    }

    walletService.recordAuditLog('USER_PROFILE_UPDATED', email, {
      userId: req.user.id,
      updatedFullName: Boolean(fullName),
      updatedPassword: Boolean(password),
    });

    return successResponse(
      res,
      {
        user: {
          id: req.user.id,
          email,
          fullName: updatedFullName || fullName || email.split('@')[0],
          role: req.user.role || 'USER',
        },
      },
      'Profile updated successfully'
    );
  } catch (err) {
    return errorResponse(res, 'Failed to update profile: ' + err.message, 500);
  }
};

/**
 * Revokes the server-side session and records audit trail.
 */
export const signOut = async (req, res) => {
  try {
    let serverRevoked = false;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.auth.signOut();
        if (!error) serverRevoked = true;
      } catch {
        serverRevoked = false;
      }
    }

    if (req.user?.email) {
      walletService.recordAuditLog('USER_LOGOUT', req.user.email, {
        userId: req.user.id,
        serverRevoked,
      });
    }

    return successResponse(res, { serverRevoked }, 'Signed out successfully');
  } catch (err) {
    return errorResponse(res, 'Sign-out failed: ' + err.message, 500);
  }
};
