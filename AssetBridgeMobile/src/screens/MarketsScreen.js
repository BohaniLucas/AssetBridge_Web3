import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { marketService, TOKENS } from '../services/marketService';

const filterCategories = ['All', 'Equities', 'Currencies'];

export default function MarketsScreen() {
  const [tokens, setTokens] = useState(TOKENS);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [tradeAction, setTradeAction] = useState('buy'); // 'buy' or 'sell'
  const [tradeAmount, setTradeAmount] = useState('');
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    let isActive = true;
    Promise.all([marketService.getLiveAssets()])
      .then(([liveTokens]) => {
        if (isActive && liveTokens?.length) setTokens(liveTokens);
      })
      .catch(() => {});
    return () => { isActive = false; };
  }, []);

  const filteredTokens = tokens.filter((t) => {
    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'Equities') return t.type === 'equity';
    if (selectedFilter === 'Currencies') return t.type === 'currency';
    return true;
  });

  const activeAsset = selectedAsset || tokens[1] || TOKENS[1];
  const numTradeAmount = Number(tradeAmount) || 0;
  const quote = marketService.getQuote({
    symbol: activeAsset.symbol,
    action: tradeAction,
    amountUsdt: numTradeAmount,
    tokenAmount: numTradeAmount,
  });

  const handleOpenTrade = (asset, action = 'buy') => {
    setSelectedAsset(asset);
    setTradeAction(action);
    setTradeAmount('');
    setShowTradeModal(true);
  };

  const handleOpenInfo = (asset) => {
    setSelectedAsset(asset);
    setShowInfoModal(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* Hero Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SAMPLE DATA · NOT LIVE OR TRADEABLE</Text>
        </View>
        <Text style={styles.heroTitle}>Global Markets & FX</Text>
        <Text style={styles.heroSub}>
          Example market values only. This app has no verified tokenised equities, currency reserves, or trading settlement connected.
        </Text>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {filterCategories.map((c) => {
          const isSel = selectedFilter === c;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.filterChip, isSel && styles.filterChipActive]}
              onPress={() => setSelectedFilter(c)}
            >
              <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Assets Grid */}
      <View style={styles.assetsList}>
        {filteredTokens.map((asset) => {
          const isUp = (asset.change24h || 0) >= 0;
          return (
            <View key={asset.symbol} style={styles.assetCard}>
              <View style={styles.assetHeader}>
                <View style={styles.assetSymbolBox}>
                  <Text style={styles.assetSymbolText}>{asset.symbol}</Text>
                </View>
                <View style={styles.assetMeta}>
                  <Text style={styles.assetName}>{asset.name}</Text>
                  <Text style={styles.assetType}>
                    {asset.type === 'equity' ? 'US Common Stock' : asset.type === 'currency' ? 'Forex Currency' : 'Stablecoin'}
                  </Text>
                </View>
                <View style={styles.priceMeta}>
                  <Text style={styles.assetPrice}>
                    ${asset.price >= 1 ? asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : asset.price.toFixed(4)}
                  </Text>
                  <View style={[styles.changeBadge, isUp ? styles.changeUp : styles.changeDown]}>
                    <Text style={[styles.changeText, isUp ? styles.changeTextUp : styles.changeTextDown]}>
                      {isUp ? '+' : ''}{asset.change24h?.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.assetBacking} numberOfLines={1}>
                🛡️ {asset.backing}
              </Text>

              {/* Action Buttons */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.infoBtn}
                  onPress={() => handleOpenInfo(asset)}
                >
                  <Text style={styles.infoBtnText}>Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.buyBtn}
                  onPress={() => handleOpenTrade(asset, 'buy')}
                >
                  <Text style={styles.buyBtnText}>Buy / Swap</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Trade Modal */}
      <Modal visible={showTradeModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trade {activeAsset.name}</Text>
              <TouchableOpacity onPress={() => setShowTradeModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Buy / Sell Toggle */}
            <View style={styles.tradeToggle}>
              <TouchableOpacity
                style={[styles.tradeToggleBtn, tradeAction === 'buy' && styles.tradeToggleBtnBuy]}
                onPress={() => setTradeAction('buy')}
              >
                <Text style={[styles.tradeToggleText, tradeAction === 'buy' && styles.tradeToggleTextActive]}>
                  Buy {activeAsset.symbol}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tradeToggleBtn, tradeAction === 'sell' && styles.tradeToggleBtnSell]}
                onPress={() => setTradeAction('sell')}
              >
                <Text style={[styles.tradeToggleText, tradeAction === 'sell' && styles.tradeToggleTextActive]}>
                  Sell {activeAsset.symbol}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>
              {tradeAction === 'buy' ? 'Pay with USDT' : `Sell ${activeAsset.symbol}`}
            </Text>
            <View style={styles.tradeInputRow}>
              <Text style={styles.tradeCurrencyPrefix}>{tradeAction === 'buy' ? '$' : ''}</Text>
              <TextInput
                style={styles.tradeInput}
                value={tradeAmount}
                onChangeText={(t) => setTradeAmount(t.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.tradeUnitTag}>
                {tradeAction === 'buy' ? 'USDT' : activeAsset.symbol}
              </Text>
            </View>

            {/* Quote Summary */}
            <View style={styles.quoteBox}>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Market Price</Text>
                <Text style={styles.quoteVal}>${activeAsset.price.toFixed(4)}</Text>
              </View>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Fixed Liquidity Fee (0.15%)</Text>
                <Text style={styles.quoteVal}>${quote.feeUsdt.toFixed(3)} USDT</Text>
              </View>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>
                  {tradeAction === 'buy' ? 'You Receive' : 'You Receive in USDT'}
                </Text>
                <Text style={[styles.quoteVal, { color: '#00C29A', fontWeight: '800' }]}>
                  {tradeAction === 'buy'
                    ? `${quote.tokensReceived.toFixed(4)} ${activeAsset.symbol}`
                    : `$${quote.netUsdt.toFixed(2)} USDT`}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.executeBtn, { opacity: 0.55 }]}
              disabled
            >
              <Text style={styles.executeBtnText}>Trading unavailable</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Info Modal */}
      <Modal visible={showInfoModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.infoModalBox}>
            <Text style={styles.infoModalTitle}>{activeAsset.name} ({activeAsset.symbol})</Text>
            <Text style={styles.infoModalSub}>Tokenized Asset Specification</Text>

            <View style={styles.specList}>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Underlying</Text>
                <Text style={styles.specVal}>{activeAsset.name}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Asset Category</Text>
                <Text style={styles.specVal}>{activeAsset.type.toUpperCase()}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Custody & Backing</Text>
                <Text style={[styles.specVal, { flex: 1, textAlign: 'right' }]}>{activeAsset.backing}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Settlement Speed</Text>
                <Text style={styles.specVal}>Instant 24/7 on Sepolia EVM</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Pricing Feed</Text>
                <Text style={styles.specVal}>Finnhub + Binance Realtime API</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.executeBtn}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.executeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  heroBanner: {
    backgroundColor: '#101936',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 194, 154, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 194, 154, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  badgeText: {
    color: '#00C29A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSub: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#101936',
    borderColor: '#101936',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  assetsList: {
    gap: 12,
  },
  assetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  assetSymbolBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 12,
  },
  assetSymbolText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  assetMeta: {
    flex: 1,
  },
  assetName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  assetType: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  priceMeta: {
    alignItems: 'flex-end',
  },
  assetPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  changeBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
  },
  changeUp: {
    backgroundColor: '#EAF9F3',
  },
  changeDown: {
    backgroundColor: '#FEE2E2',
  },
  changeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  changeTextUp: {
    color: '#00C29A',
  },
  changeTextDown: {
    color: '#EF4444',
  },
  assetBacking: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 14,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  infoBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  buyBtn: {
    flex: 2,
    backgroundColor: '#101936',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
    padding: 4,
  },
  tradeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tradeToggleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  tradeToggleBtnBuy: {
    backgroundColor: '#00C29A',
  },
  tradeToggleBtnSell: {
    backgroundColor: '#EF4444',
  },
  tradeToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tradeToggleTextActive: {
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  tradeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  tradeCurrencyPrefix: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 6,
  },
  tradeInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    paddingVertical: 10,
  },
  tradeUnitTag: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  quoteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quoteLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  quoteVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  executeBtn: {
    backgroundColor: '#101936',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  executeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  infoModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    margin: 20,
    alignSelf: 'center',
    width: '90%',
  },
  infoModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  infoModalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 16,
  },
  specList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 18,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  specLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  specVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
});

