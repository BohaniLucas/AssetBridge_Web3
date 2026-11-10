import express from 'express';
import { requireAdmin } from '../middlewares/authMiddleware.js';
import {
  generateWallet,
  getWallet,
  transfer,
  getTransactions,
  depositFaucet,
  requestPayment,
  getPaymentRequests,
  fulfillPaymentRequest,
  createPaymentLink,
  getPaymentLink,
  payPaymentLink,
  createSplitPayment,
  contributeSplitPayment,
  getSplitPayments,
  getNotifications,
  markNotificationRead,
  verifyBlockchainTx,
  verifySignature,
  getAdminOverview,
} from '../controllers/walletController.js';

const router = express.Router();

// Wallet generation & retrieval
router.post('/generate', generateWallet);
router.get('/:userId', getWallet);
router.post('/faucet', depositFaucet);

// Direct P2P transfers & ledger
router.post('/transfer', transfer);
router.get('/:userId/transactions', getTransactions);
router.post('/verify-tx', verifyBlockchainTx);
router.post('/verify-signature', verifySignature);

// Payment requests
router.post('/request-payment', requestPayment);
router.get('/:userId/payment-requests', getPaymentRequests);
router.post('/payment-request/:id/fulfill', fulfillPaymentRequest);

// Shareable payment links (WhatsApp)
router.post('/payment-link', createPaymentLink);
router.get('/payment-link/:id', getPaymentLink);
router.post('/payment-link/:id/pay', payPaymentLink);

// Group Split payments
router.post('/split-payment', createSplitPayment);
router.get('/:userId/split-payments', getSplitPayments);
router.post('/split-payment/:id/contribute', contributeSplitPayment);

// Notifications
router.get('/:userId/notifications', getNotifications);
router.post('/notifications/:id/read', markNotificationRead);

// Admin Console
router.get('/admin/overview', requireAdmin, getAdminOverview);

export default router;
