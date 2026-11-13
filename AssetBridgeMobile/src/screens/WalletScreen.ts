import { useWdkApp, useWalletManager, useAccount } from '@tetherto/wdk-react-native-core'

function WalletScreen({
  walletId,
  authenticate,
}: {
  walletId: string
  authenticate: () => Promise<boolean>
}) {
  const { state } = useWdkApp()
  const { createWallet, unlock } = useWalletManager()
  const { address } = useAccount({ network: 'ethereum', accountIndex: 0 })

  const create = async () => {
    if (await authenticate()) await createWallet(walletId)
  }

  const open = async () => {
    if (await authenticate()) await unlock(state.walletId ?? walletId)
  }

  switch (state.status) {
    case 'INITIALIZING':
    case 'REINITIALIZING':
      return <Text>Loading...</Text>
    case 'NO_WALLET':
      return <Button title="Create Wallet" onPress={create} />
    case 'LOCKED':
      return <Button title="Unlock" onPress={open} />
    case 'READY':
      return <Text>Address: {address}</Text>
    case 'ERROR':
      return <Text>Error: {state.error.message}</Text>
  }
}