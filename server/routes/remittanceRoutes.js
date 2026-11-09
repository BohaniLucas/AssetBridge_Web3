import express from 'express';
import { getQuote, sendRemittance } from '../controllers/remittanceController.js';
import { validateAmountInput } from '../middlewares/validationMiddleware.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public quote preview with amount bounds validation ($1 to $10,000 max)
router.get('/quote', validateAmountInput('amount', 1, 10000), getQuote);

// Actual fund transfer requires authentication and amount bounds validation
router.post('/send', requireAuth, validateAmountInput('sendAmount', 1, 10000), sendRemittance);

export default router;
