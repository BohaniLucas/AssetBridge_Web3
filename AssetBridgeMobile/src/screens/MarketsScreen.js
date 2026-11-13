import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mobileMarketService } from '../services/marketService';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'gainers', label: 'Top Gainers' },
  { id: 'losers', label: 'Top Losers' },
  { id: 'active', label: 'Most Active' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
];

const TIME_RANGES = [
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '1y', label: '1Y' },
];

function formatPrice(price) {
  if (price == null || !Number.isFinite(Number(price))) return '$0.00';
  const num = Number(price);
  if (num >= 1000) {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (num >= 1) {
    return `$${num.toFixed(2)}`;
  }
  return `$${num.toFixed(4)}`;
}

function formatVolume(vol) {
  if (vol == null || !Number.isFinite(Number(vol)) || vol <= 0) return 'N/A';
  const num = Number(vol);
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

export default function MarketsScreen() {
  const [assets, setAssets] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Asset Detail Modal State
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedRange, setSelectedRange] = useState('24h');
  const [historyData, setHistoryData] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Load Markets
  const loadMarkets = useCallback(async (cat = selectedCategory, isPull = false) => {
    if (!isPull) setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await mobileMarketService.getMarkets(cat);
      setAssets(data.assets || []);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to connect to market feed.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadMarkets(selectedCategory);
  }, [selectedCategory, loadMarkets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMarkets(selectedCategory, true);
  }, [selectedCategory, loadMarkets]);

  // Dynamic Search handler
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await mobileMarketService.searchMarkets(q);
        setSearchResults(results);
      } catch {
        // Fallback to local filtering if backend search fails
        const filtered = assets.filter(
          (a) =>
            a.symbol.toLowerCase().includes(q.toLowerCase()) ||
            a.name.toLowerCase().includes(q.toLowerCase()) ||
            a.baseSymbol?.toLowerCase().includes(q.toLowerCase())
        );
        setSearchResults(filtered);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, assets]);

  // Load history when selected asset or range changes
  useEffect(() => {
    if (!selectedAsset) {
      setHistoryData(null);
      return;
    }

    let isSubscribed = true;
    setIsHistoryLoading(true);

    mobileMarketService
      .getAssetHistory(selectedAsset.id || selectedAsset.symbol, selectedRange)
      .then((res) => {
        if (isSubscribed) {
          setHistoryData(res);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          setHistoryData({
            historyAvailable: false,
            reason: err.message || 'Historical candle feed is currently unavailable for this tier.',
            points: [],
          });
        }
      })
      .finally(() => {
        if (isSubscribed) setIsHistoryLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [selectedAsset, selectedRange]);

  const displayedAssets = searchResults !== null ? searchResults : assets;

  // Compute chart statistics when points exist
  const chartStats = useMemo(() => {
    if (!historyData?.points || historyData.points.length === 0) return null;
    const prices = historyData.points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const diff = last - first;
    const pct = first > 0 ? (diff / first) * 100 : 0;
    return {
      min,
      max,
      rangeSpread: max - min || 1,
      first,
      last,
      diff,
      pct,
      isUp: diff >= 0,
      count: prices.length,
    };
  }, [historyData]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Markets</Text>
          <Text style={styles.headerSub}>Live crypto prices, equities & currency rates</Text>
        </View>

        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by symbol or asset name…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isSearching && <ActivityIndicator size="small" color="#00C29A" style={styles.searchLoader} />}
          {searchQuery.length > 0 && !isSearching && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        
        {searchResults === null && (
          <View style={styles.categoryScrollWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        
        {isLoading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#00C29A" />
            <Text style={styles.loadingText}>Loading truthful market data…</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={40} color="#F43F5E" />
            <Text style={styles.errorTitle}>Connection Issue</Text>
            <Text style={styles.errorSub}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadMarkets(selectedCategory)}>
              <Text style={styles.retryBtnText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        ) : displayedAssets.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="search-outline" size={40} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No matching assets found</Text>
            <Text style={styles.emptySub}>
              {searchQuery ? `No assets match "${searchQuery}".` : 'No instruments found in this category.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.listScrollView}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C29A" />}
            showsVerticalScrollIndicator={false}
          >
            {displayedAssets.map((asset) => {
              const isForex = asset.assetClass === 'forex' || asset.rateType === 'daily_reference';
              const hasChange = asset.changePercent24h != null && Number.isFinite(Number(asset.changePercent24h));
              const isUp = hasChange && Number(asset.changePercent24h) >= 0;

              return (
                <TouchableOpacity
                  key={asset.id || asset.symbol}
                  style={styles.assetCard}
                  onPress={() => {
                    setSelectedAsset(asset);
                    setSelectedRange('24h');
                  }}
                  activeOpacity={0.7}
                >
                  
                  <View style={styles.assetLeft}>
                    {asset.logoUrl ? (
                      <Image source={{ uri: asset.logoUrl }} style={styles.assetLogo} resizeMode="contain" />
                    ) : (
                      <View style={styles.assetFallbackLogo}>
                        <Text style={styles.assetFallbackText}>
                          {(asset.baseSymbol || asset.symbol).slice(0, 3)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.assetTitles}>
                      <View style={styles.symbolRow}>
                        <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                        <View
                          style={[
                            styles.classPill,
                            asset.assetClass === 'crypto'
                              ? styles.classPillCrypto
                              : asset.assetClass === 'equity'
                              ? styles.classPillEquity
                              : styles.classPillForex,
                          ]}
                        >
                          <Text
                            style={[
                              styles.classPillText,
                              asset.assetClass === 'crypto'
                                ? styles.classPillTextCrypto
                                : asset.assetClass === 'equity'
                                ? styles.classPillTextEquity
                                : styles.classPillTextForex,
                            ]}
                          >
                            {asset.assetClass === 'crypto' ? 'Binance' : asset.assetClass === 'equity' ? 'Finnhub' : 'OpenER'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.assetName} numberOfLines={1}>
                        {asset.name}
                      </Text>
                    </View>
                  </View>

                  
                  <View style={styles.assetRight}>
                    <Text style={styles.assetPrice}>{formatPrice(asset.price)}</Text>
                    {isForex ? (
                      <View style={styles.refBadge}>
                        <Text style={styles.refBadgeText}>Daily Ref</Text>
                      </View>
                    ) : hasChange ? (
                      <View style={[styles.changeBadge, isUp ? styles.changeUp : styles.changeDown]}>
                        <Ionicons
                          name={isUp ? 'trending-up' : 'trending-down'}
                          size={11}
                          color={isUp ? '#059669' : '#E11D48'}
                          style={{ marginRight: 2 }}
                        />
                        <Text style={[styles.changeText, isUp ? styles.changeTextUp : styles.changeTextDown]}>
                          {isUp ? '+' : ''}
                          {Number(asset.changePercent24h).toFixed(2)}%
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.refBadge}>
                        <Text style={styles.refBadgeText}>Live</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        
        <Modal
          visible={!!selectedAsset}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedAsset(null)}
        >
          {selectedAsset && (
            <SafeAreaView style={styles.modalContainer}>
              
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedAsset(null)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={22} color="#0F172A" />
                </TouchableOpacity>
                <View style={styles.modalHeaderTitles}>
                  <Text style={styles.modalAssetSymbol}>{selectedAsset.symbol}</Text>
                  <Text style={styles.modalAssetName} numberOfLines={1}>
                    {selectedAsset.name}
                  </Text>
                </View>
                <View style={{ width: 36 }} />
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                
                <View style={styles.modalPriceCard}>
                  <View style={styles.modalPriceHeader}>
                    {selectedAsset.logoUrl ? (
                      <Image source={{ uri: selectedAsset.logoUrl }} style={styles.modalLargeLogo} resizeMode="contain" />
                    ) : (
                      <View style={[styles.assetFallbackLogo, { width: 44, height: 44, borderRadius: 22 }]}>
                        <Text style={[styles.assetFallbackText, { fontSize: 13 }]}>
                          {(selectedAsset.baseSymbol || selectedAsset.symbol).slice(0, 3)}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.modalBigPrice}>{formatPrice(selectedAsset.price)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        {selectedAsset.changePercent24h != null ? (
                          <View
                            style={[
                              styles.changeBadge,
                              Number(selectedAsset.changePercent24h) >= 0 ? styles.changeUp : styles.changeDown,
                            ]}
                          >
                            <Ionicons
                              name={Number(selectedAsset.changePercent24h) >= 0 ? 'trending-up' : 'trending-down'}
                              size={12}
                              color={Number(selectedAsset.changePercent24h) >= 0 ? '#059669' : '#E11D48'}
                              style={{ marginRight: 3 }}
                            />
                            <Text
                              style={[
                                styles.changeText,
                                Number(selectedAsset.changePercent24h) >= 0 ? styles.changeTextUp : styles.changeTextDown,
                              ]}
                            >
                              {Number(selectedAsset.changePercent24h) >= 0 ? '+' : ''}
                              {Number(selectedAsset.changePercent24h).toFixed(2)}% (24h)
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.refBadge}>
                            <Text style={styles.refBadgeText}>Daily Benchmark Rate</Text>
                          </View>
                        )}
                        <Text style={styles.modalProviderSource}>via {selectedAsset.source || 'Official Feed'}</Text>
                      </View>
                    </View>
                  </View>

                  
                  <View style={styles.rangeSwitcher}>
                    {TIME_RANGES.map((r) => {
                      const isSel = selectedRange === r.id;
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={[styles.rangeTab, isSel && styles.rangeTabActive]}
                          onPress={() => setSelectedRange(r.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.rangeTabText, isSel && styles.rangeTabTextActive]}>{r.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  
                  <View style={styles.chartWrapper}>
                    {isHistoryLoading ? (
                      <View style={styles.chartEmptyBox}>
                        <ActivityIndicator size="small" color="#00C29A" />
                        <Text style={styles.chartNoticeText}>Fetching historical candle series…</Text>
                      </View>
                    ) : historyData?.historyAvailable && chartStats ? (
                      <View style={styles.chartRealBox}>
                        <View style={styles.chartStatsHeader}>
                          <View>
                            <Text style={styles.chartStatLabel}>Range Low</Text>
                            <Text style={styles.chartStatValue}>{formatPrice(chartStats.min)}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.chartStatLabel}>Range High</Text>
                            <Text style={styles.chartStatValue}>{formatPrice(chartStats.max)}</Text>
                          </View>
                        </View>

                        
                        <View style={styles.sparklineContainer}>
                          {historyData.points.slice(-48).map((pt, idx, arr) => {
                            const normalized = Math.max(
                              0.08,
                              Math.min(1, (pt.price - chartStats.min) / chartStats.rangeSpread)
                            );
                            const prev = idx > 0 ? arr[idx - 1].price : pt.price;
                            const isBarUp = pt.price >= prev;
                            return (
                              <View key={idx} style={styles.sparklineCol}>
                                <View
                                  style={[
                                    styles.sparklineBar,
                                    {
                                      height: `${Math.round(normalized * 100)}%`,
                                      backgroundColor: isBarUp ? '#10B981' : '#F43F5E',
                                    },
                                  ]}
                                />
                              </View>
                            );
                          })}
                        </View>

                        <View style={styles.chartStatsFooter}>
                          <Text style={styles.chartPeriodText}>
                            {chartStats.count} authentic points ({historyData.source || 'Provider Klines'})
                          </Text>
                          <Text
                            style={[
                              styles.chartPeriodDiff,
                              chartStats.isUp ? { color: '#059669' } : { color: '#E11D48' },
                            ]}
                          >
                            {chartStats.isUp ? '+' : ''}
                            {chartStats.pct.toFixed(2)}% in {selectedRange.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.chartEmptyBox}>
                        <Ionicons name="information-circle-outline" size={26} color="#64748B" />
                        <Text style={styles.chartNoticeTitle}>Historical Series Not Available</Text>
                        <Text style={styles.chartNoticeText}>
                          {historyData?.reason ||
                            'Historical candles require an upgraded provider tier or are not published for daily reference rates. Showing live snapshot.'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Market Attributes</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>24h High</Text>
                      <Text style={styles.statVal}>
                        {selectedAsset.high24h != null ? formatPrice(selectedAsset.high24h) : 'N/A (Daily Ref)'}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>24h Low</Text>
                      <Text style={styles.statVal}>
                        {selectedAsset.low24h != null ? formatPrice(selectedAsset.low24h) : 'N/A (Daily Ref)'}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>24h Volume</Text>
                      <Text style={styles.statVal}>{formatVolume(selectedAsset.volume24h)}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Asset Class</Text>
                      <Text style={[styles.statVal, { textTransform: 'capitalize' }]}>
                        {selectedAsset.assetClass || 'Instrument'}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Pricing Feed</Text>
                      <Text style={styles.statVal}>{selectedAsset.source || 'Direct Feed'}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Feed Cadence</Text>
                      <Text style={styles.statVal}>
                        {selectedAsset.rateType === 'daily_reference' ? 'Daily (~00:00 UTC)' : 'Real-time Ticks'}
                      </Text>
                    </View>
                  </View>
                </View>

                
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity style={[styles.tradeActionBtn, styles.tradeActionBtnBuy]} activeOpacity={0.8}>
                    <Text style={styles.tradeActionBtnText}>Buy {selectedAsset.baseSymbol || selectedAsset.symbol}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.tradeActionBtn, styles.tradeActionBtnSell]} activeOpacity={0.8}>
                    <Text style={styles.tradeActionBtnText}>Sell</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>
            </SafeAreaView>
          )}
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  searchLoader: {
    marginLeft: 6,
  },
  categoryScrollWrapper: {
    height: 46,
    marginVertical: 4,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#0F766E',
    flex: 1,
    lineHeight: 15,
  },
  listScrollView: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 10,
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  assetLogo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    marginRight: 12,
  },
  assetFallbackLogo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  assetFallbackText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  assetTitles: {
    flex: 1,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assetSymbol: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  classPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  classPillCrypto: {
    backgroundColor: '#FEF3C7',
  },
  classPillEquity: {
    backgroundColor: '#E0E7FF',
  },
  classPillForex: {
    backgroundColor: '#F3E8FF',
  },
  classPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  classPillTextCrypto: {
    color: '#92400E',
  },
  classPillTextEquity: {
    color: '#3730A3',
  },
  classPillTextForex: {
    color: '#6B21A8',
  },
  assetName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  assetRight: {
    alignItems: 'flex-end',
  },
  assetPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    marginTop: 4,
  },
  changeUp: {
    backgroundColor: '#ECFDF5',
  },
  changeDown: {
    backgroundColor: '#FFF1F2',
  },
  changeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  changeTextUp: {
    color: '#059669',
  },
  changeTextDown: {
    color: '#E11D48',
  },
  refBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    marginTop: 4,
  },
  refBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  errorSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitles: {
    alignItems: 'center',
    maxWidth: 220,
  },
  modalAssetSymbol: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalAssetName: {
    fontSize: 12,
    color: '#64748B',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  modalPriceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  modalPriceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalLargeLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
  },
  modalBigPrice: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  modalProviderSource: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 8,
    fontWeight: '600',
  },
  rangeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginTop: 16,
    marginBottom: 14,
  },
  rangeTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 9,
  },
  rangeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  rangeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  rangeTabTextActive: {
    color: '#0F172A',
  },
  chartWrapper: {
    minHeight: 140,
    justifyContent: 'center',
  },
  chartEmptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  chartNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginTop: 8,
  },
  chartNoticeText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  chartRealBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  chartStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chartStatLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  chartStatValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  sparklineContainer: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sparklineCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    marginHorizontal: 0.5,
  },
  sparklineBar: {
    width: '100%',
    borderRadius: 1.5,
    minHeight: 3,
  },
  chartStatsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
  },
  chartPeriodText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  chartPeriodDiff: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    width: '47%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tradeActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeActionBtnBuy: {
    backgroundColor: '#00C29A',
  },
  tradeActionBtnSell: {
    backgroundColor: '#0F172A',
  },
  tradeActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
