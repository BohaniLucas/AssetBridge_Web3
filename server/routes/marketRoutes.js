import express from 'express';
import { getForex, getEquities, getCrypto, getAllMarkets } from '../controllers/marketController.js';

const router = express.Router();

// Live 166-currency FX rates from open.er-api.com
router.get('/forex', getForex);

// Live US equity quotes from Finnhub
router.get('/equities', getEquities);

// Live Crypto tickers from Binance
router.get('/crypto', getCrypto);

// Consolidated live market feed
router.get('/all', getAllMarkets);

export default router;
