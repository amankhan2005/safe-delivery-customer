import { Platform, Dimensions } from 'react-native';
const { width, height } = Dimensions.get('window');

export const COLORS = {
  primary:        '#1B4FD8',
  primaryDark:    '#0F3BAF',
  primaryLight:   '#EEF3FF',
  primaryMid:     '#DBEAFE',
  red:            '#E8212B',
  redLight:       '#FEE8E9',
  black:          '#0A0A0A',
  gray900:        '#111827',
  gray800:        '#1F2937',
  gray700:        '#374151',
  gray600:        '#4B5563',
  gray500:        '#6B7280',
  gray400:        '#9CA3AF',
  gray300:        '#D1D5DB',
  gray200:        '#E5E7EB',
  gray100:        '#F3F4F6',
  gray50:         '#F9FAFB',
  white:          '#FFFFFF',
  green:          '#16A34A',
  greenLight:     '#DCFCE7',
  yellow:         '#D97706',
  yellowLight:    '#FEF3C7',
  orange:         '#EA580C',
  orangeLight:    '#FFEDD5',
  bg:             '#F4F6FB',
  bgCard:         '#FFFFFF',
  border:         '#E8ECF4',
};

export const FONT_WEIGHT = {
  thin:     '100',
  light:    '300',
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  black:    '900',
};

export const SIZES = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48,
  width, height,
  radiusXs: 6, radiusSm: 10, radiusMd: 14, radiusLg: 18,
  radiusXl: 24, radiusXxl: 32, radiusFull: 999,
  fontXs: 10, fontSm: 12, fontMd: 14, fontLg: 16,
  fontXl: 18, fontXxl: 22, fontXxxl: 28, fontHuge: 36,
};

export const SHADOWS = {
  xs: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
    android: { elevation: 1 },
  }),
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
    android: { elevation: 3 },
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16 },
    android: { elevation: 6 },
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 24 },
    android: { elevation: 10 },
  }),
  blue: Platform.select({
    ios: { shadowColor: '#1B4FD8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16 },
    android: { elevation: 8 },
  }),
};

export const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
