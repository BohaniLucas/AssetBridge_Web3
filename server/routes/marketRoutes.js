import express from 'express';
import { getAssets, getSignedQuote } from '../controllers/marketController.js';

const router = express.Router();

router.get('/assets', getAssets);
router.get('/quote', getSignedQuote);

export default router;

