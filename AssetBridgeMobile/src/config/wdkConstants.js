/**
 * Pure, dependency-free WDK & Ethereum Sepolia network/token constants and fail-closed validators.
 * Shared across React Native UI, payment journal services, and Node test suites.
 */

export const WDK_NETWORK_NAME = 'ethereum';
export const WDK_SEPOLIA_CHAIN_ID = 11155111;
export const WDK_SEPOLIA_NETWORK_LABEL = 'Ethereum Sepolia (Chain ID: 11155111)';
export const WDK_SEPOLIA_USDT_DECIMALS = 6;
export const WDK_SEPOLIA_ETH_DECIMALS = 18;
export const IS_TESTNET_ENVIRONMENT = true;
export const TESTNET_FUNDS_NOTICE =
  'Test-only environment: Sepolia USDT and Sepolia ETH are test tokens with no real monetary value.';

// Maximum allowed fee drift (15%) between review quote and pre-send live recheck.
export const MAX_FEE_DRIFT_BPS = 1500n;

// Maximum age (2 minutes) for an approved fee quote before requiring a fresh review.
export const FEE_QUOTE_MAX_AGE_MS = 2 * 60 * 1000;

export const WDK_SEPOLIA_USDT_ADDRESS =
  process.env.EXPO_PUBLIC_WDK_USDT_CONTRACT_ADDRESS ||
  '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';

export const WDK_SEPOLIA_CANDIDE_USDT_ADDRESS =
  '0xd077a400968890eacc75cdc901f0356c943e4fdb';

export const FORBIDDEN_RECIPIENT_ADDRESSES = [
  WDK_SEPOLIA_USDT_ADDRESS.toLowerCase(),
  WDK_SEPOLIA_CANDIDE_USDT_ADDRESS.toLowerCase(),
  '0x0000000000000000000000000000000000000000',
  '0x0000000071727de22e5e9d8baf0edac6f37da032', // ERC-4337 EntryPoint v0.7
];

const paymasterUrl = process.env.EXPO_PUBLIC_WDK_SEPOLIA_PAYMASTER_URL || '';
export const USE_TOKEN_PAYMASTER =
  process.env.EXPO_PUBLIC_WDK_USE_TOKEN_PAYMASTER === 'true' && Boolean(paymasterUrl);

export const WDK_FEE_ASSET_LABEL = USE_TOKEN_PAYMASTER
  ? 'Sepolia USDT (Paymaster)'
  : 'Sepolia ETH';

export const WDK_FEE_ASSET_DECIMALS = USE_TOKEN_PAYMASTER
  ? WDK_SEPOLIA_USDT_DECIMALS
  : WDK_SEPOLIA_ETH_DECIMALS;

/**
 * Why offline ERC-4337 UserOperation signing is disabled:
 * In @tetherto/wdk-wallet-evm-erc-4337@1.0.0-beta.25, `signTransaction` calls
 * `_prepareForSend` -> `_buildUserOperation`, which requires live RPC & bundler network calls:
 * 1. `eth_chainId` verification against the RPC provider
 * 2. `SafeAccountV0_3_0.isDeployed` on-chain bytecode check (to decide whether `initCode` is needed)
 * 3. `fetchAccountNonce` against EntryPoint v0.7 (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`)
 * 4. Live bundler gas estimation (`eth_estimateUserOperationGas` / `pimlico_getUserOperationGasPrice`)
 * Because an offline device cannot safely determine Safe deployment state, EntryPoint nonce, or bundler gas limits,
 * offline payment preparation is strictly limited to unsigned drafts ("Draft — not sent").
 */
export const OFFLINE_SIGNING_ENABLED = false;
export const OFFLINE_SIGNING_DISABLED_REASON =
  'Offline ERC-4337 signing is disabled because @tetherto/wdk-wallet-evm-erc-4337 requires live RPC and bundler calls (EntryPoint v0.7 nonce, Safe deployment check, and bundler gas estimation) to construct a valid UserOperation. Offline payments are saved as unsigned drafts ("Draft — not sent") and require review and approval once online.';

const HEX_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function isValidPersonalEvmRecipient(address) {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  if (!HEX_ADDRESS_REGEX.test(trimmed)) return false;
  if (FORBIDDEN_RECIPIENT_ADDRESSES.includes(trimmed.toLowerCase())) {
    return false;
  }
  return true;
}

/**
 * Fail-closed validator for network, chain ID, token contract, and decimals.
 * Rejects any unknown or mismatched chain ID, token address, decimals, or network.
 */
export function assertSupportedWdkConfig({
  chainId = WDK_SEPOLIA_CHAIN_ID,
  network = WDK_NETWORK_NAME,
  tokenAddress = WDK_SEPOLIA_USDT_ADDRESS,
  decimals = WDK_SEPOLIA_USDT_DECIMALS,
} = {}) {
  if (Number(chainId) !== WDK_SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Unsupported chain ID (${chainId}). Only Ethereum Sepolia (Chain ID ${WDK_SEPOLIA_CHAIN_ID}) is allowed.`
    );
  }
  const normalizedNetwork = String(network || '').trim().toLowerCase();
  if (
    normalizedNetwork !== 'ethereum' &&
    normalizedNetwork !== 'ethereum-sepolia' &&
    normalizedNetwork !== 'sepolia'
  ) {
    throw new Error(
      `Unsupported network "${network}". Only Ethereum Sepolia is allowed.`
    );
  }
  const normalizedToken = String(tokenAddress || '').trim().toLowerCase();
  if (normalizedToken !== WDK_SEPOLIA_USDT_ADDRESS.toLowerCase()) {
    throw new Error(
      `Unsupported token contract (${tokenAddress || 'none'}). Expected Sepolia USDT (${WDK_SEPOLIA_USDT_ADDRESS}).`
    );
  }
  if (Number(decimals) !== WDK_SEPOLIA_USDT_DECIMALS) {
    throw new Error(
      `Unsupported token decimals (${decimals}). Sepolia USDT requires ${WDK_SEPOLIA_USDT_DECIMALS} decimals.`
    );
  }
  return true;
}

export function walletIdForUser(userId) {
  const cleaned = String(userId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, '_');
  if (!cleaned) {
    throw new Error('A signed-in user id is required before opening a WDK wallet.');
  }
  return `assetbridge_${cleaned}`.slice(0, 120);
}

