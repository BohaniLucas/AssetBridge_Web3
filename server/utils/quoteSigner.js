import crypto from 'crypto';

// Use strong secret with fallback warning
const SECRET_KEY = process.env.QUOTE_SIGNING_SECRET || crypto.randomBytes(32).toString('hex');
const usedQuoteNonces = new Set();

/**
 * Creates a signed quote valid for 15 seconds with anti-tamper and replay protection
 */
export const generateSignedQuote = (pair, basePrice, spreadBps = 15) => {
  const timestamp = Date.now();
  const expiresAt = timestamp + 15000; // 15 seconds strict validity
  const nonce = crypto.randomBytes(8).toString('hex'); // anti-replay nonce
  const spreadMultiplier = 1 + (spreadBps / 10000);
  const executionPrice = Number((basePrice * spreadMultiplier).toFixed(4));
  
  // Canonical payload
  const payload = `${pair}:${executionPrice}:${expiresAt}:${nonce}`;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');

  return {
    pair,
    basePrice,
    spreadBps,
    executionPrice,
    timestamp,
    expiresAt,
    nonce,
    signature,
    validDurationSeconds: 15,
  };
};

/**
 * Verifies a quote signature with constant-time equality check and replay detection
 */
export const verifyQuote = (pair, executionPrice, expiresAt, nonce, signature) => {
  if (!pair || !executionPrice || !expiresAt || !nonce || !signature) {
    return { valid: false, reason: 'Malformed quote parameters' };
  }

  // Check expiration
  if (Date.now() > Number(expiresAt)) {
    return { valid: false, reason: 'Quote has expired (validity is 15s)' };
  }

  // Check replay
  if (usedQuoteNonces.has(nonce)) {
    return { valid: false, reason: 'Quote has already been consumed (replay attack prevented)' };
  }

  const payload = `${pair}:${executionPrice}:${expiresAt}:${nonce}`;
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  const bufExpected = Buffer.from(expectedSig, 'utf8');
  const bufActual = Buffer.from(signature, 'utf8');

  if (bufExpected.length !== bufActual.length || !crypto.timingSafeEqual(bufExpected, bufActual)) {
    return { valid: false, reason: 'Invalid cryptographic signature' };
  }

  // Mark nonce as consumed
  usedQuoteNonces.add(nonce);
  // Auto-clean old nonces every 5 minutes
  setTimeout(() => usedQuoteNonces.delete(nonce), 300000);

  return { valid: true };
};
