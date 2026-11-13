import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mobileAuthService } from '../services/authService';

const INK = '#0A0F1C';
const GREEN = '#00E676';
const MUTED = '#64748B';

const INTRO = [
  {
    icon: 'globe-outline',
    eyebrow: 'MOVE WITH CLARITY',
    title: 'Money that moves\nwith your life.',
    body: 'Explore a simpler way to manage digital-dollar payments and cross-border money journeys.',
    tint: '#DBFCEB',
    iconColor: '#059669',
  },
  {
    icon: 'people-outline',
    eyebrow: 'SAVE TOGETHER',
    title: 'Build trust,\none contribution at a time.',
    body: 'Bring your stokvel together around clear schedules, shared rules and visible activity.',
    tint: '#E0E7FF',
    iconColor: '#4F46E5',
  },
  {
    icon: 'shield-checkmark-outline',
    eyebrow: 'YOU STAY IN CONTROL',
    title: 'See the details\nbefore you act.',
    body: 'Review what you are agreeing to. Your account password stays with Supabase Auth.',
    tint: '#FEF3C7',
    iconColor: '#D97706',
  },
];

function Brand({ light = false }) {
  return (
    <View style={styles.brandRow}>
      <View style={styles.logo}>
        <Ionicons name="infinite" size={21} color={GREEN} />
      </View>
      <Text style={[styles.brandName, light && styles.brandNameLight]}>InterLink</Text>
    </View>
  );
}

