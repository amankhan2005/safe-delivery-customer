import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import { verifyPhoneOTP, verifyEmailOTP, resendOTP } from '../../api';
import useAuthStore from '../../store/authStore';
import { COLORS, SIZES } from '../../theme';

// Firebase lazy import — safe for production APK
let firebaseAuth = null;
let FirebasePhoneAuthProvider = null;
let firebaseSignInWithCredential = null;

try {
  const fb = require('../../config/firebase');
  firebaseAuth               = fb.auth;
  FirebasePhoneAuthProvider  = fb.PhoneAuthProvider;
  firebaseSignInWithCredential = fb.signInWithCredential;
} catch (_) {}

// ── OTP Input ─────────────────────────────────────────────────────────────────
function OTPBox({ value, onChange, length = 4 }) {
  const inputs = useRef([]);
  const vals   = Array(length).fill('').map((_, i) => value[i] || '');

  const handleChange = (v, idx) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    const next  = [...vals]; next[idx] = digit;
    onChange(next.join(''));
    if (digit && idx < length - 1) inputs.current[idx + 1]?.focus();
  };

  const handleKey = ({ nativeEvent }, idx) => {
    if (nativeEvent.key === 'Backspace' && !vals[idx] && idx > 0)
      inputs.current[idx - 1]?.focus();
  };

  return (
    <View style={S.otpRow}>
      {vals.map((d, i) => (
        <TextInput
          key={i}
          ref={(r) => (inputs.current[i] = r)}
          style={[S.otpBox, !!d && S.otpFilled]}
          value={d}
          onChangeText={(v) => handleChange(v, i)}
          onKeyPress={(e) => handleKey(e, i)}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          selectionColor={COLORS.primary}
        />
      ))}
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VerifyPhoneOTPScreen({ navigation, route }) {
  const { phone, email, name } = route.params || {};
  const setAuth = useAuthStore((s) => s.setAuth);

  const [tab,            setTab]            = useState('email');
  const [phoneOtp,       setPhoneOtp]       = useState('');
  const [verificationId, setVerificationId] = useState(null);
  const [sendingPhone,   setSendingPhone]   = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [emailOtp,       setEmailOtp]       = useState('');
  const [cooldown,       setCooldown]       = useState(60);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Firebase Phone — uses native APNs/SafetyNet in production build ───────
  const sendFirebaseOTP = async () => {
    if (!firebaseAuth || !FirebasePhoneAuthProvider) {
      Toast.show({ type: 'info', text1: 'Use Email OTP to verify.' });
      setTab('email');
      return;
    }
    setSendingPhone(true);
    try {
      const provider = new FirebasePhoneAuthProvider(firebaseAuth);
      // In production APK: no RecaptchaVerifier needed — Android uses SafetyNet/Play Integrity
      // In Expo Go dev build: this may require test numbers set in Firebase console
      const vid = await provider.verifyPhoneNumber(phone);
      setVerificationId(vid);
      Toast.show({ type: 'success', text1: `SMS sent to ${phone}` });
    } catch (e) {
      let msg = 'Failed to send SMS. Use Email OTP.';
      if (e?.code === 'auth/invalid-phone-number') msg = 'Invalid phone. Format: +231XXXXXXXX';
      else if (e?.code === 'auth/too-many-requests') msg = 'Too many requests. Try again later.';
      Toast.show({ type: 'error', text1: msg });
      // Auto-switch to email on failure
      setTimeout(() => setTab('email'), 1500);
    } finally {
      setSendingPhone(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (phoneOtp.length !== 6) return Toast.show({ type: 'error', text1: 'Enter 6-digit SMS code' });
    if (!verificationId)       return Toast.show({ type: 'error', text1: 'Send SMS code first' });
    setVerifyingPhone(true);
    try {
      const cred     = FirebasePhoneAuthProvider.credential(verificationId, phoneOtp);
      const userCred = await firebaseSignInWithCredential(firebaseAuth, cred);
      const token    = await userCred.user.getIdToken();
      const res      = await verifyPhoneOTP({ phone, firebaseIdToken: token });
      const { token: jwt, user } = res.data.data;
      await setAuth(jwt, user);
      Toast.show({ type: 'success', text1: '✅ Phone verified! Welcome!' });
    } catch (e) {
      let msg = e?.response?.data?.message || 'Verification failed';
      if (e?.code === 'auth/invalid-verification-code') msg = 'Wrong code. Try again.';
      else if (e?.code === 'auth/code-expired')          msg = 'Code expired. Resend.';
      Toast.show({ type: 'error', text1: msg });
    } finally { setVerifyingPhone(false); }
  };

  const handleVerifyEmail = async () => {
    if (emailOtp.length !== 4) return Toast.show({ type: 'error', text1: 'Enter 4-digit OTP' });
    setVerifyingEmail(true);
    try {
      const res = await verifyEmailOTP({ phone, email, otp: emailOtp });
      const { token, user } = res.data.data;
      await setAuth(token, user);
      Toast.show({ type: 'success', text1: '✅ Email verified! Welcome!' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Invalid OTP' });
    } finally { setVerifyingEmail(false); }
  };

  const handleResendEmail = async () => {
    if (cooldown > 0) return;
    try {
      await resendOTP({ email, name });
      setCooldown(60);
      setEmailOtp('');
      Toast.show({ type: 'success', text1: '📧 OTP resent' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Failed' });
    }
  };

  return (
    <Screen bg={COLORS.white}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <TouchableOpacity onPress={() => navigation.goBack()} style={S.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.gray700} />
        </TouchableOpacity>

        <View style={S.iconBox}>
          <Ionicons name="shield-checkmark-outline" size={40} color={COLORS.primary} />
        </View>
        <Text style={S.title}>Verify Your Account</Text>
        <Text style={S.sub}>Account is created only after verification.</Text>

        {/* Tabs */}
        <View style={S.tabs}>
          <TouchableOpacity style={[S.tab, tab === 'email' && S.tabActive]} onPress={() => setTab('email')}>
            <Ionicons name="mail-outline" size={14} color={tab === 'email' ? COLORS.primary : COLORS.gray400} />
            <Text style={[S.tabText, tab === 'email' && S.tabTextActive]}>Email OTP</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.tab, tab === 'phone' && S.tabActive]} onPress={() => setTab('phone')}>
            <Ionicons name="phone-portrait-outline" size={14} color={tab === 'phone' ? COLORS.primary : COLORS.gray400} />
            <Text style={[S.tabText, tab === 'phone' && S.tabTextActive]}>Phone OTP</Text>
          </TouchableOpacity>
        </View>

        {/* Email Tab */}
        {tab === 'email' && (
          <View style={S.panel}>
            <View style={S.note}>
              <Ionicons name="mail-outline" size={13} color={COLORS.primary} />
              <Text style={S.noteText}>
                {'4-digit OTP sent to '}
                <Text style={{ fontWeight: '700' }}>{email}</Text>
                {'. Check inbox & spam.'}
              </Text>
            </View>
            <Text style={S.label}>Enter OTP</Text>
            <OTPBox value={emailOtp} onChange={setEmailOtp} length={4} />
            <Button title="Verify Email & Create Account" onPress={handleVerifyEmail} loading={verifyingEmail} size="lg" style={S.btn} />
            <TouchableOpacity onPress={handleResendEmail} disabled={cooldown > 0} style={S.resendWrap}>
              <Text style={[S.resendText, cooldown > 0 && S.resendOff]}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : '📧 Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Phone Tab */}
        {tab === 'phone' && (
          <View style={S.panel}>
            <View style={S.note}>
              <Ionicons name="phone-portrait-outline" size={13} color={COLORS.primary} />
              <Text style={S.noteText}>
                {'SMS code will be sent to '}
                <Text style={{ fontWeight: '700' }}>{phone}</Text>
                {' via Firebase.'}
              </Text>
            </View>
            <Button
              title={verificationId ? '🔄 Resend SMS' : '📲 Send SMS Code'}
              onPress={sendFirebaseOTP}
              loading={sendingPhone}
              variant={verificationId ? 'outline' : 'primary'}
              size="md"
              style={{ marginBottom: SIZES.lg }}
            />
            {verificationId && (
              <>
                <Text style={S.label}>Enter 6-digit SMS Code</Text>
                <OTPBox value={phoneOtp} onChange={setPhoneOtp} length={6} />
                <Button title="Verify Phone" onPress={handleVerifyPhone} loading={verifyingPhone} size="lg" style={S.btn} />
              </>
            )}
            <View style={S.orRow}>
              <View style={S.orLine} /><Text style={S.orTxt}>or</Text><View style={S.orLine} />
            </View>
            <TouchableOpacity onPress={() => setTab('email')} style={S.switchRow}>
              <Ionicons name="mail-outline" size={14} color={COLORS.primary} />
              <Text style={S.switchTxt}>Use Email OTP instead</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const S = StyleSheet.create({
  back:          { marginBottom: SIZES.xl },
  iconBox:       { width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: SIZES.xl, alignSelf: 'center' },
  title:         { fontSize: SIZES.fontXxl, fontWeight: '700', color: COLORS.gray900, textAlign: 'center', marginBottom: 8 },
  sub:           { fontSize: SIZES.fontMd, color: COLORS.gray500, textAlign: 'center', marginBottom: SIZES.xl, lineHeight: 22 },
  tabs:          { flexDirection: 'row', borderRadius: 10, borderWidth: 1, borderColor: COLORS.gray200, overflow: 'hidden', marginBottom: SIZES.lg },
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SIZES.md, backgroundColor: COLORS.gray50 },
  tabActive:     { backgroundColor: COLORS.primaryLight },
  tabText:       { fontSize: SIZES.fontSm, color: COLORS.gray400, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },
  panel:         { backgroundColor: COLORS.gray50, borderRadius: 14, padding: SIZES.lg, marginBottom: SIZES.lg },
  note:          { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.primaryLight, borderRadius: 8, padding: SIZES.sm, marginBottom: SIZES.lg },
  noteText:      { flex: 1, fontSize: SIZES.fontXs, color: COLORS.primary, lineHeight: 18 },
  label:         { fontSize: SIZES.fontSm, fontWeight: '600', color: COLORS.gray700, marginBottom: SIZES.sm },
  otpRow:        { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: SIZES.md },
  otpBox:        { width: 48, height: 56, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, fontSize: 22, fontWeight: '700', color: COLORS.gray900, backgroundColor: COLORS.white, textAlign: 'center' },
  otpFilled:     { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  btn:           { marginTop: SIZES.sm, marginBottom: SIZES.md },
  resendWrap:    { alignItems: 'center', paddingVertical: SIZES.sm },
  resendText:    { fontSize: SIZES.fontMd, color: COLORS.primary, fontWeight: '600' },
  resendOff:     { color: COLORS.gray400 },
  orRow:         { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginVertical: SIZES.md },
  orLine:        { flex: 1, height: 1, backgroundColor: COLORS.gray200 },
  orTxt:         { fontSize: SIZES.fontSm, color: COLORS.gray400 },
  switchRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  switchTxt:     { fontSize: SIZES.fontMd, color: COLORS.primary, fontWeight: '600' },
});