import express from 'express';
import {
  listPots,
  getPot,
  createPot,
  contributeToPot,
  advanceNextRound,
  resetDemoPot
} from '../controllers/potsController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { validateAmountInput } from '../middlewares/validationMiddleware.js';

const router = express.Router();

router.get('/', listPots);
router.get('/:id', getPot);

// Financial operations require authentication
router.post('/', requireAuth, createPot);
router.post('/:id/contribute', requireAuth, contributeToPot);
router.post('/:id/next-round', requireAuth, advanceNextRound);
router.post('/:id/reset-demo', resetDemoPot);

export default router;
