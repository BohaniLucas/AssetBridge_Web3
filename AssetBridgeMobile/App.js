import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
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
import { WdkAppProvider, useAccount, useBalance, useWalletManager, useWdkApp, BaseAsset } from '@tetherto/wdk-react-native-core';
import { bundle } from './.wdk';

import HomeScreen from './src/screens/HomeScreen';
import RemittanceScreen from './src/screens/RemittanceScreen';
import StokvelScreen from './src/screens/StokvelScreen';
import MarketsScreen from './src/screens/MarketsScreen';
import CreatePotScreen from './src/screens/CreatePotScreen';
import AuthFlowScreen from './src/screens/AuthFlowScreen';
import WalletSetupScreen from './src/screens/WalletSetupScreen';
import SessionLockOverlay from './src/components/SessionLockOverlay';
import { mobileAuthService } from './src/services/authService';
import { isSafePersonalEvmAddress, parseUsdtToBaseUnits } from './src/services/walletService';
import { assetBridgeUsdt, wdkConfigs } from './src/config/wdk';
import { createPaymentRequestId, quoteUsdtTransfer, submitOrCheckUsdtTransfer } from './src/services/wdkPaymentService';
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
      useNativeDriver: false, // Must be false for layout animation (width/padding)
    }).start();
  }, [isFocused, animatedWidth]);

  // Interpolations for smooth transitions
  const pillPadding = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 20],
  });
  
  const textOpacity = animatedWidth.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const textWidth = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60], // Adjust based on your longest label
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

const WDK_USDT_ASSET = new BaseAsset(assetBridgeUsdt);

