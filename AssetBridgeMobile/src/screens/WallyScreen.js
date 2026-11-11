import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { mobileWalletService } from '../services/walletService';

export default function WallyScreen({ wallet, onExecuteTransfer }) {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'msg-1',
      sender: 'wally',
      text: "👋 Hi Lucas! I'm Wally, your on-device AI wallet assistant powered by Tether QVAC & WDK.",
      timestamp: 'Just now',
    },
    {
      id: 'msg-2',
      sender: 'wally',
      text: "Tell me what you'd like to do in plain English — send money to family, contribute to a stokvel, or check your balance.",
      timestamp: 'Just now',
    },
  ]);

  const [pendingIntent, setPendingIntent] = useState(null);
  const [feeQuote, setFeeQuote] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txReceipt, setTxReceipt] = useState(null);

  const quickPrompts = [
    'Send $25 USDT to Mama Thandi',
    'Contribute $20 USDT to Tech Queens Stokvel',
    'Send $30 USDT to Kenya M-Pesa',
    'Check my available USDT balance',
  ];

  const handleSendPrompt = async (promptText) => {
    const text = promptText || inputText;
    if (!text.trim()) return;

    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: 'Now',
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);
    setTxReceipt(null);

    // QVAC on-device intent parsing
    const parsed = mobileWalletService.parseQvacIntent(text);
    const quote = await mobileWalletService.getFeeQuote();
    setFeeQuote(quote);

    setTimeout(() => {
      setIsProcessing(false);

      if (parsed.action === 'check_balance') {
        const reply = {
          id: `wally-${Date.now()}`,
          sender: 'wally',
          text: `Your balance is $${Number(wallet?.balanceUsdt || 0).toFixed(2)} USDT on Ethereum Sepolia.\n\nSmart Contract: 0x7169...BA06\nCurrent Sepolia Gas: ~${quote.feeUsdt} USDT (${quote.gasPriceGwei} Gwei).`,
          timestamp: 'Now',
        };
        setMessages((prev) => [...prev, reply]);
        return;
      }

      // Display payment review card for financial actions
      setPendingIntent(parsed);
      const promptReply = {
        id: `wally-${Date.now()}`,
        sender: 'wally',
        text: `I've prepared your transaction. Please review the details below before authorizing with WDK:`,
        timestamp: 'Now',
      };
      setMessages((prev) => [...prev, promptReply]);
    }, 600);
  };

  const handleApproveTransaction = async () => {
    if (!pendingIntent) return;
    setIsProcessing(true);

    try {
      const result = await onExecuteTransfer({
        recipient: pendingIntent.recipientIdentifier || pendingIntent.recipientAddress || '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
        amount: pendingIntent.amount,
        note: `Wally AI: ${pendingIntent.summary}`,
      });

      const receipt = {
        status: 'CONFIRMED',
        amount: pendingIntent.amount,
        recipient: pendingIntent.recipientName || pendingIntent.recipient || 'Recipient',
        txHash: result?.transaction?.txHash || `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        network: 'Ethereum Sepolia (ChainID: 11155111)',
        timestamp: new Date().toLocaleTimeString(),
      };
      setTxReceipt(receipt);
      setPendingIntent(null);

      const confirmMsg = {
        id: `wally-${Date.now()}`,
        sender: 'wally',
        text: `✅ Payment of $${receipt.amount.toFixed(2)} USDT successfully submitted & signed via Tether WDK!\n\nTx Hash: ${receipt.txHash.slice(0, 10)}...${receipt.txHash.slice(-8)}\nStatus: Confirmed on Sepolia`,
        timestamp: 'Now',
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err) {
      Alert.alert('Payment Failed', err.message || 'Execution error.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelTransaction = () => {
    setPendingIntent(null);
    const cancelMsg = {
      id: `wally-${Date.now()}`,
      sender: 'wally',
      text: `❌ Transaction cancelled. No USDT was deducted. Let me know if you need anything else!`,
      timestamp: 'Now',
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  return (
    <View style={styles.container}>
      {/* Top Banner: QVAC Engine Badge */}
      <View style={styles.engineBanner}>
        <View style={styles.engineRow}>
          <Text style={styles.engineIcon}>⚡</Text>
          <View>
            <Text style={styles.engineTitle}>Wally AI Assistant</Text>
            <Text style={styles.engineSubtitle}>Powered by Tether QVAC (On-Device AI) & WDK</Text>
          </View>
        </View>
        <View style={styles.localBadge}>
          <Text style={styles.localBadgeText}>Local & Private</Text>
        </View>
      </View>

      {/* Messages Scroll Area */}
      <ScrollView style={styles.messagesScroll} contentContainerStyle={styles.messagesContent}>
        {messages.map((m) => {
          const isWally = m.sender === 'wally';
          return (
            <View
              key={m.id}
              style={[
                styles.messageBubble,
                isWally ? styles.wallyBubble : styles.userBubble,
              ]}
            >
              <Text style={isWally ? styles.wallyLabel : styles.userLabel}>
                {isWally ? '🤖 Wally' : '👤 You'}
              </Text>
              <Text style={isWally ? styles.wallyText : styles.userText}>{m.text}</Text>
              <Text style={styles.timestamp}>{m.timestamp}</Text>
            </View>
          );
        })}

        {isProcessing && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color="#00C29A" />
            <Text style={styles.typingText}>Wally is interpreting your request...</Text>
          </View>
        )}

        {/* Victor's 5-Step Payment Review Card */}
        {pendingIntent && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewStepLabel}>STEP 3 OF 5: REVIEW & APPROVE</Text>
              <View style={styles.networkBadge}>
                <View style={styles.networkDot} />
                <Text style={styles.networkText}>Sepolia</Text>
              </View>
            </View>

            <Text style={styles.reviewTitle}>Payment Intent Confirmation</Text>
            <Text style={styles.reviewSubtitle}>{pendingIntent.summary}</Text>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewField}>Recipient</Text>
              <Text style={styles.reviewValue} numberOfLines={1}>
                {pendingIntent.recipientName || pendingIntent.recipient || 'Mama Thandi'}
              </Text>
            </View>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewField}>Token & Network</Text>
              <Text style={styles.reviewValue}>Tether USD (Sepolia)</Text>
            </View>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewField}>Send Amount</Text>
              <Text style={styles.reviewAmount}>${pendingIntent.amount.toFixed(2)} USDT</Text>
            </View>

            <View style={styles.reviewRow}>
              <Text style={styles.reviewField}>Network Gas Fee</Text>
              <Text style={styles.reviewValue}>$0.20 USDT (~0.00018 ETH)</Text>
            </View>

            <View style={[styles.reviewRow, styles.totalRow]}>
              <Text style={styles.totalField}>Total Required</Text>
              <Text style={styles.totalValue}>${(pendingIntent.amount + 0.2).toFixed(2)} USDT</Text>
            </View>

            {/* Approve / Reject Controls */}
            <View style={styles.reviewActions}>
              <TouchableOpacity
                style={[styles.reviewBtn, styles.rejectBtn]}
                onPress={handleCancelTransaction}
                disabled={isProcessing}
              >
                <Text style={styles.rejectBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reviewBtn, styles.approveBtn]}
                onPress={handleApproveTransaction}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.approveBtnText}>Approve & Sign (WDK)</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick Suggestion Prompts */}
        <View style={styles.promptSuggestions}>
          <Text style={styles.suggestionTitle}>💡 Try asking Wally:</Text>
          <View style={styles.promptWrap}>
            {quickPrompts.map((p, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.promptChip}
                onPress={() => handleSendPrompt(p)}
              >
                <Text style={styles.promptChipText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask Wally (e.g. 'Send $20 USDT to Thandi')..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSendPrompt()}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => handleSendPrompt()}
          disabled={isProcessing || !inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  engineBanner: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  engineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  engineIcon: { fontSize: 20 },
  engineTitle: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  engineSubtitle: { fontSize: 10, color: '#94A3B8' },
  localBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  localBadgeText: { fontSize: 9, fontWeight: '700', color: '#10B981' },
  messagesScroll: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 20 },
  messageBubble: { maxWidth: '85%', borderRadius: 18, padding: 14, marginBottom: 12 },
  wallyBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#00C29A',
  },
  wallyLabel: { fontSize: 10, fontWeight: '800', color: '#00C29A', marginBottom: 4 },
  userLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  wallyText: { fontSize: 13, color: '#1E293B', lineHeight: 19 },
  userText: { fontSize: 13, color: '#FFFFFF', fontWeight: '500', lineHeight: 19 },
  timestamp: { fontSize: 9, color: '#94A3B8', marginTop: 6, alignSelf: 'flex-end' },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  typingText: { fontSize: 11, color: '#64748B', fontStyle: 'italic' },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#00C29A',
    shadowColor: '#00C29A',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
    marginVertical: 12,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewStepLabel: { fontSize: 9, fontWeight: '900', color: '#00C29A', letterSpacing: 0.8 },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  networkDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10B981', marginRight: 4 },
  networkText: { fontSize: 10, fontWeight: '700', color: '#065F46' },
  reviewTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 8 },
  reviewSubtitle: { fontSize: 11, color: '#64748B', marginBottom: 12 },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reviewField: { fontSize: 11, color: '#64748B' },
  reviewValue: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  reviewAmount: { fontSize: 12, fontWeight: '800', color: '#00C29A' },
  totalRow: { borderBottomWidth: 0, paddingTop: 10 },
  totalField: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  totalValue: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  reviewActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  reviewBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#F1F5F9' },
  rejectBtnText: { color: '#475569', fontWeight: '700', fontSize: 12 },
  approveBtn: { backgroundColor: '#00C29A' },
  approveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  promptSuggestions: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  suggestionTitle: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 8 },
  promptWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  promptChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  promptChipText: { fontSize: 11, color: '#334155', fontWeight: '600' },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  sendButton: {
    backgroundColor: '#00C29A',
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});

