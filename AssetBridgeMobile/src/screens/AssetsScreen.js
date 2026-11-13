import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { portfolioService } from '../services/portfolioService';
import { mobileMarketService } from '../services/marketService';

function formatCurrency(val) {
  if (val == null || !Number.isFinite(Number(val))) return '$0.00';
  const num = Number(val);
  if (num >= 1000) {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${num.toFixed(2)}`;
}

export default function AssetsScreen({
  wallet,
  currentUser,
  isOffline,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState('holdings'); // 'holdings' | 'trades'
  const [holdings, setHoldings] = useState([]);
  const [trades, setTrades] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Buy Modal State
  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [selectedAssetForBuy, setSelectedAssetForBuy] = useState(null);
  const [buyAmountUsdt, setBuyAmountUsdt] = useState('');
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState('');

  // Sell Modal State
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [selectedHoldingForSell, setSelectedHoldingForSell] = useState(null);
  const [sellQuantity, setSellQuantity] = useState('');
  const [isSelling, setIsSelling] = useState(false);
  const [sellError, setSellError] = useState('');

  const userId = currentUser?.id || wallet?.userId;
  const usdtBalance = Number(wallet?.balanceUsdt || 0);

  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await portfolioService.getPortfolio(userId);
      setHoldings(data.holdings || []);
      setTrades(data.trades || []);

      // Fetch live market data to update asset values
      if (!isOffline) {
        try {
          const markets = await mobileMarketService.getMarkets('all');
          const priceMap = {};
          (markets.assets || []).forEach((a) => {
            if (a.symbol) priceMap[a.symbol.toUpperCase()] = Number(a.price);
          });
          setLivePrices(priceMap);
        } catch {
          // Fallback to last recorded prices
        }
      }
    } catch {
      // Best-effort load
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [userId, isOffline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Calculate Portfolio Value
  const portfolioSummary = useMemo(() => {
    let investedValue = 0;
    let totalCostBasis = 0;

    holdings.forEach((h) => {
      const livePrice = livePrices[h.symbol.toUpperCase()] ?? h.lastPrice ?? h.avgBuyPrice ?? 0;
      const currentVal = (h.quantity || 0) * livePrice;
      investedValue += currentVal;
      totalCostBasis += h.totalCostBasis || 0;
    });

    const totalPortfolioValue = usdtBalance + investedValue;
    const totalPnL = investedValue - totalCostBasis;
    const pnlPercent = totalCostBasis > 0 ? (totalPnL / totalCostBasis) * 100 : 0;

    return {
      totalValue: totalPortfolioValue,
      investedValue,
      cashBalance: usdtBalance,
      totalPnL,
      pnlPercent,
    };
  }, [holdings, livePrices, usdtBalance]);

  // Open Buy Modal
  const openBuyModal = (asset) => {
    setSelectedAssetForBuy(asset);
    setBuyAmountUsdt('');
    setBuyError('');
    setBuyModalVisible(true);
  };

  // Execute Buy
  const handleConfirmBuy = async () => {
    setBuyError('');
    const amount = Number(buyAmountUsdt);
    if (!Number.isFinite(amount) || amount <= 0) {
      return setBuyError('Enter an amount in USDT greater than 0.');
    }
    if (amount > usdtBalance) {
      return setBuyError(
        `Insufficient USDT balance. You have $${usdtBalance.toFixed(2)} USDT available.`
      );
    }

    const price =
      livePrices[selectedAssetForBuy.symbol.toUpperCase()] ||
      selectedAssetForBuy.price ||
      selectedAssetForBuy.lastPrice;

    if (!price || price <= 0) {
      return setBuyError('Live price unavailable for this asset.');
    }

    setIsBuying(true);
    try {
      await portfolioService.buyAsset({
        userId,
        asset: {
          ...selectedAssetForBuy,
          price,
        },
        amountUsdt: amount,
      });

      setBuyModalVisible(false);
      Alert.alert(
        'Purchase Executed',
        `Successfully bought ${(amount / price).toFixed(4)} ${selectedAssetForBuy.symbol} for $${amount.toFixed(2)} USDT.`
      );
      await loadData();
    } catch (err) {
      setBuyError(err.message || 'Failed to complete purchase.');
    } finally {
      setIsBuying(false);
    }
  };

  // Open Sell Modal
  const openSellModal = (holding) => {
    setSelectedHoldingForSell(holding);
    setSellQuantity('');
    setSellError('');
    setSellModalVisible(true);
  };

  // Execute Sell
  const handleConfirmSell = async () => {
    setSellError('');
    const qty = Number(sellQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return setSellError('Enter a valid quantity to sell.');
    }
    if (qty > selectedHoldingForSell.quantity + 0.000001) {
      return setSellError(
        `You cannot sell more than your available balance (${selectedHoldingForSell.quantity.toFixed(4)}).`
      );
    }

    const price =
      livePrices[selectedHoldingForSell.symbol.toUpperCase()] ||
      selectedHoldingForSell.lastPrice ||
      selectedHoldingForSell.avgBuyPrice;

    if (!price || price <= 0) {
      return setSellError('Live price unavailable for this asset.');
    }

    setIsSelling(false);
    try {
      const res = await portfolioService.sellAsset({
        userId,
        symbol: selectedHoldingForSell.symbol,
        quantity: qty,
        currentPrice: price,
      });

      setSellModalVisible(false);
      Alert.alert(
        'Sale Confirmed',
        `Successfully sold ${qty.toFixed(4)} ${selectedHoldingForSell.symbol} for $${res.proceedsUsdt.toFixed(2)} USDT.`
      );
      await loadData();
    } catch (err) {
      setSellError(err.message || 'Failed to execute sale.');
    } finally {
      setIsSelling(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Portfolio & Assets</Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => onNavigate && onNavigate('markets')}
            activeOpacity={0.7}
          >
            <Ionicons name="trending-up-outline" size={16} color="#00B87A" />
            <Text style={styles.exploreBtnText}>Markets</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00B87A"
            />
          }
        >
          {/* Portfolio Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(portfolioSummary.totalValue)}
            </Text>

            <View style={styles.pnlRow}>
              <View
                style={[
                  styles.pnlBadge,
                  portfolioSummary.totalPnL >= 0 ? styles.pnlBadgeGreen : styles.pnlBadgeRed,
                ]}
              >
                <Ionicons
                  name={portfolioSummary.totalPnL >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={portfolioSummary.totalPnL >= 0 ? '#059669' : '#DC2626'}
                />
                <Text
                  style={[
                    styles.pnlText,
                    portfolioSummary.totalPnL >= 0 ? styles.pnlTextGreen : styles.pnlTextRed,
                  ]}
                >
                  {portfolioSummary.totalPnL >= 0 ? '+' : ''}
                  {formatCurrency(portfolioSummary.totalPnL)} (
                  {portfolioSummary.pnlPercent.toFixed(2)}%)
                </Text>
              </View>
              <Text style={styles.pnlSub}>Unrealized Profit/Loss</Text>
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Cash (USDT)</Text>
                <Text style={styles.breakdownVal}>
                  {formatCurrency(portfolioSummary.cashBalance)}
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Invested Assets</Text>
                <Text style={styles.breakdownVal}>
                  {formatCurrency(portfolioSummary.investedValue)}
                </Text>
              </View>
            </View>
          </View>

          {/* Segment Control */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'holdings' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('holdings')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  activeTab === 'holdings' && styles.segmentBtnTextActive,
                ]}
              >
                My Holdings ({holdings.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'trades' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('trades')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  activeTab === 'trades' && styles.segmentBtnTextActive,
                ]}
              >
                Trade History ({trades.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content: Holdings */}
          {activeTab === 'holdings' && (
            <View>
              {isLoading ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="large" color="#00B87A" />
                  <Text style={styles.loadingText}>Loading your asset holdings…</Text>
                </View>
              ) : holdings.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="pie-chart-outline" size={36} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyTitle}>No Assets Held Yet</Text>
                  <Text style={styles.emptySubtitle}>
                    When you buy stocks, crypto, or commodities from the markets, they will appear here. You can monitor their live performance and sell them at any time.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => onNavigate && onNavigate('markets')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyActionBtnText}>Explore Markets & Buy Assets</Text>
                    <Ionicons name="arrow-forward" size={16} color="#0A0F1C" />
                  </TouchableOpacity>
                </View>
              ) : (
                holdings.map((h) => {
                  const livePrice =
                    livePrices[h.symbol.toUpperCase()] ?? h.lastPrice ?? h.avgBuyPrice ?? 0;
                  const currentVal = (h.quantity || 0) * livePrice;
                  const pnl = currentVal - (h.totalCostBasis || 0);
                  const pnlPct =
                    h.totalCostBasis > 0 ? (pnl / h.totalCostBasis) * 100 : 0;

                  return (
                    <View key={h.symbol} style={styles.holdingCard}>
                      <View style={styles.holdingTopRow}>
                        <View style={styles.holdingAssetGroup}>
                          <View style={styles.holdingIconBox}>
                            <Text style={styles.holdingIconText}>
                              {h.symbol.slice(0, 3)}
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                            <Text style={styles.holdingName}>{h.name}</Text>
                          </View>
                        </View>
                        <View style={styles.holdingValueCol}>
                          <Text style={styles.holdingValText}>
                            {formatCurrency(currentVal)}
                          </Text>
                          <Text
                            style={[
                              styles.holdingPnlText,
                              pnl >= 0 ? styles.textGreen : styles.textRed,
                            ]}
                          >
                            {pnl >= 0 ? '+' : ''}
                            {formatCurrency(pnl)} ({pnlPct.toFixed(2)}%)
                          </Text>
                        </View>
                      </View>

                      <View style={styles.holdingDetailsRow}>
                        <View style={styles.holdingDetailItem}>
                          <Text style={styles.holdingDetailLabel}>Quantity</Text>
                          <Text style={styles.holdingDetailVal}>
                            {Number(h.quantity).toFixed(4)}
                          </Text>
                        </View>
                        <View style={styles.holdingDetailItem}>
                          <Text style={styles.holdingDetailLabel}>Avg Buy Price</Text>
                          <Text style={styles.holdingDetailVal}>
                            {formatCurrency(h.avgBuyPrice)}
                          </Text>
                        </View>
                        <View style={styles.holdingDetailItem}>
                          <Text style={styles.holdingDetailLabel}>Live Price</Text>
                          <Text style={styles.holdingDetailVal}>
                            {formatCurrency(livePrice)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.holdingActionsRow}>
                        <TouchableOpacity
                          style={[styles.holdingBtn, styles.holdingBtnBuy]}
                          onPress={() =>
                            openBuyModal({
                              symbol: h.symbol,
                              name: h.name,
                              price: livePrice,
                              category: h.category,
                            })
                          }
                          activeOpacity={0.8}
                        >
                          <Ionicons name="add" size={16} color="#059669" />
                          <Text style={styles.holdingBtnBuyText}>Buy More</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.holdingBtn, styles.holdingBtnSell]}
                          onPress={() => openSellModal(h)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="arrow-up-outline" size={16} color="#DC2626" />
                          <Text style={styles.holdingBtnSellText}>Sell</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* Tab Content: Trade History */}
          {activeTab === 'trades' && (
            <View>
              {trades.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No Trade History</Text>
                  <Text style={styles.emptySubtitle}>
                    Your completed asset buy and sell transactions will be recorded here.
                  </Text>
                </View>
              ) : (
                trades.map((tr) => (
                  <View key={tr.id} style={styles.tradeCard}>
                    <View style={styles.tradeHeaderRow}>
                      <View style={styles.tradeTypeTag}>
                        <Ionicons
                          name={tr.type === 'BUY' ? 'arrow-down' : 'arrow-up'}
                          size={14}
                          color={tr.type === 'BUY' ? '#059669' : '#DC2626'}
                        />
                        <Text
                          style={[
                            styles.tradeTypeText,
                            tr.type === 'BUY' ? styles.textGreen : styles.textRed,
                          ]}
                        >
                          {tr.type} {tr.symbol}
                        </Text>
                      </View>
                      <Text style={styles.tradeTimestamp}>
                        {new Date(tr.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    <View style={styles.tradeDetailsRow}>
                      <Text style={styles.tradeQuantity}>
                        {Number(tr.units).toFixed(4)} {tr.symbol} @ {formatCurrency(tr.price)}
                      </Text>
                      <Text style={styles.tradeTotal}>
                        {formatCurrency(tr.amountUsdt)} USDT
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* BUY MODAL */}
        <Modal
          visible={buyModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setBuyModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Buy {selectedAssetForBuy?.symbol}
                </Text>
                <TouchableOpacity
                  onPress={() => setBuyModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#0A0F1C" />
                </TouchableOpacity>
              </View>

              {buyError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorBoxText}>{buyError}</Text>
                </View>
              ) : null}

              <View style={styles.modalPriceCard}>
                <Text style={styles.modalPriceLabel}>Live Execution Price</Text>
                <Text style={styles.modalPriceVal}>
                  {formatCurrency(
                    livePrices[selectedAssetForBuy?.symbol?.toUpperCase()] ||
                      selectedAssetForBuy?.price
                  )}
                </Text>
                <Text style={styles.modalPriceBalance}>
                  Available Cash: ${usdtBalance.toFixed(2)} USDT
                </Text>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputSectionLabel}>USDT Amount to Spend</Text>
                <View style={styles.amountInputWrap}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={buyAmountUsdt}
                    onChangeText={setBuyAmountUsdt}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                  <Text style={styles.currencySuffix}>USDT</Text>
                </View>

                {/* Quick % buttons */}
                <View style={styles.quickPercentRow}>
                  {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={styles.quickPercentBtn}
                      onPress={() =>
                        setBuyAmountUsdt((usdtBalance * pct).toFixed(2))
                      }
                    >
                      <Text style={styles.quickPercentText}>
                        {pct === 1.0 ? 'MAX' : `${pct * 100}%`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Estimate */}
              {Number(buyAmountUsdt) > 0 && selectedAssetForBuy && (
                <View style={styles.estimateBox}>
                  <Text style={styles.estimateLabel}>Estimated Asset Units:</Text>
                  <Text style={styles.estimateVal}>
                    {(
                      Number(buyAmountUsdt) /
                      (livePrices[selectedAssetForBuy.symbol.toUpperCase()] ||
                        selectedAssetForBuy.price ||
                        1)
                    ).toFixed(4)}{' '}
                    {selectedAssetForBuy.symbol}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.confirmBuyBtn, isBuying && { opacity: 0.7 }]}
                onPress={handleConfirmBuy}
                disabled={isBuying}
                activeOpacity={0.8}
              >
                {isBuying ? (
                  <ActivityIndicator size="small" color="#0A0F1C" />
                ) : (
                  <Text style={styles.confirmBuyBtnText}>
                    Confirm Purchase
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* SELL MODAL */}
        <Modal
          visible={sellModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setSellModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Sell {selectedHoldingForSell?.symbol}
                </Text>
                <TouchableOpacity
                  onPress={() => setSellModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#0A0F1C" />
                </TouchableOpacity>
              </View>

              {sellError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorBoxText}>{sellError}</Text>
                </View>
              ) : null}

              <View style={styles.modalPriceCard}>
                <Text style={styles.modalPriceLabel}>Live Market Price</Text>
                <Text style={styles.modalPriceVal}>
                  {formatCurrency(
                    livePrices[selectedHoldingForSell?.symbol?.toUpperCase()] ||
                      selectedHoldingForSell?.lastPrice
                  )}
                </Text>
                <Text style={styles.modalPriceBalance}>
                  Available to Sell: {Number(selectedHoldingForSell?.quantity).toFixed(4)}{' '}
                  {selectedHoldingForSell?.symbol}
                </Text>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputSectionLabel}>Quantity to Sell</Text>
                <View style={styles.amountInputWrap}>
                  <TextInput
                    style={[styles.amountInput, { textAlign: 'left', paddingLeft: 12 }]}
                    value={sellQuantity}
                    onChangeText={setSellQuantity}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                  <Text style={styles.currencySuffix}>
                    {selectedHoldingForSell?.symbol}
                  </Text>
                </View>

                {/* Quick % buttons */}
                <View style={styles.quickPercentRow}>
                  {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={styles.quickPercentBtn}
                      onPress={() => {
                        const totalQty = selectedHoldingForSell?.quantity || 0;
                        setSellQuantity((totalQty * pct).toFixed(4));
                      }}
                    >
                      <Text style={styles.quickPercentText}>
                        {pct === 1.0 ? 'MAX' : `${pct * 100}%`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Estimate */}
              {Number(sellQuantity) > 0 && selectedHoldingForSell && (
                <View style={styles.estimateBox}>
                  <Text style={styles.estimateLabel}>Estimated USDT Received:</Text>
                  <Text style={styles.estimateVal}>
                    $
                    {(
                      Number(sellQuantity) *
                      (livePrices[selectedHoldingForSell.symbol.toUpperCase()] ||
                        selectedHoldingForSell.lastPrice ||
                        0)
                    ).toFixed(2)}{' '}
                    USDT
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.confirmSellBtn, isSelling && { opacity: 0.7 }]}
                onPress={handleConfirmSell}
                disabled={isSelling}
                activeOpacity={0.8}
              >
                {isSelling ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmSellBtnText}>
                    Confirm Sale
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F4F8',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#F1F4F8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F1F4F8',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0A0F1C',
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
  },
  exploreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00B87A',
  },
  scrollContent: {
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#0A0F1C',
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 6,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  pnlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pnlBadgeGreen: {
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
  },
  pnlBadgeRed: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
  },
  pnlText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pnlTextGreen: {
    color: '#34D399',
  },
  pnlTextRed: {
    color: '#F87171',
  },
  pnlSub: {
    fontSize: 11,
    color: '#64748B',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  breakdownItem: {
    flex: 1,
  },
  breakdownDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  breakdownVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#0A0F1C',
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0A0F1C',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00E676',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  holdingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  holdingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  holdingAssetGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  holdingIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdingIconText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#00E676',
  },
  holdingSymbol: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  holdingName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  holdingValueCol: {
    alignItems: 'flex-end',
  },
  holdingValText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  holdingPnlText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  textGreen: {
    color: '#059669',
  },
  textRed: {
    color: '#DC2626',
  },
  holdingDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  holdingDetailItem: {
    alignItems: 'center',
  },
  holdingDetailLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  holdingDetailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A0F1C',
    marginTop: 2,
  },
  holdingActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  holdingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 12,
  },
  holdingBtnBuy: {
    backgroundColor: '#ECFDF5',
  },
  holdingBtnBuyText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  holdingBtnSell: {
    backgroundColor: '#FEF2F2',
  },
  holdingBtnSellText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  tradeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tradeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tradeTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tradeTypeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  tradeTimestamp: {
    fontSize: 11,
    color: '#94A3B8',
  },
  tradeDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradeQuantity: {
    fontSize: 13,
    color: '#64748B',
  },
  tradeTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A0F1C',
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 28, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
    color: '#0A0F1C',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  errorBoxText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    flex: 1,
  },
  modalPriceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  modalPriceLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalPriceVal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0A0F1C',
    marginTop: 4,
  },
  modalPriceBalance: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
    marginTop: 4,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    backgroundColor: '#F8FAFC',
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A0F1C',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  currencySuffix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  quickPercentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  quickPercentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  quickPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  estimateBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 18,
  },
  estimateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  estimateVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  confirmBuyBtn: {
    backgroundColor: '#00E676',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBuyBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  confirmSellBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSellBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

