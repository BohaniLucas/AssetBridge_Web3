import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mobileAuthService } from '../services/authService';
import { getApiBaseUrl } from '../config/api.js';

export default function ProfileScreen({
  user,
  wallet,
  isOffline,
  onBack,
  onSignOut,
  onProfileUpdated,
}) {
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSaveProfile = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (isOffline) {
      setErrorMsg('Cannot update profile while offline. Reconnect to internet first.');
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg('Full name cannot be empty.');
      return;
    }

    if (password) {
      if (password.length < 8) {
        setErrorMsg('New password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('New password and confirmation do not match.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload = { fullName: fullName.trim() };
      if (password) {
        payload.password = password;
      }

      const updatedUser = await mobileAuthService.updateProfile(payload);
      setSuccessMsg('Profile updated successfully.');
      setPassword('');
      setConfirmPassword('');
      if (onProfileUpdated) {
        onProfileUpdated(updatedUser);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAddress = () => {
    if (!wallet?.address) return;
    Alert.alert('Wallet Address', wallet.address, [{ text: 'Done' }]);
  };

  const initials = (user?.fullName || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#0A0F1C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile & Security</Text>
        <TouchableOpacity
          style={styles.signOutHeaderBtn}
          onPress={onSignOut}
          activeOpacity={0.7}
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* User Card */}
        <View style={[styles.card, styles.shadow]}>
          <View style={styles.userHeaderRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.userInfoCol}>
              <Text style={styles.userName}>{user?.fullName || 'InterLink User'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badgeGreen}>
                  <Ionicons name="shield-checkmark" size={12} color="#059669" />
                  <Text style={styles.badgeGreenText}>Verified Account</Text>
                </View>
                <View style={styles.badgeGray}>
                  <Text style={styles.badgeGrayText}>{user?.role || 'USER'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Edit Information Card */}
        <View style={[styles.card, styles.shadow]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="person-outline" size={20} color="#0A0F1C" />
            <Text style={styles.cardSectionTitle}>Personal Information</Text>
          </View>

          {successMsg ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-circle-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={[styles.inputWrap, styles.disabledInput]}>
              <Ionicons name="mail-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: '#64748B' }]}
                value={user?.email}
                editable={false}
                placeholderTextColor="#94A3B8"
              />
            </View>
            <Text style={styles.helperText}>Email address is tied to your cryptographic account identity.</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.cardHeaderRow}>
            <Ionicons name="lock-closed-outline" size={20} color="#0A0F1C" />
            <Text style={styles.cardSectionTitle}>Update Security Password</Text>
          </View>
          <Text style={styles.securitySubtext}>
            Leave blank if you do not want to change your password.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="key-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="key-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-type new password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, isLoading && { opacity: 0.7 }]}
            onPress={handleSaveProfile}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#0A0F1C" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Security & WDK Wallet Details Card */}
        <View style={[styles.card, styles.shadow]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="shield-outline" size={20} color="#0A0F1C" />
            <Text style={styles.cardSectionTitle}>Wallet & Key Custody</Text>
          </View>

          <View style={styles.securityItem}>
            <View style={styles.securityItemHeader}>
              <Text style={styles.securityItemLabel}>WDK Self-Custody Address</Text>
              <TouchableOpacity onPress={handleCopyAddress} activeOpacity={0.7}>
                <Text style={styles.copyText}>Copy</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.addressMonospace}>
              {wallet?.address || 'Wallet not configured'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>Network</Text>
            <Text style={styles.infoRowVal}>Ethereum Sepolia (Testnet)</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>Key Storage</Text>
            <Text style={styles.infoRowVal}>SecureStore (On-Device Hardware)</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>Inactivity Auto-Lock</Text>
            <Text style={styles.infoRowVal}>5 Minutes</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>Offline Capability</Text>
            <Text style={styles.infoRowVal}>{isOffline ? 'Offline Active' : 'Online / Synced'}</Text>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoRowLabel}>Backend Server</Text>
            <Text style={[styles.infoRowVal, { fontSize: 11 }]}>{getApiBaseUrl()}</Text>
          </View>
        </View>

        {/* Danger Zone: Sign Out */}
        <View style={[styles.card, styles.shadow, { marginBottom: 40 }]}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={onSignOut}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.signOutBtnText}>Sign Out of InterLink</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F4F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#F1F4F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  signOutHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00E676',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0A0F1C',
  },
  userInfoCol: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  badgeGray: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeGrayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  disabledInput: {
    backgroundColor: '#F1F5F9',
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 46,
    fontSize: 15,
    color: '#0A0F1C',
  },
  passwordToggle: {
    padding: 6,
  },
  helperText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  securitySubtext: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    marginTop: -8,
  },
  saveBtn: {
    backgroundColor: '#00E676',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A0F1C',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  securityItem: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  securityItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  securityItemLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  copyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00B87A',
  },
  addressMonospace: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#0A0F1C',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoRowLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  infoRowVal: {
    fontSize: 13,
    color: '#0A0F1C',
    fontWeight: '700',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  signOutBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
  },
});

