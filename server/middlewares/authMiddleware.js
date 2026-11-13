import { supabase, isSupabaseConfigured } from '../services/supabaseService.js';
import { walletService } from '../services/walletService.js';
import { errorResponse } from '../utils/responseHelper.js';

/**
 * Explicit development-only gate for test accounts.
 * Must NEVER be enabled in production (fails closed if NODE_ENV === 'production').
 */
export const isDevTestAccountEnabled = () => {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_TEST_ACCOUNT === 'true';
};

/**
 * Authentication verification middleware
 * Protects financial and user routes from unauthenticated callers.
 * Strictly derives authenticated user identity and role from Supabase token.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Access denied. Missing or malformed Authorization header (Bearer token required).', 401);
    }

    const token = authHeader.split(' ')[1];

    if (!token || token.length < 5) {
      return errorResponse(res, 'Access denied. Invalid authentication token.', 401);
    }

    // Support developer test session ONLY in development when explicitly enabled
    if (token.startsWith('assetbridge_test_token_')) {
      if (!isDevTestAccountEnabled()) {
        return errorResponse(res, 'Access denied. Development test tokens are rejected in this environment.', 401);
      }
      const id = token.replace('assetbridge_test_token_', '');
      req.user = {
        id: id || '00000000-0000-0000-0000-000000000001',
        email: 'test@assetbridge.africa',
        role: 'USER',
        fullName: 'Test User',
      };
      return next();
    }

    if (isSupabaseConfigured() && supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user || !user.email) {
        return errorResponse(res, 'Session expired or invalid. Please log in again.', 401);
      }

      // Only Supabase app_metadata is server controlled. Never trust user_metadata or client roles.
      const role = user.app_metadata?.role === 'ADMIN' ? 'ADMIN' : 'USER';
      req.user = {
        id: user.id,
        email: user.email,
        role,
        fullName: user.user_metadata?.full_name || user.email.split('@')[0],
      };
      return next();
    }

    return errorResponse(res, 'Authentication is unavailable because Supabase is not configured.', 503);
  } catch (err) {
    return errorResponse(res, 'Authentication verification failed: ' + err.message, 500);
  }
};

/**
 * Strict Administrator Verification Middleware
 * Guarantees that only cryptographically verified users with role === 'ADMIN'
 * can access administration routes, data, or operational switches.
 */
export const requireAdmin = async (req, res, next) => {
  // Enforce authentication first
  return requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'ADMIN') {
      const actor = req.user?.email || req.ip || 'anonymous';
      try {
        walletService.recordAuditLog('UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT', actor, {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
        });
      } catch {
        // Continue to deny
      }

      return errorResponse(res, 'Access denied: Administrator privileges required.', 403);
    }
    next();
  });
};
