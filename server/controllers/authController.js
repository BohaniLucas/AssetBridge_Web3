import { supabase, isSupabaseConfigured } from '../services/supabaseService.js';
import { userService } from '../services/userService.js';
import { walletService } from '../services/walletService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export const signUp = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    // Authoritative backend registration enforcing role: 'USER'
    const regResult = await userService.registerUser({ email, password, fullName });
    const wallet = walletService.getOrCreateWallet(regResult.user.email);

    // If Supabase is configured, also register in Supabase
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role: regResult.user.role } },
        });
      } catch {
        // Continue with local authoritative user
      }
    }

    walletService.recordAuditLog('USER_REGISTERED', regResult.user.email, {
      role: regResult.user.role,
      fullName: regResult.user.fullName,
    });

    return successResponse(res, {
      user: regResult.user,
      wallet,
      token: regResult.token,
      session: {
        access_token: regResult.token,
        token_type: 'bearer',
      },
    }, 'Account registered successfully', 201);
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

    const authResult = await userService.authenticateUser(email, password);
    const wallet = walletService.getOrCreateWallet(authResult.user.email);

    walletService.recordAuditLog('USER_LOGIN_SUCCESS', authResult.user.email, {
      role: authResult.user.role,
    });

    return successResponse(res, {
      user: authResult.user,
      wallet,
      token: authResult.token,
      session: {
        access_token: authResult.token,
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

    // Require role: 'ADMIN'
    const authResult = await userService.authenticateUser(email, password, 'ADMIN');

    walletService.recordAuditLog('ADMIN_LOGIN_SUCCESS', authResult.user.email, {
      role: 'ADMIN',
      portal: 'ADMIN_PORTAL',
    });

    return successResponse(res, {
      user: authResult.user,
      token: authResult.token,
      session: {
        access_token: authResult.token,
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
    const email = req.user?.email || req.query.email;
    if (!email) {
      return errorResponse(res, 'Authentication required', 401);
    }

    const role = userService.getRoleForEmail(email);
    const wallet = walletService.getOrCreateWallet(email);

    return successResponse(res, {
      user: {
        id: req.user?.id || email,
        email,
        fullName: req.user?.fullName || email.split('@')[0],
        role,
      },
      wallet,
    }, 'User profile retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};
