import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mobileAuthService } from '../services/authService';

export default function SessionLockOverlay({ visible, userEmail, onUnlocked, onSignOut }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!visible) return null;

  const handleUnlock = async () => {
    if (!password) {
      setErrorMsg('Please enter your password to unlock.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await mobileAuthService.reauthenticate(password);
      setPassword('');
      onUnlocked();
    } catch (err) {
      setErrorMsg(err.message || 'Incorrect password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.container}>
          {/* Lock Icon Badge */}
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={32} color="#00C29A" />
          </View>

          <Text style={styles.title}>Session Locked</Text>
          <Text style={styles.subtitle}>
            Financial controls locked after 5 minutes of inactivity or app backgrounding.
          </Text>

          {/* Account Card */}
          <View style={styles.userCard}>
            <Ionicons name="person-circle-outline" size={20} color="#64748B" style={{ marginRight: 8 }} />
            <Text style={styles.userEmail} numberOfLines={1}>
              {userEmail || 'Authenticated User'}
            </Text>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter password to unlock"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMsg) setErrorMsg('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color="#E11D48" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Unlock Button */}
          <TouchableOpacity
            style={[styles.unlockBtn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleUnlock}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.unlockBtnText}>Unlock Protected UI</Text>
            )}
          </TouchableOpacity>

          {/* Sign Out Option */}
          <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut} activeOpacity={0.7}>
            <Text style={styles.signOutText}>Sign Out Instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    marginBottom: 16,
  },
  userEmail: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    width: '100%',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
    marginTop: 10,
  },
  errorText: {
    fontSize: 12,
    color: '#E11D48',
    fontWeight: '600',
    flex: 1,
  },
  unlockBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  signOutBtn: {
    marginTop: 16,
    paddingVertical: 10,
  },
  signOutText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
});

