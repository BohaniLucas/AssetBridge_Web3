import express from 'express';
import {
  getForex,
  getEquities,
  getCrypto,
  getAllMarkets,
  generateTradeQuote,
  executeTrade,
} from '../controllers/marketController.js';

const router = express.Router();

// Public Live Market Feeds
router.get('/forex', getForex);
router.get('/equities', getEquities);
router.get('/crypto', getCrypto);
router.get('/all', getAllMarkets);

// Authoritative Trading Engine
router.post('/quote', generateTradeQuote);
router.post('/trade', executeTrade);

export default router;
