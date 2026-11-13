import { claimService } from '../services/claimService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

function assertSenderIdentity(req) {
  const supplied = req.body?.senderUserId || req.body?.userId;
  if (supplied && String(supplied).toLowerCase() !== String(req.user?.id).toLowerCase()) {
    const err = new Error('Forbidden: Client-supplied senderUserId does not match authenticated token.');
    err.status = 403;
    throw err;
  }
}

export const createClaim = async (req, res) => {
  try {
    assertSenderIdentity(req);
    const {
      quoteId,
      idempotencyKey,
      recipientName,
      recipientPhone,
      note,
      riskAcknowledged,
      originUrl,
    } = req.body || {};

    const result = await claimService.createClaimLink({
      senderUser: req.user,
      quoteId,
      idempotencyKey,
      recipientName,
      recipientPhone,
      note,
      riskAcknowledged,
      originUrl: originUrl || req.headers.origin || 'http://localhost:5173',
    });

    const status = result.idempotentReplay ? 200 : 201;
    return successResponse(
      res,
      result,
      result.idempotentReplay
        ? 'Idempotent Gogo claim link retrieved'
        : 'One-time Gogo claim reference created',
      status
    );
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const getPublicClaim = (req, res) => {
  try {
    const { id } = req.params;
    const lang = req.query.lang || 'en';
    const summary = claimService.getPublicClaimSummary(id, lang);
    return successResponse(res, summary, 'Public claim summary retrieved');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 404);
  }
};

export const requestClaimOtp = (req, res) => {
  try {
    const { id } = req.params;
    const { claimToken, phoneNumber } = req.body || {};
    const result = claimService.requestClaimOtp({
      claimId: id,
      claimToken,
      phoneNumber,
    });
    return successResponse(res, result, result.message);
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const verifyClaimOtp = (req, res) => {
  try {
    const { id } = req.params;
    const { otpCode } = req.body || {};
    const result = claimService.verifyClaimOtp({
      claimId: id,
      otpCode,
    });
    return successResponse(res, result, result.message);
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const confirmClaimPayout = (req, res) => {
  try {
    const { id } = req.params;
    const { verificationSessionToken, payoutMethod, recipientWalletAddress } = req.body || {};
    const result = claimService.confirmClaimPayout({
      claimId: id,
      verificationSessionToken,
      payoutMethod,
      recipientWalletAddress,
    });
    return successResponse(res, result, result.message);
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const refundClaim = (req, res) => {
  try {
    assertSenderIdentity(req);
    const { id } = req.params;
    const result = claimService.refundClaimLink({
      claimId: id,
      senderUser: req.user,
    });
    return successResponse(res, result, result.message);
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const getSenderClaims = (req, res) => {
  try {
    const requestedUserId = req.params.userId;
    if (
      requestedUserId &&
      String(requestedUserId).toLowerCase() !== String(req.user.id).toLowerCase() &&
      req.user.role !== 'ADMIN'
    ) {
      return errorResponse(res, 'Forbidden: Cannot view another user’s claim links.', 403);
    }

    const originUrl = req.headers.origin || 'http://localhost:5173';
    const claims = claimService.getSenderClaims(req.user.id, originUrl);
    return successResponse(res, claims, 'Sender claim links retrieved');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 500);
  }
};
