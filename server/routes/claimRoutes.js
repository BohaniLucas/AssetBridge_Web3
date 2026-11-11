import express from 'express';
import {
  createClaim,
  getClaim,
  claimMoney,
  refundClaim,
  getSenderClaims,
} from '../controllers/claimController.js';

const router = express.Router();

router.post('/create', createClaim);
router.get('/:id', getClaim);
router.post('/:id/claim', claimMoney);
router.post('/:id/refund', refundClaim);
router.get('/sender/:userId', getSenderClaims);

export default router;

