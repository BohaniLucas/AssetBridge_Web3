import express from 'express';
import { getForex, getEquities, getCrypto, getAllMarkets } from '../controllers/marketController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { financialFeatureUnavailable } from '../middlewares/featureUnavailable.js';

const router = express.Router();

// Public Live Market Feeds
router.get('/forex', getForex);
router.get('/equities', getEquities);
router.get('/crypto', getCrypto);
router.get('/all', getAllMarkets);

// Authoritative Trading Engine
router.post('/quote', requireAuth, financialFeatureUnavailable);
router.post('/trade', requireAuth, financialFeatureUnavailable);

export default router;
