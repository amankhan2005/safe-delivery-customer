import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Animated, StatusBar, Platform, Easing,
  ActivityIndicator, Modal, Dimensions, KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { getOrderById, getOrderOTP, cancelOrder, rateDriver } from '../../api';
import { fmtCurrency, fmtDateTime, fmtStatus, statusColor } from '../../utils/helpers';
import Button from '../../components/Button';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';
import { connectSocket, subscribeRideEvents, subscribeRiderLocation } from '../../services/socketService';

const BLUE  = '#1B4FD8';
const GREEN = '#16A34A';
const AMBER = '#D97706';
const RED   = '#DC2626';

const STEPS = [
  { key: 'searching',  label: 'Finding Rider',  icon: 'search-outline' },
  { key: 'assigned',   label: 'Rider Assigned', icon: 'bicycle-outline' },
  { key: 'picked_up',  label: 'Picked Up',      icon: 'cube-outline' },
  { key: 'in_transit', label: 'In Transit',     icon: 'navigate-outline' },
  { key: 'delivered',  label: 'Delivered',      icon: 'checkmark-circle-outline' },
];

const STATUS_MESSAGES = {
  'ride:rider_assigned': 'Rider assigned! On the way.',
  'ride:picked_up':      'Parcel has been picked up!',
  'ride:in_transit':     'Ride started. Heading to drop location.',
  'ride:arrived':        'Rider has arrived. Please get ready!',
  'ride:delivered':      'Parcel delivered successfully!',
  'ride:cancelled':      'Order was cancelled.',
};

// ── helpers ───────────────────────────────────────────────────────────────────
// FIX 1/2/3/4: Never use && with numbers/objects as guards.
// Use !! or explicit null checks so falsy numerics (0, 0.0) don't render as text.
const hasCoord = (val) => val != null && val !== '' && val !== false;

// ── Searching animation ───────────────────────────────────────────────────────
function SearchingAnimation() {
  const waves      = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const iconBounce = useRef(new Animated.Value(1)).current;
  const dotAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    waves.forEach((w, i) => {
      Animated.loop(Animated.sequence([
        Animated.delay(i * 500),
        Animated.timing(w, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(w, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])).start();
    });
    Animated.loop(Animated.sequence([
      Animated.timing(iconBounce, { toValue: 1.15, duration: 600, useNativeDriver: true }),
      Animated.timing(iconBounce, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(dotAnim, { toValue: 3, duration: 1200, useNativeDriver: false })).start();
  }, []);

  return (
    <View style={SA.root}>
      {waves.map((w, i) => {
        const scale   = w.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] });
        const opacity = w.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.25, 0] });
        return <Animated.View key={i} style={[SA.ring, { transform: [{ scale }], opacity }]} />;
      })}
      <Animated.View style={[SA.iconWrap, { transform: [{ scale: iconBounce }] }]}>
        <LinearGradient colors={[BLUE, '#0A2F9A']} style={SA.iconGrad}>
          <Ionicons name="bicycle-outline" size={36} color="#fff" />
        </LinearGradient>
      </Animated.View>
      <Text style={SA.title}>Finding your rider</Text>
      <Text style={SA.sub}>Please wait while we connect you with a nearby rider</Text>
      <View style={SA.dotRow}>
        {[0, 1, 2].map(i => {
          const opacity = dotAnim.interpolate({ inputRange: [i, i + 0.5, i + 1, 3], outputRange: [0.3, 1, 0.3, 0.3], extrapolate: 'clamp' });
          return <Animated.View key={i} style={[SA.dot, { opacity }]} />;
        })}
      </View>
    </View>
  );
}

const SA = StyleSheet.create({
  root:     { alignItems: 'center', paddingVertical: SIZES.xxl, paddingHorizontal: SIZES.xl },
  ring:     { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: BLUE, alignSelf: 'center', top: SIZES.xxl + 10 },
  iconWrap: { marginBottom: SIZES.lg, marginTop: 20 },
  iconGrad: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', ...SHADOWS.blue },
  title:    { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: '#111827', marginBottom: 8, letterSpacing: -0.3 },
  sub:      { fontSize: SIZES.fontSm, color: '#6B7280', textAlign: 'center', fontWeight: FONT_WEIGHT.medium, lineHeight: 20, marginBottom: SIZES.md },
  dotRow:   { flexDirection: 'row', gap: 8, marginTop: 4 },
  dot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: BLUE },
});

