import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/authMiddleware.js';
import { financialFeatureUnavailable } from '../middlewares/featureUnavailable.js';
import {
  getWallet,
  verifyBlockchainTx,
  verifySignature,
  recordSelfCustodyPaymentStatus,
  getSelfCustodyPaymentStatuses,
} from '../controllers/walletController.js';

const router = express.Router();

// Never serve personal wallet data or financial operations without verified Supabase auth.
router.use(requireAuth);

// Wallet generation and transaction features remain disabled until WDK client signing is integrated.
router.get('/fee-quote', financialFeatureUnavailable);
router.post('/generate', financialFeatureUnavailable);
router.get('/admin/overview', requireAdmin, financialFeatureUnavailable);
router.get('/:userId', getWallet);
router.post('/faucet', financialFeatureUnavailable);

router.post('/transfer', financialFeatureUnavailable);
router.get('/:userId/transactions', financialFeatureUnavailable);
router.post('/:userId/self-custody-payments', recordSelfCustodyPaymentStatus);
router.get('/:userId/self-custody-payments', getSelfCustodyPaymentStatuses);
router.post('/verify-tx', verifyBlockchainTx);
router.post('/verify-signature', verifySignature);

router.post('/request-payment', financialFeatureUnavailable);
router.get('/:userId/payment-requests', financialFeatureUnavailable);
router.post('/payment-request/:id/fulfill', financialFeatureUnavailable);

router.post('/payment-link', financialFeatureUnavailable);
router.get('/payment-link/:id', financialFeatureUnavailable);
router.post('/payment-link/:id/pay', financialFeatureUnavailable);

router.post('/split-payment', financialFeatureUnavailable);
router.get('/:userId/split-payments', financialFeatureUnavailable);
router.post('/split-payment/:id/contribute', financialFeatureUnavailable);

router.get('/:userId/notifications', financialFeatureUnavailable);
router.post('/notifications/:id/read', financialFeatureUnavailable);

// Admin Console

export default router;
