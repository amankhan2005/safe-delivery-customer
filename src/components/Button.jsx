import React, { useRef } from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, View, Animated,
} from 'react-native';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../theme';

export default function Button({
  title, onPress, loading = false, disabled = false,
  variant = 'primary', size = 'md', icon, iconRight, style, textStyle,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50 }).start();

  const isDisabled = disabled || loading;

  const variantStyles = {
    primary: { bg: COLORS.primary,      text: COLORS.white,        border: 'transparent',     shadow: SHADOWS.blue },
    secondary:{ bg: COLORS.gray900,     text: COLORS.white,        border: 'transparent',     shadow: SHADOWS.md },
    outline:  { bg: 'transparent',      text: COLORS.primary,      border: COLORS.primary,    shadow: null },
    ghost:    { bg: COLORS.primaryLight,text: COLORS.primary,      border: 'transparent',     shadow: null },
    danger:   { bg: COLORS.red,         text: COLORS.white,        border: 'transparent',     shadow: SHADOWS.sm },
    white:    { bg: COLORS.white,       text: COLORS.gray900,      border: 'transparent',     shadow: SHADOWS.sm },
  };

  const sizeStyles = {
    sm: { py: 10, px: 16, fontSize: SIZES.fontSm, radius: SIZES.radiusSm, height: 40 },
    md: { py: 14, px: 20, fontSize: SIZES.fontMd, radius: SIZES.radiusMd, height: 52 },
    lg: { py: 16, px: 24, fontSize: SIZES.fontLg, radius: SIZES.radiusLg, height: 58 },
  };

  const v = variantStyles[variant] || variantStyles.primary;
  const s = sizeStyles[size] || sizeStyles.md;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, v.shadow, style]}>
      <TouchableOpacity
        style={[
          styles.base,
          {
            backgroundColor:  v.bg,
            borderColor:      v.border,
            borderWidth:      variant === 'outline' ? 1.5 : 0,
            borderRadius:     s.radius,
            height:           s.height,
            paddingHorizontal: s.px,
          },
          isDisabled && styles.disabled,
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        activeOpacity={1}
      >
        {loading ? (
          <ActivityIndicator color={v.text} size="small" />
        ) : (
          <View style={styles.row}>
            {icon && <View style={styles.iconLeft}>{icon}</View>}
            <Text style={[styles.label, { color: v.text, fontSize: s.fontSize }, textStyle]}>
              {title}
            </Text>
            {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base:      { alignItems: 'center', justifyContent: 'center' },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label:     { fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.2 },
  iconLeft:  { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  disabled:  { opacity: 0.5 },
});
