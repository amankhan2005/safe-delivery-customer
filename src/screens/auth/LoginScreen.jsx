import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView, Platform,
  StatusBar, Dimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { login } from '../../api';
import useAuthStore from '../../store/authStore';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, delay: 80, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      return Toast.show({ type: 'error', text1: 'Fill all fields' });
    }
    setLoading(true);
    try {
      const res = await login({ identifier: identifier.trim(), password });
      await setAuth(res.data.data.token, res.data.data.user);
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.error || 'Invalid credentials' });
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0A2E8A" />

      {/* ── Compact Hero ── */}
      <LinearGradient
        colors={['#0A2E8A', '#0F3BAF', '#1B4FD8']}
        style={styles.hero}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={styles.geoCircle1} />
        <View style={styles.geoCircle2} />
        <View style={styles.geoDot1} />
        <View style={styles.geoDot2} />

        <Animated.View style={[styles.heroContent, { transform: [{ scale: logoScale }] }]}>
          {/* Logo pill + title on one row */}
          <View style={styles.heroRow}>
            <View style={styles.logoIconWrap}>
              <Ionicons name="cube" size={20} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.heroTitle}>Safe Delivery</Text>
              <Text style={styles.heroSub}>Liberia's trusted logistics</Text>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* ── Form Sheet ── */}
      <Animated.View
        style={[styles.sheet, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.sheetHandle} />

        <View style={styles.sheetHeaderRow}>
          <View>
            <Text style={styles.sheetTitle}>Welcome back</Text>
            <Text style={styles.sheetSub}>Sign in to continue</Text>
          </View>
          <View style={styles.sheetBadge}>
            <Ionicons name="lock-closed" size={15} color={COLORS.primary} />
          </View>
        </View>

        <View style={styles.sheetDivider} />

        <Input
          label="Phone or Email"
          placeholder="e.g. +231 077 123 4567"
          value={identifier}
          onChangeText={setIdentifier}
          keyboardType="email-address"
          leftIcon={<Ionicons name="person-outline" size={18} color={COLORS.gray400} />}
        />

        <Input
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          leftIcon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.gray400} />}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('ForgotPass')}
          style={styles.forgotRow}
        >
          <Ionicons name="key-outline" size={13} color={COLORS.primary} />
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <Button
          title="Sign In"
          onPress={handleLogin}
          loading={loading}
          size="lg"
          style={styles.signInBtn}
        />

        <View style={styles.divider}>
          <View style={styles.divLine} />
          <Text style={styles.divText}>or</Text>
          <View style={styles.divLine} />
        </View>

        <TouchableOpacity
          style={styles.otpBtn}
          onPress={() => navigation.navigate('ForgotPass', { otpLogin: true })}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={17} color={COLORS.primary} />
          <Text style={styles.otpBtnText}>Login with OTP</Text>
        </TouchableOpacity>

        <View style={styles.signupRow}>
          <Text style={styles.signupText}>New to Safe Delivery? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.signupLink}>Create Account</Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F3BAF' },

  // ── Hero: compact, no scroll ──
  hero: {
    height: 160,
    justifyContent: 'flex-end',
    paddingBottom: 36,
    overflow: 'hidden',
  },
  geoCircle1: {
    position: 'absolute', top: -50, right: -50,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  geoCircle2: {
    position: 'absolute', top: 20, right: 60,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  geoDot1: {
    position: 'absolute', top: 40, left: width * 0.55,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  geoDot2: {
    position: 'absolute', top: 65, left: width * 0.65,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  heroContent: { paddingHorizontal: SIZES.xxl },
  heroRow: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.md,
  },
  logoIconWrap: {
    width: 44, height: 44, borderRadius: SIZES.radiusMd,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroTitle: {
    fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black,
    color: COLORS.white, letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.65)',
    fontWeight: FONT_WEIGHT.medium, marginTop: 2,
  },

  // ── Sheet fills rest of screen ──
  sheet: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SIZES.xxl,
    paddingTop: SIZES.md,
    paddingBottom: SIZES.xl,
    ...SHADOWS.lg,
  },

  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.gray200,
    alignSelf: 'center', marginBottom: SIZES.lg,
  },
  sheetHeaderRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: SIZES.md,
  },
  sheetTitle: {
    fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black,
    color: COLORS.gray900, letterSpacing: -0.4,
  },
  sheetSub: {
    fontSize: SIZES.fontSm, color: COLORS.gray400,
    marginTop: 3, fontWeight: FONT_WEIGHT.medium,
  },
  sheetBadge: {
    width: 38, height: 38, borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetDivider: {
    height: 1, backgroundColor: COLORS.gray100,
    marginBottom: SIZES.lg,
  },

  forgotRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-end', marginTop: -6, marginBottom: SIZES.lg,
  },
  forgotText: {
    fontSize: SIZES.fontSm, color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },

  signInBtn: { marginBottom: SIZES.lg },

  divider: {
    flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.lg,
  },
  divLine: { flex: 1, height: 1, backgroundColor: COLORS.gray100 },
  divText: {
    marginHorizontal: SIZES.md, color: COLORS.gray300,
    fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },

  otpBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SIZES.sm,
    borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: SIZES.radiusMd, paddingVertical: 13,
    backgroundColor: COLORS.primaryLight,
    marginBottom: SIZES.lg,
  },
  otpBtnText: {
    fontSize: SIZES.fontMd, color: COLORS.primary,
    fontWeight: FONT_WEIGHT.bold,
  },

  signupRow: {
    flexDirection: 'row', justifyContent: 'center',
    paddingTop: SIZES.md,
    borderTopWidth: 1, borderTopColor: COLORS.gray100,
  },
  signupText: {
    fontSize: SIZES.fontMd, color: COLORS.gray500,
    fontWeight: FONT_WEIGHT.medium,
  },
  signupLink: {
    fontSize: SIZES.fontMd, color: COLORS.primary,
    fontWeight: FONT_WEIGHT.black,
  },
});