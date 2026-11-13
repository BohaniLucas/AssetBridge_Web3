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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './src/screens/HomeScreen';
import RemittanceScreen from './src/screens/RemittanceScreen';
import StokvelScreen from './src/screens/StokvelScreen';
import MarketsScreen from './src/screens/MarketsScreen';
import CreatePotScreen from './src/screens/CreatePotScreen';
import AuthFlowScreen from './src/screens/AuthFlowScreen';
import SessionLockOverlay from './src/components/SessionLockOverlay';
import { mobileAuthService } from './src/services/authService';
import { mobileWalletService } from './src/services/walletService';
import { mobilePotsService } from './src/services/potsService';
import { sessionLockService } from './src/services/sessionLockService';

// --- CUSTOM ANIMATED TAB BUTTON ---
const AnimatedTabButton = ({ item, isFocused, onPress }) => {
  const animatedWidth = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: isFocused ? 1 : 0,
      tension: 50,
      friction: 8,
      useNativeDriver: false, // Must be false for layout animation (width/padding)
    }).start();
  }, [isFocused]);

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

export default function App() {
  const [currentTab, setCurrentTab] = useState('wallet');
  const [wallet, setWallet] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
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

  const loadWallet = async () => {
    if (!session?.user?.id) return;
    try {
      const w = await mobileWalletService.getOrCreateWallet(session.user.id);
      setWallet(w);
    } catch {
      setWallet(null);
    }
  };

  useEffect(() => {
    if (session?.user?.id) loadWallet();
    else setWallet(null);
  }, [session?.user?.id]);

  const handleSignOut = async () => {
    const result = await mobileAuthService.signOut();
    setSession(null);
    setWallet(null);
    setIsLocked(false);
    setCurrentTab('wallet');
    if (result?.warning) {
      Alert.alert('Signed Out', result.warning);
    }
  };

  const confirmSignOut = () => Alert.alert(
    'Sign out of AssetBridge?',
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
          <View style={styles.logoBadge}><Ionicons name="infinite" size={24} color="#00E676" /></View>
          <Text style={styles.loadingBrand}>AssetBridge</Text>
          <Text style={styles.loadingCopy}>Getting your account ready…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session?.user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0F1C" />
        <AuthFlowScreen onAuthenticated={(nextSession) => setSession(nextSession)} />
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
          <View style={styles.logoBadge}>
            <Ionicons name="infinite" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.brandTitle}>AssetBridge</Text>
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
            onRefresh={async () => { setRefreshing(true); await loadWallet(); setRefreshing(false); }}
            onTransfer={async (transfer) => {
              const result = await mobileWalletService.transfer(transfer);
              setWallet(result.senderWallet || await mobileWalletService.getOrCreateWallet(wallet?.userId));
              return result;
            }}
            onFaucet={async () => {
              try {
                await mobileWalletService.claimFaucet(wallet?.userId);
                await loadWallet();
              } catch (error) {
                Alert.alert('Test funds unavailable', error.message || 'No funds were added.');
              }
            }}
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
    gap: 12,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#0A0F1C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A0F1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
