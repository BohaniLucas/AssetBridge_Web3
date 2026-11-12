import { marketDataService } from '../services/marketDataService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export const getForex = async (req, res) => {
  try {
    const forex = await marketDataService.getLiveForexRates();
    return successResponse(res, forex, 'Live forex rates retrieved from open.er-api.com');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getEquities = async (req, res) => {
  try {
    const equities = await marketDataService.getLiveEquities();
    return successResponse(res, equities, 'Live equities retrieved from Finnhub');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getCrypto = async (req, res) => {
  try {
    const crypto = await marketDataService.getLiveCrypto();
    return successResponse(res, crypto, 'Live crypto tickers retrieved from Binance');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getAllMarkets = async (req, res) => {
  try {
    const [forex, equities, crypto] = await Promise.all([
      marketDataService.getLiveForexRates(),
      marketDataService.getLiveEquities(),
      marketDataService.getLiveCrypto(),
    ]);

    return successResponse(
      res,
      {
        forex,
        equities,
        crypto,
        timestamp: new Date().toISOString(),
      },
      'Consolidated live market feeds'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const generateTradeQuote = (req, res) => errorResponse(res, 'Trading is disabled until quotes and settlement are verified by the connected network. No trade was executed.', 503);

export const executeTrade = (req, res) => errorResponse(res, 'Trading is disabled until quotes and settlement are verified by the connected network. No trade was executed.', 503);
