import { SEPOLIA_CHAIN_ID } from './api';

const SEPOLIA_RPC =
  process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ||
  'https://ethereum-sepolia-rpc.publicnode.com';
const SEPOLIA_BUNDLER =
  process.env.EXPO_PUBLIC_SEPOLIA_BUNDLER_URL ||
  'https://api.candide.dev/public/v3/11155111';

// Native ETH fee mode keeps test-token choice independent of paymaster support.
// Users need Sepolia ETH for UserOperation fees; this is testnet-only config.
export const wdkConfigs = {
  networks: {
    ethereum: {
      blockchain: 'ethereum',
      config: {
        chainId: SEPOLIA_CHAIN_ID,
        provider: SEPOLIA_RPC,
        safeModulesVersion: '0.3.0',
        bundlerUrl: SEPOLIA_BUNDLER,
        useNativeCoins: true,
      },
    },
  },
};

export const assetBridgeUsdt = {
  id: 'usdt-ethereum-sepolia',
  network: 'ethereum',
  symbol: 'USDT',
  name: 'Tether USD (Sepolia test token)',
  decimals: 6,
  isNative: false,
  address: process.env.EXPO_PUBLIC_SEPOLIA_USDT_ADDRESS ||
    '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
};
