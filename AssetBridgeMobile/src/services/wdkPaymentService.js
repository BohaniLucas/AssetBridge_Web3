import {
  WDK_NETWORK_NAME,
  WDK_SEPOLIA_CHAIN_ID,
  WDK_SEPOLIA_NETWORK_LABEL,
  WDK_SEPOLIA_ETH_DECIMALS,
  WDK_SEPOLIA_USDT_ADDRESS,
  WDK_SEPOLIA_USDT_DECIMALS,
  WDK_FEE_ASSET_LABEL,
  WDK_FEE_ASSET_DECIMALS,
  MAX_FEE_DRIFT_BPS,
  FEE_QUOTE_MAX_AGE_MS,
  USE_TOKEN_PAYMASTER,
  OFFLINE_SIGNING_ENABLED,
  OFFLINE_SIGNING_DISABLED_REASON,
  isValidPersonalEvmRecipient,
  assertSupportedWdkConfig,
} from '../config/wdkConstants.js';

const PAYMENT_RECORD_PREFIX = 'assetbridge_wdk_payment_v1_';
const JOURNAL_INDEX_PREFIX = 'assetbridge_wdk_journal_idx_v1_';
const OFFLINE_DRAFTS_PREFIX = 'assetbridge_wdk_drafts_v1_';
const WALLET_SNAPSHOT_PREFIX = 'assetbridge_wdk_snapshot_v1_';

// Drop/timeout threshold (5 minutes) if bundler reports NoSuchElementError after submission
const BUNDLER_DROP_TIMEOUT_MS = 5 * 60 * 1000;

// In-memory lock to block concurrent taps for the same requestId before async storage resolves
const inFlightRequests = new Set();

let customStorageAdapter = null;
let expoSecureStorePromise = null;

/**
 * Allows Node test suites to inject a deterministic storage adapter while
 * defaulting to expo-secure-store on React Native devices.
 */
export function setPaymentStorageAdapter(adapter) {
  customStorageAdapter = adapter;
}

async function getStorage() {
  if (customStorageAdapter) return customStorageAdapter;
  if (!expoSecureStorePromise) {
    expoSecureStorePromise = import('expo-secure-store');
  }
  return expoSecureStorePromise;
}

