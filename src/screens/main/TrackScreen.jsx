import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { getOrderById } from '../../api';
import { fmtStatus, statusColor, fmtDateTime } from '../../utils/helpers';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';

const STEPS = [
  { key: 'searching',  label: 'Finding Rider',  icon: 'search-outline' },
  { key: 'assigned',   label: 'Rider Assigned', icon: 'bicycle-outline' },
  { key: 'picked_up',  label: 'Picked Up',      icon: 'cube-outline' },
  { key: 'in_transit', label: 'In Transit',     icon: 'navigate-outline' },
  { key: 'delivered',  label: 'Delivered',      icon: 'checkmark-circle-outline' },
];

export default function TrackScreen({ navigation }) {
  const [orderId, setOrderId] = useState('');
  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTrack = async () => {
    const id = orderId.trim();
    if (!id) return Toast.show({ type: 'error', text1: 'Enter an Order ID' });
    setLoading(true);
    try {
      const res = await getOrderById(id);
      setOrder(res.data.data.order);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Order not found' });
      setOrder(null);
    } finally { setLoading(false); }
  };

  const stepIndex = order ? STEPS.findIndex(s => s.key === order.status) : -1;
  const color     = order ? statusColor(order.status) : COLORS.primary;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <LinearGradient colors={['#0F3BAF', '#1B4FD8']} style={styles.header}>
        <Text style={styles.headerTitle}>Track Order</Text>
        <Text style={styles.headerSub}>Enter your order ID to track</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray400} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="e.g. ABC12345"
            placeholderTextColor={COLORS.gray400}
            value={orderId}
            onChangeText={setOrderId}
            autoCapitalize="characters"
            returnKeyType="search"
            onSubmitEditing={handleTrack}
          />
          <TouchableOpacity
            style={[styles.trackBtn, loading && { opacity: 0.7 }]}
            onPress={handleTrack}
            disabled={loading}
          >
            <Text style={styles.trackBtnText}>{loading ? '...' : 'Track'}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!order ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="navigate-outline" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>Track Your Parcel</Text>
            <Text style={styles.emptySub}>Enter your order ID above to see live delivery status</Text>
          </View>
        ) : (
          <>
            {/* Status header */}
            <View style={[styles.statusCard, { borderTopColor: color }]}>
              <View style={[styles.statusBadge, { backgroundColor: color + '18' }]}>
                <Text style={[styles.statusText, { color }]}>{fmtStatus(order.status)}</Text>
              </View>
              <Text style={styles.statusOrderId}>#{order._id?.slice(-8).toUpperCase()}</Text>
              <Text style={styles.statusDate}>{fmtDateTime(order.createdAt)}</Text>
            </View>

            {/* Timeline */}
            {order.status !== 'cancelled' && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Delivery Progress</Text>
                {STEPS.map((s, i) => {
                  const done    = i <= stepIndex;
                  const current = i === stepIndex;
                  return (
                    <View key={s.key} style={styles.step}>
                      <View style={styles.stepLeft}>
                        <View style={[styles.stepCircle, done && { backgroundColor: color }]}>
                          <Ionicons name={done ? 'checkmark' : s.icon} size={13} color={done ? COLORS.white : COLORS.gray400} />
                        </View>
                        {i < STEPS.length - 1 && (
                          <View style={[styles.stepLine, done && { backgroundColor: color }]} />
                        )}
                      </View>
                      <View style={styles.stepRight}>
                        <Text style={[styles.stepLabel, done && { color: COLORS.gray900, fontWeight: FONT_WEIGHT.semibold }]}>{s.label}</Text>
                        {current && <Text style={[styles.stepActive, { color }]}>● Live</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Route */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Route Details</Text>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: COLORS.green }]} />
                <View style={styles.routeInfo}>
                  <Text style={styles.routeTag}>PICKUP</Text>
                  <Text style={styles.routeAddr}>{order.pickup?.address}</Text>
                </View>
              </View>
              <View style={styles.routeConn}><View style={styles.routeConnLine} /></View>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: COLORS.red }]} />
                <View style={styles.routeInfo}>
                  <Text style={styles.routeTag}>DROP</Text>
                  <Text style={styles.routeAddr}>{order.drop?.address}</Text>
                </View>
              </View>
            </View>

            {/* View full */}
            <TouchableOpacity
              style={styles.viewFullBtn}
              onPress={() => navigation.getParent()?.navigate('OrderDetail', { orderId: order._id }) || navigation.navigate('OrderDetail', { orderId: order._id })}
            >
              <Text style={styles.viewFullText}>View Full Order Details</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.bg },
  header:       { paddingTop: Platform.OS === 'ios' ? 52 : SIZES.xl, paddingBottom: SIZES.xxl, paddingHorizontal: SIZES.xl },
  headerTitle:  { fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black, color: COLORS.white, letterSpacing: -0.3 },
  headerSub:    { fontSize: SIZES.fontSm, color: 'rgba(255,255,255,0.7)', marginTop: 4, marginBottom: SIZES.xl, fontWeight: FONT_WEIGHT.medium },
  searchBox:    { backgroundColor: COLORS.white, borderRadius: SIZES.radiusMd, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIZES.md, height: 52 },
  searchInput:  { flex: 1, fontSize: SIZES.fontMd, color: COLORS.gray900, fontWeight: FONT_WEIGHT.semibold },
  trackBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: SIZES.lg, paddingVertical: SIZES.sm, borderRadius: SIZES.radiusSm },
  trackBtnText: { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.black, color: COLORS.white },
  content:      { padding: SIZES.lg, gap: SIZES.md, paddingBottom: 100 },
  empty:        { alignItems: 'center', paddingTop: 60, paddingHorizontal: SIZES.xxl },
  emptyIcon:    { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: SIZES.xl },
  emptyTitle:   { fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900, textAlign: 'center', letterSpacing: -0.3 },
  emptySub:     { fontSize: SIZES.fontMd, color: COLORS.gray400, textAlign: 'center', lineHeight: 24, marginTop: 8, fontWeight: FONT_WEIGHT.medium },
  statusCard:   { backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: SIZES.xl, alignItems: 'center', borderTopWidth: 4, ...SHADOWS.sm },
  statusBadge:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: SIZES.radiusFull, marginBottom: 8 },
  statusText:   { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black },
  statusOrderId:{ fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900, letterSpacing: -0.3 },
  statusDate:   { fontSize: SIZES.fontSm, color: COLORS.gray400, marginTop: 4, fontWeight: FONT_WEIGHT.medium },
  card:         { backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: SIZES.lg, ...SHADOWS.xs },
  cardTitle:    { fontSize: SIZES.fontLg, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900, marginBottom: SIZES.lg, letterSpacing: -0.2 },
  step:         { flexDirection: 'row', gap: SIZES.md },
  stepLeft:     { alignItems: 'center', width: 28 },
  stepCircle:   { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' },
  stepLine:     { width: 2, flex: 1, backgroundColor: COLORS.gray200, marginVertical: 3, minHeight: 18 },
  stepRight:    { flex: 1, paddingBottom: SIZES.md },
  stepLabel:    { fontSize: SIZES.fontMd, color: COLORS.gray400, fontWeight: FONT_WEIGHT.medium, paddingTop: 4 },
  stepActive:   { fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.bold, marginTop: 3 },
  routeRow:     { flexDirection: 'row', gap: SIZES.md, alignItems: 'flex-start' },
  routeDot:     { width: 12, height: 12, borderRadius: 6, marginTop: 4, flexShrink: 0 },
  routeInfo:    { flex: 1 },
  routeTag:     { fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.bold, color: COLORS.gray400, letterSpacing: 0.8, marginBottom: 3 },
  routeAddr:    { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.semibold, color: COLORS.gray900 },
  routeConn:    { paddingLeft: 5, paddingVertical: SIZES.sm },
  routeConnLine:{ width: 2, height: 20, backgroundColor: COLORS.gray200 },
  viewFullBtn:  { backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: SIZES.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...SHADOWS.xs, borderWidth: 1.5, borderColor: COLORS.primary },
  viewFullText: { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },
});
