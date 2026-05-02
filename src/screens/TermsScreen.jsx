import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Platform, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../theme';

const SECTIONS = [
  {
    icon: 'shield-checkmark-outline',
    color: COLORS.primary,
    title: 'Parcel Safety Guarantee',
    body: 'Safe Delivery is committed to the careful and secure handling of all parcels entrusted to us. Every delivery is managed with professionalism to ensure your items arrive in the same condition they were collected.',
  },
  {
    icon: 'lock-closed-outline',
    color: COLORS.green,
    title: 'Your Privacy is Protected',
    body: 'We do not share, sell, or disclose your personal information to any third party for commercial or marketing purposes. Your data belongs to you.',
  },
  {
    icon: 'person-outline',
    color: COLORS.primary,
    title: 'Data We Collect',
    items: [
      { icon: 'person-circle-outline',   text: 'Full name' },
      { icon: 'mail-outline',            text: 'Email address' },
      { icon: 'call-outline',            text: 'Phone number' },
      { icon: 'location-outline',        text: 'Location (for delivery purposes only)' },
    ],
    body: 'We collect only the information strictly necessary to process your deliveries. No additional personal data is collected or stored.',
  },
  {
    icon: 'navigate-outline',
    color: COLORS.yellow,
    title: 'Location Access',
    body: 'Location permissions are used exclusively to facilitate accurate pickup and drop-off services. We do not track your location outside of active delivery sessions.',
  },
  {
    icon: 'checkmark-circle-outline',
    color: COLORS.green,
    title: 'Verified Delivery Partners',
    body: 'All Safe Delivery riders and delivery partners undergo a thorough verification process before being onboarded. We ensure every partner meets our safety, identity, and conduct standards.',
  },
  {
    icon: 'alert-circle-outline',
    color: COLORS.red,
    title: 'Prohibited Items',
    body: 'Users must not attempt to send any of the following items through Safe Delivery:',
    items: [
      { icon: 'close-circle-outline', text: 'Weapons, firearms, or ammunition' },
      { icon: 'close-circle-outline', text: 'Hazardous, flammable, or explosive materials' },
      { icon: 'close-circle-outline', text: 'Illegal substances or controlled drugs' },
      { icon: 'close-circle-outline', text: 'Counterfeit or stolen goods' },
      { icon: 'close-circle-outline', text: 'Any item prohibited under Liberian law' },
    ],
    itemColor: COLORS.red,
  },
  {
    icon: 'ban-outline',
    color: COLORS.red,
    title: 'Violations & Account Suspension',
    body: 'Any violation of these Terms and Conditions — including but not limited to sending prohibited items, providing false information, or engaging in fraudulent activity — may result in the immediate suspension or permanent termination of your Safe Delivery account.',
  },
];

