import type { WdkConfigs } from '@tetherto/wdk-react-native-core'
import { SEPOLIA_CHAIN_ID, SEPOLIA_USDT_CONTRACT, SEPOLIA_USDT_DECIMALS } from './api'

const env = {
  rpcUrl: process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL?.trim() || '',
  bundlerUrl: process.env.EXPO_PUBLIC_SEPOLIA_BUNDLER_URL?.trim() || '',
  paymasterUrl: process.env.EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL?.trim() || '',
  paymasterAddress: process.env.EXPO_PUBLIC_SEPOLIA_PAYMASTER_ADDRESS?.trim() || '',
  paymasterTokenAddress: process.env.EXPO_PUBLIC_SEPOLIA_PAYMASTER_TOKEN_ADDRESS?.trim() || '',
  safeModulesVersion: process.env.EXPO_PUBLIC_SEPOLIA_SAFE_MODULES_VERSION?.trim() || '',
  usdtDecimals: process.env.EXPO_PUBLIC_SEPOLIA_USDT_DECIMALS?.trim() || '',
}

const requiredValues: Record<string, string> = {
  EXPO_PUBLIC_SEPOLIA_RPC_URL: env.rpcUrl,
  EXPO_PUBLIC_SEPOLIA_BUNDLER_URL: env.bundlerUrl,
  EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL: env.paymasterUrl,
  EXPO_PUBLIC_SEPOLIA_PAYMASTER_ADDRESS: env.paymasterAddress,
  EXPO_PUBLIC_SEPOLIA_PAYMASTER_TOKEN_ADDRESS: env.paymasterTokenAddress,
  EXPO_PUBLIC_SEPOLIA_SAFE_MODULES_VERSION: env.safeModulesVersion,
  EXPO_PUBLIC_SEPOLIA_USDT_CONTRACT_ADDRESS: SEPOLIA_USDT_CONTRACT,
  EXPO_PUBLIC_SEPOLIA_USDT_DECIMALS: env.usdtDecimals,
}

const missingValues = Object.entries(requiredValues)
  .filter(([, value]) => !value)
  .map(([name]) => name)

const invalidAddresses = [
  ['EXPO_PUBLIC_SEPOLIA_PAYMASTER_ADDRESS', env.paymasterAddress],
  ['EXPO_PUBLIC_SEPOLIA_PAYMASTER_TOKEN_ADDRESS', env.paymasterTokenAddress],
  ['EXPO_PUBLIC_SEPOLIA_USDT_CONTRACT_ADDRESS', SEPOLIA_USDT_CONTRACT],
]
  .filter(([, value]) => value && !/^0x[a-fA-F0-9]{40}$/.test(value))
  .map(([name]) => name)

const invalidUrls = [
  ['EXPO_PUBLIC_SEPOLIA_RPC_URL', env.rpcUrl],
  ['EXPO_PUBLIC_SEPOLIA_BUNDLER_URL', env.bundlerUrl],
  ['EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL', env.paymasterUrl],
]
  .filter(([, value]) => {
    if (!value) return false
    try {
      return !['http:', 'https:'].includes(new URL(value).protocol)
    } catch {
      return true
    }
  })
  .map(([name]) => name)

const invalidDecimals = SEPOLIA_USDT_DECIMALS === null || SEPOLIA_USDT_DECIMALS > 255

export const wdkConfigurationError = [
  missingValues.length ? `Missing: ${missingValues.join(', ')}.` : '',
  invalidAddresses.length ? `Invalid EVM address: ${invalidAddresses.join(', ')}.` : '',
  invalidUrls.length ? `Invalid URL: ${invalidUrls.join(', ')}.` : '',
  invalidDecimals ? 'EXPO_PUBLIC_SEPOLIA_USDT_DECIMALS must be an integer from 0 to 255.' : '',
].filter(Boolean).join(' ')

export const wdkConfigs: WdkConfigs | null = wdkConfigurationError ? null : {
  networks: {
    ethereum: {
      blockchain: 'ethereum',
      config: {
        chainId: SEPOLIA_CHAIN_ID,
        safeModulesVersion: env.safeModulesVersion,
        provider: env.rpcUrl,
        bundlerUrl: env.bundlerUrl,
        paymasterUrl: env.paymasterUrl,
        paymasterAddress: env.paymasterAddress,
        paymasterToken: {
          address: env.paymasterTokenAddress,
        },
      },
    },
  },
}