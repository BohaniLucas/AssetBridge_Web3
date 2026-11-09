import express from 'express';
import { signUp, signIn, getProfile } from '../controllers/authController.js';
import { validateAuthInput } from '../middlewares/validationMiddleware.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/signup', validateAuthInput, signUp);
router.post('/login', validateAuthInput, signIn);
router.get('/profile', requireAuth, getProfile);

export default router;
