import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { financialFeatureUnavailable } from '../middlewares/featureUnavailable.js';
import {
  getDestinations,
  resolveRecipientUsername,
  createQuote,
  createTransferIntent,
  approveTransfer,
  cancelTransfer,
  confirmBlockchainFunding,
  refundTransfer,
  getUserTransfers,
  getTransferById,
  handlePayoutWebhook,
} from '../controllers/remittanceController.js';

const router = express.Router();

const remittanceActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many remittance requests. Please wait before trying again.',
  },
});

// 1. Corridor catalog & truthful availability
router.get('/destinations', getDestinations);

// 2. Authenticated recipient username lookup (Flow A)
router.get('/resolve-user', requireAuth, remittanceActionLimiter, resolveRecipientUsername);
router.post('/resolve-user', requireAuth, remittanceActionLimiter, resolveRecipientUsername);

// 3. Executable / Reference Quote Creation (integer minor-unit math, 5-min lock)
router.post('/quotes', requireAuth, remittanceActionLimiter, createQuote);

// 4. Persistent Payment State Machine Routes
router.get('/transfers', requireAuth, getUserTransfers);
router.get('/transfers/:id', requireAuth, getTransferById);
router.post('/transfers', requireAuth, remittanceActionLimiter, createTransferIntent);
router.post('/transfers/:id/approve', requireAuth, remittanceActionLimiter, approveTransfer);
router.post('/transfers/:id/cancel', requireAuth, remittanceActionLimiter, cancelTransfer);
router.post('/transfers/:id/confirm-funding', requireAuth, remittanceActionLimiter, confirmBlockchainFunding);
router.post('/transfers/:id/refund', requireAuth, remittanceActionLimiter, refundTransfer);

// 5. Authenticated Provider Webhook (HMAC-SHA256 signature verified, idempotent)
router.post('/webhooks/payout', handlePayoutWebhook);

// 6. Legacy direct simulated send endpoint remains strictly fail-closed (503)
router.get('/quote', financialFeatureUnavailable);
router.post('/send', requireAuth, financialFeatureUnavailable);

export default router;
