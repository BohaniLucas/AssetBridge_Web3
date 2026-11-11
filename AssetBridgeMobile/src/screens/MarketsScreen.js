import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';

const MARKET_TOKENS = [
  { symbol: 'tAAPL', name: 'Tokenised Apple Inc.', priceUsdt: 234.80, change24h: '+1.45%', type: 'Stock' },
  { symbol: 'tTSLA', name: 'Tokenised Tesla Inc.', priceUsdt: 218.60, change24h: '+3.12%', type: 'Stock' },
  { symbol: 'tKES', name: 'Kenyan Shilling RWA', priceUsdt: 0.0077, change24h: '-0.15%', type: 'Currency' },
  { symbol: 'tZAR', name: 'South African Rand RWA', priceUsdt: 0.056, change24h: '+0.34%', type: 'Currency' },
  { symbol: 'tNGN', name: 'Nigerian Naira RWA', priceUsdt: 0.0006, change24h: '-0.20%', type: 'Currency' },
];

export default function MarketsScreen({ wallet, onTrade }) {
  const [selectedToken, setSelectedToken] = useState(null);

  const handleBuy = async (token) => {
    const cost = 25; // Buy $25 worth of token
    if ((wallet?.balanceUsdt || 0) < cost) {
      Alert.alert('Insufficient Balance', `You need $${cost} USDT to trade, but have $${wallet?.balanceUsdt || 0} USDT.`);
      return;
    }

    try {
      await onTrade({ symbol: token.symbol, amountUsdt: cost });
      Alert.alert(
        'Order Executed',
        `Acquired $${cost} USDT worth of ${token.symbol} at $${token.priceUsdt} with 0.15% locked spread!`
      );
    } catch (err) {
      Alert.alert('Trade Failed', err.message || 'Execution error');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Tokenised Real-World Assets</Text>
        <Text style={styles.subtitle}>Fractional US Equities & African FX backed on Sepolia</Text>
      </View>

      <View style={styles.oracleBanner}>
        <Text style={styles.oracleDot}>●</Text>
        <Text style={styles.oracleText}>Finnhub WebSocket & open.er-api.com live quotes</Text>
      </View>

      {MARKET_TOKENS.map((token) => {
        const isPositive = token.change24h.startsWith('+');
        return (
          <View key={token.symbol} style={styles.tokenCard}>
            <View style={styles.tokenLeft}>
              <View style={styles.tokenIconBox}>
                <Text style={styles.tokenIconText}>{token.symbol.slice(1, 3)}</Text>
              </View>
              <View>
                <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                <Text style={styles.tokenName}>{token.name}</Text>
              </View>
            </View>

            <View style={styles.tokenRight}>
              <Text style={styles.tokenPrice}>${token.priceUsdt.toFixed(4)}</Text>
              <Text style={[styles.tokenChange, isPositive ? styles.greenChange : styles.redChange]}>
                {token.change24h}
              </Text>
            </View>

            <TouchableOpacity style={styles.buyBtn} onPress={() => handleBuy(token)}>
              <Text style={styles.buyBtnText}>Trade</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  header: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 3 },
  oracleBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 10, borderRadius: 12, marginBottom: 16, borderColor: '#DCFCE7', borderWidth: 1 },
  oracleDot: { color: '#16A34A', fontSize: 12, marginRight: 6 },
  oracleText: { fontSize: 11, color: '#166534', fontWeight: '600' },
  tokenCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 },
  tokenLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  tokenIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  tokenIconText: { fontSize: 12, fontWeight: '800', color: '#0284C7' },
  tokenSymbol: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  tokenName: { fontSize: 10, color: '#64748B', marginTop: 1 },
  tokenRight: { alignItems: 'flex-end', marginRight: 12 },
  tokenPrice: { fontSize: 13, fontWeight: '900', color: '#0F172A', fontFamily: 'monospace' },
  tokenChange: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  greenChange: { color: '#059669' },
  redChange: { color: '#DC2626' },
  buyBtn: { backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  buyBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
});

