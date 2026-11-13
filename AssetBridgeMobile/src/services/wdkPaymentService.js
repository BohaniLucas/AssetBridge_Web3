import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { BaseAsset } from '@tetherto/wdk-react-native-core';
import { assetBridgeUsdt } from '../config/wdk';

const usdtAsset = new BaseAsset(assetBridgeUsdt);
const nativeEthAsset = new BaseAsset({
  id: 'ethereum-sepolia-native-eth',
  network: 'ethereum',
  symbol: 'ETH',
  name: 'Sepolia ETH',
  decimals: 18,
  isNative: true,
});
const REQUEST_PREFIX = 'assetbridge_wdk_payment_v1_';

export function createPaymentRequestId() {
  return Crypto.randomUUID();
}

export function makeUsdtTransaction(recipient, amountBaseUnits) {
  return {
    to: recipient,
    asset: usdtAsset,
    amount: String(amountBaseUnits),
  };
}

export async function quoteUsdtTransfer(account, recipient, amountBaseUnits) {
  if (!account?.estimateFee) throw new Error('WDK wallet is not ready to quote this transfer.');
  const quote = await account.estimateFee(makeUsdtTransaction(recipient, amountBaseUnits));
  if (!quote?.success) throw new Error(quote?.error || 'Could not estimate the Sepolia fee.');
  return quote;
}

async function readRequest(requestId) {
  const raw = await SecureStore.getItemAsync(`${REQUEST_PREFIX}${requestId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Saved payment state is unreadable. Do not submit again; contact support with this request ID.');
  }
}

async function saveRequest(requestId, value) {
  await SecureStore.setItemAsync(`${REQUEST_PREFIX}${requestId}`, JSON.stringify(value));
}

function isTimeout(error) {
  return /timeout|timed out/i.test(error?.message || '');
}

/**
 * Submit once, persist the WDK UserOperation hash, then reconcile against the
 * WDK ERC-4337 receipt API. A retry with the same request ID checks that same
 * operation and never calls send() a second time.
 */
export async function submitOrCheckUsdtTransfer(account, { requestId, recipient, amountBaseUnits, approvedFeeWei }) {
  if (!requestId) throw new Error('Missing unique payment request ID.');
  if (!account?.send || !account?.extension) throw new Error('WDK wallet is not ready. No funds were moved.');

  let saved = await readRequest(requestId);
  if (saved && (saved.recipient?.toLowerCase() !== recipient.toLowerCase() || String(saved.amountBaseUnits) !== String(amountBaseUnits))) {
    throw new Error('This payment request ID is already bound to different payment details. Create a new reviewed request; do not reuse its ID.');
  }
  if (saved?.status === 'successful' || saved?.status === 'failed') return saved;

  if (!saved) {
    if (approvedFeeWei == null) throw new Error('Review a current network fee before approving. No funds were moved.');
    const balances = await account.getBalance([usdtAsset, nativeEthAsset]);
    const usdtBalance = balances?.[0];
    const ethBalance = balances?.[1];
    if (!usdtBalance?.success || usdtBalance.balance == null) throw new Error('Could not verify the fresh USDT balance. No funds were moved.');
    if (BigInt(usdtBalance.balance) < BigInt(amountBaseUnits)) throw new Error('Insufficient Sepolia USDT balance. Get test USDT or enter a smaller amount.');
    if (!ethBalance?.success || ethBalance.balance == null) throw new Error('Could not verify the Sepolia ETH fee balance. No funds were moved.');
    const freshFee = await quoteUsdtTransfer(account, recipient, amountBaseUnits);
    const feeWei = BigInt(freshFee.fee || 0);
    if (feeWei > BigInt(approvedFeeWei)) throw new Error('The Sepolia network fee increased after review. Review the updated fee before approving again.');
    if (BigInt(ethBalance.balance) < feeWei) throw new Error('Insufficient Sepolia ETH for the network fee. Get test ETH before sending.');
    saved = { requestId, status: 'submitting', recipient, amountBaseUnits, createdAt: new Date().toISOString() };
    await saveRequest(requestId, saved);
    let sent;
    try {
      sent = await account.send(makeUsdtTransaction(recipient, amountBaseUnits));
    } catch (error) {
      // Keep an unknown outcome locked to this request. Retrying blindly can
      // create a second payment if the bundler accepted the first operation.
      saved = { ...saved, status: 'outcome-unknown', error: error?.message || 'Submission outcome unknown.' };
      await saveRequest(requestId, saved);
      return { ...saved, pending: true };
    }
    if (!sent?.success || !sent?.hash) {
      saved = { ...saved, status: 'failed', error: sent?.error || 'WDK did not return a submitted operation hash.' };
      await saveRequest(requestId, saved);
      return saved;
    }
    saved = { ...saved, status: 'pending', userOperationHash: sent.hash, fee: sent.fee == null ? null : String(sent.fee) };
    await saveRequest(requestId, saved);
  }

  if (saved.status === 'outcome-unknown' || !saved.userOperationHash) {
    return { ...saved, pending: true };
  }

  try {
    const receipt = await account.extension().waitForTransaction(saved.userOperationHash, {
      target: 'confirmed',
      timeout: 45000,
      interval: 3000,
    });
    if (receipt?.finality === 'dropped') {
      const failed = { ...saved, status: 'failed', error: 'The network dropped this operation. Check its status before creating a new payment.' };
      await saveRequest(requestId, failed);
      return failed;
    }
    if (receipt?.success !== true) {
      const failed = { ...saved, status: 'failed', error: 'The on-chain operation did not succeed.' };
      await saveRequest(requestId, failed);
      return failed;
    }
    const txHash = receipt?.receipt?.hash || receipt?.receipt?.transactionHash || saved.userOperationHash;
    const successful = {
      ...saved,
      status: 'successful',
      pending: false,
      transactionHash: txHash,
      confirmedAt: new Date().toISOString(),
      confirmations: receipt.confirmations || 0,
    };
    await saveRequest(requestId, successful);
    return successful;
  } catch (error) {
    if (isTimeout(error) || !error) return { ...saved, pending: true };
    // NoSuchElement can mean the bundler is still indexing the just-submitted
    // operation. Keep the hash and expose Check status instead of resubmitting.
    return { ...saved, pending: true, statusMessage: 'Still waiting for the bundler/network receipt.' };
  }
}
