import { supabase, isSupabaseConfigured } from '../services/supabaseService.js';
import { walletService } from '../services/walletService.js';
import { errorResponse } from '../utils/responseHelper.js';

/**
 * Authentication verification middleware
 * Protects financial routes from unauthenticated callers
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
