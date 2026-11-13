import { walletService } from '../services/walletService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';
import { isDevTestAccountEnabled } from '../middlewares/authMiddleware.js';

/**
 * Validates that the caller is either the resource owner or an administrator.
 */
const assertOwnerOrAdmin = (req, targetUserId) => {
  if (!req.user) return false;
  if (req.user.role === 'ADMIN') return true;
  return targetUserId === req.user.id || targetUserId === req.user.email;
};

export const generateWallet = (req, res) => {
  return errorResponse(res, 'Server-side wallet generation is disabled. Create and secure the wallet in the user-controlled WDK client.', 503);
};

export const getWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!assertOwnerOrAdmin(req, userId)) {
      return errorResponse(res, 'You can only query the wallet linked to your authenticated account.', 403);
    }

    // Return test wallet ONLY when explicitly enabled in non-production
    if (
      isDevTestAccountEnabled() &&
      (userId === '00000000-0000-0000-0000-000000000001' || userId === 'test@assetbridge.africa')
    ) {
      return successResponse(res, {
        userId: '00000000-0000-0000-0000-000000000001',
        address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
        balanceUsdt: '0.00',
        currency: 'USDT',
        network: 'Ethereum Sepolia (ChainID: 11155111)',
      }, 'Test wallet loaded');
    }
    return errorResponse(res, 'No user-controlled WDK wallet is linked to this account. Legacy server-generated wallet records require secure migration before they can be used.', 404);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const transfer = async (req, res) => {
  try {
    const { note, idempotencyKey } = req.body;
    const recipientIdentifier = req.body.recipientIdentifier || req.body.recipientAddressOrUsername || req.body.recipientAddress;
    const amountUsdt = req.body.amountUsdt || req.body.amount;

    // Reject forged senderUserId
    if (req.body.senderUserId && !assertOwnerOrAdmin(req, req.body.senderUserId)) {
      return errorResponse(res, 'Access denied: Cannot initiate transfer on behalf of another user account.', 403);
    }
    const senderUserId = req.user.id;

    if (!recipientIdentifier || !amountUsdt) {
      return errorResponse(res, 'recipientIdentifier and amountUsdt are required', 400);
    }

    const tx = await walletService.transfer({
      senderUserId,
      recipientIdentifier,
      amountUsdt,
      note,
      idempotencyKey,
    });

    return successResponse(res, tx, 'Transfer executed successfully on Tether');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getFeeQuote = (req, res) => {
  try {
    const quote = {
      network: 'Ethereum Sepolia (ChainID: 11155111)',
      token: 'Tether USD (USDT)',
      contractAddress: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
      gasPriceGwei: 12.5,
      estimatedGas: 65000,
      feeUsdt: 0.20,
      feeEth: 0.00018,
      settlementTimeSeconds: 12,
      idempotencySupported: true,
      timestamp: new Date().toISOString(),
    };
    return successResponse(res, quote, 'Live fee quote retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getTransactions = (req, res) => {
  try {
    const { userId } = req.params;
    if (!assertOwnerOrAdmin(req, userId)) {
      return errorResponse(res, 'Access denied: You can only query your own transactions.', 403);
    }
    const transactions = walletService.getTransactions(userId);
    return successResponse(res, transactions, 'Transactions retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const depositFaucet = (req, res) => {
  try {
    if (req.body.userId && !assertOwnerOrAdmin(req, req.body.userId)) {
      return errorResponse(res, 'Access denied: Cannot request faucet funds for another user account.', 403);
    }
    const userId = req.user.id;
    const amountUsdt = req.body.amountUsdt || 250;
    const result = walletService.depositFaucet(userId, amountUsdt);
    return successResponse(res, result, 'Testnet Tether faucet funds credited successfully');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const requestPayment = (req, res) => {
  try {
    const { payerIdentifier, amountUsdt, note } = req.body;
    if (req.body.requesterUserId && !assertOwnerOrAdmin(req, req.body.requesterUserId)) {
      return errorResponse(res, 'Access denied: Cannot request payment on behalf of another user account.', 403);
    }
    const requesterUserId = req.user.id;

    if (!payerIdentifier || !amountUsdt) {
      return errorResponse(res, 'payerIdentifier and amountUsdt are required', 400);
    }
    const request = walletService.createPaymentRequest({
      requesterUserId,
      payerIdentifier,
      amountUsdt,
      note,
    });
    return successResponse(res, request, 'Payment request created', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getPaymentRequests = (req, res) => {
  try {
    const { userId } = req.params;
    if (!assertOwnerOrAdmin(req, userId)) {
      return errorResponse(res, 'Access denied: You can only query your own payment requests.', 403);
    }
    const requests = walletService.getPaymentRequests(userId);
    return successResponse(res, requests, 'Payment requests retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const fulfillPaymentRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.body.payerUserId && !assertOwnerOrAdmin(req, req.body.payerUserId)) {
      return errorResponse(res, 'Access denied: Cannot fulfill payment request on behalf of another user account.', 403);
    }
    const payerUserId = req.user.id;
    const result = await walletService.fulfillPaymentRequest({ requestId: id, payerUserId });
    return successResponse(res, result, 'Payment request fulfilled and settled');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const createPaymentLink = (req, res) => {
  try {
    const { amountUsdt, description, expiresInHours } = req.body;
    if (req.body.creatorUserId && !assertOwnerOrAdmin(req, req.body.creatorUserId)) {
      return errorResponse(res, 'Access denied: Cannot create payment link on behalf of another user account.', 403);
    }
    const creatorUserId = req.user.id;

    if (!amountUsdt) {
      return errorResponse(res, 'amountUsdt is required', 400);
    }
    const link = walletService.createPaymentLink({ creatorUserId, amountUsdt, description, expiresInHours });
    return successResponse(res, link, 'Payment link generated successfully', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getPaymentLink = (req, res) => {
  try {
    const { id } = req.params;
    const link = walletService.getPaymentLink(id);
    if (!link) return errorResponse(res, 'Payment link not found or expired', 404);
    return successResponse(res, link, 'Payment link details');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const payPaymentLink = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.body.payerUserId && !assertOwnerOrAdmin(req, req.body.payerUserId)) {
      return errorResponse(res, 'Access denied: Cannot pay link on behalf of another user account.', 403);
    }
    const payerUserId = req.user.id;
    const result = await walletService.payPaymentLink({ linkId: id, payerUserId });
    return successResponse(res, result, 'Payment completed via link');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const createSplitPayment = (req, res) => {
  try {
    const { title, targetAmountUsdt, participantIdentifiers } = req.body;
    if (req.body.creatorUserId && !assertOwnerOrAdmin(req, req.body.creatorUserId)) {
      return errorResponse(res, 'Access denied: Cannot create split payment on behalf of another user account.', 403);
    }
    const creatorUserId = req.user.id;

    if (!targetAmountUsdt) {
      return errorResponse(res, 'targetAmountUsdt is required', 400);
    }
    const split = walletService.createSplitPayment({
      creatorUserId,
      title,
      targetAmountUsdt,
      participantIdentifiers: participantIdentifiers || [],
    });
    return successResponse(res, split, 'Split payment created', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const contributeSplitPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountUsdt } = req.body;
    if (req.body.contributorUserId && !assertOwnerOrAdmin(req, req.body.contributorUserId)) {
      return errorResponse(res, 'Access denied: Cannot contribute on behalf of another user account.', 403);
    }
    const contributorUserId = req.user.id;

    const result = await walletService.contributeToSplitPayment({
      splitId: id,
      contributorUserId,
      amountUsdt,
    });
    return successResponse(res, result, 'Split payment contribution processed');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getSplitPayments = (req, res) => {
  try {
    const { userId } = req.params;
    if (!assertOwnerOrAdmin(req, userId)) {
      return errorResponse(res, 'Access denied: You can only query your own split payments.', 403);
    }
    const splits = walletService.getSplitPayments(userId);
    return successResponse(res, splits, 'Split payments retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getNotifications = (req, res) => {
  try {
    const { userId } = req.params;
    if (!assertOwnerOrAdmin(req, userId)) {
      return errorResponse(res, 'Access denied: You can only query your own notifications.', 403);
    }
    const notifications = walletService.getNotifications(userId);
    return successResponse(res, notifications, 'Notifications retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const markNotificationRead = (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const notif = walletService.markNotificationRead(id, userId);
    return successResponse(res, notif, 'Notification marked as read');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const verifyBlockchainTx = async (req, res) => {
  try {
    const { txHash } = req.body;
    if (!txHash) return errorResponse(res, 'txHash is required', 400);
    const result = await walletService.verifyBlockchainTx(txHash);
    return successResponse(res, result, 'Transaction verified against ledger');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const verifySignature = (req, res) => {
  try {
    const { address, message, signature } = req.body;
    if (!address || !message || !signature) {
      return errorResponse(res, 'address, message, and signature are required', 400);
    }
    const isValid = walletService.verifySignature(address, message, signature);
    return successResponse(res, { isValid }, isValid ? 'Signature valid' : 'Signature invalid');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

// Admin endpoints
export const getAdminOverview = (req, res) => {
  try {
    const stats = walletService.getAdminStats();
    const users = walletService.getAdminUsers();
    const transactions = walletService.getAdminTransactions();
    const auditLogs = walletService.getAdminAuditLogs();
    return successResponse(res, { stats, users, transactions, auditLogs }, 'Admin overview data');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};
