/**
 * Administration Controller
 * Authoritative administrative endpoints protected by requireAdmin middleware.
 */

import { walletService } from '../services/walletService.js';
import { userService } from '../services/userService.js';
import { potService } from '../services/potService.js';
import { marketService } from '../services/marketService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

let circuitBreakerState = {
  isEquitiesPaused: false,
  updatedBy: 'system',
  updatedAt: new Date().toISOString(),
};

export const getAdminOverview = async (req, res) => {
  try {
    const data = walletService.getAdminOverview();
    return successResponse(res, {
      ...data,
      circuitBreaker: circuitBreakerState,
    }, 'Admin overview data loaded');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const users = userService.getAllUsers();
    // Merge with wallet balances
    const wallets = walletService.readWallets();
    const enriched = users.map((u) => {
      const w = wallets[u.email] || {};
      return {
        ...u,
        address: w.address || '—',
        balanceUsdt: w.balanceUsdt || 0,
        network: w.network || 'Sepolia',
      };
    });
    return successResponse(res, enriched, 'Admin users retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { email } = req.params;
    const { status } = req.body; // 'active' | 'suspended'

    if (!['active', 'suspended'].includes(status)) {
      return errorResponse(res, 'Invalid status. Must be active or suspended.', 400);
    }

    const updated = userService.updateUserStatus(email, status);
    walletService.recordAuditLog('ADMIN_USER_STATUS_CHANGE', req.user.email, {
      targetEmail: email,
      newStatus: status,
    });

    return successResponse(res, updated, `User ${email} status updated to ${status}`);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
};

export const getAdminTransactions = async (req, res) => {
  try {
    const transactions = walletService.readTransactions();
    return successResponse(res, transactions, 'Admin transaction ledger loaded');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getAdminAuditLogs = async (req, res) => {
  try {
    const logs = walletService.readAuditLogs();
    return successResponse(res, logs, 'Security audit logs loaded');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getAdminStokvels = async (req, res) => {
  try {
    const pots = potService.getAllPots();
    return successResponse(res, pots, 'Stokvel pots retrieved for admin inspection');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const toggleCircuitBreaker = async (req, res) => {
  try {
    const { isPaused, reason } = req.body;
    circuitBreakerState = {
      isEquitiesPaused: Boolean(isPaused),
      reason: reason || (isPaused ? 'Administrative safety freeze' : 'Normal trading restored'),
      updatedBy: req.user.email,
      updatedAt: new Date().toISOString(),
    };

    walletService.recordAuditLog('CIRCUIT_BREAKER_TOGGLED', req.user.email, {
      isEquitiesPaused: circuitBreakerState.isEquitiesPaused,
      reason: circuitBreakerState.reason,
    });

    return successResponse(res, circuitBreakerState, 'Market circuit breaker status updated');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

export const getAdminSettings = async (req, res) => {
  try {
    const settings = {
      network: 'Ethereum Sepolia Testnet',
      chainId: 11155111,
      tetherContract: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
      tokenisedAppleContract: '0x2f3A40A3db8a7e3D09B0adfEfbCe4f67d904297B',
      oracleProvider: 'Finnhub & open.er-api.com',
      systemHealth: 'OPERATIONAL_100%',
      p2pFeeUsdt: 0.20,
      stokvelProtocolFee: 0.00,
      adminEmails: ['admin@assetbridge.africa', 'security@assetbridge.africa'],
    };
    return successResponse(res, settings, 'Admin system settings loaded');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
};