function sanitizeKeyPart(value) {
  return String(value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .slice(0, 64);
}

function recordKeyFor(requestId) {
  return `${PAYMENT_RECORD_PREFIX}${sanitizeKeyPart(requestId)}`;
}

function journalIndexKeyFor(scopeKey = 'default') {
  return `${JOURNAL_INDEX_PREFIX}${sanitizeKeyPart(scopeKey)}`;
}

function draftsKeyFor(scopeKey = 'default') {
  return `${OFFLINE_DRAFTS_PREFIX}${sanitizeKeyPart(scopeKey)}`;
}

function walletSnapshotKeyFor(scopeKey = 'default') {
  return `${WALLET_SNAPSHOT_PREFIX}${sanitizeKeyPart(scopeKey)}`;
}

export function createPaymentRequestId() {
  return `wdkpay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDraftId() {
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function isRequestInFlight(requestId) {
  return inFlightRequests.has(String(requestId || '').trim());
}

export function parseTokenUnits(
  value,
  decimals = WDK_SEPOLIA_USDT_DECIMALS,
  label = 'Amount'
) {
  const clean = String(value ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) {
    throw new Error(`${label} must be a positive number.`);
  }

  const [whole, fraction = ''] = clean.split('.');
  if (fraction.length > decimals) {
    throw new Error(`${label} supports at most ${decimals} decimal places.`);
  }

  const baseUnits = BigInt(`${whole}${fraction.padEnd(decimals, '0')}`);
  if (baseUnits <= 0n) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return baseUnits.toString();
}

export function formatTokenUnits(
  baseUnits,
  decimals = WDK_SEPOLIA_USDT_DECIMALS,
  maxFractionDigits = decimals
) {
  if (baseUnits === null || baseUnits === undefined || baseUnits === '') {
    return null;
  }

  const raw = BigInt(baseUnits);
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const padded = abs.toString().padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals) || '0';
  const fullFraction = padded.slice(padded.length - decimals);
  const clippedFraction = fullFraction.slice(0, maxFractionDigits).replace(/0+$/, '');
  const formatted = clippedFraction ? `${whole}.${clippedFraction}` : whole;
  return negative ? `-${formatted}` : formatted;
}

/**
 * Human-readable status metadata and next safe action for every payment state.
 */
export function getPaymentStatusPresentation(record) {
  const status = record?.status || 'unknown';
  switch (status) {
    case 'draft':
      return {
        badge: 'Draft — not sent',
        tone: 'amber',
        headline: 'Saved offline draft — not broadcast to blockchain',
        detail:
          'No funds have moved and the recipient has not been paid. Reconnect to the internet to fetch a live Sepolia fee quote, review, and approve.',
        nextSafeAction: 'Review & Send when online',
        canCheckStatus: false,
        canRetryAsNew: false,
      };
    case 'approved':
      return {
        badge: 'Approved',
        tone: 'blue',
        headline: 'Approved — preparing UserOperation',
        detail: 'Payment intent recorded locally before bundler submission.',
        nextSafeAction: 'Wait for submission',
        canCheckStatus: false,
        canRetryAsNew: false,
      };
    case 'submitting':
      return {
        badge: 'Submitting',
        tone: 'blue',
        headline: 'Submitting UserOperation to Sepolia bundler',
        detail: 'Do not close the app or create a duplicate transfer while submission is in flight.',
        nextSafeAction: 'Wait for bundler response',
        canCheckStatus: false,
        canRetryAsNew: false,
      };
    case 'submitted':
    case 'pending':
      return {
        badge: 'Pending confirmation',
        tone: 'amber',
        headline: 'Submitted to bundler — awaiting Sepolia block confirmation',
        detail:
          'The UserOperation hash is recorded, but final on-chain execution is not confirmed yet. Receiver must wait for blockchain confirmation.',
        nextSafeAction: 'Check status',
        canCheckStatus: true,
        canRetryAsNew: false,
      };
    case 'successful':
      return {
        badge: 'Successful',
        tone: 'green',
        headline: 'Confirmed on Ethereum Sepolia (Testnet)',
        detail: 'Verified on-chain execution receipt received.',
        nextSafeAction: 'Done',
        canCheckStatus: false,
        canRetryAsNew: false,
      };
    case 'failed':
      return {
        badge: 'Failed',
        tone: 'red',
        headline: 'Transaction failed or reverted on-chain',
        detail:
          record?.error ||
          'The UserOperation was rejected or reverted during execution. You may safely review a new payment.',
        nextSafeAction: 'Review a new payment',
        canCheckStatus: false,
        canRetryAsNew: true,
      };
    case 'dropped':
      return {
        badge: 'Dropped / replaced',
        tone: 'red',
        headline: 'UserOperation dropped or replaced from bundler mempool',
        detail:
          record?.error ||
          'The bundler no longer tracks this UserOperation hash. Verify your balance before creating a new payment.',
        nextSafeAction: 'Review a new payment',
        canCheckStatus: true,
        canRetryAsNew: true,
      };
    case 'expired':
      return {
        badge: 'Expired',
        tone: 'red',
        headline: 'Payment request or fee quote expired',
        detail:
          record?.error ||
          'This payment request or fee quote is no longer valid. No funds were sent.',
        nextSafeAction: 'Request a fresh quote',
        canCheckStatus: false,
        canRetryAsNew: true,
      };
    case 'outcome-unknown':
    default:
      return {
        badge: 'Outcome unknown',
        tone: 'red',
        headline: 'Outcome unknown — do not retry',
        detail:
          record?.error ||
          'Submission was interrupted before a UserOperation hash could be confirmed. Do not send again automatically; refresh your wallet balance and activity first.',
        nextSafeAction: 'Refresh balance & check activity (Do not retry blindly)',
        canCheckStatus: Boolean(record?.userOperationHash),
        canRetryAsNew: false,
      };
  }
}

export async function loadSavedPaymentRecord(requestId) {
  if (!requestId) return null;
  try {
    const storage = await getStorage();
    const raw = await storage.getItemAsync(recordKeyFor(requestId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function addRequestIdToJournalIndex(requestId, scopeKey = 'default') {
  if (!requestId) return;
  try {
    const storage = await getStorage();
    const indexKey = journalIndexKeyFor(scopeKey);
    const raw = await storage.getItemAsync(indexKey);
    const list = raw ? JSON.parse(raw) : [];
    const normalized = Array.isArray(list) ? list : [];
    const filtered = normalized.filter((id) => id !== requestId);
    filtered.unshift(requestId);
    // Keep most recent 50 request IDs in index
    await storage.setItemAsync(indexKey, JSON.stringify(filtered.slice(0, 50)));
  } catch {
    // Best-effort index update
  }
}

export async function savePaymentRecord(requestId, record, scopeKey = 'default') {
  if (!requestId) return record;
  const storage = await getStorage();
  const payload = {
    ...record,
    requestId,
    scopeKey: scopeKey || record?.scopeKey || 'default',
    updatedAt: new Date().toISOString(),
  };
  await storage.setItemAsync(recordKeyFor(requestId), JSON.stringify(payload));
  await addRequestIdToJournalIndex(requestId, payload.scopeKey);
  return payload;
}

/**
 * Loads all durable payment journal entries for the given user/wallet scope.
 * Automatically reconciles any crashed `'submitting'` or `'approved'` entry that lacks
 * a `userOperationHash` and is not currently in-flight in memory into `'outcome-unknown'`.
 */
export async function listPaymentJournal(scopeKey = 'default') {
  try {
    const storage = await getStorage();
    const rawIndex = await storage.getItemAsync(journalIndexKeyFor(scopeKey));
    const ids = rawIndex ? JSON.parse(rawIndex) : [];
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const records = [];
    for (const id of ids) {
      let rec = await loadSavedPaymentRecord(id);
      if (!rec) continue;

      // Crash/restart safety: if a previous app session crashed while status was 'submitting'
      // without recording a userOperationHash, transition it to 'outcome-unknown' so the user
      // is warned not to retry blindly.
      if (
        (rec.status === 'submitting' || rec.status === 'approved') &&
        !rec.userOperationHash &&
        !inFlightRequests.has(id)
      ) {
        rec = await savePaymentRecord(
          id,
          {
            ...rec,
            status: 'outcome-unknown',
            pending: false,
            confirmed: false,
            error:
              rec.error ||
              'App restarted or connection dropped while submission was in flight. Outcome unknown — do not retry until you check your wallet balance and activity.',
            lastCheckedAt: new Date().toISOString(),
          },
          scopeKey
        );
      }
      records.push(rec);
    }
    return records;
  } catch {
    return [];
  }
}

/**
 * Estimates the ERC-4337 network fee for a Sepolia USDT transfer.
 * Fails closed if the recipient, chain ID, token contract, or decimals are invalid.
 */
export async function estimateUsdtTransferFee({
  account,
  to,
  amountUsdt,
  asset,
  chainId = WDK_SEPOLIA_CHAIN_ID,
  network = WDK_NETWORK_NAME,
  tokenAddress = asset?.getContractAddress?.() || WDK_SEPOLIA_USDT_ADDRESS,
  decimals = WDK_SEPOLIA_USDT_DECIMALS,
}) {
  assertSupportedWdkConfig({ chainId, network, tokenAddress, decimals });

  const trimmedRecipient = String(to || '').trim();
  if (!isValidPersonalEvmRecipient(trimmedRecipient)) {
    throw new Error(
      'Invalid recipient address. Enter a valid 0x personal wallet address (never the USDT token contract or zero address).'
    );
  }

  if (!account?.account) {
    throw new Error('Unlock your WDK wallet before estimating network fees.');
  }

  const amountBaseUnits = parseTokenUnits(amountUsdt, decimals, 'USDT amount');
  const estimate = await account.estimateFee({
    to: trimmedRecipient,
    asset,
    amount: amountBaseUnits,
  });

  if (!estimate?.success) {
    throw new Error(estimate?.error || 'Could not estimate the Sepolia network fee.');
  }

  const feeBaseUnits = String(estimate.fee ?? '0');
  return {
    amountUsdt: formatTokenUnits(amountBaseUnits, decimals, decimals),
    amountBaseUnits,
    feeBaseUnits,
    feeEth: formatTokenUnits(feeBaseUnits, WDK_FEE_ASSET_DECIMALS, 8) || '0',
    feeAsset: WDK_FEE_ASSET_LABEL,
    feeAssetDecimals: WDK_FEE_ASSET_DECIMALS,
    chainId: WDK_SEPOLIA_CHAIN_ID,
    networkName: WDK_SEPOLIA_NETWORK_LABEL,
    tokenAddress: WDK_SEPOLIA_USDT_ADDRESS,
    tokenSymbol: 'USDT',
    tokenDecimals: WDK_SEPOLIA_USDT_DECIMALS,
    quotedAt: new Date().toISOString(),
  };
}

/**
 * Rechecks live on-chain balance and live bundler fee immediately before submitting.
 * Stops and requires a new review if:
 * - the reviewed fee quote is missing or expired (> 2 minutes old)
 * - live balance or fee cannot be fetched (e.g. device went offline)
 * - live USDT balance is less than the transfer amount
 * - live Sepolia ETH balance is less than the live fee (in native gas mode)
 * - live fee increased by more than MAX_FEE_DRIFT_BPS (15%) above the reviewed fee quote
 */
export async function recheckLiveBalanceAndFeeBeforeSend({
  account,
  to,
  amountUsdt,
  usdtAsset,
  ethAsset,
  reviewedFeeQuote,
}) {
  if (!reviewedFeeQuote || !reviewedFeeQuote.feeBaseUnits || !reviewedFeeQuote.quotedAt) {
    return {
      ok: false,
      code: 'MISSING_FEE_QUOTE',
      requiresNewReview: true,
      message: 'A live Sepolia network fee quote is required before approving this transfer.',
    };
  }

  const quoteAgeMs = Date.now() - Date.parse(reviewedFeeQuote.quotedAt);
  if (!Number.isFinite(quoteAgeMs) || quoteAgeMs > FEE_QUOTE_MAX_AGE_MS) {
    return {
      ok: false,
      code: 'STALE_FEE_QUOTE',
      requiresNewReview: true,
      message:
        'Your reviewed fee quote has expired (older than 2 minutes). Please review the updated network fee before sending.',
    };
  }

  const amountBaseUnits = BigInt(
    parseTokenUnits(amountUsdt, WDK_SEPOLIA_USDT_DECIMALS, 'USDT amount')
  );

  let liveBalances;
  try {
    const assetsToQuery = [usdtAsset, ethAsset].filter(Boolean);
    liveBalances = await account.getBalance(assetsToQuery);
  } catch (err) {
    return {
      ok: false,
      code: 'LIVE_BALANCE_UNAVAILABLE',
      requiresNewReview: true,
      message: `Unable to verify live Sepolia balance before sending (${err?.message || 'network error'}). Transfer was not submitted.`,
    };
  }

  if (!Array.isArray(liveBalances) || liveBalances.length === 0) {
    return {
      ok: false,
      code: 'LIVE_BALANCE_UNAVAILABLE',
      requiresNewReview: true,
      message: 'Live balance check returned no data. Transfer was not submitted.',
    };
  }

  const usdtResult = liveBalances.find((b) => b.assetId === 'usdt' || b.assetId === usdtAsset?.getId?.());
  if (!usdtResult || !usdtResult.success || usdtResult.balance == null) {
    return {
      ok: false,
      code: 'LIVE_USDT_BALANCE_UNAVAILABLE',
      requiresNewReview: true,
      message: `Unable to verify live Sepolia USDT balance (${usdtResult?.error || 'RPC unavailable'}). Transfer was not submitted.`,
    };
  }

  const liveUsdtBaseUnits = BigInt(usdtResult.balance);
  if (liveUsdtBaseUnits < amountBaseUnits) {
    const formattedLive = formatTokenUnits(liveUsdtBaseUnits.toString(), WDK_SEPOLIA_USDT_DECIMALS, 2);
    return {
      ok: false,
      code: 'INSUFFICIENT_USDT_BALANCE',
      requiresNewReview: true,
      message: `Insufficient live Sepolia USDT balance ($${formattedLive} USDT available, $${amountUsdt} USDT required). Transfer was not submitted.`,
    };
  }

  let freshFeeQuote;
  try {
    freshFeeQuote = await estimateUsdtTransferFee({
      account,
      to,
      amountUsdt,
      asset: usdtAsset,
    });
  } catch (err) {
    return {
      ok: false,
      code: 'LIVE_FEE_UNAVAILABLE',
      requiresNewReview: true,
      message: `Unable to re-verify live Sepolia network fee before sending (${err?.message || 'bundler unreachable'}). Transfer was not submitted.`,
    };
  }

  const approvedFee = BigInt(reviewedFeeQuote.feeBaseUnits);
  const liveFee = BigInt(freshFeeQuote.feeBaseUnits);
  const maxAllowedFee =
    approvedFee === 0n ? 0n : (approvedFee * (10000n + MAX_FEE_DRIFT_BPS)) / 10000n;

  if (liveFee > maxAllowedFee) {
    return {
      ok: false,
      code: 'FEE_CHANGED_BEYOND_LIMIT',
      requiresNewReview: true,
      freshFeeQuote,
      message: `Sepolia network fee increased from ${reviewedFeeQuote.feeEth} to ${freshFeeQuote.feeEth} ${WDK_FEE_ASSET_LABEL} (exceeds 15% approval limit). Please review and approve the new fee before sending.`,
    };
  }

  if (!USE_TOKEN_PAYMASTER && ethAsset) {
    const ethResult = liveBalances.find((b) => b.assetId === 'eth' || b.assetId === ethAsset?.getId?.());
    if (!ethResult || !ethResult.success || ethResult.balance == null) {
      return {
        ok: false,
        code: 'LIVE_ETH_BALANCE_UNAVAILABLE',
        requiresNewReview: true,
        freshFeeQuote,
        message: 'Unable to verify live Sepolia ETH balance for gas fees. Transfer was not submitted.',
      };
    }
    const liveEthWei = BigInt(ethResult.balance);
    if (liveEthWei < liveFee) {
      const formattedEth = formatTokenUnits(liveEthWei.toString(), WDK_SEPOLIA_ETH_DECIMALS, 6);
      return {
        ok: false,
        code: 'INSUFFICIENT_ETH_FOR_FEE',
        requiresNewReview: true,
        freshFeeQuote,
        message: `Insufficient Sepolia ETH for network fee (${formattedEth} Sepolia ETH available, ${freshFeeQuote.feeEth} Sepolia ETH required).`,
      };
    }
  }

  return {
    ok: true,
    freshFeeQuote,
    liveUsdtBalance: formatTokenUnits(liveUsdtBaseUnits.toString(), WDK_SEPOLIA_USDT_DECIMALS, 2),
  };
}

/**
 * Queries the ERC-4337 UserOperation status & receipt via the documented WDK extension methods
 * (`getTransaction` and `getUserOperationReceipt` in @tetherto/wdk-wallet-evm-erc-4337@1.0.0-beta.25).
 *
 * Strictly separates `userOperationHash` from `transactionHash`:
 * - `userOperationHash` is the bundler UserOperation identifier.
 * - `transactionHash` is ONLY populated from an actual mined Ethereum block receipt.
 */
export async function checkUsdtTransferReceipt({
  account,
  userOperationHash,
  savedRecord = null,
}) {
  if (!userOperationHash) {
    return {
      confirmed: false,
      pending: false,
      status: 'outcome-unknown',
      userOperationHash: null,
      transactionHash: null,
      receipt: null,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  const nowIso = new Date().toISOString();
  const extension = account?.extension ? account.extension() : null;
  if (!extension) {
    return {
      confirmed: false,
      pending: true,
      status: 'pending',
      userOperationHash,
      transactionHash: savedRecord?.transactionHash || null,
      receipt: null,
      lastCheckedAt: nowIso,
    };
  }

  let txInfo = null;
  let txInfoError = null;

  if (typeof extension.getTransaction === 'function') {
    try {
      txInfo = await extension.getTransaction(userOperationHash);
    } catch (err) {
      txInfoError = err;
    }
  }

  let userOpReceipt = null;
  if (typeof extension.getUserOperationReceipt === 'function') {
    try {
      userOpReceipt = await extension.getUserOperationReceipt(userOperationHash);
    } catch {
      userOpReceipt = null;
    }
  }

  // Extract genuine Ethereum on-chain transactionHash (NEVER fall back to userOperationHash!)
  const minedTxHash =
    userOpReceipt?.receipt?.transactionHash ||
    userOpReceipt?.receipt?.hash ||
    txInfo?.receipt?.transactionHash ||
    txInfo?.receipt?.hash ||
    null;

  const actualFeeWei =
    userOpReceipt?.actualGasCost != null
      ? String(userOpReceipt.actualGasCost)
      : txInfo?.fee != null
      ? String(txInfo.fee)
      : savedRecord?.feeBaseUnits || null;

  // Case 1: UserOperationReceipt is available from bundler
  if (userOpReceipt) {
    const isSuccess = Boolean(userOpReceipt.success);
    return {
      confirmed: isSuccess,
      pending: false,
      status: isSuccess ? 'successful' : 'failed',
      userOperationHash,
      transactionHash: minedTxHash,
      confirmations: txInfo?.confirmations ?? (minedTxHash ? 1 : 0),
      feeBaseUnits: actualFeeWei,
      feeEth: actualFeeWei
        ? formatTokenUnits(actualFeeWei, WDK_FEE_ASSET_DECIMALS, 8)
        : savedRecord?.feeEth || null,
      receipt: userOpReceipt,
      error: isSuccess
        ? null
        : 'The UserOperation was included in a block but reverted during execution.',
      lastCheckedAt: nowIso,
    };
  }

  // Case 2: Normalized getTransaction result is available
  if (txInfo) {
    if (txInfo.finality === 'dropped') {
      return {
        confirmed: false,
        pending: false,
        status: 'dropped',
        userOperationHash,
        transactionHash: null,
        confirmations: 0,
        receipt: null,
        error: 'The UserOperation was dropped or replaced from the bundler mempool.',
        lastCheckedAt: nowIso,
      };
    }

    if (minedTxHash && txInfo.receipt) {
      const receiptStatus = txInfo.receipt.status;
      const isReverted = receiptStatus === 0 || receiptStatus === '0x0' || txInfo.success === false;
      const isConfirmed = !isReverted && (txInfo.success === true || receiptStatus === 1 || receiptStatus === '0x1');
      return {
        confirmed: isConfirmed,
        pending: !isConfirmed && !isReverted,
        status: isReverted ? 'failed' : isConfirmed ? 'successful' : 'pending',
        userOperationHash,
        transactionHash: minedTxHash,
        confirmations: txInfo.confirmations ?? 1,
        feeBaseUnits: actualFeeWei,
        feeEth: actualFeeWei
          ? formatTokenUnits(actualFeeWei, WDK_FEE_ASSET_DECIMALS, 8)
          : savedRecord?.feeEth || null,
        receipt: txInfo,
        error: isReverted ? 'Transaction reverted on-chain.' : null,
        lastCheckedAt: nowIso,
      };
    }

    return {
      confirmed: false,
      pending: true,
      status: 'pending',
      userOperationHash,
      transactionHash: null,
      confirmations: txInfo.confirmations ?? 0,
      receipt: null,
      lastCheckedAt: nowIso,
    };
  }

  // Case 3: Bundler threw NoSuchElementError (not found by hash)
  if (txInfoError) {
    const errMsg = String(txInfoError?.message || '');
    const isNoSuchElement =
      txInfoError?.name === 'NoSuchElementError' ||
      /No user operation found/i.test(errMsg);

    if (isNoSuchElement && savedRecord?.submittedAt) {
      const elapsedMs = Date.now() - Date.parse(savedRecord.submittedAt);
      if (Number.isFinite(elapsedMs) && elapsedMs > BUNDLER_DROP_TIMEOUT_MS) {
        return {
          confirmed: false,
          pending: false,
          status: 'dropped',
          userOperationHash,
          transactionHash: null,
          receipt: null,
          error:
            'Bundler no longer reports this UserOperation hash after 5 minutes (dropped or replaced). Check your wallet balance before creating a new transfer.',
          lastCheckedAt: nowIso,
        };
      }
    }
  }

  return {
    confirmed: false,
    pending: true,
    status: 'pending',
    userOperationHash,
    transactionHash: savedRecord?.transactionHash || null,
    receipt: null,
    lastCheckedAt: nowIso,
  };
}

/**
 * Submits or reconciles an ERC-4337 Sepolia USDT transfer with strict idempotency,
 * concurrent-tap locking, pre-submission intent persistence, live balance/fee recheck,
 * and strict separation between `userOperationHash` and `transactionHash`.
 */
export async function submitOrCheckUsdtTransfer({
  requestId,
  account,
  to,
  amountUsdt,
  asset,
  ethAsset = null,
  reviewedFeeQuote = null,
  skipPreSendRecheck = false,
  scopeKey = 'default',
  note = '',
  expiresAt = null,
  chainId = WDK_SEPOLIA_CHAIN_ID,
  network = WDK_NETWORK_NAME,
  tokenAddress = asset?.getContractAddress?.() || WDK_SEPOLIA_USDT_ADDRESS,
  decimals = WDK_SEPOLIA_USDT_DECIMALS,
}) {
  if (!requestId || typeof requestId !== 'string') {
    throw new Error('A durable payment request ID is required before sending.');
  }

  const normalizedRequestId = requestId.trim();

  // 1. Fail closed on unsupported chain, network, token contract, or decimals
  assertSupportedWdkConfig({ chainId, network, tokenAddress, decimals });

  // 2. Concurrent tap guard: block overlapping calls for the same requestId immediately
  if (inFlightRequests.has(normalizedRequestId)) {
    const existing = await loadSavedPaymentRecord(normalizedRequestId);
    return (
      existing || {
        requestId: normalizedRequestId,
        status: 'submitting',
        pending: true,
        confirmed: false,
        userOperationHash: null,
        transactionHash: null,
        error: 'This transfer is already submitting. Please wait.',
      }
    );
  }

  inFlightRequests.add(normalizedRequestId);

  try {
    const saved = await loadSavedPaymentRecord(normalizedRequestId);

    // 3. If a record already exists for this requestId, NEVER send a second time!
    if (saved) {
      // Immutable parameter integrity check: reject attempts to reuse requestId with different recipient/amount
      const cleanRecipient = String(to || saved.recipient || '').trim();
      const amountBaseUnits = amountUsdt
        ? parseTokenUnits(amountUsdt, decimals, 'USDT amount')
        : saved.amountBaseUnits;

      if (
        (saved.recipient &&
          cleanRecipient &&
          saved.recipient.toLowerCase() !== cleanRecipient.toLowerCase()) ||
        (saved.amountBaseUnits &&
          amountBaseUnits &&
          String(saved.amountBaseUnits) !== String(amountBaseUnits))
      ) {
        throw new Error(
          'Payment request ID conflict: This request ID is already bound to different payment parameters.'
        );
      }

      if (saved.status === 'successful' || saved.status === 'failed' || saved.status === 'expired') {
        return saved;
      }

      // If previous attempt crashed during 'submitting' or 'approved' without a userOperationHash,
      // transition to 'outcome-unknown' and refuse to resubmit.
      if (
        saved.status === 'outcome-unknown' ||
        ((saved.status === 'submitting' || saved.status === 'approved') && !saved.userOperationHash)
      ) {
        const unknownRecord = await savePaymentRecord(
          normalizedRequestId,
          {
            ...saved,
            status: 'outcome-unknown',
            pending: false,
            confirmed: false,
            userOperationHash: saved.userOperationHash || null,
            transactionHash: saved.transactionHash || null,
            error:
              saved.error ||
              'Outcome unknown — do not retry. The submission was interrupted before a UserOperation hash was returned. Refresh your balance and check recent activity.',
            lastCheckedAt: new Date().toISOString(),
          },
          scopeKey
        );
        return unknownRecord;
      }

      // Otherwise we have a saved.userOperationHash -> reconcile its on-chain / bundler status
      const receiptStatus = await checkUsdtTransferReceipt({
        account,
        userOperationHash: saved.userOperationHash,
        savedRecord: saved,
      });

      const updated = await savePaymentRecord(
        normalizedRequestId,
        {
          ...saved,
          status: receiptStatus.status,
          confirmed: receiptStatus.confirmed,
          pending: receiptStatus.pending,
          userOperationHash: saved.userOperationHash,
          transactionHash: receiptStatus.transactionHash || saved.transactionHash || null,
          confirmations: receiptStatus.confirmations ?? saved.confirmations ?? 0,
          feeBaseUnits: receiptStatus.feeBaseUnits || saved.feeBaseUnits || null,
          feeEth: receiptStatus.feeEth || saved.feeEth || null,
          error: receiptStatus.error || null,
          lastCheckedAt: receiptStatus.lastCheckedAt,
        },
        scopeKey
      );
      return updated;
    }

    // 4. New submission path: validate recipient, expiry, and account readiness
    const trimmedRecipient = String(to || '').trim();
    if (!isValidPersonalEvmRecipient(trimmedRecipient)) {
      throw new Error(
        'Invalid recipient address. Enter a valid 0x personal wallet address (never the Sepolia USDT token contract or zero address).'
      );
    }

    if (account?.address && trimmedRecipient.toLowerCase() === String(account.address).trim().toLowerCase()) {
      throw new Error('Cannot send a transfer to your own wallet address.');
    }

    if (expiresAt) {
      const expMs =
        typeof expiresAt === 'number' || /^\d+$/.test(String(expiresAt))
          ? Number(expiresAt) < 1e12
            ? Number(expiresAt) * 1000
            : Number(expiresAt)
          : Date.parse(String(expiresAt));
      if (!Number.isFinite(expMs) || expMs <= Date.now()) {
        const expiredRecord = await savePaymentRecord(
          normalizedRequestId,
          {
            requestId: normalizedRequestId,
            recipient: trimmedRecipient,
            amountUsdt: String(amountUsdt),
            status: 'expired',
            confirmed: false,
            pending: false,
            userOperationHash: null,
            transactionHash: null,
            chainId: WDK_SEPOLIA_CHAIN_ID,
            tokenAddress: WDK_SEPOLIA_USDT_ADDRESS,
            tokenSymbol: 'USDT',
            error: 'This payment request has expired before submission. No funds were sent.',
            createdAt: new Date().toISOString(),
            lastCheckedAt: new Date().toISOString(),
          },
          scopeKey
        );
        return expiredRecord;
      }
    }

    if (!account?.account) {
      throw new Error('Unlock your WDK wallet before approving a payment.');
    }

    const amountBaseUnits = parseTokenUnits(amountUsdt, decimals, 'USDT amount');
    const formattedAmountUsdt = formatTokenUnits(amountBaseUnits, decimals, decimals);

    // 5. Recheck live balance & fee immediately before submission (when reviewedFeeQuote is provided)
    let activeFeeQuote = reviewedFeeQuote;
    if (!skipPreSendRecheck && reviewedFeeQuote) {
      const recheck = await recheckLiveBalanceAndFeeBeforeSend({
        account,
        to: trimmedRecipient,
        amountUsdt: formattedAmountUsdt,
        usdtAsset: asset,
        ethAsset,
        reviewedFeeQuote,
      });
      if (!recheck.ok) {
        const err = new Error(recheck.message);
        err.code = recheck.code;
        err.requiresNewReview = recheck.requiresNewReview;
        err.freshFeeQuote = recheck.freshFeeQuote || null;
        throw err;
      }
      activeFeeQuote = recheck.freshFeeQuote || reviewedFeeQuote;
    }

    const nowIso = new Date().toISOString();
    const baseRecord = {
      requestId: normalizedRequestId,
      senderAddress: account.address || null,
      recipient: trimmedRecipient,
      amountUsdt: formattedAmountUsdt,
      amountBaseUnits,
      note: String(note || '').slice(0, 140),
      tokenAddress: WDK_SEPOLIA_USDT_ADDRESS,
      tokenSymbol: 'USDT',
      tokenDecimals: WDK_SEPOLIA_USDT_DECIMALS,
      chainId: WDK_SEPOLIA_CHAIN_ID,
      network: WDK_NETWORK_NAME,
      networkName: WDK_SEPOLIA_NETWORK_LABEL,
      feeAsset: WDK_FEE_ASSET_LABEL,
      approvedFeeBaseUnits: activeFeeQuote?.feeBaseUnits || null,
      approvedFeeEth: activeFeeQuote?.feeEth || null,
      feeBaseUnits: activeFeeQuote?.feeBaseUnits || null,
      feeEth: activeFeeQuote?.feeEth || null,
      userOperationHash: null,
      transactionHash: null,
      createdAt: nowIso,
      lastCheckedAt: nowIso,
    };

    // 6. Persist approved intent BEFORE calling WDK send
    await savePaymentRecord(
      normalizedRequestId,
      {
        ...baseRecord,
        status: 'approved',
        confirmed: false,
        pending: true,
      },
      scopeKey
    );

    // 7. Transition to 'submitting' immediately before invoking account.send()
    await savePaymentRecord(
      normalizedRequestId,
      {
        ...baseRecord,
        status: 'submitting',
        confirmed: false,
        pending: true,
      },
      scopeKey
    );

    let sendResult;
    try {
      sendResult = await account.send({
        to: trimmedRecipient,
        asset,
        amount: amountBaseUnits,
      });
    } catch (sendError) {
      // Submission threw before returning a hash: outcome is unknown, NEVER auto-retry!
      const unknownRecord = await savePaymentRecord(
        normalizedRequestId,
        {
          ...baseRecord,
          status: 'outcome-unknown',
          confirmed: false,
          pending: false,
          error:
            sendError?.message ||
            'Transfer submission was interrupted before a UserOperation hash was returned. Outcome unknown — do not retry.',
          lastCheckedAt: new Date().toISOString(),
        },
        scopeKey
      );
      return unknownRecord;
    }

    if (!sendResult?.success || !sendResult?.hash) {
      const hasAmbiguousFailure = !sendResult || (!sendResult.error && !sendResult.hash);
      const failureStatus = hasAmbiguousFailure ? 'outcome-unknown' : 'failed';
      const failedRecord = await savePaymentRecord(
        normalizedRequestId,
        {
          ...baseRecord,
          status: failureStatus,
          confirmed: false,
          pending: false,
          error:
            sendResult?.error ||
            (failureStatus === 'outcome-unknown'
              ? 'WDK did not return a UserOperation hash. Outcome unknown — do not retry.'
              : 'Transfer could not be submitted to the Sepolia bundler.'),
          lastCheckedAt: new Date().toISOString(),
        },
        scopeKey
      );
      return failedRecord;
    }

    const userOperationHash = String(sendResult.hash).trim();
    const submittedFeeWei = sendResult.fee ? String(sendResult.fee) : baseRecord.feeBaseUnits;
    const submittedFeeEth = submittedFeeWei
      ? formatTokenUnits(submittedFeeWei, WDK_FEE_ASSET_DECIMALS, 8)
      : baseRecord.feeEth;
    const submittedAt = new Date().toISOString();

    // 8. Persist the returned userOperationHash immediately before checking receipt
    const submittedRecord = await savePaymentRecord(
      normalizedRequestId,
      {
        ...baseRecord,
        status: 'submitted',
        confirmed: false,
        pending: true,
        userOperationHash,
        transactionHash: null,
        feeBaseUnits: submittedFeeWei,
        feeEth: submittedFeeEth,
        submittedAt,
        lastCheckedAt: submittedAt,
      },
      scopeKey
    );

    // 9. Perform initial receipt check
    const receiptStatus = await checkUsdtTransferReceipt({
      account,
      userOperationHash,
      savedRecord: submittedRecord,
    });

    const finalRecord = await savePaymentRecord(
      normalizedRequestId,
      {
        ...submittedRecord,
        status: receiptStatus.status,
        confirmed: receiptStatus.confirmed,
        pending: receiptStatus.pending,
        userOperationHash,
        transactionHash: receiptStatus.transactionHash || null,
        confirmations: receiptStatus.confirmations ?? 0,
        feeBaseUnits: receiptStatus.feeBaseUnits || submittedFeeWei,
        feeEth: receiptStatus.feeEth || submittedFeeEth,
        error: receiptStatus.error || null,
        lastCheckedAt: receiptStatus.lastCheckedAt,
      },
      scopeKey
    );

    return finalRecord;
  } finally {
    inFlightRequests.delete(normalizedRequestId);
  }
}

/**
 * Validates and saves an unsigned offline payment intent ("Draft — not sent").
 * Never signs or broadcasts offline, and never misrepresents the draft as paid.
 */
export async function saveOfflinePaymentDraft({
  scopeKey = 'default',
  to,
  amountUsdt,
  note = '',
  sourceLabel = 'Offline draft',
  expiresAt = null,
  chainId = WDK_SEPOLIA_CHAIN_ID,
  network = WDK_NETWORK_NAME,
  tokenAddress = WDK_SEPOLIA_USDT_ADDRESS,
  decimals = WDK_SEPOLIA_USDT_DECIMALS,
}) {
  assertSupportedWdkConfig({ chainId, network, tokenAddress, decimals });

  const trimmedRecipient = String(to || '').trim();
  if (!isValidPersonalEvmRecipient(trimmedRecipient)) {
    throw new Error(
      'Invalid recipient address. Enter a valid 0x personal wallet address (never the Sepolia USDT token contract or zero address).'
    );
  }

  const amountBaseUnits = parseTokenUnits(amountUsdt, decimals, 'USDT amount');
  const formattedAmountUsdt = formatTokenUnits(amountBaseUnits, decimals, decimals);

  if (expiresAt) {
    const expMs =
      typeof expiresAt === 'number' || /^\d+$/.test(String(expiresAt))
        ? Number(expiresAt) < 1e12
          ? Number(expiresAt) * 1000
          : Number(expiresAt)
        : Date.parse(String(expiresAt));
    if (!Number.isFinite(expMs) || expMs <= Date.now()) {
      throw new Error('Cannot save an already-expired payment request as a draft.');
    }
  }

  const draft = {
    draftId: createDraftId(),
    status: 'draft',
    statusLabel: 'Draft — not sent',
    offlineSigningEnabled: OFFLINE_SIGNING_ENABLED,
    offlineSigningReason: OFFLINE_SIGNING_DISABLED_REASON,
    recipient: trimmedRecipient,
    amountUsdt: formattedAmountUsdt,
    amountBaseUnits,
    note: String(note || '').slice(0, 140),
    sourceLabel,
    expiresAt: expiresAt || null,
    chainId: WDK_SEPOLIA_CHAIN_ID,
    networkName: WDK_SEPOLIA_NETWORK_LABEL,
    tokenSymbol: 'USDT',
    tokenAddress: WDK_SEPOLIA_USDT_ADDRESS,
    tokenDecimals: WDK_SEPOLIA_USDT_DECIMALS,
    feeAsset: WDK_FEE_ASSET_LABEL,
    createdAt: new Date().toISOString(),
  };

  const storage = await getStorage();
  const key = draftsKeyFor(scopeKey);
  const raw = await storage.getItemAsync(key);
  const existing = raw ? JSON.parse(raw) : [];
  const list = Array.isArray(existing) ? existing : [];
  list.unshift(draft);
  await storage.setItemAsync(key, JSON.stringify(list.slice(0, 30)));
  return draft;
}

export async function listOfflinePaymentDrafts(scopeKey = 'default') {
  try {
    const storage = await getStorage();
    const raw = await storage.getItemAsync(draftsKeyFor(scopeKey));
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    const now = Date.now();
    return list.map((d) => {
      if (d.expiresAt) {
        const expMs =
          typeof d.expiresAt === 'number' || /^\d+$/.test(String(d.expiresAt))
            ? Number(d.expiresAt) < 1e12
              ? Number(d.expiresAt) * 1000
              : Number(d.expiresAt)
            : Date.parse(String(d.expiresAt));
        if (Number.isFinite(expMs) && expMs <= now) {
          return { ...d, status: 'expired', statusLabel: 'Expired' };
        }
      }
      return d;
    });
  } catch {
    return [];
  }
}

export async function deleteOfflinePaymentDraft(draftId, scopeKey = 'default') {
  if (!draftId) return;
  try {
    const storage = await getStorage();
    const key = draftsKeyFor(scopeKey);
    const raw = await storage.getItemAsync(key);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;
    const filtered = list.filter((d) => d.draftId !== draftId);
    await storage.setItemAsync(key, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

/**
 * Caches non-secret wallet display state (address, last known USDT/ETH balances, recent activity)
 * with explicit `lastUpdatedAt` timestamps so the user can inspect cached state while offline.
 * Never stores seed phrases, private keys, or encryption keys.
 */
export async function saveCachedWalletSnapshot(scopeKey, snapshot) {
  if (!scopeKey || !snapshot) return null;
  try {
    const storage = await getStorage();
    const existingRaw = await storage.getItemAsync(walletSnapshotKeyFor(scopeKey));
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const nowIso = new Date().toISOString();
    const merged = {
      ...existing,
      ...snapshot,
      address: snapshot.address ?? existing.address ?? null,
      usdtBalance: snapshot.usdtBalance !== undefined ? snapshot.usdtBalance : existing.usdtBalance ?? null,
      ethBalance: snapshot.ethBalance !== undefined ? snapshot.ethBalance : existing.ethBalance ?? null,
      transactions: Array.isArray(snapshot.transactions)
        ? snapshot.transactions.slice(0, 30)
        : existing.transactions || [],
      lastUpdatedAt: snapshot.lastUpdatedAt || nowIso,
    };
    await storage.setItemAsync(walletSnapshotKeyFor(scopeKey), JSON.stringify(merged));
    return merged;
  } catch {
    return null;
  }
}

export async function loadCachedWalletSnapshot(scopeKey) {
  if (!scopeKey) return null;
  try {
    const storage = await getStorage();
    const raw = await storage.getItemAsync(walletSnapshotKeyFor(scopeKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
