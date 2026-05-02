import React, { useState, useRef } from 'react';
import {
  View, TextInput, Text, TouchableOpacity,
  StyleSheet, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONT_WEIGHT } from '../theme';

export default function Input({
  label, error, hint, secureTextEntry,
  leftIcon, rightIcon, onRightIconPress,
  style, inputStyle, multiline, numberOfLines = 1, ...props
}) {
  const [focused,  setFocused]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    props.onFocus?.();
  };

  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    props.onBlur?.();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? COLORS.red : COLORS.border, error ? COLORS.red : COLORS.primary],
  });

  const bgColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.gray50, COLORS.white],
  });

  return (
    <View style={[styles.wrapper, style]}>
      {label && (
        <Text style={[styles.label, focused && styles.labelFocused, error && styles.labelError]}>
          {label}
        </Text>
      )}

      <Animated.View style={[
        styles.inputRow,
        { borderColor, backgroundColor: bgColor },
        multiline && { height: numberOfLines * 44, alignItems: 'flex-start' },
      ]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            inputStyle,
            multiline && { textAlignVertical: 'top', paddingTop: 12 },
          ]}
          placeholderTextColor={COLORS.gray400}
          secureTextEntry={secureTextEntry && !showPass}
          onFocus={onFocus}
          onBlur={onBlur}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={multiline}
          numberOfLines={numberOfLines}
          {...props}
        />

        {secureTextEntry && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={() => setShowPass(!showPass)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={showPass ? 'eye-off-outline' : 'eye-outline'}
              size={20} color={COLORS.gray400}
            />
          </TouchableOpacity>
        )}

        {!secureTextEntry && rightIcon && (
          <TouchableOpacity style={styles.rightIcon} onPress={onRightIconPress}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </Animated.View>

      {(error || hint) && (
        <View style={styles.footRow}>
          {error && (
            <>
              <Ionicons name="alert-circle" size={12} color={COLORS.red} />
              <Text style={styles.errorText}>{error}</Text>
            </>
          )}
          {!error && hint && <Text style={styles.hintText}>{hint}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:      { marginBottom: SIZES.lg },
  label:        { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray600, marginBottom: 7 },
  labelFocused: { color: COLORS.primary },
  labelError:   { color: COLORS.red },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md, minHeight: 52,
  },
  input: {
    flex: 1, fontSize: SIZES.fontMd,
    color: COLORS.gray900, fontWeight: FONT_WEIGHT.medium,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  leftIcon:  { marginRight: 10 },
  rightIcon: { marginLeft: 10 },
  footRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  errorText: { fontSize: SIZES.fontXs, color: COLORS.red, fontWeight: FONT_WEIGHT.medium },
  hintText:  { fontSize: SIZES.fontXs, color: COLORS.gray400 },
});
