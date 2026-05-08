import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar, Dimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { signup } from '../../api';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';

const { width } = Dimensions.get('window');

export default function SignupScreen({ navigation }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSignup = async () => {
    const { name, phone, email, password, confirm } = form;

    if (!name || !phone || !email || !password)
      return Toast.show({ type: 'error', text1: 'Please fill all fields' });
    if (!termsAgreed)
      return Toast.show({ type: 'error', text1: 'Please accept Terms & Conditions' });
    if (password !== confirm)
      return Toast.show({ type: 'error', text1: 'Passwords do not match' });
    if (password.length < 6)
      return Toast.show({ type: 'error', text1: 'Password must be at least 6 characters' });

    const digits = phone.trim().replace(/\D/g, '');
    let formattedPhone;
    if (digits.startsWith('231'))      formattedPhone = '+' + digits;
    else if (digits.startsWith('0'))   formattedPhone = '+231' + digits.slice(1);
    else                               formattedPhone = '+231' + digits;

    setLoading(true);
    try {
      // Backend stores temporarily + sends email OTP — NO userId returned
      await signup({
        name: name.trim(),
        phone: formattedPhone,
        email: email.trim().toLowerCase(),
        password,
      });

      Toast.show({ type: 'success', text1: 'Verify your account!', text2: 'Use phone or email OTP' });

      navigation.navigate('VerifyPhone', {
        phone: formattedPhone,
        email: email.trim().toLowerCase(),
        name: name.trim(),
      });
    } catch (e) {
      const msg = e.response?.data?.message || '';
      if (msg.toLowerCase().includes('phone'))
        Toast.show({ type: 'error', text1: 'Phone already registered' });
      else if (msg.toLowerCase().includes('email'))
        Toast.show({ type: 'error', text1: 'Email already registered' });
      else
        Toast.show({ type: 'error', text1: msg || 'Signup failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2E8A" />
      <LinearGradient colors={['#0A2E8A', '#0F3BAF', '#1B4FD8']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.geoCircle1} /><View style={styles.geoCircle2} />
        <View style={styles.heroContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.heroRow}>
            <View style={styles.logoIconWrap}><Ionicons name="person-add" size={20} color={COLORS.white} /></View>
            <View>
              <Text style={styles.heroTitle}>Create Account</Text>
              <Text style={styles.heroSub}>Start sending parcels safely</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <View>
              <Text style={styles.sheetTitle}>Your details</Text>
              <Text style={styles.sheetSub}>Fill in the information below</Text>
            </View>
            <View style={styles.stepBadge}><Text style={styles.stepText}>1 of 2</Text></View>
          </View>
          <View style={styles.sheetDivider} />

          <View style={styles.row}>
            <View style={styles.halfLeft}>
              <Input label="Full Name" placeholder="John Doe" value={form.name} onChangeText={set('name')} autoCapitalize="words" leftIcon={<Ionicons name="person-outline" size={16} color={COLORS.gray400} />} />
            </View>
            <View style={styles.halfRight}>
              <Input label="Phone" placeholder="+231 077..." value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" leftIcon={<Ionicons name="call-outline" size={16} color={COLORS.gray400} />} />
            </View>
          </View>

          <Input label="Email Address" placeholder="john@example.com" value={form.email} onChangeText={set('email')} keyboardType="email-address" leftIcon={<Ionicons name="mail-outline" size={18} color={COLORS.gray400} />} />

          <View style={styles.row}>
            <View style={styles.halfLeft}>
              <Input label="Password" placeholder="Min 6 chars" value={form.password} onChangeText={set('password')} secureTextEntry leftIcon={<Ionicons name="lock-closed-outline" size={16} color={COLORS.gray400} />} />
            </View>
            <View style={styles.halfRight}>
              <Input label="Confirm" placeholder="Re-enter" value={form.confirm} onChangeText={set('confirm')} secureTextEntry leftIcon={<Ionicons name="lock-closed-outline" size={16} color={COLORS.gray400} />} />
            </View>
          </View>

          <TouchableOpacity style={styles.termsRow} onPress={() => setTermsAgreed(v => !v)}>
            <View style={[styles.checkbox, termsAgreed && styles.checkboxChecked]}>
              {termsAgreed && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
            </View>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsLink} onPress={() => navigation.navigate('Terms', { fromSignup: false })}>Terms & Conditions</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={15} color={COLORS.primary} />
            <Text style={styles.infoText}>
              After signup, verify via <Text style={{ fontWeight: '700' }}>SMS OTP (Twilio)</Text> or <Text style={{ fontWeight: '700' }}>email OTP</Text>. Account is created only after verification.
            </Text>
          </View>

          <Button title="Create Account" onPress={handleSignup} loading={loading} size="lg" />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F3BAF' },
  flex: { flex: 1 },
  hero: { height: 150, justifyContent: 'flex-end', paddingBottom: 32, overflow: 'hidden' },
  geoCircle1: { position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)' },
  geoCircle2: { position: 'absolute', top: 20, right: 60, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroContent: { paddingHorizontal: SIZES.xxl },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: SIZES.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
  logoIconWrap: { width: 40, height: 40, borderRadius: SIZES.radiusMd, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  heroTitle: { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: COLORS.white },
  heroSub: { fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.65)', fontWeight: FONT_WEIGHT.medium, marginTop: 2 },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sheetContent: { paddingHorizontal: SIZES.xxl, paddingTop: SIZES.md, paddingBottom: 32 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.gray200, alignSelf: 'center', marginBottom: SIZES.lg },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SIZES.md },
  sheetTitle: { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900 },
  sheetSub: { fontSize: SIZES.fontSm, color: COLORS.gray400, marginTop: 3 },
  stepBadge: { backgroundColor: COLORS.primaryLight, borderRadius: SIZES.radiusFull, paddingHorizontal: SIZES.md, paddingVertical: 4 },
  stepText: { fontSize: SIZES.fontXs, color: COLORS.primary, fontWeight: FONT_WEIGHT.bold },
  sheetDivider: { height: 1, backgroundColor: COLORS.gray100, marginBottom: SIZES.md },
  row: { flexDirection: 'row', gap: SIZES.sm },
  halfLeft: { flex: 1 },
  halfRight: { flex: 1 },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md, marginTop: SIZES.xs, backgroundColor: COLORS.gray50, borderRadius: SIZES.radiusSm, padding: SIZES.md, borderWidth: 1, borderColor: COLORS.gray100 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: COLORS.gray300, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: COLORS.white },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  termsText: { flex: 1, fontSize: SIZES.fontSm, color: COLORS.gray600, lineHeight: 18 },
  termsLink: { color: COLORS.primary, fontWeight: FONT_WEIGHT.bold, textDecorationLine: 'underline' },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.xs, backgroundColor: COLORS.primaryLight, borderRadius: SIZES.radiusSm, padding: SIZES.md, marginBottom: SIZES.lg },
  infoText: { flex: 1, fontSize: SIZES.fontXs, color: COLORS.primary, lineHeight: 17 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: SIZES.lg, paddingTop: SIZES.lg, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  footerText: { fontSize: SIZES.fontMd, color: COLORS.gray500 },
  link: { fontSize: SIZES.fontMd, color: COLORS.primary, fontWeight: FONT_WEIGHT.black },
});