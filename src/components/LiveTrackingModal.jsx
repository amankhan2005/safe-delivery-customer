import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Easing, Platform, StatusBar, Dimensions,
  ActivityIndicator, ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { getOrderById, cancelOrder } from '../api';
import { connectSocket, subscribeRideEvents, subscribeRiderLocation } from '../services/socketService';
import { fmtCurrency, fmtStatus } from '../utils/helpers';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../theme';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

const BLUE  = '#1B4FD8';
const GREEN = '#16A34A';
const AMBER = '#D97706';
const RED   = '#DC2626';

const STATUS_STEPS = ['searching', 'assigned', 'picked_up', 'in_transit', 'delivered'];

const STATUS_INFO = {
  searching:  { label: 'Finding Rider',    icon: 'search-outline',          color: BLUE,  emoji: '🔍' },
  assigned:   { label: 'Rider On the Way', icon: 'bicycle-outline',          color: BLUE,  emoji: '🛵' },
  picked_up:  { label: 'Parcel Picked Up', icon: 'cube-outline',             color: AMBER, emoji: '📦' },
  in_transit: { label: 'In Transit',       icon: 'navigate-outline',         color: AMBER, emoji: '🚀' },
  delivered:  { label: 'Delivered!',       icon: 'checkmark-circle-outline', color: GREEN, emoji: '🎉' },
  cancelled:  { label: 'Cancelled',        icon: 'close-circle-outline',     color: RED,   emoji: '❌' },
};

const STATUS_MESSAGES = {
  'ride:rider_assigned': '🛵 Rider assigned! On the way to pickup.',
  'ride:picked_up':      '📦 Parcel picked up! Heading your way.',
  'ride:in_transit':     '🚀 Rider is on the way to drop location.',
  'ride:arrived':        '📍 Rider has arrived at drop location!',
  'ride:delivered':      '🎉 Parcel delivered successfully!',
  'ride:cancelled':      '❌ Order was cancelled.',
};

