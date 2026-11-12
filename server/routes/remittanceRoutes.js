import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { financialFeatureUnavailable } from '../middlewares/featureUnavailable.js';

const router = express.Router();

// List all supported worldwide payout destinations & currencies
router.get('/destinations', financialFeatureUnavailable);
router.get('/quote', financialFeatureUnavailable);
router.post('/send', requireAuth, financialFeatureUnavailable);

export default router;
