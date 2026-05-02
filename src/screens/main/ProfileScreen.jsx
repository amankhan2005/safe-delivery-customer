import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, Platform,
  Modal, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import useAuthStore from '../../store/authStore';
import { changePassword, submitInquiry } from '../../api';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';

// ── Sub-components ──────────────────────────────────────────

const Section = ({ title, children }) => (
  <View style={styles.section}>
    {!!title && <Text style={styles.sectionTitle}>{title}</Text>}
    <View style={styles.menuCard}>{children}</View>
  </View>
);

const MenuItem = ({ icon, label, sublabel, onPress, danger, color = COLORS.primary, last }) => (
  <TouchableOpacity
    style={[styles.menuItem, !last && styles.menuItemBorder]}
    onPress={onPress} activeOpacity={0.75}
  >
    <View style={[styles.menuIconBox, { backgroundColor: (danger ? COLORS.red : color) + '18' }]}>
      <Ionicons name={icon} size={18} color={danger ? COLORS.red : color} />
    </View>
    <View style={styles.menuText}>
      <Text style={[styles.menuLabel, danger && { color: COLORS.red }]}>{label}</Text>
      {sublabel && <Text style={styles.menuSublabel}>{sublabel}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={14} color={COLORS.gray300} />
  </TouchableOpacity>
);

const FAQ_ITEMS = [
  { question: 'What is Safe Delivery?', answer: "Safe Delivery is Liberia's trusted logistics platform that connects customers with reliable delivery riders. We ensure your packages and goods are delivered safely and on time across the country." },
  { question: 'How do I use the Safe Delivery app?', answer: 'Simply create an account, place a delivery order by entering the pickup and drop-off location, choose your preferred delivery option, and pay. A rider will be assigned and you can track your order in real time.' },
  { question: 'What items are not allowed for delivery?', answer: 'We do not deliver illegal substances, weapons, flammable or hazardous materials, live animals, perishable goods without proper packaging, or any items prohibited by Liberian law.' },
  { question: 'How much does delivery cost?', answer: 'Delivery costs are calculated based on the distance between pickup and drop-off locations. You will see the exact price before confirming your order. Prices may vary during peak hours.' },
  { question: 'Is Cash on Delivery available?', answer: 'Yes! Safe Delivery supports Cash on Delivery (COD). You can pay the rider directly upon delivery. We also support mobile money and card payments for your convenience.' },
  { question: 'How can I track my order?', answer: 'Once your order is picked up by a rider, you can track their real-time location from the Orders section in the app. You will also receive status notifications at every step of the delivery.' },
];

const FaqItem = ({ item, isOpen, onToggle }) => (
  <View style={styles.faqItem}>
    <TouchableOpacity style={styles.faqQuestion} onPress={onToggle} activeOpacity={0.75}>
      <Text style={styles.faqQuestionText}>{item.question}</Text>
      <View style={[styles.faqChevronBox, isOpen && styles.faqChevronBoxOpen]}>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={13} color={isOpen ? COLORS.primary : COLORS.gray400} />
      </View>
    </TouchableOpacity>
    {isOpen && (
      <View style={styles.faqAnswer}>
        <Text style={styles.faqAnswerText}>{item.answer}</Text>
      </View>
    )}
  </View>
);

// ── Sign Out Modal ───────────────────────────────────────────

function SignOutModal({ visible, onCancel, onConfirm }) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.modalCard, { transform: [{ scale: scaleAnim }] }]}>

          {/* Icon */}
          <View style={styles.modalIconWrap}>
            <LinearGradient
              colors={['#FEE8E9', '#FECDD3']}
              style={styles.modalIconGradient}
            >
              <Ionicons name="log-out-outline" size={28} color={COLORS.red} />
            </LinearGradient>
          </View>

          <Text style={styles.modalTitle}>Sign Out?</Text>
          <Text style={styles.modalBody}>
            You'll be signed out of your Safe Delivery account. Your data stays safe and synced.
          </Text>

          {/* Buttons */}
          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onConfirm} activeOpacity={0.85} style={styles.modalConfirmWrap}>
              <LinearGradient
                colors={['#E8212B', '#C81B24']}
                style={styles.modalConfirmBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Ionicons name="log-out-outline" size={16} color={COLORS.white} />
                <Text style={styles.modalConfirmText}>Sign Out</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const [panel,       setPanel]       = useState(null);
  const [passForm,    setPassForm]    = useState({ old: '', newP: '', confirm: '' });
  const [message,     setMessage]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [openFaq,     setOpenFaq]     = useState(null);
  const [signOutModal, setSignOutModal] = useState(false);

  const togglePanel = (p) => setPanel(v => v === p ? null : p);
  const setP = (k) => (v) => setPassForm(f => ({ ...f, [k]: v }));

  const handleChangePass = async () => {
    const { old, newP, confirm } = passForm;
    if (!old || !newP || !confirm) return Toast.show({ type: 'error', text1: 'Fill all fields' });
    if (newP !== confirm) return Toast.show({ type: 'error', text1: 'Passwords do not match' });
    if (newP.length < 6)  return Toast.show({ type: 'error', text1: 'Minimum 6 characters' });
    setLoading(true);
    try {
      await changePassword({ oldPassword: old, newPassword: newP });
      Toast.show({ type: 'success', text1: 'Password updated!' });
      setPanel(null); setPassForm({ old: '', newP: '', confirm: '' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.error || 'Failed' });
    } finally { setLoading(false); }
  };

  const handleInquiry = async () => {
    if (!message.trim()) return Toast.show({ type: 'error', text1: 'Enter your message' });
    setLoading(true);
    try {
      await submitInquiry({
        firstName: user?.name?.split(' ')[0] || 'User',
        lastName:  user?.name?.split(' ').slice(1).join(' ') || '',
        phone: user?.phone, email: user?.email, role: 'customer', message,
      });
      Toast.show({ type: 'success', text1: 'Message sent!', text2: "We'll get back to you soon." });
      setPanel(null); setMessage('');
    } catch { Toast.show({ type: 'error', text1: 'Failed' }); }
    finally { setLoading(false); }
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <LinearGradient
        colors={['#0A2E8A', '#0F3BAF', '#1B4FD8']}
        style={styles.header}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerCircle} />
        <View style={styles.headerCircle2} />
        <View style={styles.headerDot} />

        {/* Avatar + Info */}
        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            <LinearGradient
              colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.15)']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </LinearGradient>
            {/* Online dot */}
            <View style={styles.onlineDot} />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-circle" size={13} color="#4ADE80" />
              <Text style={styles.verifiedText}>Verified Account</Text>
            </View>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <Text style={styles.profilePhone}>{user?.phone}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total Orders', value: user?.totalOrders ?? '0',     icon: 'cube-outline' },
            { label: 'Delivered',    value: user?.deliveredOrders ?? '0', icon: 'checkmark-circle-outline' },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <View style={styles.statDivider} />}
              <View style={styles.statItem}>
                <Ionicons name={s.icon} size={14} color="rgba(255,255,255,0.6)" style={{ marginBottom: 2 }} />
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </LinearGradient>

      {/* ── Body ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        <Section title="Account">
          <MenuItem
            icon="lock-closed-outline"
            label="Change Password"
            sublabel="Keep your account secure"
            onPress={() => togglePanel('password')}
            color={COLORS.primary}
            last
          />
        </Section>

        {panel === 'password' && (
          <View style={styles.panel}>
            <View style={styles.panelHdr}>
              <View style={styles.panelTitleRow}>
                <View style={styles.panelIconBox}>
                  <Ionicons name="lock-closed-outline" size={15} color={COLORS.primary} />
                </View>
                <Text style={styles.panelTitle}>Change Password</Text>
              </View>
              <TouchableOpacity onPress={() => setPanel(null)} style={styles.panelClose}>
                <Ionicons name="close" size={16} color={COLORS.gray500} />
              </TouchableOpacity>
            </View>
            <Input label="Current Password"  placeholder="••••••"          value={passForm.old}     onChangeText={setP('old')}     secureTextEntry leftIcon={<Ionicons name="lock-closed-outline" size={16} color={COLORS.gray400} />} />
            <Input label="New Password"      placeholder="Min 6 characters" value={passForm.newP}    onChangeText={setP('newP')}    secureTextEntry leftIcon={<Ionicons name="lock-open-outline" size={16} color={COLORS.gray400} />} />
            <Input label="Confirm Password"  placeholder="Re-enter"         value={passForm.confirm} onChangeText={setP('confirm')} secureTextEntry leftIcon={<Ionicons name="checkmark-circle-outline" size={16} color={COLORS.gray400} />} />
            <Button title="Update Password" onPress={handleChangePass} loading={loading} size="lg" />
          </View>
        )}

        <Section title="Support">
          <MenuItem icon="help-circle-outline"      label="Contact Support"    sublabel="Get help from our team"          onPress={() => togglePanel('support')} color={COLORS.green} />
          <MenuItem icon="document-text-outline"    label="FAQ"                sublabel="Frequently asked questions"      onPress={() => togglePanel('faq')}     color={COLORS.green} />
          <MenuItem icon="shield-checkmark-outline" label="Terms & Conditions" sublabel="Our policies and user agreement" onPress={() => navigation.navigate('Terms', { fromSignup: false })} color={COLORS.primary} last />
        </Section>

        {panel === 'support' && (
          <View style={styles.panel}>
            <View style={styles.panelHdr}>
              <View style={styles.panelTitleRow}>
                <View style={[styles.panelIconBox, { backgroundColor: COLORS.green + '18' }]}>
                  <Ionicons name="help-circle-outline" size={15} color={COLORS.green} />
                </View>
                <Text style={styles.panelTitle}>Contact Support</Text>
              </View>
              <TouchableOpacity onPress={() => setPanel(null)} style={styles.panelClose}>
                <Ionicons name="close" size={16} color={COLORS.gray500} />
              </TouchableOpacity>
            </View>
            <Input
              label="Your Message"
              placeholder="Describe your issue..."
              value={message}
              onChangeText={setMessage}
              multiline numberOfLines={4}
              inputStyle={{ height: 100, textAlignVertical: 'top' }}
            />
            <Button title="Send Message" onPress={handleInquiry} loading={loading} size="lg" />
          </View>
        )}

        {panel === 'faq' && (
          <View style={styles.panel}>
            <View style={styles.panelHdr}>
              <View style={styles.panelTitleRow}>
                <View style={[styles.panelIconBox, { backgroundColor: COLORS.green + '18' }]}>
                  <Ionicons name="document-text-outline" size={15} color={COLORS.green} />
                </View>
                <Text style={styles.panelTitle}>FAQ</Text>
              </View>
              <TouchableOpacity onPress={() => { setPanel(null); setOpenFaq(null); }} style={styles.panelClose}>
                <Ionicons name="close" size={16} color={COLORS.gray500} />
              </TouchableOpacity>
            </View>
            {FAQ_ITEMS.map((item, index) => (
              <FaqItem
                key={index}
                item={item}
                isOpen={openFaq === index}
                onToggle={() => setOpenFaq(v => v === index ? null : index)}
              />
            ))}
          </View>
        )}

        {/* Sign Out */}
        <Section title="">
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => setSignOutModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.signOutIconBox}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.red} />
            </View>
            <Text style={styles.signOutText}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.red + '80'} />
          </TouchableOpacity>
        </Section>

        <View style={styles.versionRow}>
          <View style={styles.versionDot} />
          <Text style={styles.version}>Safe Delivery v1.0 • Liberia's Trusted Logistics</Text>
          <View style={styles.versionDot} />
        </View>

      </ScrollView>

      {/* ── Sign Out Modal ── */}
      <SignOutModal
        visible={signOutModal}
        onCancel={() => setSignOutModal(false)}
        onConfirm={() => { setSignOutModal(false); logout(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : SIZES.xxl,
    paddingBottom: SIZES.xl,
    paddingHorizontal: SIZES.xl,
    overflow: 'hidden',
  },
  headerCircle:  { position: 'absolute', top: -60, right: -60, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,255,255,0.07)' },
  headerCircle2: { position: 'absolute', bottom: -30, left: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.04)' },
  headerDot:     { position: 'absolute', top: 80, right: 80, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },

  profileRow:  { flexDirection: 'row', alignItems: 'center', gap: SIZES.lg, marginBottom: SIZES.xl },
  avatarWrap:  { position: 'relative' },
  avatar:      { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText:  { fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black, color: COLORS.white },
  onlineDot:   { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#4ADE80', borderWidth: 2, borderColor: COLORS.primaryDark },

  profileInfo:  { flex: 1 },
  profileName:  { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: COLORS.white, letterSpacing: -0.3 },
  verifiedRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 4 },
  verifiedText: { fontSize: SIZES.fontXs, color: '#4ADE80', fontWeight: FONT_WEIGHT.bold },
  profileEmail: { fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.7)', fontWeight: FONT_WEIGHT.medium },
  profilePhone: { fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.55)', fontWeight: FONT_WEIGHT.medium, marginTop: 2 },

  statsRow:    { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.11)', borderRadius: SIZES.radiusMd, padding: SIZES.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statItem:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: COLORS.white },
  statLabel:   { fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.6)', fontWeight: FONT_WEIGHT.medium, marginTop: 1, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: SIZES.lg, paddingBottom: 110 },

  // Section
  section:      { marginBottom: SIZES.md },
  sectionTitle: { fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.bold, color: COLORS.gray400, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SIZES.sm },
  menuCard:     { backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, overflow: 'hidden', ...SHADOWS.xs },
  menuItem:     { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, padding: SIZES.lg },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  menuIconBox:  { width: 38, height: 38, borderRadius: SIZES.radiusSm, alignItems: 'center', justifyContent: 'center' },
  menuText:     { flex: 1 },
  menuLabel:    { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray900 },
  menuSublabel: { fontSize: SIZES.fontXs, color: COLORS.gray400, marginTop: 2, fontWeight: FONT_WEIGHT.medium },

  // Panel
  panel:    { backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: SIZES.lg, marginBottom: SIZES.md, ...SHADOWS.sm },
  panelHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.xl },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  panelIconBox:  { width: 30, height: 30, borderRadius: SIZES.radiusXs, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  panelTitle:    { fontSize: SIZES.fontLg, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900 },
  panelClose:    { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' },

  // FAQ
  faqItem:         { borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  faqQuestion:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SIZES.md, gap: SIZES.sm },
  faqQuestionText: { flex: 1, fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray900, lineHeight: 20 },
  faqChevronBox:   { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' },
  faqChevronBoxOpen: { backgroundColor: COLORS.primaryLight },
  faqAnswer:       { paddingBottom: SIZES.md },
  faqAnswerText:   { fontSize: SIZES.fontXs, color: COLORS.gray500, fontWeight: FONT_WEIGHT.medium, lineHeight: 18 },

  // Sign Out button
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.md,
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg,
    padding: SIZES.lg, ...SHADOWS.xs,
    borderWidth: 1, borderColor: COLORS.red + '20',
  },
  signOutIconBox: {
    width: 38, height: 38, borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.red + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  signOutText: { flex: 1, fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.semibold, color: COLORS.red },

  // Version
  versionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, paddingVertical: SIZES.xxl },
  versionDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.gray200 },
  version:     { fontSize: SIZES.fontXs, color: COLORS.gray400, fontWeight: FONT_WEIGHT.medium },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SIZES.xxl,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: SIZES.xxl,
    alignItems: 'center',
    width: '100%',
    ...SHADOWS.lg,
  },
  modalIconWrap:     { marginBottom: SIZES.lg },
  modalIconGradient: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  modalTitle: {
    fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black,
    color: COLORS.gray900, marginBottom: SIZES.sm,
    letterSpacing: -0.3,
  },
  modalBody: {
    fontSize: SIZES.fontSm, color: COLORS.gray400,
    textAlign: 'center', lineHeight: 20,
    fontWeight: FONT_WEIGHT.medium, marginBottom: SIZES.xxl,
  },
  modalBtnRow: { flexDirection: 'row', gap: SIZES.md, width: '100%' },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14,
    borderRadius: SIZES.radiusMd,
    backgroundColor: COLORS.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: SIZES.fontMd, color: COLORS.gray700,
    fontWeight: FONT_WEIGHT.bold,
  },
  modalConfirmWrap: { flex: 1, borderRadius: SIZES.radiusMd, overflow: 'hidden' },
  modalConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SIZES.sm, paddingVertical: 14,
  },
  modalConfirmText: {
    fontSize: SIZES.fontMd, color: COLORS.white,
    fontWeight: FONT_WEIGHT.bold,
  },
});