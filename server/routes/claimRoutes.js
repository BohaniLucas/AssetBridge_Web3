import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { financialFeatureUnavailable } from '../middlewares/featureUnavailable.js';
import {
  createClaim,
  getPublicClaim,
  requestClaimOtp,
  verifyClaimOtp,
  confirmClaimPayout,
  refundClaim,
  getSenderClaims,
} from '../controllers/claimController.js';

const router = express.Router();

// Strict rate limit for public receiver claim endpoints (anti-enumeration & brute-force defense)
const publicClaimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many claim verification attempts from this IP. Please try again later.',
  },
});

// 1. Public Receiver Entry Points (No App Required, Sanitized Metadata & Strict OTP Checks)
router.get('/public/:id', publicClaimLimiter, getPublicClaim);
router.post('/public/:id/request-otp', publicClaimLimiter, requestClaimOtp);
router.post('/public/:id/verify-otp', publicClaimLimiter, verifyClaimOtp);
router.post('/public/:id/confirm-payout', publicClaimLimiter, confirmClaimPayout);

// 2. Authenticated Sender Management Routes (Ownership Verified)
router.post('/create', requireAuth, createClaim);
router.get('/sender', requireAuth, getSenderClaims);
router.get('/sender/:userId', requireAuth, getSenderClaims);
router.post('/:id/refund', requireAuth, refundClaim);

// 3. Legacy unverified claim endpoints remain fail-closed (503)
router.use(requireAuth);
router.all('*', financialFeatureUnavailable);

export default router;
