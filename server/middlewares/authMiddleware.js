import { supabase, isSupabaseConfigured } from '../services/supabaseService.js';
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

    if (!token || token.length < 10) {
      return errorResponse(res, 'Access denied. Invalid authentication token.', 401);
    }

    if (isSupabaseConfigured() && supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return errorResponse(res, 'Session expired or invalid. Please log in again.', 401);
      }

      req.user = user;
      return next();
    }

    // Demo mode: accept valid demo tokens
    if (token.startsWith('mock_jwt') || token.startsWith('demo-')) {
      req.user = {
        id: 'demo-user-authenticated',
        email: 'zoia@assetbridge.africa',
        role: 'authenticated_user',
      };
      return next();
    }

    return errorResponse(res, 'Invalid token provided.', 401);
  } catch (err) {
    return errorResponse(res, 'Authentication verification failed.', 500);
  }
};

