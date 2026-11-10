import express from 'express';
import {
  listPots,
  getPot,
  createPot,
  contributeToPot,
  joinPot,
  voteInvestment,
} from '../controllers/potsController.js';

const router = express.Router();

router.get('/', listPots);
router.get('/:id', getPot);

// Financial and governance operations
router.post('/', createPot);
router.post('/join', joinPot);
router.post('/:id/contribute', contributeToPot);
router.post('/:id/vote', voteInvestment);

export default router;