function walletIdForUser(userId) {
  return `assetbridge-${String(userId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function WdkRuntime() {
  const { state: wdkState } = useWdkApp();
  const walletManager = useWalletManager();
  const { account, address } = useAccount({ network: 'ethereum', accountIndex: 0 });
  const balance = useBalance(0, WDK_USDT_ASSET, { refetchInterval: 30000 });
  return <AppShell wdk={{ state: wdkState, walletManager, account, address, balance }} />;
}

export default function App() {
  return (
    <WdkAppProvider bundle={{ bundle }} wdkConfigs={wdkConfigs}>
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
  const walletInitRef = useRef('');
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let mounted = true;
    mobileAuthService.restoreSession()
      .then((savedSession) => {
        if (mounted) {
          setSession(savedSession);
          if (savedSession && sessionLockService.hasIdleExpired()) {
            sessionLockService.lock();
          }
        }
      })
      .catch(() => { if (mounted) setSession(null); })
      .finally(() => { if (mounted) setAuthLoading(false); });

    // Subscribe to session lock updates
    const unsubscribe = sessionLockService.subscribe((locked) => {
      if (mounted) setIsLocked(locked);
    });

    // App state listener handles OS backgrounding & suspend/resume timing
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      sessionLockService.handleAppStateChange(nextAppState, appStateRef.current);
      appStateRef.current = nextAppState;
    });

    // Foreground periodic idle timer check (every 10s)
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
    { id: 'remittance', label: 'Remit', activeIcon: 'paper-plane', inactiveIcon: 'paper-plane-outline' },
    { id: 'stokvel', label: 'Stokvels', activeIcon: 'people', inactiveIcon: 'people-outline' },
    { id: 'markets', label: 'Markets', activeIcon: 'analytics', inactiveIcon: 'analytics-outline' },
  ];

  const walletId = session?.user?.id ? walletIdForUser(session.user.id) : '';
  const walletReady = Boolean(session?.user?.id && wdk.state?.status === 'READY' && wdk.state.walletId === walletId && wdk.address);
  const wallet = walletReady
    ? { userId: session.user.id, address: wdk.address, balanceUsdt: wdk.balance.data?.balance == null ? null : Number(wdk.balance.data.balance) / 1e6, isVerifiedUserWallet: true }
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
        if (wdk.state.status === 'READY' || wdk.state.status === 'LOCKED') await wdk.walletManager.lock();
        await wdk.walletManager.unlock(walletId);
      } catch (err) {
        if (session?.user?.id) {
          walletInitRef.current = '';
          setWalletSetupRequired(true);
          setWalletSetupError(err?.message || 'No local wallet is available. Restore your wallet or create a new test wallet.');
        }
      }
    })();
  }, [session?.user?.id, isLocked, walletId, wdk.state?.status, wdk.state?.walletId, wdk.walletManager]);

  useEffect(() => {
    if (isLocked && wdk.state?.status === 'READY') {
      wdk.walletManager.lock().catch(() => {});
    }
  }, [isLocked, wdk.state?.status, wdk.walletManager]);

  const loadWallet = async () => {
    if (wdk.state?.status === 'READY') {
      await wdk.balance.refetch?.();
    }
  };

  const handleSignOut = async () => {
    try { await wdk.walletManager.lock(); } catch { /* Signing remains unavailable until next unlock. */ }
    const result = await mobileAuthService.signOut();
    setSession(null);
    setWalletSetupRequired(false);
    setWalletSetupError('');
    setIsLocked(false);
    setCurrentTab('wallet');
    if (result?.warning) {
      Alert.alert('Signed Out', result.warning);
    }
  };

  const confirmSignOut = () => Alert.alert(
    'Sign out of InterLink?',
    'You can sign back in at any time.',
    [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ],
  );

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
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
      </SafeAreaView>
    );
  }

  if (!session?.user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0F1C" />
        <AuthFlowScreen onAuthenticated={(nextSession, meta) => { setIsNewAccount(Boolean(meta?.isNewAccount)); setWalletSetupRequired(false); setWalletSetupError(''); setSession(nextSession); }} />
      </SafeAreaView>
    );
  }

  if (walletSetupRequired && wdk.state?.status !== 'READY') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0F1C" />
        <WalletSetupScreen
          walletId={walletId}
          walletManager={wdk.walletManager}
          isNewAccount={isNewAccount}
          onComplete={() => { setWalletSetupRequired(false); setWalletSetupError(''); setIsNewAccount(false); walletInitRef.current = walletId; }}
        />
        {walletSetupError ? <Text style={{ color: '#FCA5A5', padding: 12 }}>{walletSetupError}</Text> : null}
      </SafeAreaView>
    );
  }

  if (!walletReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F1F4F8" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#00B87A" />
          <Text style={styles.loadingCopy}>Unlocking this device’s wallet…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleNavigate = (tabName) => {
    if (['remittance', 'remit'].includes(tabName)) setCurrentTab('remittance');
    else if (['stokvel', 'pots'].includes(tabName)) setCurrentTab('stokvel');
    else if (['markets', 'trade'].includes(tabName)) setCurrentTab('markets');
    else setCurrentTab('wallet');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F1F4F8" />

      {/* --- MINIMALIST TOP NAV --- */}
      <View style={styles.topNav}>
        <View style={styles.brandGroup}>
          <Image
            source={require('./assets/interlink-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>InterLink</Text>
        </View>

        <TouchableOpacity style={styles.profileChip} activeOpacity={0.7} onPress={confirmSignOut} accessibilityLabel="Sign out">
          <Ionicons name="log-out-outline" size={19} color="#0A0F1C" style={{ marginRight: 9 }} />
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(session.user.fullName || session.user.email || 'U').slice(0, 1).toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* --- SCREEN BODY --- */}
      <View
        style={styles.screenContainer}
        onTouchStart={() => sessionLockService.recordActivity()}
      >
        {currentTab === 'createPot' ? (
          <CreatePotScreen onBack={() => setCurrentTab('stokvel')} onSave={async (potData) => {
            await mobilePotsService.createPot(potData, wallet?.userId);
          }} />
        ) : currentTab === 'wallet' && (
          <HomeScreen 
            wallet={wallet}
            currentUser={session?.user}
            onRefresh={loadWallet}
            onFeeQuote={async (recipientAddress, amountBaseUnits) => {
              const q = await quoteUsdtTransfer(wdk.account, recipientAddress, amountBaseUnits);
              const feeWei = BigInt(q.fee || 0);
              return { ...q, feeEth: (Number(feeWei) / 1e18).toFixed(6), feeUsdt: 'testnet value unavailable' };
            }}
            onTransfer={async (transfer) => {
              if (!wdk.account || !wallet) throw new Error('Unlock or restore your local WDK wallet first. No funds were moved.');
              const resolvedRecipient = transfer.recipientAddressOrUsername;
              if (!isSafePersonalEvmAddress(resolvedRecipient)) throw new Error('Enter a supported Ethereum Sepolia wallet address. Username resolution is not yet connected. No funds were moved.');
              const amountBaseUnits = parseUsdtToBaseUnits(String(transfer.amountUsdt));
              return submitOrCheckUsdtTransfer(wdk.account, { requestId: transfer.requestId || createPaymentRequestId(), recipient: resolvedRecipient, amountBaseUnits, approvedFeeWei: transfer.approvedFeeWei });
            }}
            onFaucet={async () => Alert.alert('Sepolia test funds', 'Request Sepolia ETH from a trusted Sepolia faucet and Sepolia test USDT from the configured test-token source. This app does not mint or add funds.')}
            onNavigate={handleNavigate} 
          />
        )}
        {currentTab === 'remittance' && <RemittanceScreen />}
        {currentTab === 'stokvel' && <StokvelScreen onNavigate={(target) => target === 'CreatePot' ? setCurrentTab('createPot') : handleNavigate(target)} />}
        {currentTab === 'markets' && <MarketsScreen />}
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
        onUnlocked={() => sessionLockService.unlock()}
        onSignOut={handleSignOut}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F4F8', // Soft cool gray keeps white surfaces distinct
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F4F8' },
  loadingBrand: { color: '#0A0F1C', fontSize: 22, fontWeight: '900', marginTop: 13 },
  loadingCopy: { color: '#64748B', fontSize: 13, marginTop: 8 },

  /* --- TOP NAV (Ultra Minimal & Clean) --- */
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
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
    fontSize: 22,
    fontWeight: '900',
    color: '#0A0F1C',
    letterSpacing: -0.8,
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
  notificationDot: {
    position: 'absolute',
    top: 6,
    left: 24,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 10,
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

  /* --- BODY --- */
  screenContainer: {
    flex: 1,
    backgroundColor: '#F1F4F8',
  },

  /* --- FLUID BOTTOM NAV --- */
  floatingNavContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 24,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  floatingNavBar: {
    flexDirection: 'row',
    backgroundColor: '#0A0F1C', // Obsidian Dark
    borderRadius: 100, // Perfect stadium shape
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ultraShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16, // Heavy drop shadow so it visually lifts off the screen
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
