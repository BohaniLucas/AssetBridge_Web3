/**
 * WDK Bridge Service
 *
 * Connects the Tether WDK SDK (wallet creation, unlocking, on-chain USDT
 * transfers) to the existing AssetBridge UI via a React Context.
 *
 * Consumers call `useWdkBridge()` to get:
 *   - wdkStatus   ('INITIALIZING' | 'NO_WALLET' | 'LOCKED' | 'READY' | 'ERROR')
 *   - wdkAddress   (on-chain ERC-4337 smart-account address, or null)
 *   - wdkError     (last error message, or null)
 *   - createWallet(id)      → creates a new WDK wallet
 *   - unlockWallet(id)      → unlocks an existing wallet
 *   - sendUsdt({ to, amount })  → sends USDT on Sepolia via WDK
 *   - getBalance()          → reads on-chain USDT balance (if exposed by SDK)
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import {
  useWdkApp,
  useWalletManager,
  useAccount,
  BaseAsset,
} from '@tetherto/wdk-react-native-core';
import {
  SEPOLIA_USDT_CONTRACT,
  SEPOLIA_USDT_DECIMALS,
} from '../config/api';

// ─── USDT Asset Definition ──────────────────────────────────────
const USDT_ASSET = SEPOLIA_USDT_DECIMALS === null
  ? null
  : new BaseAsset({
    id: 'usdt-sepolia',
    network: 'ethereum',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: SEPOLIA_USDT_DECIMALS,
    isNative: false,
    address: SEPOLIA_USDT_CONTRACT || null,
  });

// ─── Context ────────────────────────────────────────────────────
const WdkBridgeContext = createContext(null);

// ─── Provider ───────────────────────────────────────────────────
export function WdkBridgeProvider({ children }) {
  // WDK core state
  const { state } = useWdkApp();
  const {
    wallets,
    activeWalletId,
    restoreWallet: wdkRestore,
    generateMnemonic: wdkGenerateMnemonic,
    unlock: wdkUnlock,
    lock: wdkLock,
  } = useWalletManager();

  // On-chain account (only meaningful when status === 'READY')
  const account = useAccount({ network: 'ethereum', accountIndex: 0 });
  const wdkAddress = account?.address ?? null;
  const wdkSend = account?.send ?? null;
  const wdkGetBalance = account?.getBalance ?? null;

  // ── Wallet lifecycle ──────────────────────────────────────────
  const generateMnemonic = useCallback(async () => {
    try {
      return { success: true, mnemonic: await wdkGenerateMnemonic(12) };
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to prepare a recovery phrase.' };
    }
  }, [wdkGenerateMnemonic]);

  const saveWallet = useCallback(
    async (walletId, mnemonic) => {
      try {
        await wdkRestore(mnemonic, walletId);
        return { success: true };
      } catch (err) {
        return { success: false, error: err?.message || 'Failed to create the WDK wallet.' };
      }
    },
    [wdkRestore],
  );

  const unlockWallet = useCallback(
    async (walletId) => {
      try {
        const id = walletId || activeWalletId;
        if (!id) throw new Error('No wallet ID available to unlock.');
        await wdkUnlock(id);
        return { success: true };
      } catch (err) {
        return { success: false, error: err?.message || 'Failed to unlock WDK wallet.' };
      }
    },
    [wdkUnlock, activeWalletId],
  );

  const lockWallet = useCallback(async () => {
    try {
      await wdkLock();
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to lock the WDK wallet.' };
    }
  }, [wdkLock]);

  const getBalance = useCallback(async () => {
    if (!USDT_ASSET) {
      throw new Error('Configure the Sepolia USDT token decimals before loading its balance.');
    }
    if (!wdkGetBalance || !wdkAddress) {
      throw new Error('Unlock your WDK wallet before loading its on-chain balance.');
    }

    const [result] = await wdkGetBalance([USDT_ASSET]);
    if (!result?.success || result.balance === null) {
      throw new Error(result?.error || 'The Sepolia USDT balance could not be read.');
    }
    if (!/^\d+$/.test(result.balance)) {
      throw new Error('The blockchain returned an invalid USDT balance.');
    }

    return formatTokenBalance(result.balance, SEPOLIA_USDT_DECIMALS);
  }, [wdkGetBalance, wdkAddress]);

  // ── Send USDT on-chain ────────────────────────────────────────
  const sendUsdt = useCallback(
    /**
     * @param {{ to: string, amount: string | number }} params
     *   `amount` is in human-readable USDT (e.g. "1.5" for 1.50 USDT).
     *   Internally converted to the configured token base units.
     */
    async ({ to, amount }) => {
      if (!wdkSend || !USDT_ASSET) {
        return { success: false, error: 'WDK account not ready. Unlock your wallet first.' };
      }
      if (!to || !amount) {
        return { success: false, error: 'Recipient address and amount are required.' };
      }

      try {
        const smallestUnit = parseTokenAmount(amount, SEPOLIA_USDT_DECIMALS);

        const result = await wdkSend({
          to,
          asset: USDT_ASSET,
          amount: smallestUnit,
        });

        if (result?.success) {
          return {
            success: true,
            hash: result.hash || null,
            fee: result.fee || null,
          };
        }
        return {
          success: false,
          error: result?.error || 'On-chain transfer did not succeed.',
        };
      } catch (err) {
        return {
          success: false,
          error: err?.message || 'On-chain USDT transfer failed.',
        };
      }
    },
    [wdkSend],
  );

  // ── Memoized context value ────────────────────────────────────
  const value = useMemo(
    () => ({
      wdkStatus: state?.status || 'INITIALIZING',
      wdkWalletId: state?.walletId || activeWalletId || null,
      wdkWalletIds: wallets.map((wallet) => wallet.identifier),
      wdkError: state?.error?.message || null,
      wdkAddress,
      generateMnemonic,
      saveWallet,
      unlockWallet,
      lockWallet,
      getBalance,
      sendUsdt,
    }),
    [
      state?.status,
      state?.walletId,
      state?.error,
      activeWalletId,
      wallets,
      wdkAddress,
      generateMnemonic,
      saveWallet,
      unlockWallet,
      lockWallet,
      getBalance,
      sendUsdt,
    ],
  );

  return (
    <WdkBridgeContext.Provider value={value}>
      {children}
    </WdkBridgeContext.Provider>
  );
}

