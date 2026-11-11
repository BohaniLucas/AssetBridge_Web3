import { walletService } from '../services/walletService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export const generateWallet = (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return errorResponse(res, 'userId or email is required', 400);
    }
    const wallet = walletService.generateUserWallet(userId);
    return successResponse(res, wallet, 'Cryptographically verified Tether wallet generated successfully', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return errorResponse(res, 'userId is required', 400);
    }
    const wallet = walletService.getOrCreateWallet(userId);
    if (!wallet) {
      return errorResponse(res, 'Wallet not found', 404);
    }

    return successResponse(res, wallet, 'User wallet retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const transfer = async (req, res) => {
  try {
    const { senderUserId, note, idempotencyKey } = req.body;
    const recipientIdentifier = req.body.recipientIdentifier || req.body.recipientAddressOrUsername || req.body.recipientAddress;
    const amountUsdt = req.body.amountUsdt || req.body.amount;

    if (!senderUserId || !recipientIdentifier || !amountUsdt) {
      return errorResponse(res, 'senderUserId, recipientIdentifier, and amountUsdt are required', 400);
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
    const transactions = walletService.getTransactions(userId);
    return successResponse(res, transactions, 'Transactions retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const depositFaucet = (req, res) => {
  try {
    const { userId, amountUsdt } = req.body;
    if (!userId) {
      return errorResponse(res, 'userId is required', 400);
    }
    const result = walletService.depositFaucet(userId, amountUsdt || 250);
    return successResponse(res, result, 'Testnet Tether faucet funds credited successfully');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const requestPayment = (req, res) => {
  try {
    const { requesterUserId, payerIdentifier, amountUsdt, note } = req.body;
    if (!requesterUserId || !payerIdentifier || !amountUsdt) {
      return errorResponse(res, 'requesterUserId, payerIdentifier, and amountUsdt are required', 400);
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
    const requests = walletService.getPaymentRequests(userId);
    return successResponse(res, requests, 'Payment requests retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const fulfillPaymentRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { payerUserId } = req.body;
    if (!payerUserId) {
      return errorResponse(res, 'payerUserId is required', 400);
    }
    const result = await walletService.fulfillPaymentRequest({ requestId: id, payerUserId });
    return successResponse(res, result, 'Payment request fulfilled and settled');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const createPaymentLink = (req, res) => {
  try {
    const { creatorUserId, amountUsdt, description, expiresInHours } = req.body;
    if (!creatorUserId || !amountUsdt) {
      return errorResponse(res, 'creatorUserId and amountUsdt are required', 400);
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
    const { payerUserId } = req.body;
    if (!payerUserId) return errorResponse(res, 'payerUserId is required', 400);
    const result = await walletService.payPaymentLink({ linkId: id, payerUserId });
    return successResponse(res, result, 'Payment completed via link');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const createSplitPayment = (req, res) => {
  try {
    const { creatorUserId, title, targetAmountUsdt, participantIdentifiers } = req.body;
    if (!creatorUserId || !targetAmountUsdt) {
      return errorResponse(res, 'creatorUserId and targetAmountUsdt are required', 400);
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
    const { contributorUserId, amountUsdt } = req.body;
    if (!contributorUserId) return errorResponse(res, 'contributorUserId is required', 400);
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
    const splits = walletService.getSplitPayments(userId);
    return successResponse(res, splits, 'Split payments retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getNotifications = (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = walletService.getNotifications(userId);
    return successResponse(res, notifications, 'Notifications retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const markNotificationRead = (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
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
