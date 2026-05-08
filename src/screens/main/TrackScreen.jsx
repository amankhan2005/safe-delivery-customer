import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, Platform, ScrollView,
  Animated, Easing, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { getOrderById } from '../../api';
import { connectSocket, subscribeRideEvents, subscribeRiderLocation } from '../../services/socketService';
import { fmtStatus, statusColor, fmtDateTime } from '../../utils/helpers';

// ─────────────────────────────────────────────
//  TOKENS
// ─────────────────────────────────────────────
const C = {
  blue:       '#1B4FD8',
  blueDark:   '#0A2F9A',
  blueMid:    '#2563EB',
  blueLight:  '#EFF6FF',
  blueFaint:  '#F0F4FF',
  green:      '#16A34A',
  greenLight: '#F0FDF4',
  red:        '#DC2626',
  redLight:   '#FEF2F2',
  amber:      '#D97706',
  white:      '#FFFFFF',
  bg:         '#F4F7FF',
  text:       '#0F172A',
  textMid:    '#374151',
  textMuted:  '#6B7280',
  textGhost:  '#9CA3AF',
  border:     '#E5E7EB',
  borderFaint:'#F1F5F9',
  surface:    '#F8FAFC',
  card:       '#FFFFFF',
};

const STEPS = [
  { key: 'searching',  label: 'Finding Rider',  icon: 'search-outline',           desc: 'Looking for an available rider' },
  { key: 'assigned',   label: 'Rider Assigned', icon: 'bicycle-outline',           desc: 'A rider accepted your order' },
  { key: 'picked_up',  label: 'Picked Up',      icon: 'cube-outline',              desc: 'Parcel collected from pickup' },
  { key: 'in_transit', label: 'In Transit',     icon: 'navigate-outline',          desc: 'Heading to drop location' },
  { key: 'delivered',  label: 'Delivered',      icon: 'checkmark-circle-outline',  desc: 'Parcel delivered successfully' },
];

const STATUS_MESSAGES = {
  'ride:rider_assigned': { text: 'Rider assigned! On the way to pickup.', type: 'success' },
  'ride:picked_up':      { text: 'Parcel picked up! Heading to drop.',    type: 'success' },
  'ride:in_transit':     { text: 'Rider is heading to drop location.',    type: 'success' },
  'ride:arrived':        { text: 'Rider arrived at drop location!',       type: 'success' },
  'ride:delivered':      { text: 'Parcel delivered successfully!',        type: 'success' },
  'ride:cancelled':      { text: 'Order was cancelled.',                  type: 'error'   },
};

// ─────────────────────────────────────────────
//  LIVE PULSE DOT
// ─────────────────────────────────────────────
function LiveDot({ color = C.green, size = 8 }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const ring  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.25, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(ring, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.timing(ring, { toValue: 0, duration: 0,    useNativeDriver: true }),
    ])).start();
  }, []);

  const ringScale   = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.45, 0.08, 0] });
  const frame = size + 6;

  return (
    <View style={{ width: frame, height: frame, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute',
        width: frame, height: frame,
        borderRadius: frame / 2,
        backgroundColor: color,
        transform: [{ scale: ringScale }],
        opacity: ringOpacity,
      }} />
      <Animated.View style={{
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ scale: pulse }],
      }} />
    </View>
  );
}

