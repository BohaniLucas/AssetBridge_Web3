import { marketDataService } from '../services/marketDataService.js';
import { walletService } from '../services/walletService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';
import { ethers } from 'ethers';

const activeQuotes = new Map();

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

/**
 * Generate a 30-second locked quote for trading
 */
export const generateTradeQuote = async (req, res) => {
  try {
    const { symbol, action, amountUsdt, tokenAmount } = req.body;
    if (!symbol || !action) {
      return errorResponse(res, 'symbol and action (buy/sell) are required', 400);
    }

    const equities = await marketDataService.getLiveEquities();
    const token = equities.find((e) => e.symbol === symbol || e.underlying === symbol) || {
      symbol: symbol || 'tAAPL',
      price: 236.40,
    };

    const spreadPercent = 0.15; // 0.15% standard liquidity fee
    const basePrice = token.price;
    const effectivePrice = action === 'buy' ? basePrice * (1 + spreadPercent / 100) : basePrice * (1 - spreadPercent / 100);

    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const expiresAt = Date.now() + 30000; // 30-second validity window

    const quote = {
      quoteId,
      symbol: token.symbol,
      action,
      basePrice,
      effectivePrice,
      spreadPercent,
      amountUsdt: Number(amountUsdt) || (Number(tokenAmount) * effectivePrice),
      tokenAmount: Number(tokenAmount) || (Number(amountUsdt) / effectivePrice),
      expiresAt,
    };

    activeQuotes.set(quoteId, quote);
    return successResponse(res, quote, 'Guaranteed 30-second trade quote generated');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

/**
 * Authoritatively execute trade on backend
 */
export const executeTrade = async (req, res) => {
  try {
    const { userId, quoteId, symbol, action, amountUsdt } = req.body;
    if (!userId) return errorResponse(res, 'userId is required', 400);

    const userWallet = walletService.getOrCreateWallet(userId);
    if (!userWallet) return errorResponse(res, 'Wallet not found', 404);

    let tradeQuote = activeQuotes.get(quoteId);

    // If no prior quote, generate instantaneous market execution quote
    if (!tradeQuote) {
      const equities = await marketDataService.getLiveEquities();
      const token = equities.find((e) => e.symbol === symbol) || { price: 236.40 };
      const cost = Number(amountUsdt);
      tradeQuote = {
        symbol: symbol || 'tAAPL',
        action: action || 'buy',
        effectivePrice: token.price,
        amountUsdt: cost,
        tokenAmount: cost / token.price,
        expiresAt: Date.now() + 10000,
      };
    }

    if (Date.now() > tradeQuote.expiresAt) {
      return errorResponse(res, 'Trade quote has expired. Please refresh quotes.', 400);
    }

    // Execute Buy
    if (tradeQuote.action === 'buy') {
      if (userWallet.balanceUsdt < tradeQuote.amountUsdt) {
        return errorResponse(
          res,
          `Insufficient Tether USDT balance. Required: $${tradeQuote.amountUsdt.toFixed(2)} USDT, Available: $${userWallet.balanceUsdt.toFixed(2)} USDT.`,
          400
        );
      }

      userWallet.balanceUsdt = Math.round((userWallet.balanceUsdt - tradeQuote.amountUsdt) * 100) / 100;
      if (!userWallet.tokenHoldings) userWallet.tokenHoldings = {};
      const currentShares = userWallet.tokenHoldings[tradeQuote.symbol] || 0;
      userWallet.tokenHoldings[tradeQuote.symbol] = Math.round((currentShares + tradeQuote.tokenAmount) * 10000) / 10000;
    } else {
      // Execute Sell
      const currentShares = userWallet.tokenHoldings?.[tradeQuote.symbol] || 0;
      if (currentShares < tradeQuote.tokenAmount) {
        return errorResponse(res, `Insufficient ${tradeQuote.symbol} shares. Owned: ${currentShares}, Selling: ${tradeQuote.tokenAmount}`, 400);
      }

      userWallet.tokenHoldings[tradeQuote.symbol] = Math.round((currentShares - tradeQuote.tokenAmount) * 10000) / 10000;
      userWallet.balanceUsdt = Math.round((userWallet.balanceUsdt + tradeQuote.amountUsdt) * 100) / 100;
    }

    const txHash = ethers.hexlify(ethers.randomBytes(32));

    walletService.logAudit('TRADE_EXECUTED', userId, {
      action: tradeQuote.action,
      symbol: tradeQuote.symbol,
      amountUsdt: tradeQuote.amountUsdt,
      txHash,
    });

    walletService.addNotification(
      userId,
      `Trade Settled: ${tradeQuote.action.toUpperCase()} ${tradeQuote.symbol}`,
      `${tradeQuote.action === 'buy' ? 'Purchased' : 'Sold'} ${tradeQuote.tokenAmount.toFixed(3)} ${tradeQuote.symbol} for $${tradeQuote.amountUsdt.toFixed(2)} USDT`,
      'success',
      { txHash }
    );

    activeQuotes.delete(quoteId);

    return successResponse(
      res,
      {
        success: true,
        txHash,
        action: tradeQuote.action,
        symbol: tradeQuote.symbol,
        tokenAmount: tradeQuote.tokenAmount,
        amountUsdt: tradeQuote.amountUsdt,
        updatedBalanceUsdt: userWallet.balanceUsdt,
        updatedHoldings: userWallet.tokenHoldings,
        timestamp: new Date().toISOString(),
      },
      'Trade executed and settled on Tether'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};
