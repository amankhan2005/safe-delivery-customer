import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Animated, StatusBar, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { getOrderById, getOrderOTP, cancelOrder } from '../../api';
import { fmtCurrency, fmtDateTime, fmtStatus, statusColor } from '../../utils/helpers';
import Button from '../../components/Button';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';

const STEPS = [
  { key: 'searching',  label: 'Finding Rider',   icon: 'search-outline' },
  { key: 'assigned',   label: 'Rider Assigned',  icon: 'bicycle-outline' },
  { key: 'picked_up',  label: 'Picked Up',       icon: 'cube-outline' },
  { key: 'in_transit', label: 'In Transit',      icon: 'navigate-outline' },
  { key: 'delivered',  label: 'Delivered',       icon: 'checkmark-circle-outline' },
];

export default function OrderDetailScreen({ navigation, route }) {
  const { orderId }   = route.params;
  const [order,        setOrder]      = useState(null);
  const [otp,          setOtp]        = useState(null);
  const [otpVisible,   setOtpVisible] = useState(false);
  const [refreshing,   setRefreshing] = useState(false);
  const [cancelling,   setCancelling] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const res = await getOrderById(orderId);
      setOrder(res.data.data.order);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch { Toast.show({ type: 'error', text1: 'Failed to load order' }); }
    finally { setRefreshing(false); }
  }, [orderId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const fetchOTP = async () => {
    try {
      const res = await getOrderOTP(orderId);
      setOtp(res.data.data.otp);
      setOtpVisible(true);
    } catch { Toast.show({ type: 'error', text1: 'Could not fetch OTP' }); }
  };

  const handleCancel = () => {
    Alert.alert('Cancel Order', 'Are you sure?', [
      { text: 'Keep Order', style: 'cancel' },
      { text: 'Cancel Order', style: 'destructive', onPress: async () => {
        setCancelling(true);
        try {
          await cancelOrder(orderId, { cancellationReason: 'Customer cancelled' });
          Toast.show({ type: 'success', text1: 'Order cancelled' });
          load();
        } catch (e) {
          Toast.show({ type: 'error', text1: e.response?.data?.error || 'Failed' });
        } finally { setCancelling(false); }
      }},
    ]);
  };

  if (!order) {
    return (
      <View style={styles.center}>
        <Ionicons name="cube-outline" size={40} color={COLORS.gray200} />
      </View>
    );
  }

  const color       = statusColor(order.status);
  const stepIndex   = STEPS.findIndex(s => s.key === order.status);
  const canCancel   = ['searching', 'assigned'].includes(order.status);
  const showOTP     = order.status === 'in_transit';
  const delivered   = order.status === 'delivered';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={color} />

      {/* Dynamic header color by status */}
      <LinearGradient
        colors={[color + 'DD', color]}
        style={styles.header}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.headerBody}>
          <Text style={styles.statusLabel}>{fmtStatus(order.status)}</Text>
          <Text style={styles.orderId}>#{order._id?.slice(-8).toUpperCase()}</Text>
          <Text style={styles.orderDate}>{fmtDateTime(order.createdAt)}</Text>
        </View>
      </LinearGradient>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={color} />
        }
      >

        {/* OTP Card */}
        {showOTP && (
          <View style={styles.otpCard}>
            <Ionicons name="key" size={22} color={COLORS.primary} />
            <Text style={styles.otpTitle}>Delivery OTP</Text>
            <Text style={styles.otpSub}>Show this to the rider</Text>
            {otpVisible && otp ? (
              <View style={styles.otpCodeRow}>
                {otp.toString().split('').map((d, i) => (
                  <View key={i} style={styles.otpDigitBox}>
                    <Text style={styles.otpDigit}>{d}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Button title="Tap to Reveal OTP" onPress={fetchOTP} variant="ghost" size="sm" style={{ marginTop: SIZES.sm }} />
            )}
          </View>
        )}

        {/* Delivered success */}
        {delivered && (
          <LinearGradient colors={['#14532D', '#16A34A']} style={styles.deliveredCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Ionicons name="checkmark-circle" size={32} color={COLORS.white} />
            <View>
              <Text style={styles.deliveredTitle}>Delivered!</Text>
              <Text style={styles.deliveredSub}>Your parcel was delivered safely</Text>
            </View>
          </LinearGradient>
        )}

        {/* Progress Timeline */}
        {order.status !== 'cancelled' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery Progress</Text>
            {STEPS.map((s, i) => {
              const done    = i <= stepIndex;
              const current = i === stepIndex;
              return (
                <View key={s.key} style={styles.step}>
                  <View style={styles.stepLeft}>
                    <View style={[
                      styles.stepCircle,
                      done && { backgroundColor: color },
                      current && SHADOWS.md,
                    ]}>
                      <Ionicons name={done ? 'checkmark' : s.icon} size={14} color={done ? COLORS.white : COLORS.gray400} />
                    </View>
                    {i < STEPS.length - 1 && (
                      <View style={[styles.stepLine, done && { backgroundColor: color }]} />
                    )}
                  </View>
                  <View style={styles.stepRight}>
                    <Text style={[styles.stepLabel, done && { color: COLORS.gray900, fontWeight: FONT_WEIGHT.semibold }]}>
                      {s.label}
                    </Text>
                    {current && (
                      <Text style={[styles.stepCurrent, { color }]}>● Active</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Route */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Route</Text>
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.green }]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeTag}>PICKUP</Text>
              <Text style={styles.routeAddr}>{order.pickup?.address}</Text>
              <Text style={styles.routeContact}>{order.pickup?.contactName} · {order.pickup?.contactPhone}</Text>
            </View>
          </View>
          <View style={styles.routeConnector}>
            {[0,1,2,3].map(i => <View key={i} style={styles.connDash} />)}
          </View>
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.red }]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeTag}>DROP</Text>
              <Text style={styles.routeAddr}>{order.drop?.address}</Text>
              <Text style={styles.routeContact}>{order.drop?.contactName} · {order.drop?.contactPhone}</Text>
            </View>
          </View>
        </View>

        {/* Rider */}
        {order.riderId && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Rider</Text>
            <View style={styles.riderRow}>
              <LinearGradient colors={['#0F3BAF', '#1B4FD8']} style={styles.riderAvatar}>
                <Text style={styles.riderAvatarText}>{order.riderId?.name?.charAt(0)}</Text>
              </LinearGradient>
              <View style={styles.riderInfo}>
                <Text style={styles.riderName}>{order.riderId?.name}</Text>
                <Text style={styles.riderPhone}>{order.riderId?.phone}</Text>
              </View>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color={COLORS.yellow} />
                <Text style={styles.ratingText}>{(order.riderId?.rating || 0).toFixed(1)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Payment */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment</Text>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Total Fare</Text>
            <Text style={styles.fareVal}>{fmtCurrency(order.fare)}</Text>
          </View>
          <View style={styles.payBadge}>
            <Ionicons name="cash-outline" size={16} color={COLORS.green} />
            <Text style={styles.payText}>Cash on Delivery</Text>
          </View>
        </View>

        {/* Cancel */}
        {canCancel && (
          <Button
            title="Cancel Order"
            onPress={handleCancel}
            loading={cancelling}
            variant="danger"
            size="lg"
            style={{ marginBottom: SIZES.lg }}
          />
        )}

      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  header: { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: SIZES.xxxl, paddingHorizontal: SIZES.xl },
  headerTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.xl },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: SIZES.fontLg, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
  headerBody:  { alignItems: 'center' },
  statusLabel: { fontSize: SIZES.fontSm, color: 'rgba(255,255,255,0.8)', fontWeight: FONT_WEIGHT.semibold, textTransform: 'uppercase', letterSpacing: 1 },
  orderId:     { fontSize: SIZES.fontXxxl, fontWeight: FONT_WEIGHT.black, color: COLORS.white, letterSpacing: -0.5, marginTop: 4 },
  orderDate:   { fontSize: SIZES.fontSm, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: FONT_WEIGHT.medium },

  content: { padding: SIZES.lg, paddingTop: SIZES.md, gap: SIZES.md, paddingBottom: SIZES.huge },

  card:      { backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: SIZES.lg, ...SHADOWS.sm },
  cardTitle: { fontSize: SIZES.fontLg, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900, marginBottom: SIZES.lg, letterSpacing: -0.2 },

  // OTP
  otpCard:   { backgroundColor: COLORS.primaryLight, borderRadius: SIZES.radiusLg, padding: SIZES.xl, alignItems: 'center', gap: 4, ...SHADOWS.xs },
  otpTitle:  { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: COLORS.primary },
  otpSub:    { fontSize: SIZES.fontSm, color: COLORS.gray500, fontWeight: FONT_WEIGHT.medium },
  otpCodeRow:{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
  otpDigitBox:{ width: 52, height: 60, borderRadius: SIZES.radiusMd, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm },
  otpDigit:  { fontSize: 28, fontWeight: FONT_WEIGHT.black, color: COLORS.primary },

  // Delivered
  deliveredCard: { borderRadius: SIZES.radiusLg, padding: SIZES.xl, flexDirection: 'row', alignItems: 'center', gap: SIZES.lg, ...SHADOWS.md },
  deliveredTitle: { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: COLORS.white },
  deliveredSub:   { fontSize: SIZES.fontSm, color: 'rgba(255,255,255,0.8)', fontWeight: FONT_WEIGHT.medium, marginTop: 2 },

  // Timeline
  step:       { flexDirection: 'row', gap: SIZES.md },
  stepLeft:   { alignItems: 'center', width: 28 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' },
  stepLine:   { width: 2, flex: 1, backgroundColor: COLORS.gray200, marginVertical: 3, minHeight: 20 },
  stepRight:  { flex: 1, paddingBottom: SIZES.lg },
  stepLabel:  { fontSize: SIZES.fontMd, color: COLORS.gray400, fontWeight: FONT_WEIGHT.medium, paddingTop: 4 },
  stepCurrent:{ fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.bold, marginTop: 3 },

  // Route
  routeItem:     { flexDirection: 'row', gap: SIZES.md, alignItems: 'flex-start' },
  routeDot:      { width: 12, height: 12, borderRadius: 6, marginTop: 6, flexShrink: 0 },
  routeInfo:     { flex: 1 },
  routeTag:      { fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.bold, color: COLORS.gray400, letterSpacing: 0.8, marginBottom: 3 },
  routeAddr:     { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray900 },
  routeContact:  { fontSize: SIZES.fontSm, color: COLORS.gray500, marginTop: 3, fontWeight: FONT_WEIGHT.medium },
  routeConnector:{ flexDirection: 'column', gap: 4, marginLeft: 5, marginVertical: SIZES.sm },
  connDash:      { width: 2, height: 6, backgroundColor: COLORS.gray200, borderRadius: 1 },

  // Rider
  riderRow:       { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
  riderAvatar:    { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  riderAvatarText:{ fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: COLORS.white },
  riderInfo:      { flex: 1 },
  riderName:      { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.bold, color: COLORS.gray900 },
  riderPhone:     { fontSize: SIZES.fontSm, color: COLORS.gray500, marginTop: 2, fontWeight: FONT_WEIGHT.medium },
  ratingBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.yellowLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: SIZES.radiusFull },
  ratingText:     { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.bold, color: COLORS.yellow },

  // Fare
  fareRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.md },
  fareLabel: { fontSize: SIZES.fontMd, color: COLORS.gray500, fontWeight: FONT_WEIGHT.medium },
  fareVal:   { fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900, letterSpacing: -0.3 },
  payBadge:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.greenLight, borderRadius: SIZES.radiusSm, padding: SIZES.sm },
  payText:   { fontSize: SIZES.fontSm, color: COLORS.green, fontWeight: FONT_WEIGHT.bold },
});