// ─────────────────────────────────────────────
//  SEARCHING RIPPLE
// ─────────────────────────────────────────────
function RippleAnimation({ color }) {
  const rings   = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const pulse   = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    rings.forEach((r, i) => {
      Animated.loop(Animated.sequence([
        Animated.delay(i * 700),
        Animated.timing(r, { toValue: 1, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(r, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ])).start();
    });
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
    Animated.loop(
      Animated.timing(dotAnim, { toValue: 3, duration: 1200, useNativeDriver: false })
    ).start();
  }, []);

  return (
    <View style={RA.root}>
      {rings.map((r, i) => {
        const scale   = r.interpolate({ inputRange: [0, 1], outputRange: [0.35, 2.9] });
        const opacity = r.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.45, 0.1, 0] });
        return (
          <Animated.View key={i} style={[RA.ring, { borderColor: color, transform: [{ scale }], opacity }]} />
        );
      })}
      <Animated.View style={[RA.iconWrap, { backgroundColor: color, transform: [{ scale: pulse }] }]}>
        <Ionicons name="bicycle-outline" size={32} color="#fff" />
      </Animated.View>
      <Text style={[RA.label, { color }]}>Searching for nearby rider</Text>
      <View style={RA.dotRow}>
        {[0, 1, 2].map(i => {
          const op = dotAnim.interpolate({
            inputRange: [i, i + 0.5, i + 1, 3],
            outputRange: [0.18, 1, 0.18, 0.18],
            extrapolate: 'clamp',
          });
          return <Animated.View key={i} style={[RA.dot, { backgroundColor: color, opacity: op }]} />;
        })}
      </View>
    </View>
  );
}

const RA = StyleSheet.create({
  root:     { alignItems: 'center', paddingVertical: 40, position: 'relative', minHeight: 230 },
  ring:     { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, top: 36 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  label:    { fontSize: 14, fontWeight: '600', marginBottom: 16, letterSpacing: 0.1 },
  dotRow:   { flexDirection: 'row', gap: 7 },
  dot:      { width: 7, height: 7, borderRadius: 3.5 },
});

// ─────────────────────────────────────────────
//  TIMELINE STEP (collapsible)
// ─────────────────────────────────────────────
function TimelineStep({ s, i, stepIndex, color, total, expanded }) {
  const slideX  = useRef(new Animated.Value(-16)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideX,  { toValue: 0, duration: 260, delay: i * 50, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 260, delay: i * 50, useNativeDriver: true }),
    ]).start();
  }, [stepIndex]);

  const done    = i < stepIndex;
  const current = i === stepIndex;
  const future  = i > stepIndex;

  // In collapsed mode, only show done steps + current + next one
  if (!expanded && future && i > stepIndex + 1) return null;

  return (
    <Animated.View style={[TS.row, { transform: [{ translateX: slideX }], opacity }]}>
      <View style={TS.left}>
        <View style={[
          TS.circle,
          done    && { backgroundColor: color, borderColor: color },
          current && { backgroundColor: color, borderColor: color, shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 },
          future  && { backgroundColor: C.surface, borderColor: C.border },
        ]}>
          {done
            ? <Ionicons name="checkmark" size={12} color="#fff" />
            : <Ionicons name={s.icon} size={12} color={current ? '#fff' : C.textGhost} />
          }
        </View>
        {i < total - 1 && (
          <View style={[TS.line, done && { backgroundColor: color }]} />
        )}
      </View>
      <View style={TS.right}>
        <Text style={[
          TS.label,
          done    && { color: C.text, fontWeight: '700' },
          current && { color: C.text, fontWeight: '700' },
          future  && { color: C.textGhost, fontWeight: '500' },
        ]}>
          {s.label}
        </Text>
        {current
          ? <View style={TS.livePillRow}>
              <View style={[TS.liveDot, { backgroundColor: color }]} />
              <Text style={[TS.livePillText, { color }]}>Now</Text>
            </View>
          : <Text style={[TS.desc, future && { color: '#D1D5DB' }]}>{s.desc}</Text>
        }
      </View>
    </Animated.View>
  );
}

