import React from 'react';
import {
  View, ScrollView, KeyboardAvoidingView,
  Platform, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Responsive scale helpers
export const rs  = (size) => Math.round(size * (SCREEN_W / 390));  // horizontal scale
export const vs  = (size) => Math.round(size * (SCREEN_H / 844));  // vertical scale
export const ms  = (size, factor = 0.5) => size + (rs(size) - size) * factor; // moderate scale

export default function Screen({
  children,
  scroll      = false,
  pad         = true,
  style,
  bg          = COLORS.bg,
  edges,
  scrollProps = {},
}) {
  const insets = useSafeAreaInsets();

  // Android: account for soft/gesture navigation bar at bottom
  // On Android the bottom inset is 0 even with gesture nav — we add a safe floor
  const androidNavBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 0;

  const inner = (
    <View
      style={[
        styles.inner,
        pad && styles.pad,
        { backgroundColor: bg },
        // On Android without scroll, push content above nav bar
        !scroll && Platform.OS === 'android' && { paddingBottom: androidNavBottom },
        style,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: bg }]}
      edges={edges ?? (Platform.OS === 'android' ? ['top'] : ['top', 'left', 'right'])}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scroll,
              // Android scroll: add bottom padding so content clears nav bar
              Platform.OS === 'android' && { paddingBottom: androidNavBottom + 8 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            overScrollMode="never"           // cleaner on Android
            {...scrollProps}
          >
            {inner}
          </ScrollView>
        ) : inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  flex:   { flex: 1 },
  inner:  { flex: 1 },
  pad:    { padding: SIZES.lg },
  scroll: { flexGrow: 1 },
});