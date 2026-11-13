import { BaseAsset } from '@tetherto/wdk-react-native-core';
import { bundle } from '../../.wdk/index.js';
import {
  WDK_NETWORK_NAME,
  WDK_SEPOLIA_CHAIN_ID,
  WDK_SEPOLIA_NETWORK_LABEL,
  WDK_SEPOLIA_USDT_DECIMALS,
  WDK_SEPOLIA_ETH_DECIMALS,
  IS_TESTNET_ENVIRONMENT,
  TESTNET_FUNDS_NOTICE,
  MAX_FEE_DRIFT_BPS,
  FEE_QUOTE_MAX_AGE_MS,
  WDK_SEPOLIA_USDT_ADDRESS,
  WDK_SEPOLIA_CANDIDE_USDT_ADDRESS,
  FORBIDDEN_RECIPIENT_ADDRESSES,
  USE_TOKEN_PAYMASTER,
  WDK_FEE_ASSET_LABEL,
  WDK_FEE_ASSET_DECIMALS,
  OFFLINE_SIGNING_ENABLED,
  OFFLINE_SIGNING_DISABLED_REASON,
  isValidPersonalEvmRecipient,
  assertSupportedWdkConfig,
  walletIdForUser,
} from './wdkConstants';

export {
  WDK_NETWORK_NAME,
  WDK_SEPOLIA_CHAIN_ID,
  WDK_SEPOLIA_NETWORK_LABEL,
  WDK_SEPOLIA_USDT_DECIMALS,
  WDK_SEPOLIA_ETH_DECIMALS,
  IS_TESTNET_ENVIRONMENT,
  TESTNET_FUNDS_NOTICE,
  MAX_FEE_DRIFT_BPS,
  FEE_QUOTE_MAX_AGE_MS,
  WDK_SEPOLIA_USDT_ADDRESS,
  WDK_SEPOLIA_CANDIDE_USDT_ADDRESS,
  FORBIDDEN_RECIPIENT_ADDRESSES,
  USE_TOKEN_PAYMASTER,
  WDK_FEE_ASSET_LABEL,
  WDK_FEE_ASSET_DECIMALS,
  OFFLINE_SIGNING_ENABLED,
  OFFLINE_SIGNING_DISABLED_REASON,
  isValidPersonalEvmRecipient,
  assertSupportedWdkConfig,
  walletIdForUser,
};

const rpcUrl =
  process.env.EXPO_PUBLIC_WDK_SEPOLIA_RPC_URL ||
  'https://sepolia.drpc.org';

const bundlerUrl =
  process.env.EXPO_PUBLIC_WDK_SEPOLIA_BUNDLER_URL ||
  'https://api.candide.dev/public/v3/sepolia';

const paymasterUrl = process.env.EXPO_PUBLIC_WDK_SEPOLIA_PAYMASTER_URL || '';
const paymasterAddress =
  process.env.EXPO_PUBLIC_WDK_SEPOLIA_PAYMASTER_ADDRESS ||
  '0x8b1f6cb5d062aa2ce8d581942bbb960420d875ba';
const paymasterTokenAddress =
  process.env.EXPO_PUBLIC_WDK_SEPOLIA_PAYMASTER_TOKEN_ADDRESS ||
  WDK_SEPOLIA_CANDIDE_USDT_ADDRESS;

export const wdkBundleConfig = {
  bundle,
};

export const wdkConfigs = {
  networks: {
    [WDK_NETWORK_NAME]: {
      chainId: WDK_SEPOLIA_CHAIN_ID,
      provider: rpcUrl,
      bundlerUrl,
      safeModulesVersion: '0.3.0',
      ...(USE_TOKEN_PAYMASTER
        ? {
            paymasterUrl,
            paymasterAddress,
            paymasterToken: {
              address: paymasterTokenAddress,
            },
            transferMaxFee: 100000,
          }
        : {
            useNativeCoins: true,
          }),
    },
  },
};

export const sepoliaEthAsset = new BaseAsset({
  id: 'eth',
  network: WDK_NETWORK_NAME,
  symbol: 'ETH',
  name: 'Sepolia Ether (Testnet)',
  decimals: WDK_SEPOLIA_ETH_DECIMALS,
  isNative: true,
  address: null,
});

export const sepoliaUsdtAsset = new BaseAsset({
  id: 'usdt',
  network: WDK_NETWORK_NAME,
  symbol: 'USDT',
  name: 'Sepolia Tether USD (Testnet)',
  decimals: WDK_SEPOLIA_USDT_DECIMALS,
  isNative: false,
  address: WDK_SEPOLIA_USDT_ADDRESS,
});

export const wdkAssets = [sepoliaUsdtAsset, sepoliaEthAsset];
