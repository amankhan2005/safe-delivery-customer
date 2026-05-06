import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, Animated,
  StatusBar, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getMyOrders } from '../../api';
import { fmtCurrency, fmtAgo, fmtStatus, statusColor } from '../../utils/helpers';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';
import LiveTrackingModal from '../../components/LiveTrackingModal';

const STATUS_ICON = {
  searching:  'search-outline',
  assigned:   'bicycle-outline',
  picked_up:  'cube-outline',
  in_transit: 'navigate-outline',
  delivered:  'checkmark-circle-outline',
  cancelled:  'close-circle-outline',
};

const ACTIVE_STATUSES = ['searching', 'assigned', 'picked_up', 'in_transit'];

// ── Safe helpers ─────────────────────────────────────────────────────────────
// Guarantee fmtStatus / fmtCurrency / fmtAgo never receive undefined/null
const safeStatus   = (status) => fmtStatus(status   ?? 'unknown');
const safeCurrency = (fare)   => fmtCurrency(fare    ?? 0);
const safeAgo      = (date)   => fmtAgo(date         ?? '');
const safeColor    = (status) => statusColor(status  ?? 'unknown');

// Safe order-ID slice — shows "UNKNOWN" when _id is absent
const safeOrderId  = (id)     => id ? String(id).slice(-8).toUpperCase() : 'UNKNOWN';

// Safe address helpers
const safePickup   = (item)   => item?.pickup?.address  || 'No pickup address';
const safeDrop     = (item)   => item?.drop?.address    || 'No drop address';

// Safe active-status check — guards against null/undefined status
const isActiveOrder = (order) => {
  if (!order || typeof order.status !== 'string') return false;
  return ACTIVE_STATUSES.includes(order.status);
};

