import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Screen from '../../components/Screen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { login } from '../../api';
import useAuthStore from '../../store/authStore';
import { COLORS, SIZES, FONT_WEIGHT } from '../../theme';

const RETRY_MESSAGES = [
  { icon: '🔌', text: 'Connecting to server…' },
  { icon: '⏳', text: 'Server is waking up, please wait…' },
  { icon: '🔄', text: 'Almost there, just a moment…' },
  { icon: '💤', text: 'Still connecting, please be patient…' },
];

const getFriendlyError = (e) => {
  if (e?.code === 'ECONNABORTED' || !e?.response) {
    return { icon: '📡', title: 'Connection Timeout', sub: 'Server is waking up from sleep. Tap Retry in a moment.', retry: true };
  }
  const status = e?.response?.status;
  const msg    = e?.response?.data?.error || e?.response?.data?.message || '';

  if (status === 401 || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
    return { icon: '🔑', title: 'Wrong Credentials', sub: 'Email/phone or password is incorrect. Please check and try again.', retry: false };
  }
  if (status === 404 || msg.toLowerCase().includes('not found')) {
    return { icon: '👤', title: 'Account Not Found', sub: 'No account with this email or phone. Please sign up first.', retry: false };
  }
  if (status === 403) {
    return { icon: '⚠️', title: 'Account Issue', sub: msg || 'Your account may not be verified yet.', retry: false };
  }
  if (status === 429) {
    return { icon: '🚫', title: 'Too Many Attempts', sub: 'Please wait a few minutes before trying again.', retry: false };
  }
  if (status >= 500) {
    return { icon: '🛠️', title: 'Server Error', sub: 'Something went wrong on our end. Please try again.', retry: true };
  }
  return { icon: '❌', title: 'Login Failed', sub: msg || 'Something went wrong. Please try again.', retry: true };
};

export default function LoginScreen({ navigation }) {
  const setAuth = useAuthStore((s) => s.setAuth);

  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [retryIdx,   setRetryIdx]   = useState(0);
  const [showPw,     setShowPw]     = useState(false);
  const [errorBox,   setErrorBox]   = useState(null);

  const retryRef = useRef(null);

  const startRetryMessages = () => {
    setRetryIdx(0);
    retryRef.current = setInterval(() => {
      setRetryIdx((i) => Math.min(i + 1, RETRY_MESSAGES.length - 1));
    }, 5000);
  };

  const stopRetryMessages = () => {
    if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
    setRetryIdx(0);
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setErrorBox({ icon: '📝', title: 'Fields Required', sub: 'Please enter your email/phone and password.', retry: false });
      return;
    }
    if (loading) return;

    setErrorBox(null);
    setLoading(true);
    startRetryMessages();

    try {
      const res = await login({ identifier: identifier.trim(), password });
      const { token, user } = res.data.data;
      stopRetryMessages();
      setErrorBox(null);
      await setAuth(token, user);
      Toast.show({ type: 'success', text1: `✅ Welcome back, ${user.name?.split(' ')[0]}!` });
    } catch (e) {
      stopRetryMessages();
      setErrorBox(getFriendlyError(e));
    } finally {
      setLoading(false);
      stopRetryMessages();
    }
  };

  const currentMsg = RETRY_MESSAGES[retryIdx];

  return (
    <Screen bg={COLORS.white}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <TouchableOpacity onPress={() => navigation.goBack()} style={S.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.gray700} />
        </TouchableOpacity>

        <View style={S.headerSection}>
          <LinearGradient colors={['#1B4FD8', '#0A2F9A']} style={S.logoBox}>
            <Ionicons name="cube-outline" size={32} color="#fff" />
          </LinearGradient>
          <Text style={S.title}>Welcome back</Text>
          <Text style={S.sub}>Login to your Safe Delivery account</Text>
        </View>

        <View style={S.form}>
          <Input
            label="Email or Phone"
            placeholder="your@email.com or +2310770000000"
            value={identifier}
            onChangeText={(v) => { setIdentifier(v); setErrorBox(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="person-outline"
            editable={!loading}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(v) => { setPassword(v); setErrorBox(null); }}
            secureTextEntry={!showPw}
            leftIcon="lock-closed-outline"
            rightIcon={showPw ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPw(!showPw)}
            editable={!loading}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPass')}
            style={S.forgotRow}
            disabled={loading}
          >
            <Text style={S.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Connecting / wakeup status */}
          {loading ? (
            <View style={S.statusBox}>
              <Text style={S.statusIcon}>{currentMsg.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.statusText}>{currentMsg.text}</Text>
                {retryIdx >= 1 ? (
                  <Text style={S.statusHint}>This happens when server is starting up</Text>
                ) : null}
              </View>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : null}

          {/* Error box */}
          {!loading && errorBox ? (
            <View style={[S.errorBox, errorBox.retry && S.errorBoxWarn]}>
              <Text style={S.errorIcon}>{errorBox.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.errorTitle}>{errorBox.title}</Text>
                <Text style={S.errorSub}>{errorBox.sub}</Text>
              </View>
              {errorBox.retry ? (
                <TouchableOpacity onPress={handleLogin} style={S.retryBtn}>
                  <Ionicons name="refresh-outline" size={13} color="#fff" />
                  <Text style={S.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <Button
            title={loading ? 'Logging in…' : 'Login'}
            onPress={handleLogin}
            loading={loading}
            size="lg"
            style={S.loginBtn}
          />

          <View style={S.signupRow}>
            <Text style={S.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')} disabled={loading}>
              <Text style={S.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const S = StyleSheet.create({
  back:          { marginBottom: SIZES.xl },
  headerSection: { alignItems: 'center', marginBottom: SIZES.xxl },
  logoBox:       { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: SIZES.lg },
  title:         { fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900, marginBottom: 8 },
  sub:           { fontSize: SIZES.fontMd, color: COLORS.gray500, textAlign: 'center' },
  form:          { gap: SIZES.md },

  forgotRow: { alignItems: 'flex-end', marginTop: -4 },
  forgotText:{ fontSize: SIZES.fontSm, color: COLORS.primary, fontWeight: FONT_WEIGHT.semibold },

  statusBox:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 12, padding: SIZES.md, borderWidth: 1, borderColor: '#BFDBFE' },
  statusIcon: { fontSize: 20 },
  statusText: { fontSize: SIZES.fontSm, color: '#1E40AF', fontWeight: FONT_WEIGHT.semibold },
  statusHint: { fontSize: SIZES.fontXs, color: '#3B82F6', marginTop: 2 },

  errorBox:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 12, padding: SIZES.md, borderWidth: 1, borderColor: '#FECACA' },
  errorBoxWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  errorIcon:    { fontSize: 20 },
  errorTitle:   { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.black, color: '#991B1B', marginBottom: 2 },
  errorSub:     { fontSize: SIZES.fontXs, color: '#B91C1C', lineHeight: 16 },
  retryBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 2 },
  retryBtnText: { fontSize: SIZES.fontXs, color: '#fff', fontWeight: FONT_WEIGHT.bold },

  loginBtn:   { marginTop: SIZES.sm },
  signupRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: SIZES.md },
  signupText: { fontSize: SIZES.fontMd, color: COLORS.gray500 },
  signupLink: { fontSize: SIZES.fontMd, color: COLORS.primary, fontWeight: FONT_WEIGHT.bold },
});