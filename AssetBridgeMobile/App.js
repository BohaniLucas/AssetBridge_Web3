import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import RemittanceScreen from './src/screens/RemittanceScreen';
import StokvelScreen from './src/screens/StokvelScreen';
import MarketsScreen from './src/screens/MarketsScreen';
import { mobileWalletService } from './src/services/walletService';

export default function App() {
  const [currentTab, setCurrentTab] = useState('wallet'); // 'wallet' | 'remittance' | 'stokvel' | 'markets'
  const [wallet, setWallet] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadWallet = async () => {
    try {
      const w = await mobileWalletService.getWallet();
      setWallet(w);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWallet();
    setRefreshing(false);
  };

  const handleFaucet = async () => {
    try {
      const updated = await mobileWalletService.requestFaucet();
      setWallet(updated);
      Alert.alert('Faucet Credited', '+250.00 USDT added to your Sepolia wallet balance!');
    } catch (err) {
      Alert.alert('Faucet Failed', err.message || 'Error requesting testnet USDT');
    }
  };

  const handleTransfer = async ({ recipient, amount, note }) => {
    const res = await mobileWalletService.transferUsdt({ recipient, amount, note });
    await loadWallet();
    return res;
  };

  const handleNavigate = (tabName) => {
    if (tabName === 'remittance' || tabName === 'remit') {
      setCurrentTab('remittance');
    } else if (tabName === 'stokvel' || tabName === 'pots') {
      setCurrentTab('stokvel');
    } else if (tabName === 'markets' || tabName === 'trade') {
      setCurrentTab('markets');
    } else {
      setCurrentTab('wallet');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#101936" />

      {/* Top Header Navbar */}
      <View style={styles.navBar}>
        <View style={styles.brandGroup}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>AB</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>AssetBridge</Text>
            <View style={styles.networkBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.networkText}>Sepolia EVM · Pure Fintech</Text>
            </View>
          </View>
        </View>

        <View style={styles.userChip}>
          <Text style={styles.userInitial}>M</Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            malulekelucas04@gmail.com
          </Text>
        </View>
      </View>

      {/* Main Screen Body */}
      <View style={styles.screenContainer}>
        {currentTab === 'wallet' && (
          <HomeScreen
            wallet={wallet}
            onRefresh={handleRefresh}
            onTransfer={handleTransfer}
            onFaucet={handleFaucet}
            onNavigate={handleNavigate}
          />
        )}
        {currentTab === 'remittance' && <RemittanceScreen />}
        {currentTab === 'stokvel' && <StokvelScreen />}
        {currentTab === 'markets' && <MarketsScreen />}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {/* Tab 1: Wallet */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('wallet')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, currentTab === 'wallet' && styles.tabIconActive]}>💳</Text>
          <Text style={[styles.tabLabel, currentTab === 'wallet' && styles.tabLabelActive]}>Wallet</Text>
        </TouchableOpacity>

        {/* Tab 2: Remit */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('remittance')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, currentTab === 'remittance' && styles.tabIconActive]}>🌍</Text>
          <Text style={[styles.tabLabel, currentTab === 'remittance' && styles.tabLabelActive]}>Remit</Text>
        </TouchableOpacity>

        {/* Tab 3: Stokvels */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('stokvel')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, currentTab === 'stokvel' && styles.tabIconActive]}>👥</Text>
          <Text style={[styles.tabLabel, currentTab === 'stokvel' && styles.tabLabelActive]}>Stokvels</Text>
        </TouchableOpacity>

        {/* Tab 4: Markets */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('markets')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, currentTab === 'markets' && styles.tabIconActive]}>📈</Text>
          <Text style={[styles.tabLabel, currentTab === 'markets' && styles.tabLabelActive]}>Markets</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#101936',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#101936',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#00C29A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#00C29A',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  logoText: {
    color: '#101936',
    fontWeight: '900',
    fontSize: 16,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00C29A',
    marginRight: 5,
  },
  networkText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 130,
  },
  userInitial: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00C29A',
    color: '#101936',
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 11,
    fontWeight: '900',
    marginRight: 6,
  },
  userEmail: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '600',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 3,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#00C29A',
    fontWeight: '800',
  },
});
