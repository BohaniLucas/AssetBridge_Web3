import express from 'express';
import { requireAdmin } from '../middlewares/authMiddleware.js';
import { financialFeatureUnavailable } from '../middlewares/featureUnavailable.js';
import {
  getAdminUsers,
  updateUserStatus,
  getAdminAuditLogs,
  toggleCircuitBreaker,
  getAdminSettings,
} from '../controllers/adminController.js';

const router = express.Router();

// All administration routes are strictly protected by requireAdmin middleware
router.use(requireAdmin);

router.get('/overview', financialFeatureUnavailable);
router.get('/users', getAdminUsers);
router.post('/users/:email/status', updateUserStatus);
router.get('/transactions', financialFeatureUnavailable);
router.get('/audit-logs', getAdminAuditLogs);
router.get('/stokvels', financialFeatureUnavailable);
router.post('/circuit-breaker', toggleCircuitBreaker);
router.get('/settings', getAdminSettings);

export default router;

