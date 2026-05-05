import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { forgotPassword, verifyResetOTP, resetPassword } from '../../api';
import { COLORS, SIZES } from '../../theme';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep]       = useState(1);
  const [email, setEmail]     = useState('');
  const [otp, setOtp]         = useState(['', '', '', '']);
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken]     = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSend = async () => {
    if (!email.trim()) return Toast.show({ type: 'error', text1: 'Enter your email address' });
    setLoading(true);
    try {
      await forgotPassword({ email: email.trim().toLowerCase() });
      setCooldown(60);
      setStep(2);
      Toast.show({ type: 'success', text1: 'OTP sent to your email' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.message || 'Failed' });
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async () => {
    const code = otp.join('');
    if (code.length !== 4) return Toast.show({ type: 'error', text1: 'Enter 4-digit OTP' });
    setLoading(true);
    try {
      const res = await verifyResetOTP({ email: email.trim().toLowerCase(), otp: code });
      setToken(res.data.data.resetToken);
      setStep(3);
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.message || 'Invalid OTP' });
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (newPass.length < 6) return Toast.show({ type: 'error', text1: 'Password must be 6+ characters' });
    if (newPass !== confirm) return Toast.show({ type: 'error', text1: 'Passwords do not match' });
    setLoading(true);
    try {
      await resetPassword({ resetToken: token, newPassword: newPass });
      Toast.show({ type: 'success', text1: 'Password reset! Please login.' });
      navigation.navigate('Login');
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.message || 'Failed' });
    } finally { setLoading(false); }
  };

  const handleChange = (val, idx) => {
    const next = [...otp]; next[idx] = val; setOtp(next);
    if (val && idx < 3) inputs.current[idx + 1]?.focus();
  };

  return (
    <Screen scroll bg={COLORS.white}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={COLORS.gray700} />
      </TouchableOpacity>
      <View style={styles.iconBox}>
        <Ionicons name={step === 3 ? 'lock-closed-outline' : 'mail-outline'} size={36} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>{step === 1 ? 'Forgot Password' : step === 2 ? 'Enter OTP' : 'New Password'}</Text>
      <Text style={styles.sub}>
        {step === 1 ? "Enter your email address and we'll send a reset code."
          : step === 2 ? `Enter the code sent to ${email}.`
          : 'Set your new password below.'}
      </Text>

      {step === 1 && (
        <>
          <Input label="Email Address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" leftIcon={<Ionicons name="mail-outline" size={18} color={COLORS.gray400} />} style={{ marginTop: SIZES.lg }} />
          <Button title="Send OTP" onPress={handleSend} loading={loading} size="lg" style={{ marginTop: SIZES.xl }} />
        </>
      )}

      {step === 2 && (
        <>
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput key={i} ref={(r) => (inputs.current[i] = r)}
                style={[styles.otpBox, digit && styles.otpBoxFilled]}
                value={digit} onChangeText={(v) => handleChange(v.replace(/\D/g, '').slice(-1), i)}
                onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && !otp[i] && i > 0) inputs.current[i - 1]?.focus(); }}
                keyboardType="number-pad" maxLength={1} textAlign="center"
              />
            ))}
          </View>
          <Button title="Verify OTP" onPress={handleVerifyOTP} loading={loading} size="lg" style={{ marginTop: SIZES.lg }} />
          <TouchableOpacity disabled={cooldown > 0} style={styles.resend} onPress={handleSend}>
            <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {step === 3 && (
        <>
          <Input label="New Password" placeholder="Min 6 characters" value={newPass} onChangeText={setNewPass} secureTextEntry style={{ marginTop: SIZES.lg }} />
          <Input label="Confirm Password" placeholder="Re-enter" value={confirm} onChangeText={setConfirm} secureTextEntry />
          <Button title="Reset Password" onPress={handleReset} loading={loading} size="lg" style={{ marginTop: SIZES.xl }} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginBottom: SIZES.xl },
  iconBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: SIZES.xl, alignSelf: 'center' },
  title: { fontSize: SIZES.fontXxl, fontWeight: '700', color: COLORS.gray900, marginBottom: 8 },
  sub: { fontSize: SIZES.fontMd, color: COLORS.gray500, lineHeight: 24, marginBottom: SIZES.xl },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: SIZES.xl },
  otpBox: { width: 56, height: 64, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: SIZES.radiusMd, fontSize: 24, fontWeight: '700', color: COLORS.gray900 },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  resend: { alignItems: 'center', marginTop: SIZES.lg },
  resendText: { fontSize: SIZES.fontMd, color: COLORS.primary, fontWeight: '600' },
  resendDisabled: { color: COLORS.gray400 },
});