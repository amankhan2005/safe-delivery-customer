import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { forgotPassword, verifyResetOTP, resetPassword } from '../../api';
import { COLORS, SIZES } from '../../theme';

// Step 1 — enter phone
// Step 2 — enter OTP
// Step 3 — enter new password

export default function ForgotPasswordScreen({ navigation }) {
  const [step,      setStep]     = useState(1);
  const [phone,     setPhone]    = useState('');
  const [otp,       setOtp]      = useState(['', '', '', '']);
  const [newPass,   setNewPass]  = useState('');
  const [confirm,   setConfirm]  = useState('');
  const [loading,   setLoading]  = useState(false);
  const [token,     setToken]    = useState('');
  const [cooldown,  setCooldown] = useState(0);
  const inputs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Step 1
  const handleSend = async () => {
    if (!phone.trim()) return Toast.show({ type: 'error', text1: 'Enter your phone number' });
    setLoading(true);
    try {
      await forgotPassword({ phone: phone.trim() });
      setCooldown(60);
      setStep(2);
      Toast.show({ type: 'success', text1: 'OTP sent to your phone and email' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.error || 'Failed' });
    } finally { setLoading(false); }
  };

  // Step 2
  const handleVerifyOTP = async () => {
    const code = otp.join('');
    if (code.length !== 4) return Toast.show({ type: 'error', text1: 'Enter 4-digit OTP' });
    setLoading(true);
    try {
      const res = await verifyResetOTP({ phone: phone.trim(), otp: code });
      setToken(res.data.data.resetToken);
      setStep(3);
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.error || 'Invalid OTP' });
    } finally { setLoading(false); }
  };

  // Step 3
  const handleReset = async () => {
    if (!newPass || !confirm) return Toast.show({ type: 'error', text1: 'Fill all fields' });
    if (newPass !== confirm)  return Toast.show({ type: 'error', text1: 'Passwords do not match' });
    if (newPass.length < 6)   return Toast.show({ type: 'error', text1: 'Min 6 characters' });
    setLoading(true);
    try {
      await resetPassword({ resetToken: token, newPassword: newPass });
      Toast.show({ type: 'success', text1: 'Password reset! Please login.' });
      navigation.navigate('Login');
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.error || 'Failed' });
    } finally { setLoading(false); }
  };

  const otpChange = (val, idx) => {
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 3) inputs.current[idx + 1]?.focus();
  };

  return (
    <Screen scroll bg={COLORS.white}>
      <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={COLORS.gray700} />
      </TouchableOpacity>

      {/* Step indicators */}
      <View style={styles.steps}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={[styles.step, s <= step && styles.stepActive]} />
        ))}
      </View>

      {step === 1 && (
        <>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.sub}>Enter your phone number to receive a reset OTP</Text>
          <Input
            label="Phone Number"
            placeholder="+231 077 123 4567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon={<Ionicons name="call-outline" size={18} color={COLORS.gray400} />}
          />
          <Button title="Send OTP" onPress={handleSend} loading={loading} size="lg" />
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.sub}>4-digit code sent to <Text style={styles.bold}>{phone}</Text></Text>
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(r) => (inputs.current[i] = r)}
                style={[styles.otpBox, digit && styles.otpBoxFilled]}
                value={digit}
                onChangeText={(v) => otpChange(v.replace(/\D/g, '').slice(-1), i)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
              />
            ))}
          </View>
          <Button title="Verify OTP" onPress={handleVerifyOTP} loading={loading} size="lg" style={{ marginBottom: SIZES.md }} />
          <TouchableOpacity onPress={handleSend} disabled={cooldown > 0} style={styles.resend}>
            <Text style={[styles.resendText, cooldown > 0 && { color: COLORS.gray400 }]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {step === 3 && (
        <>
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.sub}>Choose a strong password for your account</Text>
          <Input
            label="New Password"
            placeholder="Min 6 characters"
            value={newPass}
            onChangeText={setNewPass}
            secureTextEntry
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.gray400} />}
          />
          <Input
            label="Confirm Password"
            placeholder="Re-enter password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.gray400} />}
          />
          <Button title="Reset Password" onPress={handleReset} loading={loading} size="lg" />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back:   { marginBottom: SIZES.xl },
  steps:  { flexDirection: 'row', gap: 6, marginBottom: SIZES.xxl },
  step:   { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.gray200 },
  stepActive: { backgroundColor: COLORS.primary },
  title:  { fontSize: SIZES.fontXxl, fontWeight: '700', color: COLORS.gray900, marginBottom: 8 },
  sub:    { fontSize: SIZES.fontMd, color: COLORS.gray500, marginBottom: SIZES.xxl, lineHeight: 24 },
  bold:   { color: COLORS.gray900, fontWeight: '600' },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: SIZES.xxxl },
  otpBox: {
    width: 56, height: 64, borderWidth: 1.5,
    borderColor: COLORS.border, borderRadius: SIZES.radiusMd,
    fontSize: 24, fontWeight: '700', color: COLORS.gray900,
  },
  otpBoxFilled:{ borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  resend:      { alignItems: 'center' },
  resendText:  { fontSize: SIZES.fontMd, color: COLORS.primary, fontWeight: '600' },
});
