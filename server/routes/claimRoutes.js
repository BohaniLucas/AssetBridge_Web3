import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { financialFeatureUnavailable } from '../middlewares/featureUnavailable.js';

const router = express.Router();

router.use(requireAuth);
router.all('*', financialFeatureUnavailable);

export default router;

