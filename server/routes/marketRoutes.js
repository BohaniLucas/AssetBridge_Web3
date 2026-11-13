import express from 'express';
import {
  getAllMarkets,
  getAssetDetail,
  getAssetHistory,
  searchMarkets,
  getMarketStatus,
  getForex,
  getEquities,
  getCrypto,
  getMarketNews,
  generateTradeQuote,
  executeTrade,
} from '../controllers/marketController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public Authentic Market Feeds
router.get('/all', getAllMarkets);
router.get('/status', getMarketStatus);
router.get('/news', getMarketNews);
router.get('/search', searchMarkets);
router.get('/history/:idOrSymbol', getAssetHistory);
router.get('/asset/:idOrSymbol', getAssetDetail);

// Legacy feed endpoints
router.get('/forex', getForex);
router.get('/equities', getEquities);
router.get('/crypto', getCrypto);

// Trading remains explicitly guarded
router.post('/quote', requireAuth, generateTradeQuote);
router.post('/trade', requireAuth, executeTrade);

export default router;
