import { marketService } from '../services/marketService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export const getAssets = (req, res) => {
  try {
    const assets = marketService.getAllAssets();
    return successResponse(res, assets, 'Assets retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getSignedQuote = (req, res) => {
  try {
    const { pair } = req.query;
    if (!pair) {
      return errorResponse(res, 'Pair is required', 400);
    }
    const quote = marketService.getQuote(pair);
    return successResponse(res, quote, 'Signed quote generated');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

