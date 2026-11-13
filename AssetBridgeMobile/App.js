import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
  Animated,
  AppState,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  WdkAppProvider,
  useAccount,
  useBalance,
  useWalletManager,
  useWdkApp,
} from '@tetherto/wdk-react-native-core';

import HomeScreen from './src/screens/HomeScreen';
import RemittanceScreen from './src/screens/RemittanceScreen';
import StokvelScreen from './src/screens/StokvelScreen';
import MarketsScreen from './src/screens/MarketsScreen';
import AssetsScreen from './src/screens/AssetsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import CreatePotScreen from './src/screens/CreatePotScreen';
import AuthFlowScreen from './src/screens/AuthFlowScreen';
import WalletSetupScreen from './src/screens/WalletSetupScreen';
import SessionLockOverlay from './src/components/SessionLockOverlay';
import { mobileAuthService } from './src/services/authService';
import {
  mobileWalletService,
  isSafePersonalEvmAddress,
} from './src/services/walletService';
import {
  wdkBundleConfig,
  wdkConfigs,
  sepoliaUsdtAsset,
  sepoliaEthAsset,
  walletIdForUser,
  WDK_NETWORK_NAME,
} from './src/config/wdk';
import {
  createPaymentRequestId,
  estimateUsdtTransferFee,
  submitOrCheckUsdtTransfer,
  formatTokenUnits,
  saveCachedWalletSnapshot,
  loadCachedWalletSnapshot,
} from './src/services/wdkPaymentService';
import { mobilePotsService } from './src/services/potsService';
import { sessionLockService } from './src/services/sessionLockService';

// --- CUSTOM ANIMATED TAB BUTTON ---
const AnimatedTabButton = ({ item, isFocused, onPress }) => {
  const [animatedWidth] = useState(() => new Animated.Value(isFocused ? 1 : 0));

  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: isFocused ? 1 : 0,
      tension: 50,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [isFocused, animatedWidth]);

  const pillPadding = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 16],
  });

  const textOpacity = animatedWidth.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const textWidth = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.tabItem}>
      <Animated.View
        style={[
          styles.tabPill,
          {
            backgroundColor: isFocused ? '#00E676' : 'transparent',
            paddingHorizontal: pillPadding,
          },
        ]}
      >
        <Ionicons
          name={isFocused ? item.activeIcon : item.inactiveIcon}
          size={22}
          color={isFocused ? '#0A0F1C' : '#64748B'}
        />
        <Animated.View style={{ width: textWidth, opacity: textOpacity, overflow: 'hidden' }}>
          <Text style={styles.tabLabelAnimated} numberOfLines={1}>
            {item.label}
          </Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

function WdkRuntime() {
  const { state: wdkState } = useWdkApp();
  const walletManager = useWalletManager();
  const wdkAccount = useAccount({ network: WDK_NETWORK_NAME, accountIndex: 0 });
  const usdtBalance = useBalance(0, sepoliaUsdtAsset, { refetchInterval: 30000 });
  const ethBalance = useBalance(0, sepoliaEthAsset, { refetchInterval: 30000 });
  return (
    <AppShell
      wdk={{
        state: wdkState,
        walletManager,
        account: wdkAccount,
        address: wdkAccount.address,
        usdtBalance,
        ethBalance,
      }}
    />
  );
}

export default function App() {
  return (
    <WdkAppProvider bundle={wdkBundleConfig} wdkConfigs={wdkConfigs}>
      <WdkRuntime />
    </WdkAppProvider>
  );
}

