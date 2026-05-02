import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  Dimensions, TouchableOpacity, Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONT_WEIGHT, SHADOWS } from '../../theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1', icon: 'cube-outline', color: '#1B4FD8',
    bg: ['#0F3BAF', '#1B4FD8'],
    title: 'Send Anything,\nAnywhere',
    sub:  'Same-day deliveries across Liberia. Fast, safe, and reliable.',
  },
  {
    id: '2', icon: 'shield-checkmark-outline', color: '#16A34A',
    bg: ['#14532D', '#16A34A'],
    title: 'Verified Riders,\nSafe Parcels',
    sub:  'Every rider is KYC-verified and background-checked. Your safety first.',
  },
  {
    id: '3', icon: 'cash-outline', color: '#D97706',
    bg: ['#78350F', '#D97706'],
    title: 'Pay Only on\nDelivery',
    sub:  'No upfront payments. Cash on delivery with a secure OTP handoff.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [index, setIndex] = useState(0);
  const listRef  = useRef(null);
  const btnScale = useRef(new Animated.Value(1)).current;

  const go = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      navigation.replace('Login');
    }
  };

  const onPressIn  = () => Animated.spring(btnScale, { toValue: 0.93, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 50 }).start();

  const slide = SLIDES[index];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled
        onMomentumScrollEnd={(e) => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LinearGradient colors={item.bg} style={styles.slide} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}>
            {/* Decorative */}
            <View style={styles.bgCircle1} />
            <View style={styles.bgCircle2} />

            {/* Icon */}
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={80} color="rgba(255,255,255,0.95)" />
            </View>

            {/* Text */}
            <View style={styles.textWrap}>
              <Text style={styles.slideTitle}>{item.title}</Text>
              <Text style={styles.slideSub}>{item.sub}</Text>
            </View>
          </LinearGradient>
        )}
      />

      {/* Bottom sheet */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                i === index && { width: 24, backgroundColor: COLORS.primary },
              ]}
            />
          ))}
        </View>

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={styles.cta}
            onPress={go}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={1}
          >
            <LinearGradient
              colors={['#1B4FD8', '#0F3BAF']}
              style={styles.ctaInner}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.ctaText}>
                {index === SLIDES.length - 1 ? "Let's Go" : 'Continue'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Skip */}
        {index < SLIDES.length - 1 && (
          <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.skip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.white },
  slide:  { width, flex: 1, alignItems: 'center', justifyContent: 'center', padding: SIZES.xxxl },
  bgCircle1: {
    position: 'absolute', top: -80, right: -80,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  bgCircle2: {
    position: 'absolute', bottom: 40, left: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconWrap: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SIZES.huge,
  },
  textWrap:   { alignItems: 'center' },
  slideTitle: {
    fontSize: SIZES.fontHuge, fontWeight: FONT_WEIGHT.black,
    color: COLORS.white, textAlign: 'center',
    lineHeight: SIZES.fontHuge * 1.2, letterSpacing: -0.5,
    marginBottom: SIZES.lg,
  },
  slideSub: {
    fontSize: SIZES.fontLg, color: 'rgba(255,255,255,0.8)',
    textAlign: 'center', lineHeight: 26,
    fontWeight: FONT_WEIGHT.medium,
  },
  bottom: {
    backgroundColor: COLORS.white,
    padding: SIZES.xxl, paddingTop: SIZES.xl,
    paddingBottom: SIZES.xxxl,
    borderTopLeftRadius: SIZES.radiusXxl,
    borderTopRightRadius: SIZES.radiusXxl,
    marginTop: -SIZES.xxxl,
    ...SHADOWS.md,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: SIZES.xxl },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.gray200,
  },
  cta:      { borderRadius: SIZES.radiusLg, overflow: 'hidden', ...SHADOWS.blue },
  ctaInner: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    paddingVertical: 18,
  },
  ctaText:  { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: COLORS.white, letterSpacing: 0.3 },
  skip:     { alignItems: 'center', paddingTop: SIZES.lg },
  skipText: { fontSize: SIZES.fontMd, color: COLORS.gray400, fontWeight: FONT_WEIGHT.medium },
});
