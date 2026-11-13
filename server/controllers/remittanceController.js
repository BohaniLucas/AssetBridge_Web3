import { remittanceService } from '../services/remittanceService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

/**
 * Verify that if the client passed a senderUserId, it strictly matches the authenticated token user.
 */
function assertNoForgedSender(req) {
  const supplied = req.body?.senderUserId || req.body?.userId;
  if (supplied && String(supplied).toLowerCase() !== String(req.user?.id).toLowerCase()) {
    const err = new Error('Forbidden: Client-supplied user ID does not match authenticated token.');
    err.status = 403;
    throw err;
  }
}

export const getDestinations = async (req, res) => {
  try {
    const destinations = await remittanceService.getAllDestinations();
    return successResponse(res, destinations, 'Corridor availability and reference rates retrieved');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 500);
  }
};

export const resolveRecipientUsername = async (req, res) => {
  try {
    const username = req.query.username || req.body?.username;
    const resolved = await remittanceService.resolveUsername(username, req.user.id);
    return successResponse(res, resolved, 'Recipient account verified');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const createQuote = async (req, res) => {
  try {
    assertNoForgedSender(req);
    const {
      flowType = 'app_to_app',
      corridorCode = 'ZA-ZAR',
      payoutRail,
      sendAmountUsdt,
      amount,
    } = req.body || {};

    const quote = await remittanceService.createQuote({
      userId: req.user.id,
      flowType,
      corridorCode,
      payoutRail,
      sendAmountUsdt: sendAmountUsdt ?? amount,
    });

    return successResponse(res, quote, 'Remittance quote locked for 5 minutes', 201);
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const createTransferIntent = async (req, res) => {
  try {
    assertNoForgedSender(req);
    const {
      quoteId,
      idempotencyKey,
      recipientUsername,
      recipientName,
      recipientPhone,
      note,
    } = req.body || {};

    const result = await remittanceService.createTransferIntent({
      senderUser: req.user,
      quoteId,
      idempotencyKey,
      recipientUsername,
      recipientName,
      recipientPhone,
      note,
    });

    const status = result.idempotentReplay ? 200 : 201;
    return successResponse(
      res,
      result,
      result.idempotentReplay
        ? 'Idempotent transfer intent retrieved'
        : 'Transfer intent created; awaiting sender review and approval',
      status
    );
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const approveTransfer = async (req, res) => {
  try {
    assertNoForgedSender(req);
    const { id } = req.params;
    const { riskAcknowledged } = req.body || {};

    const result = await remittanceService.approveTransfer({
      transferId: id,
      senderUser: req.user,
      riskAcknowledged,
    });

    return successResponse(res, result, 'Transfer approved; awaiting verified on-chain funding');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const cancelTransfer = (req, res) => {
  try {
    assertNoForgedSender(req);
    const { id } = req.params;
    const result = remittanceService.cancelTransfer({
      transferId: id,
      senderUser: req.user,
    });
    return successResponse(res, result, 'Transfer cancelled');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const confirmBlockchainFunding = async (req, res) => {
  try {
    assertNoForgedSender(req);
    const { id } = req.params;
    const { txHash } = req.body || {};

    const result = await remittanceService.confirmBlockchainFunding({
      transferId: id,
      senderUser: req.user,
      txHash,
    });

    return successResponse(res, result, 'On-chain funding verified');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const refundTransfer = (req, res) => {
  try {
    assertNoForgedSender(req);
    const { id } = req.params;
    const { reason } = req.body || {};

    const result = remittanceService.requestOrCompleteRefund({
      transferId: id,
      senderUser: req.user,
      reason,
    });

    return successResponse(res, result, result.message);
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const getUserTransfers = (req, res) => {
  try {
    const transfers = remittanceService.listUserTransfers(req.user.id);
    return successResponse(res, transfers, 'Transfers retrieved');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 500);
  }
};

export const getTransferById = (req, res) => {
  try {
    const transfer = remittanceService.getTransferForUser(
      req.params.id,
      req.user.id,
      req.user.role
    );
    return successResponse(res, transfer, 'Transfer details retrieved');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 404);
  }
};

export const handlePayoutWebhook = (req, res) => {
  try {
    const signatureHeader = req.headers['x-webhook-signature'];
    const result = remittanceService.processPayoutWebhook({
      rawBody: JSON.stringify(req.body || {}),
      signatureHeader,
      payload: req.body,
    });
    return successResponse(res, result, 'Webhook processed');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const getWithdrawOptions = async (req, res) => {
  try {
    assertNoForgedSender(req);
    const data = await remittanceService.getWithdrawOptions(req.user);
    return successResponse(res, data, 'Withdrawal options and provider audit retrieved');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const createWithdrawQuote = async (req, res) => {
  try {
    assertNoForgedSender(req);
    const { corridorCode, payoutMethod, sendAmount } = req.body || {};
    const quote = await remittanceService.createWithdrawQuote({
      user: req.user,
      corridorCode,
      payoutMethod,
      sendAmount,
    });
    return successResponse(res, quote, 'Withdrawal quote generated', 201);
  } catch (err) {
    return errorResponse(res, err.message, err.status || 400);
  }
};

export const executeWithdrawal = async (req, res) => {
  try {
    assertNoForgedSender(req);
    const { quoteId, destinationId, rawPhoneNumber, idempotencyKey } = req.body || {};
    const result = await remittanceService.executeWithdrawal({
      user: req.user,
      quoteId,
      destinationId,
      rawPhoneNumber,
      idempotencyKey,
    });
    return successResponse(res, result, 'Withdrawal submitted');
  } catch (err) {
    return errorResponse(res, err.message, err.status || 503);
  }
};