// ── Ripple for searching ──────────────────────────────────────────────────────
function SearchRipple() {
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    rings.forEach((r, i) => {
      Animated.loop(Animated.sequence([
        Animated.delay(i * 600),
        Animated.timing(r, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])).start();
    });
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <View style={SR.root}>
      {rings.map((r, i) => {
        const scale   = r.interpolate({ inputRange: [0,1], outputRange: [0.3, 2.8] });
        const opacity = r.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 0.1, 0] });
        return <Animated.View key={i} style={[SR.ring, { transform: [{ scale }], opacity }]} />;
      })}
      <Animated.View style={[SR.iconWrap, { transform: [{ scale: pulse }] }]}>
        <LinearGradient colors={['#0A2F9A', BLUE]} style={SR.icon}>
          <Ionicons name="bicycle-outline" size={28} color="#fff" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const SR = StyleSheet.create({
  root:    { alignItems: 'center', justifyContent: 'center', height: 140 },
  ring:    { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: BLUE },
  iconWrap:{ },
  icon:    { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function LiveTrackingModal({ orderId, visible, onClose, onDelivered, navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);

  const [order,         setOrder]         = useState(null);
  const [riderCoords,   setRiderCoords]   = useState(null);
  const [cancelSecs,    setCancelSecs]    = useState(120);
  const [cancelling,    setCancelling]    = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [showMap,       setShowMap]       = useState(false);

  const slideAnim  = useRef(new Animated.Value(SCREEN_H)).current;
  const bgOpacity  = useRef(new Animated.Value(0)).current;
  const unsubRef   = useRef({ events: null, location: null });

  // ── Slide in ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 300, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // ── Cancel countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!order?.createdAt || !['searching','assigned'].includes(order?.status)) return;
    const created = new Date(order.createdAt).getTime();
    const tick = () => setCancelSecs(Math.max(120 - Math.floor((Date.now() - created) / 1000), 0));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [order?.createdAt, order?.status]);

  // ── Load order ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await getOrderById(orderId);
      const o = res.data.data.order;
      setOrder(o);
      if (o.riderId?.currentLocation?.lat) setRiderCoords(o.riderId.currentLocation);
      if (['assigned','picked_up','in_transit'].includes(o.status)) setShowMap(true);
      if (o.status === 'delivered') {
        setTimeout(() => onDelivered?.(o), 800);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => {
    if (!visible || !orderId) return;
    setLoading(true);
    load();

    const setup = async () => {
      await connectSocket();
      unsubRef.current.events = subscribeRideEvents(orderId, (event, data) => {
        const msg = STATUS_MESSAGES[event];
        if (msg) Toast.show({ type: event.includes('cancel') ? 'error' : 'success', text1: msg, visibilityTime: 4000 });
        load();
      });
      unsubRef.current.location = subscribeRiderLocation(orderId, ({ lat, lng }) => {
        setRiderCoords({ lat, lng });
        mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 600);
      });
    };
    setup();
    const poll = setInterval(load, 12000);
    return () => {
      clearInterval(poll);
      unsubRef.current.events?.();
      unsubRef.current.location?.();
    };
  }, [visible, orderId]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelOrder(orderId, { cancellationReason: 'Customer cancelled' });
      Toast.show({ type: 'success', text1: 'Order cancelled' });
      load();
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.error || 'Could not cancel' });
    } finally { setCancelling(false); }
  };

  if (!visible) return null;

  const status     = order?.status || 'searching';
  const info       = STATUS_INFO[status] || STATUS_INFO.searching;
  const stepIdx    = STATUS_STEPS.indexOf(status);
  const isActive   = ['assigned','picked_up','in_transit'].includes(status);
  const canCancel  = ['searching','assigned'].includes(status) && cancelSecs > 0;
  const isDone     = ['delivered','cancelled'].includes(status);
  const cancelProg = cancelSecs / 120;

  const pickupLat = order?.pickup?.lat;
  const pickupLng = order?.pickup?.lng;
  const dropLat   = order?.drop?.lat;
  const dropLng   = order?.drop?.lng;

  const mapRegion = riderCoords ? {
    latitude:  riderCoords.lat, longitude: riderCoords.lng,
    latitudeDelta: 0.015, longitudeDelta: 0.015,
  } : pickupLat ? {
    latitude:  (pickupLat + (dropLat || pickupLat)) / 2,
    longitude: (pickupLng + (dropLng || pickupLng)) / 2,
    latitudeDelta: 0.04, longitudeDelta: 0.04,
  } : { latitude: 6.3, longitude: -10.8, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => isDone && onClose()}>
      {/* Backdrop */}
      <Animated.View style={[S.backdrop, { opacity: bgOpacity }]} />

      {/* Sheet */}
      <Animated.View style={[S.sheet, { transform: [{ translateY: slideAnim }] }]}>

        {/* ── Map (full top half when active) ── */}
        {showMap && mapRegion && (
          <View style={S.mapWrap}>
            <MapView
              ref={mapRef}
              style={S.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={mapRegion}
              scrollEnabled
              zoomEnabled
            >
              {pickupLat && (
                <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} title="Pickup">
                  <View style={S.markerPickup}><Ionicons name="location" size={20} color={GREEN} /></View>
                </Marker>
              )}
              {dropLat && (
                <Marker coordinate={{ latitude: dropLat, longitude: dropLng }} title="Drop">
                  <View style={S.markerDrop}><Ionicons name="location" size={20} color={RED} /></View>
                </Marker>
              )}
              {riderCoords && (
                <Marker coordinate={{ latitude: riderCoords.lat, longitude: riderCoords.lng }} title="Rider">
                  <View style={S.markerRider}>
                    <Ionicons name="bicycle-outline" size={20} color={BLUE} />
                  </View>
                </Marker>
              )}
              {riderCoords && pickupLat && (
                <Polyline
                  coordinates={[
                    { latitude: riderCoords.lat, longitude: riderCoords.lng },
                    { latitude: pickupLat, longitude: pickupLng },
                    ...(dropLat ? [{ latitude: dropLat, longitude: dropLng }] : []),
                  ]}
                  strokeColor={BLUE} strokeWidth={3} lineDashPattern={[6,4]}
                />
              )}
            </MapView>

            {/* Live pill over map */}
            <View style={S.mapLivePill}>
              <View style={S.mapLiveDot} />
              <Text style={S.mapLiveText}>LIVE</Text>
            </View>
          </View>
        )}

        {/* ── Bottom card ── */}
        <View style={[S.card, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={S.handle} />

          {loading ? (
            <View style={S.loadingWrap}>
              <ActivityIndicator color={BLUE} size="large" />
              <Text style={S.loadingText}>Loading your order...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

              {/* Status hero */}
              <View style={[S.statusHero, { backgroundColor: info.color + '12', borderColor: info.color + '30' }]}>
                {!showMap && status === 'searching' && <SearchRipple />}
                {showMap || status !== 'searching' ? (
                  <View style={[S.statusIconWrap, { backgroundColor: info.color }]}>
                    <Text style={{ fontSize: 26 }}>{info.emoji}</Text>
                  </View>
                ) : null}
                <Text style={[S.statusLabel, { color: info.color }]}>{info.label}</Text>
                <Text style={S.statusOrderId}>Order #{order?._id?.slice(-6).toUpperCase()}</Text>
              </View>

              {/* Progress stepper */}
              {!isDone && (
                <View style={S.stepper}>
                  {STATUS_STEPS.slice(0,-1).map((s, i) => {
                    const done    = i <= stepIdx;
                    const current = i === stepIdx;
                    return (
                      <React.Fragment key={s}>
                        <View style={[S.stepDot, done && { backgroundColor: info.color }, current && { borderWidth: 2, borderColor: info.color }]}>
                          {done && !current && <Ionicons name="checkmark" size={10} color="#fff" />}
                          {current && <View style={[S.stepDotInner, { backgroundColor: info.color }]} />}
                        </View>
                        {i < STATUS_STEPS.length - 2 && (
                          <View style={[S.stepLine, { backgroundColor: i < stepIdx ? info.color : '#E5E7EB' }]} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>
              )}

              {/* Rider info */}
              {order?.riderId && status !== 'searching' && (
                <View style={S.riderRow}>
                  <LinearGradient colors={['#0A2F9A', BLUE]} style={S.riderAvatar}>
                    <Text style={S.riderAvatarText}>{order?.riderId.name?.charAt(0)}</Text>
                  </LinearGradient>
                  <View style={S.riderInfo}>
                    <Text style={S.riderName}>{order?.riderId.name}</Text>
                    <Text style={S.riderVehicle}>
                      {order?.riderId.vehicle?.color} {order?.riderId.vehicle?.model} · {order?.riderId.vehicle?.plate}
                    </Text>
                  </View>
                  {order?.riderId.rating > 0 && (
                    <View style={S.ratingBadge}>
                      <Ionicons name="star" size={12} color={AMBER} />
                      <Text style={S.ratingText}>{order?.riderId.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Route */}
              <View style={S.routeCard}>
                <View style={S.routeRow}>
                  <View style={[S.routeDot, { backgroundColor: GREEN }]} />
                  <Text style={S.routeText} numberOfLines={1}>{order?.pickup?.address}</Text>
                </View>
                <View style={S.routeArrow}><Ionicons name="arrow-down" size={14} color="#CBD5E1" /></View>
                <View style={S.routeRow}>
                  <View style={[S.routeDot, { backgroundColor: RED }]} />
                  <Text style={S.routeText} numberOfLines={1}>{order?.drop?.address}</Text>
                </View>
              </View>

              {/* Fare */}
              <View style={S.fareRow}>
                <Text style={S.fareLabel}>Total Fare</Text>
                <Text style={[S.fareValue, { color: BLUE }]}>{fmtCurrency(order?.fare)}</Text>
              </View>

              {/* Cancel card */}
              {canCancel && (
                <View style={S.cancelCard}>
                  <View style={S.cancelTop}>
                    <View>
                      <Text style={S.cancelTitle}>Cancel order?</Text>
                      <Text style={S.cancelSub}>Window closes in {cancelSecs}s</Text>
                    </View>
                    <Text style={[S.cancelTimer, { color: cancelSecs > 60 ? GREEN : cancelSecs > 20 ? AMBER : RED }]}>
                      {cancelSecs}s
                    </Text>
                  </View>
                  <View style={S.cancelBar}>
                    <View style={[S.cancelBarFill, {
                      width: `${cancelProg * 100}%`,
                      backgroundColor: cancelSecs > 60 ? GREEN : cancelSecs > 20 ? AMBER : RED,
                    }]} />
                  </View>
                  <TouchableOpacity
                    style={[S.cancelBtn, cancelling && { opacity: 0.7 }]}
                    onPress={handleCancel} disabled={cancelling} activeOpacity={0.85}
                  >
                    {cancelling
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><Ionicons name="close-circle-outline" size={16} color="#fff" /><Text style={S.cancelBtnText}>Cancel Order</Text></>
                    }
                  </TouchableOpacity>
                </View>
              )}

              {/* Cancelled state */}
              {status === 'cancelled' && (
                <View style={S.endCard}>
                  <Ionicons name="close-circle" size={32} color={RED} />
                  <Text style={[S.endTitle, { color: RED }]}>Order Cancelled</Text>
                  <TouchableOpacity style={[S.endBtn, { backgroundColor: RED }]} onPress={onClose}>
                    <Text style={S.endBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Delivered state */}
              {status === 'delivered' && (
                <View style={S.endCard}>
                  <Text style={{ fontSize: 44 }}>🎉</Text>
                  <Text style={[S.endTitle, { color: GREEN }]}>Delivered!</Text>
                  <Text style={S.endSub}>Your parcel reached its destination safely</Text>
                  <TouchableOpacity
                    style={[S.endBtn, { backgroundColor: BLUE }]}
                    onPress={() => {
                      onClose();
                      navigation?.navigate('OrderDetail', { orderId });
                    }}
                  >
                    <Text style={S.endBtnText}>View Details & Rate Rider</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ paddingVertical: 10 }} onPress={onClose}>
                    <Text style={{ color: '#9CA3AF', fontSize: 13, fontWeight: '600' }}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* View full details */}
              {!isDone && (
                <TouchableOpacity
                  style={S.viewDetailsBtn}
                  onPress={() => { onClose(); navigation?.navigate('OrderDetail', { orderId }); }}
                >
                  <Text style={S.viewDetailsText}>View Full Details</Text>
                  <Ionicons name="chevron-forward" size={14} color={BLUE} />
                </TouchableOpacity>
              )}

            </ScrollView>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:    { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, justifyContent: 'flex-end' },

  mapWrap:  { flex: 1, position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_H * 0.52 },
  map:      { flex: 1 },
  mapLivePill: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  mapLiveDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  mapLiveText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  markerPickup: { backgroundColor: '#DCFCE7', borderRadius: 10, padding: 4, borderWidth: 1.5, borderColor: GREEN },
  markerDrop:   { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 4, borderWidth: 1.5, borderColor: RED },
  markerRider:  { backgroundColor: '#fff', borderRadius: 20, padding: 6, elevation: 4 },

  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20,
    marginTop: SCREEN_H * 0.48,
    minHeight: SCREEN_H * 0.52,
    elevation: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },

  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },

  statusHero:    { alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, gap: 6 },
  statusIconWrap:{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statusLabel:   { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  statusOrderId: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },

  stepper:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, paddingHorizontal: 8 },
  stepDot:     { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  stepDotInner:{ width: 8, height: 8, borderRadius: 4 },
  stepLine:    { flex: 1, height: 2, marginHorizontal: 2 },

  riderRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFF', borderRadius: 14, padding: 12, marginBottom: 12 },
  riderAvatar:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  riderAvatarText:{ fontSize: 18, fontWeight: '900', color: '#fff' },
  riderInfo:     { flex: 1 },
  riderName:     { fontSize: 15, fontWeight: '800', color: '#111827' },
  riderVehicle:  { fontSize: 12, color: '#6B7280', marginTop: 2 },
  ratingBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#FDE68A' },
  ratingText:    { fontSize: 13, fontWeight: '800', color: AMBER },

  routeCard:  { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 12, gap: 8 },
  routeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeDot:   { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  routeText:  { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  routeArrow: { paddingLeft: 4 },

  fareRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginBottom: 12 },
  fareLabel: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  fareValue: { fontSize: 20, fontWeight: '900' },

  cancelCard:  { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#FECACA', marginBottom: 12 },
  cancelTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cancelTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  cancelSub:   { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cancelTimer: { fontSize: 22, fontWeight: '900' },
  cancelBar:   { height: 5, backgroundColor: '#F3F4F6', borderRadius: 3, marginBottom: 12, overflow: 'hidden' },
  cancelBarFill:{ height: '100%', borderRadius: 3 },
  cancelBtn:   { height: 46, borderRadius: 10, backgroundColor: RED, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cancelBtnText:{ fontSize: 14, fontWeight: '800', color: '#fff' },

  endCard:   { alignItems: 'center', paddingVertical: 16, gap: 8 },
  endTitle:  { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  endSub:    { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  endBtn:    { marginTop: 8, height: 50, paddingHorizontal: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  endBtnText:{ fontSize: 14, fontWeight: '800', color: '#fff' },

  viewDetailsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
  viewDetailsText:{ fontSize: 13, fontWeight: '700', color: BLUE },
});