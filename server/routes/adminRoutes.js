import express from 'express';
import { requireAdmin } from '../middlewares/authMiddleware.js';
import {
  getAdminOverview,
  getAdminUsers,
  updateUserStatus,
  getAdminTransactions,
  getAdminAuditLogs,
  getAdminStokvels,
  toggleCircuitBreaker,
  getAdminSettings,
} from '../controllers/adminController.js';

const router = express.Router();

// All administration routes are strictly protected by requireAdmin middleware
router.use(requireAdmin);

router.get('/overview', getAdminOverview);
router.get('/users', getAdminUsers);
router.post('/users/:email/status', updateUserStatus);
router.get('/transactions', getAdminTransactions);
router.get('/audit-logs', getAdminAuditLogs);
router.get('/stokvels', getAdminStokvels);
router.post('/circuit-breaker', toggleCircuitBreaker);
router.get('/settings', getAdminSettings);

export default router;

