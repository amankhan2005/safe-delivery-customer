import React from 'react';
import {
  View, ScrollView, KeyboardAvoidingView,
  Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../theme';

export default function Screen({
  children, scroll = false, pad = true,
  style, bg = COLORS.bg, edges,
}) {
  const inner = (
    <View style={[styles.inner, pad && styles.pad, { backgroundColor: bg }, style]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