function formatTokenBalance(rawBalance, decimals) {
  const raw = BigInt(rawBalance);
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function parseTokenAmount(amount, decimals) {
  const value = String(amount).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new Error('Amount must be a positive decimal number.');
  }

  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places.`);
  }

  const smallestUnit = BigInt(whole) * (10n ** BigInt(decimals))
    + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (smallestUnit <= 0n) {
    throw new Error('Amount must be a positive decimal number.');
  }
  return smallestUnit.toString();
}

// ─── Hook ───────────────────────────────────────────────────────
export function useWdkBridge() {
  const ctx = useContext(WdkBridgeContext);
  if (!ctx) {
    // Return a safe no-op fallback so screens outside the provider don't crash
    return {
      wdkStatus: 'INITIALIZING',
      wdkWalletId: null,
      wdkWalletIds: [],
      wdkError: null,
      wdkAddress: null,
      generateMnemonic: async () => ({ success: false, error: 'WDK provider not mounted.' }),
      saveWallet: async () => ({ success: false, error: 'WDK provider not mounted.' }),
      unlockWallet: async () => ({ success: false, error: 'WDK provider not mounted.' }),
      lockWallet: async () => ({ success: false, error: 'WDK provider not mounted.' }),
      getBalance: async () => { throw new Error('WDK provider not mounted.'); },
      sendUsdt: async () => ({ success: false, error: 'WDK provider not mounted.' }),
    };
  }
  return ctx;
}