// ── Rider Found Banner ────────────────────────────────────────────────────────
function RiderFoundBanner({ rider }) {
  const slideY  = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, tension: 80, friction: 8,  useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[RF.root, { transform: [{ translateY: slideY }, { scale }], opacity }]}>
      <LinearGradient colors={['#0A2F9A', BLUE]} style={RF.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <View style={RF.avatar}>
          <Text style={RF.avatarText}>{rider?.name?.charAt(0) || '?'}</Text>
        </View>
        <View style={RF.info}>
          <Text style={RF.label}>Rider Found!</Text>
          <Text style={RF.name}>{rider?.name || 'Your Rider'}</Text>
          {/* FIX 5: vehicle strings — use single Text, avoid implicit concatenation outside Text */}
          <Text style={RF.vehicle}>
            {[rider?.vehicle?.color, rider?.vehicle?.model].filter(Boolean).join(' ')}
            {rider?.vehicle?.plate ? ` · ${rider.vehicle.plate}` : ''}
          </Text>
        </View>
        <View style={RF.motoIcon}>
          <Ionicons name="bicycle-outline" size={28} color="#fff" />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const RF = StyleSheet.create({
  root:      { borderRadius: 16, overflow: 'hidden', ...SHADOWS.blue },
  grad:      { flexDirection: 'row', alignItems: 'center', padding: SIZES.lg, gap: SIZES.md },
  avatar:    { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarText:{ fontSize: SIZES.fontXxl, fontWeight: FONT_WEIGHT.black, color: '#fff' },
  info:      { flex: 1 },
  label:     { fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.75)', fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5, marginBottom: 2 },
  name:      { fontSize: SIZES.fontLg, fontWeight: FONT_WEIGHT.black, color: '#fff' },
  vehicle:   { fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  motoIcon:  { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OrderDetailScreen({ navigation, route }) {
  const { orderId } = route.params;

  const [order,           setOrder]           = useState(null);
  const [otp,             setOtp]             = useState(null);
  const [otpVisible,      setOtpVisible]      = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);
  const [cancelling,      setCancelling]      = useState(false);
  const [cancelSecsLeft,  setCancelSecsLeft]  = useState(120);
  const [riderCoords,     setRiderCoords]     = useState(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [selectedRating,  setSelectedRating]  = useState(0);
  const [ratingLoading,   setRatingLoading]   = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const fadeAnim       = useRef(new Animated.Value(0)).current;
  const mapRef         = useRef(null);
  const unsubRef       = useRef({ location: null, events: null });
  const ratingShownRef = useRef(false);

  // Cancel countdown
  useEffect(() => {
    if (!order || !['searching', 'assigned'].includes(order.status)) return;
    const created = new Date(order.createdAt).getTime();
    const tick = () => setCancelSecsLeft(Math.max(120 - Math.floor((Date.now() - created) / 1000), 0));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [order?.createdAt, order?.status]);

  const load = useCallback(async () => {
    try {
      const res = await getOrderById(orderId);
      const o = res.data.data.order;
      setOrder(o);
      // FIX 6: driverRating could be 0 (number). Use explicit null/undefined check, not falsy check.
      if (o.status === 'delivered' && o.driverRating == null && !ratingSubmitted && !ratingShownRef.current) {
        ratingShownRef.current = true;
        setTimeout(() => setShowRatingModal(true), 1000);
      }
      if (o.riderId?.currentLocation?.lat != null) {
        setRiderCoords(o.riderId.currentLocation);
      }
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load order' });
    } finally {
      setRefreshing(false);
    }
  }, [orderId, ratingSubmitted]);

  useEffect(() => {
    load();
    const setup = async () => {
      await connectSocket();
      unsubRef.current.events = subscribeRideEvents(orderId, (event) => {
        const msg = STATUS_MESSAGES[event];
        if (msg) Toast.show({ type: event === 'ride:cancelled' ? 'error' : 'success', text1: msg });
        load();
      });
      unsubRef.current.location = subscribeRiderLocation(orderId, ({ lat, lng }) => {
        setRiderCoords({ lat, lng });
        mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
      });
    };
    setup();
    const poll = setInterval(load, 15000);
    return () => { clearInterval(poll); unsubRef.current.events?.(); unsubRef.current.location?.(); };
  }, [orderId]);

  const fetchOTP = async () => {
    try {
      const res = await getOrderOTP(orderId);
      setOtp(res.data.data.deliveryOTP);
      setOtpVisible(true);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not fetch OTP' });
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'Keep Order', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
        setCancelling(true);
        try {
          await cancelOrder(orderId, { cancellationReason: 'Customer cancelled' });
          Toast.show({ type: 'success', text1: 'Order cancelled' });
          load();
        } catch (e) {
          Toast.show({ type: 'error', text1: e.response?.data?.error || 'Failed' });
        } finally {
          setCancelling(false);
        }
      }},
    ]);
  };

  const handleRating = async (stars) => {
    setSelectedRating(stars);
    setRatingLoading(true);
    try {
      await rateDriver(orderId, { rating: stars });
      setRatingSubmitted(true);
      setShowRatingModal(false);
      Toast.show({ type: 'success', text1: 'Thank you for your feedback!', text2: `You rated ${stars} star${stars > 1 ? 's' : ''}` });
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.error || 'Rating failed' });
    } finally {
      setRatingLoading(false);
    }
  };

  if (!order) return (
    <View style={S.center}>
      <ActivityIndicator size="large" color={BLUE} />
    </View>
  );

  const color       = statusColor(order.status);
  const stepIndex   = STEPS.findIndex(s => s.key === order.status);
  const showOTP     = order.status === 'in_transit';
  const delivered   = order.status === 'delivered';
  const isActive    = ['assigned', 'picked_up', 'in_transit'].includes(order.status);
  const isSearching = order.status === 'searching';
  const isAssigned  = order.status === 'assigned';
  const canCancel   = ['searching', 'assigned'].includes(order.status) && cancelSecsLeft > 0;

  // FIX 1/2/3: Use hasCoord() so lat=0 (valid!) doesn't evaluate as falsy and render "0"
  const pickupLat = order.pickup?.lat;
  const pickupLng = order.pickup?.lng;
  const dropLat   = order.drop?.lat;
  const dropLng   = order.drop?.lng;

  const hasPickup      = hasCoord(pickupLat) && hasCoord(pickupLng);
  const hasDrop        = hasCoord(dropLat)   && hasCoord(dropLng);
  const hasRiderCoords = riderCoords != null  && hasCoord(riderCoords.lat) && hasCoord(riderCoords.lng);

  const mapRegion = hasRiderCoords ? {
    latitude:      (riderCoords.lat + (hasPickup ? pickupLat : riderCoords.lat)) / 2,
    longitude:     (riderCoords.lng + (hasPickup ? pickupLng : riderCoords.lng)) / 2,
    latitudeDelta: 0.04,
    longitudeDelta:0.04,
  } : hasPickup ? {
    latitude:      (pickupLat + (hasDrop ? dropLat : pickupLat)) / 2,
    longitude:     (pickupLng + (hasDrop ? dropLng : pickupLng)) / 2,
    latitudeDelta: 0.04,
    longitudeDelta:0.04,
  } : null;

  const cancelProgress = cancelSecsLeft / 120;

  // FIX 4: driverRating could be 0 — use explicit null check for "has been rated" logic
  const hasBeenRated   = ratingSubmitted || order.driverRating != null;
  const canRate        = delivered && !hasBeenRated && order.riderId != null;
  const showRatingDone = delivered && hasBeenRated;

  // FIX 7: OTP string — otp can be a number, otpVisible && otp would render "0" if otp=0
  // Use !! otp to force boolean
  const showOtpDigits = otpVisible && otp != null;

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      {/* ── Header ── */}
      <LinearGradient colors={['#0A2F9A', BLUE]} style={S.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={S.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={S.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={S.headerTitle}>Order Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={S.headerBody}>
          <View style={[S.statusPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={S.statusPillText}>{fmtStatus(order.status)}</Text>
          </View>
          <Text style={S.orderId}>#{order._id?.slice(-8).toUpperCase()}</Text>
          <Text style={S.orderDate}>{fmtDateTime(order.createdAt)}</Text>
        </View>
      </LinearGradient>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={S.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={BLUE}
            colors={[BLUE]}
          />
        }
      >

        {/* Searching */}
        {isSearching ? <View style={S.card}><SearchingAnimation /></View> : null}

        {/* Rider Found Banner */}
        {/* FIX A: double && with object — use explicit boolean */}
        {isAssigned && order.riderId != null ? (
          <RiderFoundBanner rider={order.riderId} />
        ) : null}

        {/* Live Map */}
        {isActive && mapRegion != null ? (
          <View style={S.mapCard}>
            <View style={S.mapHeader}>
              <View style={[S.liveDot, { backgroundColor: GREEN }]} />
              <Text style={S.mapHeaderText}>Live Tracking</Text>
              {hasRiderCoords ? (
                <View style={S.etaPill}>
                  <Ionicons name="bicycle-outline" size={11} color={BLUE} />
                  <Text style={S.etaText}>On the way</Text>
                </View>
              ) : null}
            </View>
            <MapView
              ref={mapRef}
              style={S.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={mapRegion}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              {/* FIX 1: use hasPickup boolean, not pickupLat directly */}
              {hasPickup ? (
                <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} title="Pickup">
                  <View style={S.markerPickup}>
                    <Ionicons name="location" size={20} color={GREEN} />
                  </View>
                </Marker>
              ) : null}

              {/* FIX 2: use hasDrop boolean, not dropLat directly */}
              {hasDrop ? (
                <Marker coordinate={{ latitude: dropLat, longitude: dropLng }} title="Drop">
                  <View style={S.markerDrop}>
                    <Ionicons name="location" size={20} color={RED} />
                  </View>
                </Marker>
              ) : null}

              {/* FIX E: hasRiderCoords boolean guard */}
              {hasRiderCoords ? (
                <Marker
                  coordinate={{ latitude: riderCoords.lat, longitude: riderCoords.lng }}
                  title={order.riderId?.name || 'Rider'}
                >
                  <View style={S.riderMarker}>
                    <Ionicons name="bicycle-outline" size={22} color={BLUE} />
                  </View>
                </Marker>
              ) : null}

              {/* FIX 3: use hasRiderCoords && hasPickup booleans */}
              {hasRiderCoords && hasPickup ? (
                <Polyline
                  coordinates={[
                    { latitude: riderCoords.lat, longitude: riderCoords.lng },
                    { latitude: pickupLat,        longitude: pickupLng },
                    ...(hasDrop ? [{ latitude: dropLat, longitude: dropLng }] : []),
                  ]}
                  strokeColor={BLUE}
                  strokeWidth={3}
                  lineDashPattern={[8, 4]}
                />
              ) : null}
            </MapView>
          </View>
        ) : null}

        {/* OTP */}
        {showOTP ? (
          <View style={S.otpCard}>
            <View style={S.otpIconWrap}>
              <Ionicons name="key" size={24} color={AMBER} />
            </View>
            <Text style={S.otpTitle}>Delivery OTP</Text>
            <Text style={S.otpSub}>Share this code with your rider to confirm delivery</Text>
            {/* FIX 7: showOtpDigits uses != null check, not truthy otp */}
            {showOtpDigits ? (
              <View style={S.otpCodeRow}>
                {String(otp).split('').map((d, i) => (
                  <View key={i} style={S.otpDigitBox}>
                    <Text style={S.otpDigit}>{d}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <TouchableOpacity style={S.otpRevealBtn} onPress={fetchOTP}>
                <Ionicons name="eye-outline" size={16} color={AMBER} />
                <Text style={S.otpRevealText}>Tap to Reveal OTP</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Delivered */}
        {delivered ? (
          <LinearGradient
            colors={['#14532D', GREEN]}
            style={S.deliveredCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={S.deliveredIcon}>
              <Ionicons name="checkmark-circle" size={28} color="#fff" />
            </View>
            <View>
              <Text style={S.deliveredTitle}>Delivered Successfully!</Text>
              <Text style={S.deliveredSub}>Your parcel reached its destination safely</Text>
            </View>
          </LinearGradient>
        ) : null}

        {/* Rate Rider — FIX G/H: use canRate / showRatingDone booleans computed above */}
        {canRate ? (
          <TouchableOpacity style={S.ratingTrigger} onPress={() => setShowRatingModal(true)} activeOpacity={0.85}>
            <LinearGradient colors={['#FFFBEB', '#FEF3C7']} style={S.ratingTriggerInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <View style={S.ratingStarWrap}>
                {[1, 2, 3, 4, 5].map(s => (
                  <Ionicons key={s} name="star-outline" size={16} color={AMBER} />
                ))}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.ratingTriggerTitle}>Rate your Rider</Text>
                <Text style={S.ratingTriggerSub}>How was your delivery experience?</Text>
              </View>
              <View style={S.ratingChevron}>
                <Ionicons name="chevron-forward" size={18} color={AMBER} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        {showRatingDone ? (
          <View style={S.ratingDoneCard}>
            <View style={S.ratingDoneStars}>
              {[1, 2, 3, 4, 5].map(s => (
                <Ionicons
                  key={s}
                  name={s <= (order.driverRating ?? selectedRating) ? 'star' : 'star-outline'}
                  size={18}
                  color={AMBER}
                />
              ))}
            </View>
            {/* FIX 8: single Text, nested Text for bold — avoid adjacent JSX text nodes */}
            <Text style={S.ratingDoneText}>
              {'You rated '}
              <Text style={{ fontWeight: '800' }}>
                {order.riderId?.name?.split(' ')[0] || 'this rider'}
              </Text>
              {' — Thank you!'}
            </Text>
          </View>
        ) : null}

        {/* Timeline */}
        {order.status !== 'cancelled' ? (
          <View style={S.card}>
            <Text style={S.cardTitle}>Delivery Progress</Text>
            {STEPS.map((s, i) => {
              const done    = i <= stepIndex;
              const current = i === stepIndex;
              return (
                <View key={s.key} style={S.step}>
                  <View style={S.stepLeft}>
                    <View style={[S.stepCircle, done && { backgroundColor: BLUE, ...SHADOWS.sm }]}>
                      <Ionicons name={done ? 'checkmark' : s.icon} size={14} color={done ? '#fff' : '#9CA3AF'} />
                    </View>
                    {i < STEPS.length - 1 ? (
                      <View style={[S.stepLine, done && { backgroundColor: BLUE }]} />
                    ) : null}
                  </View>
                  <View style={S.stepRight}>
                    <Text style={[S.stepLabel, done && { color: '#111827', fontWeight: FONT_WEIGHT.semibold }]}>
                      {s.label}
                    </Text>
                    {current ? (
                      <Text style={[S.stepActive, { color: BLUE }]}>● Active now</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Route */}
        <View style={S.card}>
          <Text style={S.cardTitle}>Route</Text>
          <View style={S.routeItem}>
            <View style={[S.routeDot, { backgroundColor: GREEN }]} />
            <View style={S.routeInfo}>
              <Text style={S.routeTag}>PICKUP</Text>
              <Text style={S.routeAddr}>{order.pickup?.address}</Text>
              {/* FIX: contact info — use single Text, build string safely */}
              <Text style={S.routeContact}>
                {[order.pickup?.contactName, order.pickup?.contactPhone].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
          <View style={S.routeConn}>
            {[0, 1, 2, 3].map(i => <View key={i} style={S.connDash} />)}
          </View>
          <View style={S.routeItem}>
            <View style={[S.routeDot, { backgroundColor: RED }]} />
            <View style={S.routeInfo}>
              <Text style={S.routeTag}>DROP-OFF</Text>
              <Text style={S.routeAddr}>{order.drop?.address}</Text>
              <Text style={S.routeContact}>
                {[order.drop?.contactName, order.drop?.contactPhone].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
        </View>

        {/* Rider Card */}
        {order.riderId != null && order.status !== 'searching' ? (
          <View style={S.card}>
            <Text style={S.cardTitle}>Your Rider</Text>
            <View style={S.riderRow}>
              <LinearGradient colors={['#0A2F9A', BLUE]} style={S.riderAvatar}>
                <Text style={S.riderAvatarText}>{order.riderId?.name?.charAt(0)}</Text>
              </LinearGradient>
              <View style={S.riderInfo}>
                <Text style={S.riderName}>{order.riderId?.name}</Text>
                <Text style={S.riderPhone}>{order.riderId?.phone}</Text>
                {order.riderId?.vehicle?.model ? (
                  <Text style={S.riderVehicle}>
                    {[order.riderId.vehicle.color, order.riderId.vehicle.model].filter(Boolean).join(' ')}
                    {order.riderId.vehicle.plate ? ` · ${order.riderId.vehicle.plate}` : ''}
                  </Text>
                ) : null}
              </View>
              {order.riderId?.rating > 0 ? (
                <View style={S.ratingBadge}>
                  <Ionicons name="star" size={12} color={AMBER} />
                  <Text style={S.ratingBadgeText}>{order.riderId.rating.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Payment */}
        <View style={S.card}>
          <Text style={S.cardTitle}>Payment</Text>
          {order.promoDiscount > 0 ? (
            <>
              <View style={S.payRow}>
                <Text style={S.payLabel}>Original Fare</Text>
                <Text style={S.payValStrike}>{fmtCurrency(order.fare + order.promoDiscount)}</Text>
              </View>
              <View style={S.payRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="pricetag-outline" size={13} color={GREEN} />
                  {/* FIX: promo label — string interpolation inside Text */}
                  <Text style={[S.payLabel, { color: GREEN }]}>
                    {`Promo${order.promoCode ? ` (${order.promoCode})` : ' Discount'}`}
                  </Text>
                </View>
                {/* FIX 9: no bare "-" string — wrap entirely in Text */}
                <Text style={[S.payVal, { color: GREEN }]}>
                  {`-${fmtCurrency(order.promoDiscount)}`}
                </Text>
              </View>
              <View style={S.payDivider} />
              <View style={S.payRow}>
                <Text style={[S.payLabel, { fontWeight: FONT_WEIGHT.black, color: '#111827' }]}>You Pay</Text>
                <Text style={[S.payVal, { color: BLUE }]}>{fmtCurrency(order.fare)}</Text>
              </View>
            </>
          ) : (
            <View style={S.payRow}>
              <Text style={S.payLabel}>Total Fare</Text>
              <Text style={[S.payVal, { color: BLUE }]}>{fmtCurrency(order.fare)}</Text>
            </View>
          )}
          <View style={S.codBadge}>
            <View style={S.codIconWrap}>
              <Ionicons name="cash-outline" size={18} color={GREEN} />
            </View>
            <View>
              <Text style={S.codTitle}>Cash on Delivery</Text>
              {/* FIX: template literal inside Text — already correct, just confirming */}
              <Text style={S.codSub}>{`Pay ${fmtCurrency(order.fare)} when your parcel arrives`}</Text>
            </View>
          </View>
        </View>

        {/* Cancel */}
        {['searching', 'assigned'].includes(order.status) ? (
          cancelSecsLeft > 0 ? (
            <View style={S.cancelCard}>
              <View style={S.cancelTop}>
                <View>
                  <Text style={S.cancelCardTitle}>Need to cancel?</Text>
                  <Text style={S.cancelCardSub}>You can cancel within the window below</Text>
                </View>
                <View style={S.cancelTimerBadge}>
                  {/* FIX: number rendered as text — wrap in Text */}
                  <Text style={S.cancelTimerNum}>{cancelSecsLeft}s</Text>
                  <Text style={S.cancelTimerLabel}>left</Text>
                </View>
              </View>
              <View style={S.cancelBarBg}>
                <View style={[
                  S.cancelBarFill,
                  {
                    width: `${Math.max(0, Math.min(cancelProgress * 100, 100))}%`,
                    backgroundColor: cancelSecsLeft > 60 ? GREEN : cancelSecsLeft > 30 ? AMBER : RED,
                  },
                ]} />
              </View>
              <TouchableOpacity
                style={[S.cancelBtn, cancelling && { opacity: 0.7 }]}
                onPress={handleCancel}
                disabled={cancelling}
                activeOpacity={0.85}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color="#fff" />
                    <Text style={S.cancelBtnText}>Cancel Order</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={S.cancelExpired}>
              <Ionicons name="lock-closed-outline" size={16} color="#9CA3AF" />
              <Text style={S.cancelExpiredText}>Cancellation window has closed</Text>
            </View>
          )
        ) : null}

      </Animated.ScrollView>

      {/* ── Rating Modal ── */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={S.modalOverlay}>
            <View style={S.modalCard}>
              <View style={S.modalHandle} />

              <View style={S.modalAvatarSection}>
                <View style={S.modalAvatarRing}>
                  <LinearGradient colors={['#0A2F9A', BLUE]} style={S.modalAvatar}>
                    <Text style={S.modalAvatarText}>
                      {order?.riderId?.name?.charAt(0) || '?'}
                    </Text>
                  </LinearGradient>
                  <View style={S.modalAvatarBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={GREEN} />
                  </View>
                </View>
                <View style={S.modalDeliveredPill}>
                  <Ionicons name="checkmark" size={11} color={GREEN} />
                  <Text style={S.modalDeliveredText}>Delivered Successfully</Text>
                </View>
              </View>

              <Text style={S.modalTitle}>How was your delivery?</Text>
              {/* FIX 8: adjacent JSX text nodes — use nested <Text> instead */}
              <Text style={S.modalSub}>
                {'Rate your experience with '}
                <Text style={{ fontWeight: '800', color: '#111827' }}>
                  {order?.riderId?.name || 'your rider'}
                </Text>
              </Text>

              <View style={S.modalStarsWrap}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => !ratingLoading && handleRating(star)}
                    activeOpacity={0.75}
                    style={S.starBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                  >
                    <Ionicons
                      name={star <= selectedRating ? 'star' : 'star-outline'}
                      size={42}
                      color={star <= selectedRating ? AMBER : '#D1D5DB'}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[
                S.ratingLabelPill,
                selectedRating > 0 && { backgroundColor: AMBER + '18', borderColor: AMBER + '50' },
              ]}>
                <Text style={[S.ratingLabelText, selectedRating > 0 && { color: AMBER }]}>
                  {selectedRating === 0 ? 'Tap a star to rate'    :
                   selectedRating === 1 ? 'Poor experience'        :
                   selectedRating === 2 ? 'Could be better'        :
                   selectedRating === 3 ? 'It was okay'            :
                   selectedRating === 4 ? 'Great service!'         :
                                          'Absolutely loved it!'}
                </Text>
              </View>

              {ratingLoading ? (
                <View style={S.ratingLoadingRow}>
                  <ActivityIndicator color={BLUE} size="small" />
                  <Text style={S.ratingLoadingText}>Submitting your rating...</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={S.skipBtn}
                  onPress={() => setShowRatingModal(false)}
                  activeOpacity={0.6}
                >
                  <Text style={S.skipText}>Maybe later</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ── Styles (unchanged from original) ─────────────────────────────────────────
const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F4F6FB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6FB' },

  header:         { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 32, paddingHorizontal: 20 },
  headerTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { fontSize: 17, fontWeight: FONT_WEIGHT.bold, color: '#fff' },
  headerBody:     { alignItems: 'center', gap: 6 },
  statusPill:     { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: FONT_WEIGHT.bold, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
  orderId:        { fontSize: 28, fontWeight: FONT_WEIGHT.black, color: '#fff', letterSpacing: -0.5 },
  orderDate:      { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: FONT_WEIGHT.medium },

  content: { padding: 16, paddingTop: 12, gap: 12, paddingBottom: 80 },

  card:      { backgroundColor: '#fff', borderRadius: 16, padding: 16, ...SHADOWS.sm },
  cardTitle: { fontSize: 16, fontWeight: FONT_WEIGHT.black, color: '#111827', marginBottom: 16, letterSpacing: -0.2 },

  mapCard:       { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', ...SHADOWS.sm },
  mapHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  liveDot:       { width: 8, height: 8, borderRadius: 4 },
  mapHeaderText: { fontSize: 15, fontWeight: FONT_WEIGHT.black, color: '#111827', flex: 1 },
  etaPill:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  etaText:       { fontSize: 11, color: BLUE, fontWeight: FONT_WEIGHT.bold },
  map:           { height: 220 },
  markerPickup:  { backgroundColor: '#DCFCE7', borderRadius: 10, padding: 4, borderWidth: 1.5, borderColor: GREEN },
  markerDrop:    { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 4, borderWidth: 1.5, borderColor: RED },
  riderMarker:   { backgroundColor: '#fff', borderRadius: 20, padding: 6, ...SHADOWS.md },

  otpCard:      { backgroundColor: '#FFFBEB', borderRadius: 16, padding: 20, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#FDE68A', ...SHADOWS.sm },
  otpIconWrap:  { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  otpTitle:     { fontSize: 18, fontWeight: FONT_WEIGHT.black, color: '#92400E' },
  otpSub:       { fontSize: 13, color: '#B45309', fontWeight: FONT_WEIGHT.medium, textAlign: 'center' },
  otpCodeRow:   { flexDirection: 'row', gap: 8, marginTop: 12 },
  otpDigitBox:  { width: 52, height: 60, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FDE68A', ...SHADOWS.sm },
  otpDigit:     { fontSize: 26, fontWeight: FONT_WEIGHT.black, color: AMBER },
  otpRevealBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: '#FEF3C7', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' },
  otpRevealText:{ fontSize: 14, fontWeight: FONT_WEIGHT.bold, color: AMBER },

  deliveredCard:  { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, ...SHADOWS.sm },
  deliveredIcon:  { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  deliveredTitle: { fontSize: 17, fontWeight: FONT_WEIGHT.black, color: '#fff' },
  deliveredSub:   { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: FONT_WEIGHT.medium },

  ratingTrigger:      { borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: '#FDE68A', ...SHADOWS.sm },
  ratingTriggerInner: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  ratingStarWrap:     { flexDirection: 'row', gap: 2, marginBottom: 4 },
  ratingTriggerTitle: { fontSize: 15, fontWeight: FONT_WEIGHT.black, color: '#92400E' },
  ratingTriggerSub:   { fontSize: 12, color: '#B45309', marginTop: 2 },
  ratingChevron:      { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  ratingDoneCard:     { backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FDE68A', gap: 8, alignItems: 'center' },
  ratingDoneStars:    { flexDirection: 'row', gap: 4 },
  ratingDoneText:     { fontSize: 13, fontWeight: FONT_WEIGHT.semibold, color: '#92400E' },

  step:       { flexDirection: 'row', gap: 14 },
  stepLeft:   { alignItems: 'center', width: 28 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  stepLine:   { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 3, minHeight: 20 },
  stepRight:  { flex: 1, paddingBottom: 16 },
  stepLabel:  { fontSize: 14, color: '#9CA3AF', fontWeight: FONT_WEIGHT.medium, paddingTop: 4 },
  stepActive: { fontSize: 11, fontWeight: FONT_WEIGHT.bold, marginTop: 3 },

  routeItem:   { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  routeDot:    { width: 12, height: 12, borderRadius: 6, marginTop: 6, flexShrink: 0 },
  routeInfo:   { flex: 1 },
  routeTag:    { fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 3 },
  routeAddr:   { fontSize: 14, fontWeight: FONT_WEIGHT.semibold, color: '#111827' },
  routeContact:{ fontSize: 12, color: '#6B7280', marginTop: 3 },
  routeConn:   { flexDirection: 'column', gap: 4, marginLeft: 5, marginVertical: 8 },
  connDash:    { width: 2, height: 6, backgroundColor: '#E5E7EB', borderRadius: 1 },

  riderRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riderAvatar:     { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  riderAvatarText: { fontSize: 20, fontWeight: FONT_WEIGHT.black, color: '#fff' },
  riderInfo:       { flex: 1 },
  riderName:       { fontSize: 15, fontWeight: FONT_WEIGHT.bold, color: '#111827' },
  riderPhone:      { fontSize: 13, color: '#6B7280', marginTop: 2 },
  riderVehicle:    { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  ratingBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#FDE68A' },
  ratingBadgeText: { fontSize: 13, fontWeight: FONT_WEIGHT.bold, color: AMBER },

  payRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  payLabel:     { fontSize: 14, color: '#6B7280', fontWeight: FONT_WEIGHT.medium },
  payVal:       { fontSize: 22, fontWeight: FONT_WEIGHT.black, letterSpacing: -0.3 },
  payValStrike: { fontSize: 16, color: '#9CA3AF', textDecorationLine: 'line-through' },
  payDivider:   { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  codBadge:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#86EFAC' },
  codIconWrap:  { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  codTitle:     { fontSize: 14, fontWeight: FONT_WEIGHT.black, color: '#14532D' },
  codSub:       { fontSize: 12, color: GREEN, marginTop: 2 },

  cancelCard:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#FECACA', ...SHADOWS.sm },
  cancelTop:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cancelCardTitle:   { fontSize: 15, fontWeight: FONT_WEIGHT.black, color: '#111827' },
  cancelCardSub:     { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cancelTimerBadge:  { backgroundColor: '#FEF2F2', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  cancelTimerNum:    { fontSize: 22, fontWeight: FONT_WEIGHT.black, color: RED },
  cancelTimerLabel:  { fontSize: 10, color: RED, fontWeight: FONT_WEIGHT.semibold },
  cancelBarBg:       { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, marginBottom: 14, overflow: 'hidden' },
  cancelBarFill:     { height: '100%', borderRadius: 3 },
  cancelBtn:         { height: 50, borderRadius: 12, backgroundColor: RED, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...SHADOWS.sm },
  cancelBtnText:     { fontSize: 15, fontWeight: FONT_WEIGHT.black, color: '#fff' },
  cancelExpired:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  cancelExpiredText: { fontSize: 13, color: '#9CA3AF', fontWeight: FONT_WEIGHT.medium },

  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard:           { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 32, paddingTop: 14, alignItems: 'center', width: '100%' },
  modalHandle:         { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 20 },
  modalAvatarSection:  { alignItems: 'center', marginBottom: 16 },
  modalAvatarRing:     { width: 84, height: 84, borderRadius: 42, borderWidth: 2.5, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 10, position: 'relative' },
  modalAvatar:         { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  modalAvatarText:     { fontSize: 28, fontWeight: FONT_WEIGHT.black, color: '#fff' },
  modalAvatarBadge:    { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#fff', borderRadius: 12, padding: 1 },
  modalDeliveredPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDF4', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: '#86EFAC' },
  modalDeliveredText:  { fontSize: 12, fontWeight: '700', color: GREEN },
  modalTitle:          { fontSize: 20, fontWeight: FONT_WEIGHT.black, color: '#111827', letterSpacing: -0.3, textAlign: 'center', marginBottom: 6 },
  modalSub:            { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  modalStarsWrap:      { flexDirection: 'row', gap: 4, marginBottom: 14, paddingHorizontal: 8 },
  starBtn:             { padding: 8 },
  ratingLabelPill:     { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginBottom: 20, minWidth: 180, alignItems: 'center' },
  ratingLabelText:     { fontSize: 14, fontWeight: '700', color: '#9CA3AF', textAlign: 'center' },
  ratingLoadingRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  ratingLoadingText:   { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  skipBtn:             { paddingVertical: 10, paddingHorizontal: 28 },
  skipText:            { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
});