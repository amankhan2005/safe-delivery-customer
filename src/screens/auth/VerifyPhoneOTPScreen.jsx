import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import { verifyPhoneOTP, resendOTP } from '../../api';
import { COLORS, SIZES } from '../../theme';

export default function VerifyPhoneOTPScreen({ navigation, route }) {
  const { userId, phone, email } = route.params || {};
  const [otp,      setOtp]      = useState(['', '', '', '']);
  const [loading,  setLoading]  = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const inputs = useRef([]);

  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const handleChange = (val, idx) => {
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 3) inputs.current[idx + 1]?.focus();
  };

  const handleKeyPress = ({ nativeEvent }, idx) => {
    if (nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 4) return Toast.show({ type: 'error', text1: 'Enter 4-digit OTP' });

    setLoading(true);
    try {
      await verifyPhoneOTP({ userId, otp: code });
      Toast.show({ type: 'success', text1: 'Phone verified!' });
      navigation.navigate('VerifyEmail', { userId, email });
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.error || 'Invalid OTP' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await resendOTP({ identifier: phone, type: 'phone', userId });
      setCooldown(60);
      Toast.show({ type: 'success', text1: 'OTP resent!' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to resend' });
    }
  };

  return (
    <Screen bg={COLORS.white}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={COLORS.gray700} />
      </TouchableOpacity>

      <View style={styles.iconBox}>
        <Ionicons name="phone-portrait-outline" size={40} color={COLORS.primary} />
      </View>

      <Text style={styles.title}>Verify Phone</Text>
      <Text style={styles.sub}>
        Enter the 4-digit code sent to{'\n'}
        <Text style={styles.bold}>{phone}</Text>
      </Text>

      {/* OTP boxes */}
      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(r) => (inputs.current[i] = r)}
            style={[styles.otpBox, digit && styles.otpBoxFilled]}
            value={digit}
            onChangeText={(v) => handleChange(v.replace(/\D/g, '').slice(-1), i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            selectionColor={COLORS.primary}
          />
        ))}
      </View>

      <Button title="Verify" onPress={handleVerify} loading={loading} size="lg" style={styles.btn} />

      <TouchableOpacity onPress={handleResend} style={styles.resend} disabled={cooldown > 0}>
        <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
        </Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back:    { marginBottom: SIZES.xxl },
  iconBox: {
    width: 72, height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SIZES.xl,
  },
  title: { fontSize: SIZES.fontXxl, fontWeight: '700', color: COLORS.gray900, marginBottom: 8 },
  sub:   { fontSize: SIZES.fontMd, color: COLORS.gray500, marginBottom: SIZES.xxxl, lineHeight: 24 },
  bold:  { color: COLORS.gray900, fontWeight: '600' },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: SIZES.xxxl,
  },
  otpBox: {
    width: 56, height: 64,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: SIZES.radiusMd,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.gray900,
    backgroundColor: COLORS.white,
  },
  otpBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  btn:           { marginBottom: SIZES.lg },
  resend:        { alignItems: 'center' },
  resendText:    { fontSize: SIZES.fontMd, color: COLORS.primary, fontWeight: '600' },
  resendDisabled:{ color: COLORS.gray400 },
});
