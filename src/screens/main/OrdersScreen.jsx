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
      setOrders(res.data.data.orders || []);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const openTracking = (orderId) => {
    setTrackingOrderId(orderId);
    setShowTrackingModal(true);
  };

  const renderItem = ({ item }) => {
    const color    = statusColor(item.status);
    const icon     = STATUS_ICON[item.status] || 'cube-outline';
    const isActive = ACTIVE_STATUSES.includes(item.status);

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => isActive
            ? openTracking(item._id)
            : navigation.navigate('OrderDetail', { orderId: item._id })
          }
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
                <Text style={styles.orderId}>#{item._id?.slice(-8).toUpperCase()}</Text>
                <Text style={styles.orderTime}>{fmtAgo(item.createdAt)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: color + '18' }]}>
                <Text style={[styles.badgeText, { color }]}>{fmtStatus(item.status)}</Text>
              </View>
            </View>

            {/* Route */}
            <View style={styles.route}>
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: COLORS.green }]} />
                <Text style={styles.routeAddr} numberOfLines={1}>{item.pickup?.address}</Text>
              </View>
              <View style={styles.routeDashCol}>
                {[0,1,2].map(i => <View key={i} style={styles.dash} />)}
              </View>
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: COLORS.red }]} />
                <Text style={styles.routeAddr} numberOfLines={1}>{item.drop?.address}</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <View style={styles.fareRow}>
                <Ionicons name="cash-outline" size={14} color={COLORS.green} />
                <Text style={styles.fare}>{fmtCurrency(item.fare)}</Text>
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

  const activeOrders   = orders.filter(o => ACTIVE_STATUSES.includes(o.status));
  const inactiveOrders = orders.filter(o => !ACTIVE_STATUSES.includes(o.status));

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
        {activeOrders.length > 0 && (
          <View style={styles.activePill}>
            <View style={styles.activePillDot} />
            <Text style={styles.activePillText}>{activeOrders.length} active now</Text>
          </View>
        )}
      </LinearGradient>

      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
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
          activeOrders.length > 0 ? (
            <TouchableOpacity
              style={styles.activeBanner}
              onPress={() => openTracking(activeOrders[0]._id)}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#0A2F9A', '#1B4FD8']} style={styles.activeBannerInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <View style={styles.activeBannerLeft}>
                  <View style={styles.activeBannerDot} />
                  <View>
                    <Text style={styles.activeBannerTitle}>Active Delivery</Text>
                    <Text style={styles.activeBannerSub} numberOfLines={1}>
                      {fmtStatus(activeOrders[0].status)} · {activeOrders[0].pickup?.address?.split(',')[0]}
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
          !loading && (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cube-outline" size={48} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySub}>Your delivery history will appear here</Text>
            </View>
          )
        }
      />

      {/* Live Tracking Modal */}
      <LiveTrackingModal
        orderId={trackingOrderId}
        visible={showTrackingModal}
        onClose={() => { setShowTrackingModal(false); load(); }}
        navigation={navigation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  header:      { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: SIZES.xxl, paddingHorizontal: SIZES.xl },
  headerTitle: { fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black, color: COLORS.white, letterSpacing: -0.3 },
  headerSub:   { fontSize: SIZES.fontSm, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: FONT_WEIGHT.medium },
  activePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  activePillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  activePillText:{ fontSize: 12, fontWeight: '700', color: '#fff' },

  list: { padding: SIZES.lg, paddingTop: SIZES.md, gap: SIZES.md, paddingBottom: SIZES.huge },

  // Active banner
  activeBanner:      { marginBottom: SIZES.md, borderRadius: 14, overflow: 'hidden', ...SHADOWS.blue },
  activeBannerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  activeBannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  activeBannerDot:   { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4ADE80', flexShrink: 0 },
  activeBannerTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
  activeBannerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  activeBannerBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  activeBannerBtnText:{ fontSize: 13, fontWeight: '800', color: '#1B4FD8' },

  card: {
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg,
    flexDirection: 'row', overflow: 'hidden', ...SHADOWS.sm,
  },
  stripe:    { width: 4 },
  cardBody:  { flex: 1, padding: SIZES.lg },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
  iconBox:   { width: 36, height: 36, borderRadius: SIZES.radiusSm, alignItems: 'center', justifyContent: 'center' },
  cardTopInfo: { flex: 1 },
  orderId:   { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.bold, color: COLORS.gray900 },
  orderTime: { fontSize: SIZES.fontXs, color: COLORS.gray400, marginTop: 2, fontWeight: FONT_WEIGHT.medium },
  badge:     { paddingHorizontal: 9, paddingVertical: 4, borderRadius: SIZES.radiusFull },
  badgeText: { fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.bold },

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