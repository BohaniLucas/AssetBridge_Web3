const WEB_WALLET_MESSAGE = 'Wallet key storage and transaction signing are available in the Android and iOS app, not in a web browser.';

export function WdkBridgeProvider({ children }) {
  return children;
}

export function useWdkBridge() {
  return {
    wdkStatus: 'UNAVAILABLE',
    wdkWalletId: null,
    wdkWalletIds: [],
    wdkError: WEB_WALLET_MESSAGE,
    wdkAddress: null,
    generateMnemonic: async () => ({ success: false, error: WEB_WALLET_MESSAGE }),
    saveWallet: async () => ({ success: false, error: WEB_WALLET_MESSAGE }),
    unlockWallet: async () => ({ success: false, error: WEB_WALLET_MESSAGE }),
    lockWallet: async () => ({ success: false, error: WEB_WALLET_MESSAGE }),
    getBalance: async () => { throw new Error(WEB_WALLET_MESSAGE); },
    sendUsdt: async () => ({ success: false, error: WEB_WALLET_MESSAGE }),
  };
}
