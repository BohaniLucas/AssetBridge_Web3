// src/screens/SendScreen.tsx
import { useAccount, BaseAsset } from '@tetherto/wdk-react-native-core'
import { sepoliaTestTokenAddress } from '../config/wdk'

const usdt = new BaseAsset({
  id: 'usdt-ethereum',
  network: 'ethereum',
  symbol: 'USDT',
  name: 'Tether USD',
  decimals: 6,
  isNative: false,
  address: sepoliaTestTokenAddress,
})

function SendScreen({ recipient }: { recipient: string }) {
  const { address, send } = useAccount({ network: 'ethereum', accountIndex: 0 })

  const handleSend = async () => {
    if (!address) return

    const result = await send({
      to: recipient,
      asset: usdt,
      amount: '1000000', // 1 USDt (6 decimals)
    })

    if (result.success) {
      console.log('TX hash:', result.hash, 'Fee:', result.fee)
    } else {
      console.error('TX failed:', result.error)
    }
  }

  return <Button title="Send 1 USDt" onPress={handleSend} />
}