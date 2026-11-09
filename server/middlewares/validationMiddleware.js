import { errorResponse } from '../utils/responseHelper.js';

/**
 * Validates and sanitizes email and password for auth routes
 */
export const validateAuthInput = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string') {
    return errorResponse(res, 'Valid email is required', 400);
  }

  // Strict email regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email.trim())) {
    return errorResponse(res, 'Invalid email address format', 400);
  }

  if (!password || typeof password !== 'string') {
    return errorResponse(res, 'Password is required', 400);
  }

  if (password.length < 8) {
    return errorResponse(res, 'Password must be at least 8 characters long for security', 400);
  }

  // Sanitize email
  req.body.email = email.trim().toLowerCase();
  next();
};

/**
 * Validates financial transaction amounts to prevent negative values, NaN, overflow
 */
export const validateAmountInput = (fieldName = 'sendAmount', min = 1, max = 10000) => {
  return (req, res, next) => {
    const rawAmount = req.body[fieldName] ?? req.query[fieldName];
    const amount = Number(rawAmount);

    if (rawAmount === undefined || rawAmount === null || rawAmount === '') {
      return errorResponse(res, `Field '${fieldName}' is required`, 400);
    }

    if (isNaN(amount) || !isFinite(amount)) {
      return errorResponse(res, `Field '${fieldName}' must be a valid number`, 400);
    }

    if (amount < min) {
      return errorResponse(res, `Amount must be at least $${min}`, 400);
    }

    if (amount > max) {
      return errorResponse(res, `Amount exceeds the single-transaction safety limit of $${max.toLocaleString()}`, 400);
    }

    // Attach validated numeric amount
    if (req.body[fieldName] !== undefined) req.body[fieldName] = amount;
    if (req.query[fieldName] !== undefined) req.query[fieldName] = amount;

    next();
  };
};

/**
 * Strips script tags and dangerous HTML/injection characters
 */
export const sanitizeInputs = (req, res, next) => {
  const sanitize = (val) => {
    if (typeof val === 'string') {
      return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
    }
    return val;
  };

  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      req.body[key] = sanitize(req.body[key]);
    }
  }

  next();
};

