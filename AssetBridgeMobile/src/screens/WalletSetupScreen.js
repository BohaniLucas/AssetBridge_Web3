import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function WalletSetupScreen({ walletId, walletManager, isNewAccount, onComplete }) {
  const [step, setStep] = useState(isNewAccount ? 'start' : 'choose');
  const [mnemonic, setMnemonic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const createPhrase = async () => {
    setBusy(true);
    setError('');
    try {
      const phrase = await walletManager.generateMnemonic(12);
      setMnemonic(phrase);
      setStep('backup');
    } catch (err) {
      setError(err?.message || 'Could not create a recovery phrase. No wallet was created.');
    } finally {
      setBusy(false);
    }
  };

  const saveWallet = async (phrase) => {
    setBusy(true);
    setError('');
    try {
      await walletManager.restoreWallet(phrase.trim().replace(/\s+/g, ' '), walletId);
      await walletManager.unlock(walletId);
      setMnemonic('');
      onComplete();
    } catch (err) {
      setError(err?.message || 'Wallet setup failed. Your phrase was not sent to AssetBridge servers.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>ASSETBRIDGE WALLET</Text>
        <Text style={styles.title}>{step === 'backup' ? 'Save your recovery phrase' : step === 'restore' ? 'Restore your wallet' : 'Set up your wallet'}</Text>
        <Text style={styles.body}>
          Your wallet is created on this device. AssetBridge does not receive your recovery phrase or private keys. Anyone with the phrase can control the wallet, so keep it private and offline.
        </Text>

        {step === 'backup' ? (
          <>
            <View style={styles.phraseCard}>
              <Text selectable style={styles.phrase}>{mnemonic}</Text>
            </View>
            <Text style={styles.warning}>Write these words down in order. Do not screenshot, message, or share them.</Text>
            <TouchableOpacity style={styles.primary} disabled={busy} onPress={() => saveWallet(mnemonic)}>
              {busy ? <ActivityIndicator color="#06121B" /> : <Text style={styles.primaryText}>I saved my phrase — create wallet</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => { setMnemonic(''); setStep('start'); }}>
              <Text style={styles.secondaryText}>Cancel setup</Text>
            </TouchableOpacity>
          </>
        ) : step === 'restore' ? (
          <>
            <TextInput
              style={styles.input}
              value={mnemonic}
              onChangeText={setMnemonic}
              placeholder="Enter your 12 or 24 recovery words"
              placeholderTextColor="#8293A3"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              textAlignVertical="top"
              secureTextEntry={false}
            />
            <TouchableOpacity style={styles.primary} disabled={busy || !mnemonic.trim()} onPress={() => saveWallet(mnemonic)}>
              {busy ? <ActivityIndicator color="#06121B" /> : <Text style={styles.primaryText}>Restore wallet on this device</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => { setMnemonic(''); setStep('choose'); }}>
              <Text style={styles.secondaryText}>Back</Text>
            </TouchableOpacity>
          </>
        ) : step === 'choose' ? (
          <>
            <TouchableOpacity style={styles.primary} disabled={busy} onPress={() => setStep('restore')}>
              <Text style={styles.primaryText}>Restore existing wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} disabled={busy} onPress={() => setStep('start')}>
              <Text style={styles.secondaryText}>Create a new wallet</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.primary} disabled={busy} onPress={createPhrase}>
            {busy ? <ActivityIndicator color="#06121B" /> : <Text style={styles.primaryText}>Create my wallet</Text>}
          </TouchableOpacity>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.network}>Wallet network: Ethereum Sepolia · test funds only</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0F1C' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  kicker: { color: '#00E676', fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginBottom: 12 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginBottom: 12 },
  body: { color: '#B7C2D0', fontSize: 15, lineHeight: 23, marginBottom: 22 },
  phraseCard: { backgroundColor: '#151F31', borderColor: '#334155', borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 14 },
  phrase: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 30, textAlign: 'center' },
  warning: { color: '#FDE68A', lineHeight: 20, marginBottom: 18 },
  input: { minHeight: 130, backgroundColor: '#151F31', borderRadius: 16, padding: 16, color: '#FFFFFF', fontSize: 16, marginBottom: 16 },
  primary: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00E676', paddingHorizontal: 16, marginTop: 10 },
  primaryText: { color: '#06121B', fontWeight: '900', fontSize: 15, textAlign: 'center' },
  secondary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { color: '#D0DAE5', fontSize: 15, fontWeight: '700' },
  error: { color: '#FCA5A5', marginTop: 14, lineHeight: 20 },
  network: { color: '#8293A3', fontSize: 12, marginTop: 26, textAlign: 'center' },
});
