import { walletService } from '../services/walletService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export const generateWallet = (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return errorResponse(res, 'userId or email is required', 400);
    }
    const wallet = walletService.generateUserWallet(userId);
    return successResponse(res, wallet, 'Cryptographically verified Tether wallet generated successfully');
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

    // Refresh live Tether balance
    const liveBalance = await walletService.getTetherBalance(wallet.address);
    wallet.balanceUsdt = liveBalance;

    return successResponse(res, wallet, 'User wallet retrieved');
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
