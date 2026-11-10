import { remittanceService } from '../services/remittanceService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export const getDestinations = (req, res) => {
  try {
    const destinations = remittanceService.getAllDestinations();
    return successResponse(res, destinations, 'Destinations retrieved successfully');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getQuote = (req, res) => {
  try {
    const { amount = 100, targetCurrency = 'tKES' } = req.query;
    const quote = remittanceService.calculateTransferQuote(Number(amount), targetCurrency);
    return successResponse(res, quote, 'Remittance quote generated');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const sendRemittance = (req, res) => {
  try {
    const { sendAmount, targetCurrency, recipient, senderUsername } = req.body;
    if (!sendAmount || !targetCurrency) {
      return errorResponse(res, 'sendAmount and targetCurrency are required', 400);
    }
    const transfer = remittanceService.executeTransfer({
      sendAmount,
      targetCurrency,
      recipient,
      senderUsername
    });
    return successResponse(res, transfer, 'Transfer settled successfully on testnet');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};
