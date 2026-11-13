import express from 'express';
import {
  signUp,
  signIn,
  adminSignIn,
  getProfile,
  refreshAuthSession,
  signOut,
} from '../controllers/authController.js';
import { validateAuthInput } from '../middlewares/validationMiddleware.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/signup', validateAuthInput, signUp);
router.post('/login', validateAuthInput, signIn);
router.post('/refresh', refreshAuthSession);
router.post('/admin-login', validateAuthInput, adminSignIn);
router.post('/logout', requireAuth, signOut);
router.get('/profile', requireAuth, getProfile);
router.get('/me', requireAuth, getProfile);

export default router;
