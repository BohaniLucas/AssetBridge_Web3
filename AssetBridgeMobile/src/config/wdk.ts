import type { WdkConfigs } from '@tetherto/wdk-react-native-core'

export const sepoliaTestTokenAddress: string = process.env.EXPO_PUBLIC_SEPOLIA_TEST_TOKEN_ADDRESS ?? ''
if (!/^0x[a-fA-F0-9]{40}$/.test(sepoliaTestTokenAddress)) {
  throw new Error('Set EXPO_PUBLIC_SEPOLIA_TEST_TOKEN_ADDRESS to your verified test token')
}

export const wdkConfigs: WdkConfigs = {
  networks: {
    ethereum: {
      blockchain: 'ethereum',
      config: {
        chainId: 11155111, // Sepolia testnet
        safeModuleVersion: '0.3.0',
        provider: 'https://rpc.sepolia.org',
        bundlerUrl: 'https://api.candide.dev/public/v3/11155111',
        paymasterUrl: 'https://api.candide.dev/public/v3/11155111',
        paymasterAddress: '0x0b1f8cb5d082ae2ca0d501942b0b988429d075ba',
        transferMaxFee: 5000000,
        paymasterToken: {
          address: sepoliaTestTokenAddress,
        }
      }
    }
  }
}