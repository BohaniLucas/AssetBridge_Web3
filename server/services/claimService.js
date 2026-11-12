import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { walletService } from './walletService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLAIMS_FILE = path.join(__dirname, '../data/claims.json');

const loadClaims = () => {
  try {
    if (!fs.existsSync(CLAIMS_FILE)) {
      fs.writeFileSync(CLAIMS_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const data = fs.readFileSync(CLAIMS_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch {
    return [];
  }
};

const saveClaims = (claims) => {
  try {
    fs.writeFileSync(CLAIMS_FILE, JSON.stringify(claims, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Claims Store Error]', err.message);
  }
};

let claimsCache = loadClaims();

export const claimService = {
  createClaimLink({
    senderUserId,
    senderName = 'Nomsa',
    amountZar = 400.0,
    amountUsdt = 20.0,
    recipientName = 'Gogo',
    recipientPhone = '+27 82 555 0192',
    note = 'Groceries & monthly support',
    originUrl = 'http://localhost:5173',
  }) {
    if (!senderUserId) throw new Error('Sender userId is required.');
    const numZar = Number(amountZar);
    const numUsdt = Number(amountUsdt);
    if (!numZar || numZar <= 0) throw new Error('Amount in Rand must be greater than 0.');

    // 1. Check sender wallet and lock funds into escrow
    const senderWallet = walletService.getOrCreateWallet(senderUserId);
    const totalRequiredUsdt = numUsdt + 0.20; // $0.20 network gas fee
    if (senderWallet.balanceUsdt < totalRequiredUsdt) {
      throw new Error(
        `Insufficient balance. You need $${totalRequiredUsdt.toFixed(2)} USDT (R${numZar} + $0.20 gas fee), but you have $${senderWallet.balanceUsdt.toFixed(2)} USDT.`
      );
    }

    // 2. Debit sender balance into Escrow Claim Contract
    senderWallet.balanceUsdt = Math.round((senderWallet.balanceUsdt - totalRequiredUsdt) * 100) / 100;

    // 3. Generate secure secret code & hash
    const secretCode = `GOGO${Math.floor(1000 + Math.random() * 9000)}`;
    const secretHash = crypto.createHash('sha256').update(secretCode).digest('hex');
    const claimId = `clm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const escrowTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const claim = {
      id: claimId,
      senderUserId,
      senderName,
      amountZar: numZar,
      amountUsdt: numUsdt,
      recipientName,
      recipientPhone,
      secretCode,
      secretHash,
      status: 'waiting', // 'waiting' | 'claimed' | 'refunded' | 'expired'
      note,
      escrowTxHash,
      createdAt: new Date().toISOString(),
      expiresAt,
      claimedAt: null,
      claimedByPhone: null,
      claimedTxHash: null,
      whatsappMessage: `${senderName} sent you R${numZar.toFixed(2)}!\nTap the link to claim your money (no app or password needed):\n${originUrl}/claim/${claimId}?code=${secretCode}`,
    };

    claimsCache.unshift(claim);
    saveClaims(claimsCache);

    walletService.logAudit('ESCROW_CLAIM_LINK_CREATED', senderUserId, {
      claimId,
      amountZar: numZar,
      amountUsdt: numUsdt,
      recipientPhone,
      escrowTxHash,
    });

    return claim;
  },

  getClaimLink(claimId) {
    const claim = claimsCache.find((c) => c.id === claimId);
    if (!claim) return null;

    // Check expiration
    if (new Date() > new Date(claim.expiresAt) && claim.status === 'waiting') {
      claim.status = 'expired';
      saveClaims(claimsCache);
    }

    // Return safe presentation data (hide hash)
    return {
      id: claim.id,
      senderName: claim.senderName,
      amountZar: claim.amountZar,
      amountUsdt: claim.amountUsdt,
      recipientName: claim.recipientName,
      recipientPhone: claim.recipientPhone,
      status: claim.status,
      note: claim.note,
      createdAt: claim.createdAt,
      expiresAt: claim.expiresAt,
      claimedAt: claim.claimedAt,
      claimedTxHash: claim.claimedTxHash,
      escrowTxHash: claim.escrowTxHash,
    };
  },

  claimMoney({ claimId, secretCode, phoneNumber, smsCode, pin }) {
    const claim = claimsCache.find((c) => c.id === claimId);
    if (!claim) throw new Error('Claim link not found.');
    if (claim.status === 'claimed') throw new Error('This money has already been claimed.');
    if (claim.status === 'refunded') throw new Error('This link was cancelled and refunded to the sender.');
    if (claim.status === 'expired') throw new Error('This link has expired after 7 days.');

    // Verify secret code
    if (secretCode && claim.secretCode !== secretCode) {
      throw new Error('Invalid secret claim code provided in the link.');
    }

    // Verify SMS Code (Allow demo code 123456 or any 6-digit number)
    const cleanSms = (smsCode || '').trim();
    if (cleanSms !== '123456' && !/^[0-9]{6}$/.test(cleanSms)) {
      throw new Error('Invalid 6-digit SMS verification code. Use demo code: 123456.');
    }

    // Verify or register recipient custodial wallet
    const cleanPhone = (phoneNumber || claim.recipientPhone).replace(/[^0-9+]/g, '');
    const custodialUserId = `phone_${cleanPhone}@custodial.assetbridge.africa`;
    const recipientWallet = walletService.getOrCreateWallet(custodialUserId);

    // Credit recipient with R400 (or equivalent in tZAR / tokenized assets)
    recipientWallet.balanceUsdt = Math.round((recipientWallet.balanceUsdt + claim.amountUsdt) * 100) / 100;
    if (!recipientWallet.balanceZar) recipientWallet.balanceZar = 0;
    recipientWallet.balanceZar = Math.round((recipientWallet.balanceZar + claim.amountZar) * 100) / 100;

    const claimedTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    claim.status = 'claimed';
    claim.claimedAt = new Date().toISOString();
    claim.claimedByPhone = cleanPhone;
    claim.claimedTxHash = claimedTxHash;
    saveClaims(claimsCache);

    // Notify sender
    walletService.addNotification(
      claim.senderUserId,
      'Money Claimed!',
      `${claim.recipientName} (${cleanPhone}) successfully claimed R${claim.amountZar.toFixed(2)}.`
    );

    walletService.logAudit('ESCROW_CLAIM_FULFILLED', claim.senderUserId, {
      claimId,
      claimedByPhone: cleanPhone,
      amountZar: claim.amountZar,
      claimedTxHash,
    });

    return {
      success: true,
      amountZar: claim.amountZar,
      recipientName: claim.recipientName,
      phone: cleanPhone,
      claimedTxHash,
      timestamp: claim.claimedAt,
      balanceZar: recipientWallet.balanceZar,
    };
  },

  refundClaimLink({ claimId, senderUserId }) {
    const claim = claimsCache.find((c) => c.id === claimId);
    if (!claim) throw new Error('Claim link not found.');
    if (claim.senderUserId.toLowerCase() !== senderUserId.toLowerCase()) {
      throw new Error('Unauthorized: only the sender can cancel or refund this link.');
    }
    if (claim.status === 'claimed') {
      throw new Error('Cannot refund: this money has already been claimed by Gogo.');
    }
    if (claim.status === 'refunded') {
      throw new Error('This link has already been refunded.');
    }

    // Refund full amount back to sender
    const senderWallet = walletService.getOrCreateWallet(senderUserId);
    senderWallet.balanceUsdt = Math.round((senderWallet.balanceUsdt + claim.amountUsdt) * 100) / 100;

    claim.status = 'refunded';
    claim.refundedAt = new Date().toISOString();
    saveClaims(claimsCache);

    walletService.logAudit('ESCROW_CLAIM_REFUNDED', senderUserId, {
      claimId,
      refundedAmountUsdt: claim.amountUsdt,
      refundedAmountZar: claim.amountZar,
    });

    return {
      success: true,
      message: `R${claim.amountZar.toFixed(2)} ($${claim.amountUsdt.toFixed(2)} USDT) successfully returned to your wallet.`,
      refundedAmountZar: claim.amountZar,
      refundedAmountUsdt: claim.amountUsdt,
    };
  },

  getSenderClaims(senderUserId) {
    if (!senderUserId) return [];
    return claimsCache.filter(
      (c) => c.senderUserId.toLowerCase() === senderUserId.toLowerCase()
    );
  },
};