export default function OrdersScreen({ navigation }) {
  const [orders,            setOrders]            = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [refreshing,        setRefreshing]        = useState(false);
  const [trackingOrderId,   setTrackingOrderId]   = useState(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const res = await getMyOrders();
      // Guarantee orders is always an array — never set undefined/null into state
      const raw = res?.data?.data?.orders;
      setOrders(Array.isArray(raw) ? raw : []);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e) {
      // Detailed error log so issues are visible in Metro console
      console.log('ORDER API ERROR:', e?.response?.data || e?.message || e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const openTracking = (orderId) => {
    // Guard: only open modal when we have a valid orderId string
    if (!orderId) {
      console.log('[Tracking] openTracking called with missing orderId — skipping');
      return;
    }
    setTrackingOrderId(orderId);
    setShowTrackingModal(true);
  };

  const renderItem = ({ item }) => {
    // Guard: skip rendering if item itself is null/undefined
    if (!item) return null;

    const status   = item.status ?? 'unknown';
    const color    = safeColor(status);
    const icon     = STATUS_ICON[status] || 'cube-outline';
    const isActive = isActiveOrder(item);

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => {
            if (isActive) {
              openTracking(item._id);
            } else {
              // Only navigate if _id exists
              if (item._id) {
                navigation.navigate('OrderDetail', { orderId: item._id });
              } else {
                console.log('[OrdersScreen] Cannot navigate — order _id is missing');
              }
            }
          }}
          activeOpacity={0.8}
        >
          {/* Status stripe */}
          <View style={[styles.stripe, { backgroundColor: color }]} />

          <View style={styles.cardBody}>
            {/* Top */}
            <View style={styles.cardTop}>
              <View style={[styles.iconBox, { backgroundColor: color + '18' }]}>
                <Ionicons name={icon} size={20} color={color} />
              </View>
              <View style={styles.cardTopInfo}>
                <Text style={styles.orderId}>#{safeOrderId(item._id)}</Text>
                <Text style={styles.orderTime}>{safeAgo(item.createdAt)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: color + '18' }]}>
                <Text style={[styles.badgeText, { color }]}>{safeStatus(status)}</Text>
              </View>
            </View>

            {/* Route */}
            <View style={styles.route}>
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: COLORS.green }]} />
                <Text style={styles.routeAddr} numberOfLines={1}>{safePickup(item)}</Text>
              </View>
              <View style={styles.routeDashCol}>
                {[0, 1, 2].map(i => <View key={i} style={styles.dash} />)}
              </View>
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: COLORS.red }]} />
                <Text style={styles.routeAddr} numberOfLines={1}>{safeDrop(item)}</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <View style={styles.fareRow}>
                <Ionicons name="cash-outline" size={14} color={COLORS.green} />
                <Text style={styles.fare}>{safeCurrency(item.fare)}</Text>
              </View>
              {/* Active order CTA */}
              {isActive ? (
                <View style={styles.trackBtn}>
                  <View style={styles.trackBtnDot} />
                  <Text style={styles.trackBtnText}>Track Live</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={COLORS.gray300} />
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Always filter from a guaranteed array; guard each item's status
  const activeOrders   = orders.filter(isActiveOrder);
  const inactiveOrders = orders.filter(o => !isActiveOrder(o));

  // Safe key extractor — never returns undefined
  const keyExtractor = (item) => item?._id ? String(item._id) : Math.random().toString(36);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <LinearGradient
        colors={['#0F3BAF', '#1B4FD8']}
        style={styles.header}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSub}>{orders.length} deliveries</Text>
        {activeOrders.length > 0 ? (
          <View style={styles.activePill}>
            <View style={styles.activePillDot} />
            <Text style={styles.activePillText}>{activeOrders.length} active now</Text>
          </View>
        ) : null}
      </LinearGradient>

      <FlatList
        data={orders}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListHeaderComponent={
          activeOrders.length > 0 && activeOrders[0]?._id ? (
            <TouchableOpacity
              style={styles.activeBanner}
              onPress={() => openTracking(activeOrders[0]._id)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#0A2F9A', '#1B4FD8']}
                style={styles.activeBannerInner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.activeBannerLeft}>
                  <View style={styles.activeBannerDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeBannerTitle}>Active Delivery</Text>
                    <Text style={styles.activeBannerSub} numberOfLines={1}>
                      {safeStatus(activeOrders[0].status)}
                      {activeOrders[0].pickup?.address
                        ? ` · ${activeOrders[0].pickup.address.split(',')[0]}`
                        : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.activeBannerBtn}>
                  <Text style={styles.activeBannerBtnText}>Track</Text>
                  <Ionicons name="navigate" size={14} color="#1B4FD8" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cube-outline" size={48} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySub}>Your delivery history will appear here</Text>
            </View>
          ) : null
        }
      />

      {/* Live Tracking Modal — only rendered when orderId is valid */}
      {trackingOrderId != null && trackingOrderId !== '' ? (
        <LiveTrackingModal
          orderId={trackingOrderId}
          visible={showTrackingModal}
          onClose={() => {
            setShowTrackingModal(false);
            setTrackingOrderId(null);
            load();
          }}
          navigation={navigation}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  header:      { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: SIZES.xxl, paddingHorizontal: SIZES.xl },
  headerTitle: { fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black, color: COLORS.white, letterSpacing: -0.3 },
  headerSub:   { fontSize: SIZES.fontSm, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: FONT_WEIGHT.medium },
  activePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  activePillDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  activePillText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  list: { padding: SIZES.lg, paddingTop: SIZES.md, gap: SIZES.md, paddingBottom: SIZES.huge },

  activeBanner:       { marginBottom: SIZES.md, borderRadius: 14, overflow: 'hidden', ...SHADOWS.blue },
  activeBannerInner:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  activeBannerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  activeBannerDot:    { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4ADE80', flexShrink: 0 },
  activeBannerTitle:  { fontSize: 14, fontWeight: '800', color: '#fff' },
  activeBannerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  activeBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  activeBannerBtnText:{ fontSize: 13, fontWeight: '800', color: '#1B4FD8' },

  card: {
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg,
    flexDirection: 'row', overflow: 'hidden', ...SHADOWS.sm,
  },
  stripe:      { width: 4 },
  cardBody:    { flex: 1, padding: SIZES.lg },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
  iconBox:     { width: 36, height: 36, borderRadius: SIZES.radiusSm, alignItems: 'center', justifyContent: 'center' },
  cardTopInfo: { flex: 1 },
  orderId:     { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.bold, color: COLORS.gray900 },
  orderTime:   { fontSize: SIZES.fontXs, color: COLORS.gray400, marginTop: 2, fontWeight: FONT_WEIGHT.medium },
  badge:       { paddingHorizontal: 9, paddingVertical: 4, borderRadius: SIZES.radiusFull },
  badgeText:   { fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.bold },

  route:        { marginBottom: SIZES.md },
  routeRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:          { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeAddr:    { flex: 1, fontSize: SIZES.fontSm, color: COLORS.gray700, fontWeight: FONT_WEIGHT.medium },
  routeDashCol: { flexDirection: 'column', gap: 3, marginLeft: 3, marginVertical: 3 },
  dash:         { width: 2, height: 4, backgroundColor: COLORS.gray200, borderRadius: 1 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.gray100, paddingTop: SIZES.sm },
  fareRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fare:       { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.bold, color: COLORS.green },

  trackBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  trackBtnDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1B4FD8' },
  trackBtnText: { fontSize: 12, fontWeight: '800', color: '#1B4FD8' },

  empty:      { alignItems: 'center', paddingTop: 100 },
  emptyIcon:  { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: SIZES.xl },
  emptyTitle: { fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900, letterSpacing: -0.3 },
  emptySub:   { fontSize: SIZES.fontMd, color: COLORS.gray400, marginTop: 8, fontWeight: FONT_WEIGHT.medium },
});