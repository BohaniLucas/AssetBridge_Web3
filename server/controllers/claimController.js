import { claimService } from '../services/claimService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export const createClaim = (req, res) => {
  try {
    const {
      senderUserId,
      senderName,
      amountZar,
      amountUsdt,
      recipientName,
      recipientPhone,
      note,
      originUrl,
    } = req.body;

    if (!senderUserId || !amountZar) {
      return errorResponse(res, 'senderUserId and amountZar are required', 400);
    }

    const claim = claimService.createClaimLink({
      senderUserId,
      senderName: senderName || 'Nomsa',
      amountZar,
      amountUsdt: amountUsdt || Number(amountZar) / 20.0,
      recipientName: recipientName || 'Gogo',
      recipientPhone: recipientPhone || '+27 82 555 0192',
      note: note || 'Groceries and monthly support',
      originUrl: originUrl || req.headers.origin || 'http://localhost:5173',
    });

    return successResponse(res, claim, 'Escrow claim link generated successfully', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getClaim = (req, res) => {
  try {
    const { id } = req.params;
    const claim = claimService.getClaimLink(id);
    if (!claim) {
      return errorResponse(res, 'Claim link not found or invalid', 404);
    }
    return successResponse(res, claim, 'Claim link retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const claimMoney = (req, res) => {
  try {
    const { id } = req.params;
    const { secretCode, phoneNumber, smsCode, pin } = req.body;

    const result = claimService.claimMoney({
      claimId: id,
      secretCode,
      phoneNumber,
      smsCode,
      pin,
    });

    return successResponse(res, result, 'Money successfully claimed and account created!');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const refundClaim = (req, res) => {
  try {
    const { id } = req.params;
    const { senderUserId } = req.body;

    if (!senderUserId) {
      return errorResponse(res, 'senderUserId is required to authorize refund', 400);
    }

    const result = claimService.refundClaimLink({
      claimId: id,
      senderUserId,
    });

    return successResponse(res, result, result.message);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getSenderClaims = (req, res) => {
  try {
    const { userId } = req.params;
    const claims = claimService.getSenderClaims(userId);
    return successResponse(res, claims, 'Sender claim links retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

