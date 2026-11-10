import express from 'express';
import { generateWallet, getWallet, verifySignature } from '../controllers/walletController.js';

const router = express.Router();

// Generate a cryptographically verified Tether wallet
router.post('/generate', generateWallet);

// Get user's Tether wallet and live balance
router.get('/:userId', getWallet);

// Verify an EIP-191 signature against address
router.post('/verify-signature', verifySignature);

export default router;

