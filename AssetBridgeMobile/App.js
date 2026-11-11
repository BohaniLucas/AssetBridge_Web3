import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import WalletScreen from './src/screens/WalletScreen';
import WallyScreen from './src/screens/WallyScreen';
import RemittanceScreen from './src/screens/RemittanceScreen';
import StokvelScreen from './src/screens/StokvelScreen';
import MarketsScreen from './src/screens/MarketsScreen';
import { mobileWalletService } from './src/services/walletService';

export default function App() {
  const [activeTab, setActiveTab] = useState('wallet'); // 'wallet' | 'wally' | 'remittance' | 'stokvel' | 'markets'
  const [wallet, setWallet] = useState(null);
  const [currentUser] = useState('malulekelucas04@gmail.com');

  const loadWallet = async () => {
    const data = await mobileWalletService.getOrCreateWallet(currentUser);
    setWallet({ ...data });
  };

  useEffect(() => {
    loadWallet();
  }, []);

  const handleTransfer = async ({ recipient, amount, note }) => {
    const result = await mobileWalletService.transfer({
      senderUserId: currentUser,
      recipientAddressOrUsername: recipient,
      amountUsdt: amount,
      note,
    });
    if (result.senderWallet) {
      setWallet({ ...result.senderWallet });
    } else {
      await loadWallet();
    }
  };

  const handleFaucet = async () => {
    const result = await mobileWalletService.claimFaucet(currentUser);
    if (result.wallet) {
      setWallet({ ...result.wallet });
    }
  };

  const handleSendRemittance = async ({ amountUsdt, recipient }) => {
    await handleTransfer({
      recipient,
      amount: amountUsdt,
      note: 'Cross-border remittance',
    });
  };

  const handleContributeStokvel = async ({ amountUsdt }) => {
    await handleTransfer({
      recipient: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
      amount: amountUsdt,
      note: 'Stokvel monthly round contribution',
    });
  };

  const handleTrade = async ({ symbol, amountUsdt }) => {
    await handleTransfer({
      recipient: '0x2f3A40A3db8a7e3D09B0adfEfbCe4f67d904297B',
      amount: amountUsdt,
      note: `Swap Tether for ${symbol}`,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Mobile Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>AB</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>AssetBridge Mobile</Text>
            <Text style={styles.userSubtitle}>{currentUser}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Sepolia</Text>
          </View>
        </View>
      </View>

      {/* Screen Switcher */}
      <View style={styles.screenContainer}>
        {activeTab === 'wallet' && (
          <WalletScreen
            wallet={wallet}
            onRefresh={loadWallet}
            onTransfer={handleTransfer}
            onFaucet={handleFaucet}
          />
        )}

        {activeTab === 'wally' && (
          <WallyScreen
            wallet={wallet}
            onExecuteTransfer={handleTransfer}
          />
        )}

        {activeTab === 'remittance' && (
          <RemittanceScreen
            wallet={wallet}
            onSendRemittance={handleSendRemittance}
          />
        )}

        {activeTab === 'stokvel' && (
          <StokvelScreen
            wallet={wallet}
            onContribute={handleContributeStokvel}
          />
        )}

        {activeTab === 'markets' && (
          <MarketsScreen
            wallet={wallet}
            onTrade={handleTrade}
          />
        )}
      </View>

      {/* Modern Bottom Navigation Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'wallet' && styles.tabBtnActive]}
          onPress={() => setActiveTab('wallet')}
        >
          <Text style={styles.tabIcon}>💳</Text>
          <Text style={[styles.tabLabel, activeTab === 'wallet' && styles.tabLabelActive]}>Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'wally' && styles.tabBtnActive]}
          onPress={() => setActiveTab('wally')}
        >
          <Text style={styles.tabIcon}>🤖</Text>
          <Text style={[styles.tabLabel, activeTab === 'wally' && styles.tabLabelActive]}>Wally AI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'remittance' && styles.tabBtnActive]}
          onPress={() => setActiveTab('remittance')}
        >
          <Text style={styles.tabIcon}>🌍</Text>
          <Text style={[styles.tabLabel, activeTab === 'remittance' && styles.tabLabelActive]}>Remit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'stokvel' && styles.tabBtnActive]}
          onPress={() => setActiveTab('stokvel')}
        >
          <Text style={styles.tabIcon}>👥</Text>
          <Text style={[styles.tabLabel, activeTab === 'stokvel' && styles.tabLabelActive]}>Stokvels</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'markets' && styles.tabBtnActive]}
          onPress={() => setActiveTab('markets')}
        >
          <Text style={styles.tabIcon}>📈</Text>
          <Text style={[styles.tabLabel, activeTab === 'markets' && styles.tabLabelActive]}>Markets</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#00C29A', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  brandTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  userSubtitle: { fontSize: 10, color: '#64748B' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 5 },
  liveText: { fontSize: 10, fontWeight: '700', color: '#065F46' },
  screenContainer: { flex: 1 },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingBottom: 16,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  tabBtnActive: {},
  tabIcon: { fontSize: 18, marginBottom: 2 },
  tabLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  tabLabelActive: { color: '#00C29A', fontWeight: '800' },
});