function AppShell({ wdk }) {
  const [currentTab, setCurrentTab] = useState('wallet');
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [walletSetupRequired, setWalletSetupRequired] = useState(false);
  const [walletSetupError, setWalletSetupError] = useState('');
  const [cachedSnapshot, setCachedSnapshot] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const walletInitRef = useRef('');
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let mounted = true;
    mobileAuthService
      .restoreSession()
      .then((savedSession) => {
        if (mounted) {
          setSession(savedSession);
          if (savedSession && sessionLockService.hasIdleExpired()) {
            sessionLockService.lock();
          }
        }
      })
      .catch(() => {
        if (mounted) setSession(null);
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    const unsubscribe = sessionLockService.subscribe((locked) => {
      if (mounted) setIsLocked(locked);
    });

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      sessionLockService.handleAppStateChange(nextAppState, appStateRef.current);
      appStateRef.current = nextAppState;
    });

    const idleCheckInterval = setInterval(() => {
      if (appStateRef.current === 'active' && sessionLockService.hasIdleExpired()) {
        sessionLockService.lock();
      }
    }, 10000);

    return () => {
      mounted = false;
      unsubscribe();
      appStateSubscription.remove();
      clearInterval(idleCheckInterval);
    };
  }, []);

  const TABS = [
    { id: 'wallet', label: 'Wallet', activeIcon: 'wallet', inactiveIcon: 'wallet-outline' },
    { id: 'assets', label: 'Assets', activeIcon: 'pie-chart', inactiveIcon: 'pie-chart-outline' },
    { id: 'remittance', label: 'Remit', activeIcon: 'paper-plane', inactiveIcon: 'paper-plane-outline' },
    { id: 'stokvel', label: 'Stokvels', activeIcon: 'people', inactiveIcon: 'people-outline' },
    { id: 'markets', label: 'Markets', activeIcon: 'analytics', inactiveIcon: 'analytics-outline' },
  ];

  const walletId = session?.user?.id ? walletIdForUser(session.user.id) : '';

  // Load cached wallet snapshot for offline display
  useEffect(() => {
    let active = true;
    if (!walletId) {
      Promise.resolve().then(() => {
        if (active) setCachedSnapshot(null);
      });
      return () => {
        active = false;
      };
    }
    loadCachedWalletSnapshot(walletId).then((snap) => {
      if (active) setCachedSnapshot(snap || null);
    });
    return () => {
      active = false;
    };
  }, [walletId]);

  const liveAddress =
    wdk.state?.status === 'READY' && wdk.state.walletId === walletId && wdk.address
      ? wdk.address
      : null;

  const liveUsdtRaw = wdk.usdtBalance?.data?.balance;
  const liveEthRaw = wdk.ethBalance?.data?.balance;

  const liveUsdtFormatted =
    liveUsdtRaw != null ? Number(formatTokenUnits(liveUsdtRaw, 6, 6)) : null;
  const liveEthFormatted =
    liveEthRaw != null ? formatTokenUnits(liveEthRaw, 18, 6) : null;

  // Persist snapshot whenever live address or balance updates
  useEffect(() => {
    if (!walletId || !liveAddress) return;
    const nowIso = new Date().toISOString();
    const updatePayload = {
      address: liveAddress,
      lastUpdatedAt: nowIso,
    };
    if (liveUsdtFormatted !== null) updatePayload.usdtBalance = liveUsdtFormatted;
    if (liveEthFormatted !== null) updatePayload.ethBalance = liveEthFormatted;
    saveCachedWalletSnapshot(walletId, updatePayload).then((saved) => {
      if (saved) setCachedSnapshot(saved);
    });
  }, [walletId, liveAddress, liveUsdtFormatted, liveEthFormatted]);

  const isOffline = Boolean(
    session?.offline ||
      (wdk.usdtBalance?.isError && !wdk.usdtBalance?.isFetching)
  );

  const effectiveAddress = liveAddress || cachedSnapshot?.address || null;
  const walletReady = Boolean(
    session?.user?.id &&
      ((wdk.state?.status === 'READY' && wdk.state.walletId === walletId && wdk.address) ||
        (session?.offline && effectiveAddress))
  );

  const wallet = walletReady
    ? {
        userId: session.user.id,
        walletId,
        address: effectiveAddress,
        balanceUsdt:
          liveUsdtFormatted !== null
            ? liveUsdtFormatted
            : cachedSnapshot?.usdtBalance ?? null,
        balanceEth:
          liveEthFormatted !== null
            ? liveEthFormatted
            : cachedSnapshot?.ethBalance ?? null,
        isCachedBalance: liveUsdtFormatted === null && cachedSnapshot?.usdtBalance != null,
        lastUpdatedAt: cachedSnapshot?.lastUpdatedAt || session?.lastVerifiedAt || null,
        isVerifiedUserWallet: true,
      }
    : null;

  useEffect(() => {
    if (!session?.user?.id || isLocked) {
      walletInitRef.current = '';
      return undefined;
    }
    if (!['NO_WALLET', 'LOCKED', 'READY'].includes(wdk.state?.status)) return undefined;
    if (wdk.state.status === 'READY' && wdk.state.walletId === walletId) {
      return undefined;
    }
    if (walletInitRef.current === walletId) return undefined;
    walletInitRef.current = walletId;
    (async () => {
      try {
        if (wdk.state.status === 'READY' || wdk.state.status === 'LOCKED') {
          await wdk.walletManager.lock();
        }
        await wdk.walletManager.unlock(walletId);
      } catch (err) {
        if (session?.user?.id) {
          walletInitRef.current = '';
          setWalletSetupRequired(true);
          setWalletSetupError(
            err?.message ||
              'No local wallet is available. Restore your wallet or create a new test wallet.'
          );
        }
      }
    })();
  }, [session?.user?.id, isLocked, walletId, wdk.state?.status, wdk.state?.walletId, wdk.walletManager]);

  useEffect(() => {
    if (isLocked && wdk.state?.status === 'READY') {
      wdk.walletManager.lock().catch(() => {});
    }
  }, [isLocked, wdk.state?.status, wdk.walletManager]);

  const handleSignOut = useCallback(async () => {
    try {
      await wdk.walletManager.lock();
    } catch {
      /* Signing remains unavailable until next unlock. */
    }
    const result = await mobileAuthService.signOut();
    setSession(null);
    setWalletSetupRequired(false);
    setWalletSetupError('');
    setIsLocked(false);
    setCurrentTab('wallet');
    if (result?.warning) {
      Alert.alert('Signed Out', result.warning);
    }
  }, [wdk.walletManager]);

  const handleReconnectAndRefresh = useCallback(async () => {
    setIsReconnecting(true);
    try {
      const reconciled = await mobileAuthService.reconcileSessionConnectivity();
      if (reconciled.status === 'revoked' || !reconciled.session) {
        Alert.alert(
          'Session Expired',
          'Your session expired or was revoked while offline. Please sign in again.'
        );
        await handleSignOut();
        return;
      }
      setSession(reconciled.session);
      if (wdk.state?.status === 'READY') {
        await Promise.allSettled([
          wdk.usdtBalance?.refetch?.(),
          wdk.ethBalance?.refetch?.(),
        ]);
      }
    } finally {
      setIsReconnecting(false);
    }
  }, [wdk.state?.status, wdk.usdtBalance, wdk.ethBalance, handleSignOut]);

  const confirmSignOut = () =>
    Alert.alert('Sign out of InterLink?', 'You can sign back in at any time.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ]);

  if (authLoading) {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F1F4F8" />
        <View style={styles.loadingScreen}>
          <Image
            source={require('./assets/interlink-logo.png')}
            style={styles.logoImageLarge}
            resizeMode="contain"
          />
          <Text style={styles.loadingBrand}>InterLink</Text>
          <Text style={styles.loadingCopy}>Getting your account ready…</Text>
        </View>
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0F1C" />
        <AuthFlowScreen
          onAuthenticated={(nextSession, meta) => {
            setIsNewAccount(Boolean(meta?.isNewAccount));
            setWalletSetupRequired(false);
            setWalletSetupError('');
            setSession(nextSession);
          }}
        />
      </View>
    );
  }

  if (walletSetupRequired && wdk.state?.status !== 'READY' && !walletReady) {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0F1C" />
        <WalletSetupScreen
          walletId={walletId}
          walletManager={wdk.walletManager}
          isNewAccount={isNewAccount}
          onComplete={() => {
            setWalletSetupRequired(false);
            setWalletSetupError('');
            setIsNewAccount(false);
            walletInitRef.current = walletId;
          }}
        />
        {walletSetupError ? (
          <Text style={{ color: '#FCA5A5', padding: 12 }}>{walletSetupError}</Text>
        ) : null}
      </View>
    );
  }

  if (!walletReady) {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F1F4F8" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#00B87A" />
          <Text style={styles.loadingCopy}>Unlocking this device’s WDK wallet…</Text>
        </View>
      </View>
    );
  }

  const handleNavigate = (tabName) => {
    if (['remittance', 'remit'].includes(tabName)) setCurrentTab('remittance');
    else if (['stokvel', 'pots'].includes(tabName)) setCurrentTab('stokvel');
    else if (['markets', 'trade'].includes(tabName)) setCurrentTab('markets');
    else if (['assets', 'portfolio', 'holdings'].includes(tabName)) setCurrentTab('assets');
    else if (['profile', 'account', 'security'].includes(tabName)) setCurrentTab('profile');
    else setCurrentTab('wallet');
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F1F4F8" />

      {/* --- MINIMALIST TOP NAV --- */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.brandGroup}
          activeOpacity={0.8}
          onPress={() => setCurrentTab('wallet')}
        >
          <Image
            source={require('./assets/interlink-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.brandTitle}>InterLink</Text>
            <Text style={styles.testnetSubLabel}>Sepolia Testnet · Test Funds Only</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.profileChip,
            currentTab === 'profile' && { backgroundColor: '#E2E8F0', borderColor: '#00B87A' },
          ]}
          activeOpacity={0.7}
          onPress={() => setCurrentTab(currentTab === 'profile' ? 'wallet' : 'profile')}
          accessibilityLabel="Profile and account settings"
        >
          <Ionicons
            name={currentTab === 'profile' ? 'arrow-back-outline' : 'person-outline'}
            size={18}
            color="#0A0F1C"
            style={{ marginRight: 8 }}
          />
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(session.user.fullName || session.user.email || 'U').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* --- PERSISTENT OFFLINE STATUS BANNER --- */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
            <Ionicons name="cloud-offline-outline" size={18} color="#92400E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineBannerTitle}>
                Offline Mode — Cached Data Only
              </Text>
              <Text style={styles.offlineBannerSub}>
                New broadcasts, live fee quotes, and withdrawals are disabled offline. You can view cached balances, inspect pending payments, or save unsigned payment drafts.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.reconnectBtn}
            onPress={handleReconnectAndRefresh}
            disabled={isReconnecting}
          >
            {isReconnecting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.reconnectBtnText}>Reconnect</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* --- SCREEN BODY --- */}
      <View
        style={styles.screenContainer}
        onTouchStart={() => sessionLockService.recordActivity()}
      >
        {currentTab === 'createPot' ? (
          <CreatePotScreen
            onBack={() => setCurrentTab('stokvel')}
            onSave={async (potData) => {
              await mobilePotsService.createPot(potData, wallet?.userId);
            }}
          />
        ) : (
          currentTab === 'wallet' && (
            <HomeScreen
              wallet={wallet}
              currentUser={session?.user}
              isOffline={isOffline}
              onRefresh={handleReconnectAndRefresh}
              onFeeQuote={async (recipientAddress, amountUsdt) => {
                if (isOffline) {
                  throw new Error(
                    'Offline: Cannot fetch a live Sepolia network fee quote without an internet connection. Save as an unsigned draft instead.'
                  );
                }
                return estimateUsdtTransferFee({
                  account: wdk.account,
                  to: recipientAddress,
                  amountUsdt,
                  asset: sepoliaUsdtAsset,
                });
              }}
              onTransfer={async (transfer) => {
                if (isOffline) {
                  throw new Error(
                    'Offline: Blockchain transactions cannot be broadcast while offline. Save this payment as a draft ("Draft — not sent") and submit when back online.'
                  );
                }
                if (!wdk.account?.account || !wallet) {
                  throw new Error(
                    'Unlock or restore your local WDK wallet first. No funds were moved.'
                  );
                }
                const resolvedRecipient = transfer.recipientAddressOrUsername;
                if (!isSafePersonalEvmAddress(resolvedRecipient)) {
                  throw new Error(
                    'Enter a supported Ethereum Sepolia wallet address (0x...). No funds were moved.'
                  );
                }
                const result = await submitOrCheckUsdtTransfer({
                  requestId: transfer.requestId || createPaymentRequestId(),
                  account: wdk.account,
                  to: resolvedRecipient,
                  amountUsdt: String(transfer.amountUsdt),
                  asset: sepoliaUsdtAsset,
                  ethAsset: sepoliaEthAsset,
                  reviewedFeeQuote: transfer.reviewedFeeQuote || null,
                  skipPreSendRecheck: Boolean(transfer.skipPreSendRecheck),
                  scopeKey: walletId,
                  note: transfer.note || '',
                  expiresAt: transfer.expiresAt || null,
                });
                if (session?.user?.id && result?.requestId) {
                  mobileWalletService
                    .syncSelfCustodyPaymentStatus(session.user.id, result)
                    .catch(() => {});
                }
                return result;
              }}
              onFaucet={async () =>
                Alert.alert(
                  'Test-Only Sepolia Faucet Info',
                  'Sepolia USDT and Sepolia ETH are test-only tokens with no real-world value. Request Sepolia ETH from a public Sepolia faucet and test USDT from the configured Sepolia test token faucet. InterLink never fabricates or simulates balances.'
                )
              }
              onNavigate={handleNavigate}
            />
          )
        )}
        {currentTab === 'profile' && (
          <ProfileScreen
            user={session.user}
            wallet={wallet}
            isOffline={isOffline}
            onBack={() => setCurrentTab('wallet')}
            onSignOut={confirmSignOut}
            onProfileUpdated={(updated) => {
              setSession((prev) => ({
                ...prev,
                user: {
                  ...prev.user,
                  ...updated,
                },
              }));
            }}
          />
        )}
        {currentTab === 'assets' && (
          <AssetsScreen
            wallet={wallet}
            currentUser={session.user}
            isOffline={isOffline}
            onNavigate={handleNavigate}
          />
        )}
        {currentTab === 'remittance' && <RemittanceScreen />}
        {currentTab === 'stokvel' && (
          <StokvelScreen
            onNavigate={(target) =>
              target === 'CreatePot' ? setCurrentTab('createPot') : handleNavigate(target)
            }
          />
        )}
        {currentTab === 'markets' && (
          <MarketsScreen
            wallet={wallet}
            currentUser={session.user}
            onNavigate={handleNavigate}
          />
        )}
      </View>

      {/* --- FLUID FLOATING BOTTOM NAV --- */}
      <View style={styles.floatingNavContainer} pointerEvents="box-none">
        <View style={[styles.floatingNavBar, styles.ultraShadow]}>
          {TABS.map((tab) => (
            <AnimatedTabButton
              key={tab.id}
              item={tab}
              isFocused={currentTab === tab.id}
              onPress={() => setCurrentTab(tab.id)}
            />
          ))}
        </View>
      </View>

      {/* Session Inactivity & Background Lock Overlay */}
      <SessionLockOverlay
        visible={Boolean(session && isLocked)}
        userEmail={session?.user?.email}
        isOffline={isOffline}
        onUnlocked={() => sessionLockService.unlock()}
        onSignOut={handleSignOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F4F8',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F4F8',
  },
  loadingBrand: { color: '#0A0F1C', fontSize: 22, fontWeight: '900', marginTop: 13 },
  loadingCopy: { color: '#64748B', fontSize: 13, marginTop: 8 },

  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#F1F4F8',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImage: {
    width: 38,
    height: 38,
    backgroundColor: 'transparent',
  },
  logoImageLarge: {
    width: 48,
    height: 48,
    backgroundColor: 'transparent',
  },
  brandTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0A0F1C',
    letterSpacing: -0.8,
  },
  testnetSubLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  offlineBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  offlineBannerSub: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
    marginTop: 2,
  },
  reconnectBtn: {
    backgroundColor: '#92400E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reconnectBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 6,
    paddingLeft: 14,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A0F1C',
  },

  screenContainer: {
    flex: 1,
    backgroundColor: '#F1F4F8',
  },

  floatingNavContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 24,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  floatingNavBar: {
    flexDirection: 'row',
    backgroundColor: '#0A0F1C',
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  ultraShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
  },
  tabLabelAnimated: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A0F1C',
    marginLeft: 6,
  },
});
