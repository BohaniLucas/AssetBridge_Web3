/** Generate a minimal Ethereum Sepolia wallet worklet for AssetBridge. */
module.exports = {
  networks: {
    ethereum: {
      package: '@tetherto/wdk-wallet-evm-erc-4337',
    },
  },
};