function PrimaryButton({ title, onPress, disabled, loading, icon }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.86}
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.primaryButton, (disabled || loading) && styles.buttonDisabled]}
    >
      {loading ? <ActivityIndicator color={INK} /> : (
        <>
          <Text style={styles.primaryButtonText}>{title}</Text>
          {icon ? <Ionicons name={icon} size={18} color={INK} /> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

function Field({ label, icon, value, onChangeText, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={18} color="#94A3B8" style={styles.fieldIcon} />
        <TextInput
          accessibilityLabel={label}
          autoCorrect={false}
          placeholderTextColor="#94A3B8"
          selectionColor="#059669"
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          {...props}
        />
      </View>
    </View>
  );
}

export default function AuthFlowScreen({ onAuthenticated }) {
  const [screen, setScreen] = useState('welcome');
  const [introIndex, setIntroIndex] = useState(0);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const go = (next) => {
    setError('');
    setNotice('');
    setScreen(next);
  };

  const submitLogin = async () => {
    setError('');
    if (!email.trim() || !password) return setError('Enter your email and password to continue.');
    setBusy(true);
    try {
      const session = await mobileAuthService.signIn(email, password);
      onAuthenticated(session);
    } catch (err) {
      setError(err.message || 'We could not sign you in. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async () => {
    setError('');
    if (!fullName.trim()) return setError('Enter your name so your group can recognise you.');
    if (!email.trim()) return setError('Enter an email address.');
    if (password.length < 8) return setError('Use a password with at least 8 characters.');
    if (password !== confirmPassword) return setError('Those passwords do not match.');
    setBusy(true);
    try {
      const result = await mobileAuthService.signUp({ fullName, email, password });
      if (result.requiresEmailConfirmation) {
        setNotice('Your account request is ready. Check your email to confirm it, then sign in.');
        setPassword('');
        setConfirmPassword('');
        setScreen('login');
      } else {
        onAuthenticated(result);
      }
    } catch (err) {
      setError(err.message || 'We could not create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {screen === 'welcome' && (
          <View style={styles.welcomeScreen}>
            <View style={styles.welcomeTop}>
              <Brand light />
            </View>

            <View style={styles.heroWrap}>
              <View style={styles.heroGlow} />
              <View style={styles.heroOrbit} />
              <View style={styles.heroCardBack} />
              <View style={styles.heroCard}>
                <View style={styles.heroCardHeader}>
                  <View style={styles.heroMiniLogo}><Ionicons name="infinite" size={15} color={INK} /></View>
                  <Text style={styles.heroCardCaption}>YOUR MONEY, CONNECTED</Text>
                  <Ionicons name="ellipsis-horizontal" size={18} color="#94A3B8" />
                </View>
                <Text style={styles.heroCardLabel}>PAYMENTS • SAVINGS • COMMUNITY</Text>
                <View style={styles.heroLine} />
                <View style={styles.heroCardFooter}>
                  <View style={styles.heroAvatarStack}>
                    {['#A7F3D0', '#BFDBFE', '#FDE68A'].map((color, index) => (
                      <View key={color} style={[styles.heroAvatar, { backgroundColor: color, marginLeft: index ? -9 : 0 }]}>
                        <Ionicons name="person" size={11} color={INK} />
                      </View>
                    ))}
                  </View>
                  <Text style={styles.heroFooterText}>Built around people</Text>
                  <View style={styles.heroArrow}><Ionicons name="arrow-up-right" size={17} color={INK} /></View>
                </View>
              </View>
              <View style={styles.floatingBadge}>
                <View style={styles.floatingBadgeIcon}><Ionicons name="shield-checkmark" size={17} color="#047857" /></View>
                <View><Text style={styles.floatingBadgeTitle}>You’re in control</Text><Text style={styles.floatingBadgeSub}>Review every step</Text></View>
              </View>
            </View>

            <View style={styles.welcomeCopy}>
              <Text style={styles.welcomeEyebrow}>A BRIDGE TO WHAT’S NEXT</Text>
              <Text style={styles.welcomeTitle}>Move money.{ '\n' }Grow together.</Text>
              <Text style={styles.welcomeBody}>A clearer home for digital payments and community saving.</Text>
            </View>

            <View style={styles.welcomeActions}>
              <PrimaryButton title="Get started" icon="arrow-forward" onPress={() => { setIntroIndex(0); go('intro'); }} />
              <TouchableOpacity accessibilityRole="button" onPress={() => go('login')} style={styles.loginTextButton}>
                <Text style={styles.loginText}>I already have an account <Text style={styles.loginArrow}></Text></Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.previewDisclosure}>Preview build · wallet and payment features may be unavailable until connected to a verified network.</Text>
          </View>
        )}

        {screen === 'intro' && (() => {
          const slide = INTRO[introIndex];
          const isLast = introIndex === INTRO.length - 1;
          return (
            <View style={styles.contentScreen}>
              <View style={styles.innerHeader}>
                <Brand />
                <TouchableOpacity onPress={() => go('login')}><Text style={styles.skipText}>Log in</Text></TouchableOpacity>
              </View>
              <View style={styles.introVisual}>
                <View style={styles.introVisualRing} />
                <View style={[styles.introIconCard, { backgroundColor: slide.tint }]}>
                  <Ionicons name={slide.icon} size={52} color={slide.iconColor} />
                </View>
                <View style={styles.introSpark}><Ionicons name="sparkles" size={17} color="#D97706" /></View>
                <View style={styles.introCheck}><Ionicons name="checkmark" size={15} color="#FFFFFF" /></View>
              </View>
              <View style={styles.introTextBlock}>
                <Text style={styles.introEyebrow}>{slide.eyebrow}</Text>
                <Text style={styles.introTitle}>{slide.title}</Text>
                <Text style={styles.introBody}>{slide.body}</Text>
              </View>
              <View style={styles.introBottom}>
                <View style={styles.pagination}>
                  {INTRO.map((item, index) => <View key={item.eyebrow} style={[styles.paginationDot, index === introIndex && styles.paginationDotActive]} />)}
                </View>
                <PrimaryButton
                  title={isLast ? 'Create your account' : 'Continue'}
                  icon={isLast ? 'person-add-outline' : 'arrow-forward'}
                  onPress={() => isLast ? go('signup') : setIntroIndex((value) => value + 1)}
                />
                <TouchableOpacity style={styles.backLink} onPress={() => go('welcome')}>
                  <Text style={styles.backLinkText}>Back to welcome</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {(screen === 'login' || screen === 'signup') && (
          <View style={styles.contentScreen}>
            <View style={styles.innerHeader}>
              <TouchableOpacity accessibilityRole="button" onPress={() => go('welcome')} style={styles.backButton}>
                <Ionicons name="arrow-back" size={20} color={INK} />
              </TouchableOpacity>
              <Brand />
              <View style={{ width: 40 }} />
            </View>
            <View style={styles.formIntro}>
              <View style={styles.formIcon}><Ionicons name={screen === 'login' ? 'hand-right-outline' : 'sparkles-outline'} size={24} color="#059669" /></View>
              <Text style={styles.formEyebrow}>{screen === 'login' ? 'WELCOME BACK' : 'YOUR JOURNEY STARTS HERE'}</Text>
              <Text style={styles.formTitle}>{screen === 'login' ? 'Good to see you.' : 'Create your account.'}</Text>
              <Text style={styles.formSubtitle}>{screen === 'login' ? 'Sign in to continue to InterLink.' : 'A few details to get your account ready.'}</Text>
            </View>

            {screen === 'signup' ? (
              <Field label="Your name" icon="person-outline" value={fullName} onChangeText={setFullName} placeholder="e.g. Thandi Mokoena" autoCapitalize="words" returnKeyType="next" />
            ) : null}
            <Field label="Email address" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" returnKeyType="next" />

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputShell}>
                <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.fieldIcon} />
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setPassword}
                  placeholder={screen === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  textContentType={screen === 'signup' ? 'newPassword' : 'password'}
                  value={password}
                  returnKeyType={screen === 'signup' ? 'next' : 'done'}
                  onSubmitEditing={screen === 'login' ? submitLogin : undefined}
                />
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {screen === 'signup' ? (
              <Field label="Confirm password" icon="shield-checkmark-outline" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Enter your password again" secureTextEntry={!showPassword} textContentType="newPassword" returnKeyType="done" onSubmitEditing={submitSignup} />
            ) : (
              <TouchableOpacity onPress={() => setNotice('Password reset is not available in this mobile build yet. Contact support to recover access.')} style={styles.forgotButton}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {error ? <View accessibilityRole="alert" style={styles.messageBox}><Ionicons name="alert-circle" size={18} color="#B91C1C" /><Text style={styles.errorText}>{error}</Text></View> : null}
            {notice ? <View accessibilityRole="alert" style={styles.noticeBox}><Ionicons name="information-circle" size={18} color="#047857" /><Text style={styles.noticeText}>{notice}</Text></View> : null}

            <PrimaryButton
              title={screen === 'login' ? 'Log in' : 'Create account'}
              icon={screen === 'login' ? 'arrow-forward' : 'checkmark'}
              loading={busy}
              disabled={busy}
              onPress={screen === 'login' ? submitLogin : submitSignup}
            />

            {screen === 'signup' ? (
              <Text style={styles.privacyNote}>Creating an account does not create or fund a wallet. Your recovery phrase will never be requested here.</Text>
            ) : null}

            <View style={styles.switchAuthRow}>
              <Text style={styles.switchAuthText}>{screen === 'login' ? 'New to InterLink?' : 'Already have an account?'}</Text>
              <TouchableOpacity onPress={() => go(screen === 'login' ? 'signup' : 'login')}>
                <Text style={styles.switchAuthLink}>{screen === 'login' ? ' Create account' : ' Log in'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F4F8' },
  scrollContent: { flexGrow: 1 },
  welcomeScreen: { flex: 1, minHeight: 760, backgroundColor: INK, paddingHorizontal: 25, paddingTop: 22, paddingBottom: 28, justifyContent: 'space-between', overflow: 'hidden' },
  welcomeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 35, height: 35, borderRadius: 12, backgroundColor: '#172236', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#26354B' },
  brandName: { color: INK, fontSize: 19, fontWeight: '900', letterSpacing: -0.55 },
  brandNameLight: { color: '#F8FAFC' },
  previewPill: { flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: '#172236', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 30, borderWidth: 1, borderColor: '#26354B' },
  previewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  previewText: { color: '#C4D1E0', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  heroWrap: { height: 265, justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  heroGlow: { width: 220, height: 220, borderRadius: 110, backgroundColor: '#00E676', opacity: 0.07, position: 'absolute' },
  heroOrbit: { width: 245, height: 245, borderRadius: 123, borderWidth: 1, borderColor: '#28364C', position: 'absolute' },
  heroCardBack: { width: '82%', height: 150, borderRadius: 22, backgroundColor: '#203149', transform: [{ rotate: '-8deg' }], position: 'absolute', top: 52, opacity: 0.72 },
  heroCard: { width: '88%', height: 172, borderRadius: 22, padding: 17, backgroundColor: '#FFFFFF', transform: [{ rotate: '3deg' }], shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.24, shadowRadius: 20, elevation: 12 },
  heroCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroMiniLogo: { width: 26, height: 26, borderRadius: 9, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  heroCardCaption: { flex: 1, color: '#64748B', fontSize: 8, letterSpacing: 0.8, fontWeight: '900' },
  heroCardLabel: { color: INK, fontSize: 13, fontWeight: '900', letterSpacing: 0.2, marginTop: 21 },
  heroLine: { height: 1, backgroundColor: '#E2E8F0', marginTop: 15 },
  heroCardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  heroAvatarStack: { flexDirection: 'row', alignItems: 'center' },
  heroAvatar: { height: 25, width: 25, borderRadius: 13, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  heroFooterText: { flex: 1, marginLeft: 9, fontSize: 11, color: '#475569', fontWeight: '700' },
  heroArrow: { width: 29, height: 29, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  floatingBadge: { position: 'absolute', right: 0, bottom: 11, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', padding: 9, paddingRight: 13, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 7 },
  floatingBadgeIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  floatingBadgeTitle: { color: INK, fontSize: 10, fontWeight: '800' },
  floatingBadgeSub: { color: MUTED, fontSize: 9, marginTop: 2 },
  welcomeCopy: { marginTop: 2 },
  welcomeEyebrow: { color: GREEN, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  welcomeTitle: { color: '#F8FAFC', fontSize: 43, lineHeight: 48, fontWeight: '900', letterSpacing: -1.7, marginTop: 12 },
  welcomeBody: { color: '#A8B4C5', fontSize: 15, lineHeight: 23, marginTop: 11, maxWidth: 310 },
  welcomeActions: { marginTop: 24 },
  primaryButton: { minHeight: 56, borderRadius: 17, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  primaryButtonText: { color: INK, fontWeight: '900', fontSize: 15, letterSpacing: 0.1 },
  buttonDisabled: { opacity: 0.65 },
  loginTextButton: { alignItems: 'center', paddingVertical: 17 },
  loginText: { color: '#D5DEE9', fontSize: 13, fontWeight: '700' },
  loginArrow: { color: GREEN, fontWeight: '900' },
  previewDisclosure: { color: '#74839A', fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 1 },
  contentScreen: { flexGrow: 1, minHeight: 760, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 30, backgroundColor: '#F1F4F8' },
  innerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  skipText: { color: '#334155', fontSize: 13, fontWeight: '800' },
  introVisual: { height: 260, marginTop: 24, alignItems: 'center', justifyContent: 'center' },
  introVisualRing: { height: 215, width: 215, borderRadius: 108, backgroundColor: '#E7EDF3', borderWidth: 1, borderColor: '#D9E2EC' },
  introIconCard: { position: 'absolute', height: 122, width: 122, borderRadius: 36, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }], shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  introSpark: { position: 'absolute', top: 43, right: '21%', height: 38, width: 38, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  introCheck: { position: 'absolute', bottom: 48, left: '22%', height: 31, width: 31, borderRadius: 11, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  introTextBlock: { alignItems: 'center', paddingHorizontal: 7 },
  introEyebrow: { color: '#059669', fontSize: 10, fontWeight: '900', letterSpacing: 1.7, marginBottom: 12 },
  introTitle: { color: INK, fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -1, textAlign: 'center' },
  introBody: { color: MUTED, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 13, maxWidth: 340 },
  introBottom: { marginTop: 'auto', paddingTop: 25 },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 19 },
  paginationDot: { height: 7, width: 7, borderRadius: 4, backgroundColor: '#CBD5E1' },
  paginationDotActive: { width: 23, backgroundColor: INK },
  backLink: { alignItems: 'center', paddingVertical: 15 },
  backLinkText: { color: MUTED, fontSize: 12, fontWeight: '700' },
  backButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  formIntro: { marginTop: 31, marginBottom: 25 },
  formIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  formEyebrow: { color: '#059669', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  formTitle: { color: INK, fontSize: 30, fontWeight: '900', letterSpacing: -1, marginTop: 7 },
  formSubtitle: { color: MUTED, fontSize: 14, lineHeight: 21, marginTop: 7 },
  fieldWrap: { marginBottom: 15 },
  fieldLabel: { color: '#263449', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  inputShell: { height: 54, borderRadius: 15, borderWidth: 1, borderColor: '#DCE3EB', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, height: '100%', color: INK, fontSize: 14, paddingVertical: 0 },
  eyeButton: { padding: 8, marginRight: -7 },
  forgotButton: { alignSelf: 'flex-end', paddingVertical: 4, marginBottom: 19, marginTop: -5 },
  forgotText: { color: '#047857', fontSize: 12, fontWeight: '800' },
  messageBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 13, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, color: '#991B1B', fontSize: 12, lineHeight: 18 },
  noticeBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 13, padding: 12, marginBottom: 14 },
  noticeText: { flex: 1, color: '#065F46', fontSize: 12, lineHeight: 18 },
  privacyNote: { marginTop: 14, color: '#64748B', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  switchAuthRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 25, paddingVertical: 8 },
  switchAuthText: { color: MUTED, fontSize: 13 },
  switchAuthLink: { color: '#047857', fontSize: 13, fontWeight: '900' },
});
