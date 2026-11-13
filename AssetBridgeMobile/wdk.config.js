/** Generate a minimal Ethereum Sepolia wallet worklet for AssetBridge. */
module.exports = {
  networks: {
    ethereum: {
      package: '@tetherto/wdk-wallet-evm-erc-4337',
    },
  },
  // The worklet bundle uses linked Bare native addons (including bare-type).
  // Produce Android libraries for the Android ABI set and place them in
  // BareKit's JNI source directory so Gradle packages them into the APK/AAB.
  output: {
    addons: {
      android: './node_modules/react-native-bare-kit/android/src/main/addons',
      ios: './ios-addons',
      macos: './mac-addons',
      linux: './linux-addons',
      windows: './windows-addons',
    },
  },
  options: {
    targets: [
      'android-arm64',
      'android-arm',
      'android-ia32',
      'android-x64',
      'ios-arm64',
      'ios-arm64-simulator',
      'ios-x64-simulator',
    ],
    linkAddons: true,
  },
};