function SectionCard({ section }) {
  const accentColor = section.color || COLORS.primary;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: accentColor + '18' }]}>
          <Ionicons name={section.icon} size={20} color={accentColor} />
        </View>
        <Text style={styles.cardTitle}>{section.title}</Text>
      </View>
      {section.body ? <Text style={styles.cardBody}>{section.body}</Text> : null}
      {section.items ? (
        <View style={styles.listWrap}>
          {section.items.map((item, i) => (
            <View key={i} style={styles.listRow}>
              <Ionicons
                name={item.icon}
                size={15}
                color={section.itemColor || accentColor}
                style={styles.listIcon}
              />
              <Text style={styles.listText}>{item.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function TermsScreen({ navigation, route }) {
  // fromSignup = true  → show "I Agree" button at bottom
  // fromSignup = false → show back button only (profile access)
  const fromSignup = route?.params?.fromSignup ?? false;

  const handleAgree = () => {
    navigation.navigate('Tabs');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* Header */}
      <LinearGradient
        colors={['#0F3BAF', '#1B4FD8', '#2563EB']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerBubble1} />
        <View style={styles.headerBubble2} />

        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Terms &amp; Conditions</Text>
            <Text style={styles.headerSub}>Safe Delivery • Liberia</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="document-text-outline" size={20} color="rgba(255,255,255,0.8)" />
          </View>
        </View>

        <View style={styles.lastUpdatedRow}>
          <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.65)" />
          <Text style={styles.lastUpdated}>Last updated: May 2026</Text>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          fromSignup && styles.scrollContentWithBtn,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introBanner}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.introText}>
            Please read these terms carefully. By using Safe Delivery, you agree to the following conditions.
          </Text>
        </View>

        {SECTIONS.map((section, index) => (
          <SectionCard key={index} section={section} />
        ))}

        <View style={styles.footer}>
          <Ionicons name="shield-outline" size={16} color={COLORS.gray400} />
          <Text style={styles.footerText}>
            Safe Delivery — Liberia's Trusted Logistics Platform
          </Text>
        </View>
      </ScrollView>

      {/* Agree Button (signup flow only) */}
      {fromSignup && (
        <View style={styles.agreeContainer}>
          <TouchableOpacity style={styles.agreeBtn} onPress={handleAgree} activeOpacity={0.88}>
            <LinearGradient
              colors={['#1B4FD8', '#2563EB']}
              style={styles.agreeBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
              <Text style={styles.agreeBtnText}>I Agree &amp; Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.agreeHint}>
            By tapping "I Agree", you accept these Terms &amp; Conditions.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 12 : SIZES.xl,
    paddingBottom: SIZES.xl,
    paddingHorizontal: SIZES.xl,
    overflow: 'hidden',
  },
  headerBubble1: {
    position: 'absolute', top: -50, right: -50,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerBubble2: {
    position: 'absolute', bottom: -20, left: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.md,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: {
    fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black,
    color: COLORS.white, letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.7)',
    fontWeight: FONT_WEIGHT.medium, marginTop: 2,
  },
  headerBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  lastUpdatedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: SIZES.md,
  },
  lastUpdated: {
    fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.6)',
    fontWeight: FONT_WEIGHT.medium,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: SIZES.lg, paddingBottom: SIZES.xxl },
  scrollContentWithBtn: { paddingBottom: 140 },

  // Intro banner
  introBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: SIZES.radiusMd, padding: SIZES.md,
    marginBottom: SIZES.lg, borderLeftWidth: 3, borderLeftColor: COLORS.primary,
  },
  introText: {
    flex: 1, fontSize: SIZES.fontSm, color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium, lineHeight: 18,
  },

  // Section card
  card: {
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg,
    padding: SIZES.lg, marginBottom: SIZES.md,
    ...SHADOWS.xs,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: SIZES.sm, marginBottom: SIZES.sm,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: SIZES.radiusSm,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: {
    fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black,
    color: COLORS.gray900, flex: 1,
  },
  cardBody: {
    fontSize: SIZES.fontSm, color: COLORS.gray500,
    lineHeight: 20, fontWeight: FONT_WEIGHT.medium,
  },
  listWrap: { marginTop: SIZES.sm, gap: SIZES.xs },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm },
  listIcon: { marginTop: 2 },
  listText: {
    flex: 1, fontSize: SIZES.fontSm, color: COLORS.gray600,
    fontWeight: FONT_WEIGHT.medium, lineHeight: 20,
  },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SIZES.sm, paddingVertical: SIZES.xl,
  },
  footerText: {
    fontSize: SIZES.fontXs, color: COLORS.gray400,
    fontWeight: FONT_WEIGHT.medium, textAlign: 'center',
  },

  // Agree button
  agreeContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SIZES.xl,
    paddingTop: SIZES.lg,
    paddingBottom: Platform.OS === 'ios' ? 32 : SIZES.xl,
    ...SHADOWS.md,
  },
  agreeBtn: { borderRadius: SIZES.radiusMd, overflow: 'hidden', marginBottom: SIZES.sm },
  agreeBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SIZES.sm, paddingVertical: 15,
  },
  agreeBtnText: {
    fontSize: SIZES.fontLg, fontWeight: FONT_WEIGHT.black,
    color: COLORS.white, letterSpacing: 0.2,
  },
  agreeHint: {
    fontSize: SIZES.fontXs, color: COLORS.gray400,
    textAlign: 'center', fontWeight: FONT_WEIGHT.medium,
  },
});