const TS = StyleSheet.create({
  row:         { flexDirection: 'row', gap: 12 },
  left:        { alignItems: 'center', width: 26 },
  circle:      { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  line:        { width: 2, flex: 1, backgroundColor: C.border, marginVertical: 3, minHeight: 20 },
  right:       { flex: 1, paddingBottom: 16, paddingTop: 1 },
  label:       { fontSize: 13.5, color: C.textMuted, fontWeight: '600' },
  livePillRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  liveDot:     { width: 6, height: 6, borderRadius: 3 },
  livePillText:{ fontSize: 11, fontWeight: '700' },
  desc:        { fontSize: 12, color: C.textGhost, marginTop: 2, lineHeight: 16 },
});

// ─────────────────────────────────────────────
//  RIDER CARD
// ─────────────────────────────────────────────
function RiderCard({ rider }) {
  const slideY  = useRef(new Animated.Value(14)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, tension: 80, friction: 11, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[RC.root, { transform: [{ translateY: slideY }], opacity }]}>
      <LinearGradient colors={[C.blueDark, C.blue, C.blueMid]} style={RC.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <View style={RC.decorCircle} />
        <View style={RC.decorCircle2} />
        <View style={RC.avatar}>
          <Text style={RC.avatarText}>{rider?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
        </View>
        <View style={RC.info}>
          <Text style={RC.nameLabel}>YOUR RIDER</Text>
          <Text style={RC.name}>{rider?.name || 'Rider'}</Text>
          {rider?.vehicle?.model ? (
            <Text style={RC.vehicle}>{rider.vehicle.color} {rider.vehicle.model} · {rider.vehicle.plate}</Text>
          ) : null}
        </View>
        {rider?.rating > 0 && (
          <View style={RC.ratingBadge}>
            <Ionicons name="star" size={11} color="#FBBF24" />
            <Text style={RC.ratingText}>{rider.rating.toFixed(1)}</Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const RC = StyleSheet.create({
  root:         { borderRadius: 18, overflow: 'hidden', marginBottom: 12, shadowColor: C.blue, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 6 },
  grad:         { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 13, overflow: 'hidden' },
  decorCircle:  { position: 'absolute', right: -28, top: -28, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
  decorCircle2: { position: 'absolute', left: -18, bottom: -18, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.04)' },
  avatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText:   { fontSize: 19, fontWeight: '900', color: '#fff' },
  info:         { flex: 1 },
  nameLabel:    { fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '700', letterSpacing: 1.1, marginBottom: 2 },
  name:         { fontSize: 16, fontWeight: '800', color: '#fff' },
  vehicle:      { fontSize: 11.5, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  ratingBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  ratingText:   { fontSize: 12.5, fontWeight: '800', color: '#fff' },
});

// ─────────────────────────────────────────────
//  ETA HERO CHIP — shown when in_transit / assigned
// ─────────────────────────────────────────────
function ETAChip({ etaMinutes, color }) {
  const scale   = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, tension: 75, friction: 10, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[ETA.root, { transform: [{ scale }], opacity }]}>
      <LinearGradient colors={[color + '12', color + '06']} style={ETA.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={ETA.leftBar}>
          <View style={[ETA.accentBar, { backgroundColor: color }]} />
          <View style={ETA.textCol}>
            <Text style={[ETA.bigNum, { color }]}>{etaMinutes ?? '—'}</Text>
            <Text style={[ETA.unit, { color: color + 'BB' }]}>min away</Text>
          </View>
        </View>
        <View style={ETA.divider} />
        <View style={ETA.rightCol}>
          <Ionicons name="navigate-circle-outline" size={22} color={color} style={{ marginBottom: 2 }} />
          <Text style={[ETA.rightLabel, { color: color + 'CC' }]}>Estimated{'\n'}arrival</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const ETA = StyleSheet.create({
  root:       { borderRadius: 16, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: C.border },
  grad:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  leftBar:    { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  accentBar:  { width: 3, height: 40, borderRadius: 2 },
  textCol:    {},
  bigNum:     { fontSize: 36, fontWeight: '900', lineHeight: 40, letterSpacing: -1 },
  unit:       { fontSize: 12, fontWeight: '600', marginTop: -2 },
  divider:    { width: 1, height: 36, backgroundColor: C.border },
  rightCol:   { alignItems: 'center', paddingLeft: 4 },
  rightLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 15 },
});

// ─────────────────────────────────────────────
//  EMPTY STATE
// ─────────────────────────────────────────────
function EmptyState() {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[ES.root, { opacity: fadeIn, transform: [{ translateY: slideY }] }]}>
      <View style={ES.iconOuter}>
        <View style={ES.iconInner}>
          <Ionicons name="cube-outline" size={44} color={C.blue} />
        </View>
      </View>
      <Text style={ES.title}>Track your delivery</Text>
      <Text style={ES.sub}>Enter the order ID from your booking confirmation to see live updates</Text>
      <View style={ES.tipCard}>
        {[
          { color: C.green, text: 'Order ID shown right after booking' },
          { color: C.blue,  text: 'Find it in your Orders tab anytime' },
          { color: C.amber, text: 'IDs are uppercase letters & numbers' },
        ].map((tip, i) => (
          <View key={i} style={ES.tipRow}>
            <View style={[ES.tipDot, { backgroundColor: tip.color }]} />
            <Text style={ES.tipText}>{tip.text}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const ES = StyleSheet.create({
  root:      { alignItems: 'center', paddingTop: 40, paddingHorizontal: 16 },
  iconOuter: { width: 116, height: 116, borderRadius: 58, borderWidth: 1.5, borderColor: C.blue + '28', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  iconInner: { width: 90, height: 90, borderRadius: 45, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.4, marginBottom: 8 },
  sub:       { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  tipCard:   { backgroundColor: C.card, borderRadius: 16, padding: 16, width: '100%', gap: 12, borderWidth: 1, borderColor: C.borderFaint },
  tipRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipDot:    { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  tipText:   { fontSize: 13, color: C.textMid, fontWeight: '500', flex: 1 },
});

// ─────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────
export default function TrackScreen({ navigation }) {
  const [orderId,       setOrderId]       = useState('');
  const [order,         setOrder]         = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [isLive,        setIsLive]        = useState(false);
  const [lastUpdate,    setLastUpdate]    = useState(null);
  const [secsAgo,       setSecsAgo]       = useState(0);
  const [timelineOpen,  setTimelineOpen]  = useState(false);

  const cardSlide   = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const unsubRef    = useRef({ events: null, location: null });
  const pollRef     = useRef(null);
  const timerRef    = useRef(null);

  // Live "X seconds ago" counter
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (lastUpdate) setSecsAgo(Math.floor((Date.now() - lastUpdate.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [lastUpdate]);

  useEffect(() => {
    return () => {
      unsubRef.current.events?.();
      unsubRef.current.location?.();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const refreshOrder = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await getOrderById(id);
      const o = res?.data?.data?.order;
      if (!o) return; // guard null/304 response
      setOrder(o);
      setLastUpdate(new Date());
      setSecsAgo(0);
      if (['delivered', 'cancelled'].includes(o.status)) {
        unsubRef.current.events?.();
        unsubRef.current.location?.();
        if (pollRef.current) clearInterval(pollRef.current);
        setIsLive(false);
      }
    } catch (_) {}
  }, []);

  const startLiveTracking = useCallback(async (id) => {
    unsubRef.current.events?.();
    unsubRef.current.location?.();
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      await connectSocket();
      unsubRef.current.events = subscribeRideEvents(id, (event) => {
        const msg = STATUS_MESSAGES[event];
        if (msg) Toast.show({ type: msg.type, text1: msg.text, visibilityTime: 4000 });
        refreshOrder(id);
      });
      unsubRef.current.location = subscribeRiderLocation(id, () => refreshOrder(id));
      setIsLive(true);
    } catch (_) {
      setIsLive(false);
    }

    pollRef.current = setInterval(() => refreshOrder(id), 10000);
  }, [refreshOrder]);

  const handleTrack = async () => {
    const id = orderId.trim();
    if (!id) return Toast.show({ type: 'error', text1: 'Enter an Order ID' });

    setLoading(true);
    setTimelineOpen(false);
    try {
      const res = await getOrderById(id);
      const o = res?.data?.data?.order;
      if (!o) return; // guard null/304 response
      setOrder(o);
      setLastUpdate(new Date());
      setSecsAgo(0);

      cardSlide.setValue(40);
      cardOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(cardSlide,   { toValue: 0, tension: 60, friction: 11, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]).start();

      if (!['delivered', 'cancelled'].includes(o.status)) {
        startLiveTracking(id);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Order not found. Check the ID and try again.' });
      setOrder(null);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setOrderId('');
    setOrder(null);
    setIsLive(false);
    setLastUpdate(null);
    setTimelineOpen(false);
    unsubRef.current.events?.();
    unsubRef.current.location?.();
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const stepIndex   = order ? STEPS.findIndex(s => s.key === order.status) : -1;
  const color       = order ? statusColor(order.status) : C.blue;
  const isSearching = order?.status === 'searching';
  const isCancelled = order?.status === 'cancelled';
  const isDelivered = order?.status === 'delivered';
  const isActive    = order && !isCancelled && !isDelivered;
  const hasRider    = order?.riderId && order.status !== 'searching';
  const showETA     = isActive && !isSearching && order?.etaMinutes;

  const lastUpdatedText = lastUpdate
    ? secsAgo < 5 ? 'Just updated' : `Updated ${secsAgo}s ago`
    : null;

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDark} />

      {/* ── HEADER ── */}
      <LinearGradient
        colors={[C.blueDark, C.blue, '#3B6EF6']}
        style={S.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={S.headerOrb1} />
        <View style={S.headerOrb2} />

        <View style={S.headerTitleRow}>
          <Ionicons name="cube-outline" size={22} color="rgba(255,255,255,0.8)" />
          <Text style={S.headerTitle}>Track Order</Text>
        </View>
        <Text style={S.headerSub}>Enter your 8-digit order ID</Text>

        {/* Search card */}
        <View style={S.searchCard}>
          <View style={S.searchRow}>
            <View style={S.searchIconWrap}>
              <Ionicons name="search-outline" size={17} color={C.blue} />
            </View>
            <TextInput
              style={S.searchInput}
              placeholder="e.g. 68F8510F"
              placeholderTextColor={C.textGhost}
              value={orderId}
              onChangeText={setOrderId}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleTrack}
            />
            {orderId.length > 0 && (
              <TouchableOpacity
                onPress={handleClear}
                style={S.clearBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Clear order ID"
              >
                <Ionicons name="close-circle" size={18} color={C.textGhost} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[S.trackBtn, loading && { opacity: 0.65 }]}
            onPress={handleTrack}
            disabled={loading}
            activeOpacity={0.82}
            accessibilityLabel="Track order"
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[C.blueDark, C.blue, C.blueMid]}
              style={S.trackBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading
                ? <Text style={S.trackBtnText}>Searching…</Text>
                : <>
                    <Ionicons name="navigate" size={15} color="#fff" />
                    <Text style={S.trackBtnText}>Track</Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── CONTENT ── */}
      <ScrollView
        contentContainerStyle={S.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!order ? (
          <EmptyState />
        ) : (
          <Animated.View style={{ transform: [{ translateY: cardSlide }], opacity: cardOpacity }}>

            {/* ── ETA CHIP (priority info first) ── */}
            {showETA && <ETAChip etaMinutes={order.etaMinutes} color={color} />}

            {/* ── LIVE BANNER ── */}
            {isActive && (
              <View style={[S.liveBanner, { borderColor: color + '30', backgroundColor: color + '0A' }]}>
                <LiveDot color={color} />
                <Text style={[S.liveBannerText, { color }]}>Live tracking active</Text>
                <View style={[
                  S.statusPill,
                  isLive
                    ? { backgroundColor: C.greenLight, borderColor: '#86EFAC' }
                    : { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                ]}>
                  <View style={[S.statusPillDot, { backgroundColor: isLive ? C.green : C.amber }]} />
                  <Text style={[S.statusPillText, { color: isLive ? C.green : C.amber }]}>
                    {isLive ? 'Live' : 'Polling'}
                  </Text>
                </View>
              </View>
            )}

            {/* ── HERO CARD ── */}
            <View style={[S.heroCard, { borderTopColor: color }]}>
              <View style={S.heroTop}>
                <View style={[S.heroBadge, { backgroundColor: color + '12' }]}>
                  <View style={[S.heroBadgeDot, { backgroundColor: color }]} />
                  <Text style={[S.heroBadgeText, { color }]}>{fmtStatus(order.status)}</Text>
                </View>
                {isDelivered && <Ionicons name="checkmark-circle" size={21} color={C.green} />}
                {isCancelled && <Ionicons name="close-circle"     size={21} color={C.red}   />}
                {isActive    && <LiveDot color={color} />}
              </View>

              <Text style={S.heroOrderId}>#{order._id?.slice(-8).toUpperCase()}</Text>
              <Text style={S.heroDate}>{fmtDateTime(order.createdAt)}</Text>

              {lastUpdatedText && (
                <View style={S.lastUpdatedRow}>
                  <Ionicons name="time-outline" size={10} color={C.textGhost} />
                  <Text style={S.lastUpdatedText}>{lastUpdatedText}</Text>
                </View>
              )}

              <View style={S.routePill}>
                <View style={[S.routeDot, { backgroundColor: C.green }]} />
                <Text style={S.routeText} numberOfLines={1}>{order.pickup?.address}</Text>
              </View>
              <View style={S.routeConnector}>
                <View style={S.routeConnectorLine} />
                <Ionicons name="chevron-down" size={11} color="#CBD5E1" />
              </View>
              <View style={S.routePill}>
                <View style={[S.routeDot, { backgroundColor: C.red }]} />
                <Text style={S.routeText} numberOfLines={1}>{order.drop?.address}</Text>
              </View>
            </View>

            {/* ── RIDER CARD ── */}
            {hasRider && <RiderCard rider={order.riderId} />}

            {/* ── SEARCHING ANIMATION ── */}
            {isSearching && (
              <View style={S.card}>
                <RippleAnimation color={color} />
              </View>
            )}

            {/* ── CANCELLED CARD ── */}
            {isCancelled && (
              <View style={S.cancelledCard}>
                <View style={S.cancelledIconWrap}>
                  <Ionicons name="close-circle" size={26} color={C.red} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.cancelledTitle}>Order Cancelled</Text>
                  <Text style={S.cancelledSub}>No riders available in your area</Text>
                </View>
              </View>
            )}

            {/* Refund row (cancelled only) */}
            {isCancelled && (
              <View style={S.refundRow}>
                <Ionicons name="card-outline" size={14} color={C.textMuted} />
                <Text style={S.refundText}>Refund will reflect in </Text>
                <Text style={S.refundAmt}>3–5 business days</Text>
              </View>
            )}

            {/* ── DELIVERED CARD ── */}
            {isDelivered && (
              <LinearGradient
                colors={['#14532D', C.green]}
                style={S.deliveredCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={S.deliveredIconWrap}>
                  <Ionicons name="checkmark-circle" size={26} color="#fff" />
                </View>
                <View>
                  <Text style={S.deliveredTitle}>Delivered!</Text>
                  <Text style={S.deliveredSub}>Parcel delivered successfully</Text>
                </View>
              </LinearGradient>
            )}

            {/* ── TIMELINE (collapsible) ── */}
            {!isCancelled && (
              <View style={S.card}>
                <Pressable
                  style={S.cardHeader}
                  onPress={() => setTimelineOpen(v => !v)}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle delivery progress"
                >
                  <View style={[S.cardHeaderDot, { backgroundColor: color }]} />
                  <Text style={S.cardTitle}>Delivery Progress</Text>
                  {isActive && (
                    <View style={S.autoUpdatePill}>
                      <LiveDot color={color} size={6} />
                      <Text style={[S.autoUpdateText, { color }]}>Live</Text>
                    </View>
                  )}
                  <Ionicons
                    name={timelineOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={C.textGhost}
                    style={{ marginLeft: 'auto' }}
                  />
                </Pressable>
                {STEPS.map((s, i) => (
                  <TimelineStep
                    key={s.key}
                    s={s}
                    i={i}
                    stepIndex={stepIndex}
                    color={color}
                    total={STEPS.length}
                    expanded={timelineOpen}
                  />
                ))}
                {!timelineOpen && (
                  <TouchableOpacity
                    onPress={() => setTimelineOpen(true)}
                    style={S.expandBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[S.expandBtnText, { color }]}>View all steps</Text>
                    <Ionicons name="chevron-down" size={13} color={color} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── FARE ── */}
            <View style={S.fareCard}>
              <View style={S.fareRow}>
                <Text style={S.fareLabel}>Total Fare</Text>
                <Text style={[S.fareValue, { color: isCancelled ? C.textGhost : C.blue }]}>
                  {isCancelled
                    ? String(`$${order.fare ?? 0}`)
                    : `$${order.fare ?? 0}`
                  }
                </Text>
              </View>
              {isCancelled && (
                <>
                  <View style={S.fareDivider} />
                  <View style={S.fareRow}>
                    <Text style={S.fareLabel}>Refund</Text>
                    <Text style={[S.fareValue, { color: C.green }]}>{`$${order?.fare ?? 0}`}</Text>
                  </View>
                </>
              )}
              <View style={S.fareDivider} />
              <View style={S.fareRow}>
                <Text style={S.fareLabel}>Payment</Text>
                <View style={S.codPill}>
                  <Ionicons name="cash-outline" size={12} color={C.green} />
                  <Text style={S.codText}>Cash on Delivery</Text>
                </View>
              </View>
            </View>

            {/* ── CTA ── */}
            {!isCancelled && (
              <TouchableOpacity
                style={S.ctaBtn}
                activeOpacity={0.84}
                accessibilityRole="button"
                accessibilityLabel="View full order details"
                onPress={() =>
                  navigation.getParent()?.navigate('OrderDetail', { orderId: order._id }) ||
                  navigation.navigate('OrderDetail', { orderId: order._id })
                }
              >
                <LinearGradient
                  colors={[C.blueDark, C.blue, C.blueMid]}
                  style={S.ctaGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="document-text-outline" size={16} color="#fff" />
                  <Text style={S.ctaText}>View Full Order Details</Text>
                  <Ionicons name="arrow-forward" size={15} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              </TouchableOpacity>
            )}

            {isCancelled && (
              <TouchableOpacity
                style={[S.ctaBtn, { shadowColor: C.red }]}
                activeOpacity={0.84}
                accessibilityRole="button"
                accessibilityLabel="Place new order"
                onPress={() => {
                  handleClear();
                  try { navigation.getParent()?.navigate('Book'); } catch {}
                  try { navigation.navigate('Book'); } catch {}
                }}
              >
                <LinearGradient
                  colors={['#7F1D1D', C.red]}
                  style={S.ctaGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#fff" />
                  <Text style={S.ctaText}>Place New Order</Text>
                  <Ionicons name="arrow-forward" size={15} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              </TouchableOpacity>
            )}

          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    paddingTop:        Platform.OS === 'ios' ? 58 : 38,
    paddingBottom:     28,
    paddingHorizontal: 20,
    overflow:          'hidden',
  },
  headerOrb1: {
    position: 'absolute', top: -44, right: -44,
    width: 170, height: 170, borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerOrb2: {
    position: 'absolute', bottom: -18, left: 28,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  headerTitle:    { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  headerSub:      { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16, fontWeight: '500' },

  // Search card
  searchCard:     {
    backgroundColor: C.white, borderRadius: 16, padding: 12, gap: 10,
    shadowColor: C.blueDark, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 6,
  },
  searchRow:      { flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center' },
  searchInput:    { flex: 1, fontSize: 15, color: C.text, fontWeight: '700', letterSpacing: 1.3, paddingVertical: 4 },
  clearBtn:       { padding: 4, minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  trackBtn:       { borderRadius: 12, overflow: 'hidden' },
  trackBtnGrad:   { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  trackBtnText:   { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Content
  content: { padding: 14, paddingBottom: 120 },

  // Live banner
  liveBanner:    {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 13, paddingVertical: 9, marginBottom: 10,
  },
  liveBannerText:  { fontSize: 13, fontWeight: '600', flex: 1 },
  statusPill:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1 },
  statusPillDot:   { width: 5, height: 5, borderRadius: 2.5 },
  statusPillText:  { fontSize: 11, fontWeight: '700' },

  // Hero card
  heroCard:     {
    backgroundColor: C.card, borderRadius: 20, padding: 17,
    borderTopWidth: 4, marginBottom: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  heroTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  heroBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  heroBadgeDot: { width: 5, height: 5, borderRadius: 2.5 },
  heroBadgeText:{ fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroOrderId:  { fontSize: 27, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginBottom: 2 },
  heroDate:     { fontSize: 12, color: C.textGhost, fontWeight: '500', marginBottom: 8 },
  lastUpdatedRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 13 },
  lastUpdatedText:{ fontSize: 11, color: C.textGhost, fontWeight: '500' },

  // Route
  routePill:          { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: 10, padding: 9 },
  routeDot:           { width: 9, height: 9, borderRadius: 4.5, flexShrink: 0 },
  routeText:          { fontSize: 13, color: C.textMid, fontWeight: '600', flex: 1 },
  routeConnector:     { alignItems: 'center', paddingVertical: 2 },
  routeConnectorLine: { width: 2, height: 8, backgroundColor: C.border },

  // Card
  card:           {
    backgroundColor: C.card, borderRadius: 17, padding: 15, marginBottom: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18, minHeight: 44 },
  cardHeaderDot:  { width: 7, height: 7, borderRadius: 3.5 },
  cardTitle:      { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  autoUpdatePill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
  autoUpdateText: { fontSize: 10.5, fontWeight: '700' },
  expandBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 4, paddingVertical: 8, marginTop: -4 },
  expandBtnText:  { fontSize: 12.5, fontWeight: '700' },

  // Status cards
  cancelledCard: {
    backgroundColor: C.redLight, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#FECACA',
  },
  cancelledIconWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  cancelledTitle: { fontSize: 15.5, fontWeight: '800', color: C.red },
  cancelledSub:   { fontSize: 12.5, color: '#EF4444', marginTop: 2 },

  refundRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surface, borderRadius: 10, padding: 10,
    marginBottom: 11, borderWidth: 1, borderColor: C.borderFaint,
  },
  refundText: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
  refundAmt:  { fontSize: 13, fontWeight: '700', color: C.text },

  deliveredCard: {
    borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 11,
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4,
  },
  deliveredIconWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  deliveredTitle: { fontSize: 17, fontWeight: '900', color: '#fff' },
  deliveredSub:   { fontSize: 12.5, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  // Fare card
  fareCard:    {
    backgroundColor: C.card, borderRadius: 17, padding: 15, marginBottom: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  fareRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareDivider: { height: 1, backgroundColor: C.borderFaint, marginVertical: 10 },
  fareLabel:   { fontSize: 13.5, color: C.textMuted, fontWeight: '600' },
  fareValue:   { fontSize: 15.5, fontWeight: '900' }, // safe
  promoSaved:  { fontSize: 12, color: C.green, fontWeight: '600' },
  codPill:     {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.greenLight, paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, borderColor: '#86EFAC',
  },
  codText: { fontSize: 12, fontWeight: '700', color: C.green },

  // CTA
  ctaBtn: {
    borderRadius: 15, overflow: 'hidden', marginBottom: 12,
    shadowColor: C.blue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 5,
  },
  ctaGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, gap: 9 },
  ctaText: { fontSize: 14.5, fontWeight: '800', color: '#fff', flex: 1, textAlign: 'center' },
});