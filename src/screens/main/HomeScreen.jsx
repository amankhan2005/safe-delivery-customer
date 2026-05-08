import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, StatusBar, FlatList, Platform,
  Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMyOrders } from '../../api';
import useAuthStore from '../../store/authStore';
import useLocation from '../../hooks/useLocation';
import { fmtCurrency, fmtAgo } from '../../utils/helpers';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────
const HERO_SLIDES = [
  {
    id: '1',
    title: 'Fast, Secure &',
    titleRed: 'Reliable Delivery',
    sub: 'We deliver your parcels safely to your doorstep.',
    bg: ['#EEF3FF', '#DBEAFE'],
    btnColor: COLORS.primary,
  },
  {
    id: '2',
    title: 'Track Your',
    titleRed: 'Delivery Live',
    sub: 'Real-time updates from pickup to drop.',
    bg: ['#FEE8E9', '#FFF0F0'],
    btnColor: COLORS.red,
  },
  {
    id: '3',
    title: 'Cash On',
    titleRed: 'Delivery',
    sub: 'Pay only when your parcel arrives safely.',
    bg: ['#DCFCE7', '#BBF7D0'],
    btnColor: COLORS.green,
  },
];

const QUICK_ACTIONS = [
  { icon: 'cube-outline',    label: 'Send Parcel',   bg: '#EEF3FF', color: COLORS.primary, tab: 'Book' },
  { icon: 'navigate-outline',label: 'Track Order',   bg: '#FEE8E9', color: COLORS.red,     tab: 'Track' },
  { icon: 'time-outline',    label: 'Order History', bg: '#DCFCE7', color: COLORS.green,   tab: 'Orders' },
  { icon: 'headset-outline', label: 'Support',       bg: '#F3E8FF', color: '#7C3AED',      tab: 'Profile' },
];

const SERVICES = [
  {
    icon: 'flash-outline',
    name: 'Express Delivery',
    desc: 'Lightning-fast delivery across Liberia. Your parcel, delivered in hours.',
    color: COLORS.primary,
    bg: '#EEF3FF',
    accent: ['#4F8EF7', '#1B4FD8'],
    tag: 'Most Popular',
  },
  {
    icon: 'shield-checkmark-outline',
    name: 'Secure Delivery',
    desc: 'Every parcel is insured and handled with care. 100% safety guaranteed.',
    color: COLORS.red,
    bg: '#FEE8E9',
    accent: ['#F87171', '#DC2626'],
    tag: 'Insured',
  },
  {
    icon: 'cash-outline',
    name: 'Cash on Delivery',
    desc: 'No upfront payment needed. Pay only when your parcel arrives safely.',
    color: COLORS.green,
    bg: '#DCFCE7',
    accent: ['#4ADE80', '#16A34A'],
    tag: 'Zero Hassle',
  },
];

const STATUS_BADGE = {
  delivered:  { bg: '#DCFCE7', color: '#16A34A', label: 'Delivered' },
  searching:  { bg: '#FEF3C7', color: '#D97706', label: 'Searching' },
  assigned:   { bg: '#DBEAFE', color: '#1B4FD8', label: 'Assigned' },
  in_transit: { bg: '#EDE9FE', color: '#7C3AED', label: 'On the Way' },
  picked_up:  { bg: '#CFFAFE', color: '#0E7490', label: 'Picked Up' },
  cancelled:  { bg: '#FEE2E2', color: '#DC2626', label: 'Cancelled' },
};

// ─────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { address: currentAddress } = useLocation();
  const insets = useSafeAreaInsets();

  const [heroIdx, setHeroIdx]             = useState(0);
  const [orders, setOrders]               = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif]         = useState(false);

  const heroRef  = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Fetch data ──────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    // Orders
    getMyOrders()
      .then((r) => {
        const raw = r?.data?.data?.orders;
        setOrders(Array.isArray(raw) ? raw.slice(0, 3) : []);
      })
      .catch(() => setOrders([]));

    // Real notifications
    fetchNotifications();

    // Hero auto-scroll
    const t = setInterval(() => {
      setHeroIdx((i) => {
        const next = (i + 1) % HERO_SLIDES.length;
        heroRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('https://safe-delivery-backend.onrender.com/api/notifications', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      // Triple-safe: handle array, { data: [] }, { notifications: [] }, or anything else
      let list = [];
      if (Array.isArray(json))                        list = json;
      else if (Array.isArray(json?.data))             list = json.data;
      else if (Array.isArray(json?.notifications))    list = json.notifications;
      else if (Array.isArray(json?.data?.notifications)) list = json.data.notifications;
      setNotifications(list);
    } catch {
      setNotifications([]);  // Always fall back to empty array — NEVER undefined
    }
  };

  const unreadCount = Array.isArray(notifications) ? notifications.filter((n) => !n.read && !n.isRead).length : 0;
  const slide = HERO_SLIDES[heroIdx];

  // ── Notification Panel ───────────────────────
  const NotificationPanel = () => (
    <View style={styles.notifPanel}>
      <View style={styles.notifPanelHeader}>
        <Text style={styles.notifPanelTitle}>Notifications</Text>
        <TouchableOpacity onPress={() => setShowNotif(false)}>
          <Ionicons name="close" size={22} color={COLORS.gray700} />
        </TouchableOpacity>
      </View>
      {(Array.isArray(notifications) ? notifications : []).length === 0 ? (
        <View style={styles.notifEmpty}>
          <Ionicons name="notifications-off-outline" size={36} color={COLORS.gray300} />
          <Text style={styles.notifEmptyText}>No notifications</Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
          {(Array.isArray(notifications) ? notifications : []).map((n, i) => {
            const read = n.read || n.isRead;
            return (
              <View key={n._id || i} style={[styles.notifItem, !read && styles.notifItemUnread]}>
                <View style={[styles.notifDot, { backgroundColor: read ? COLORS.gray200 : COLORS.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifMsg, !read && { fontWeight: FONT_WEIGHT.bold, color: COLORS.gray900 }]}>
                    {n.message || n.title || 'New notification'}
                  </Text>
                  {n.createdAt && (
                    <Text style={styles.notifTime}>{fmtAgo(n.createdAt)}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  // ── Render ───────────────────────────────────
  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ── HEADER: Logo centered, notification right ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {/* Left spacer (balances notification button) */}
        <View style={styles.headerSpacer} />

        {/* Centered Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoIconBox}>
            <Ionicons name="cube" size={18} color={COLORS.white} />
          </View>
          <View>
            <Text style={styles.logoName}>
              SAFE <Text style={{ color: COLORS.red }}>DELIVERY</Text>
            </Text>
            <Text style={styles.logoTag}>FAST. SECURE. TRUSTED.</Text>
          </View>
        </View>

        {/* Notification button */}
        <TouchableOpacity
          style={styles.notifBtn}
          activeOpacity={0.7}
          onPress={() => setShowNotif((v) => !v)}
        >
          <Ionicons name="notifications-outline" size={22} color={COLORS.gray700} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifCount}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Notification dropdown panel */}
      {showNotif && <NotificationPanel />}

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>

        {/* ── LOCATION BAR ── */}
        <View style={styles.locationBar}>
          <View style={styles.locationLeft}>
            <View style={styles.locationIcon}>
              <Ionicons name="location" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.deliverTo}>Deliver to</Text>
              <View style={styles.cityRow}>
                <Text style={styles.city}>{currentAddress || 'Monrovia, Liberia'}</Text>
                <Ionicons name="chevron-down" size={14} color={COLORS.gray500} />
              </View>
              <View style={styles.currentRow}>
                <Ionicons name="radio-button-on-outline" size={11} color={COLORS.primary} />
                <Text style={styles.currentText}>Current Location</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.changeBtn}>
            <Ionicons name="radio-button-on-outline" size={13} color={COLORS.primary} />
            <Text style={styles.changeBtnText}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* ── HERO CAROUSEL ── */}
        <FlatList
          ref={heroRef}
          data={HERO_SLIDES}
          horizontal pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(i) => i.id}
          onMomentumScrollEnd={(e) =>
            setHeroIdx(Math.round(e.nativeEvent.contentOffset.x / (width - 32)))
          }
          style={styles.heroList}
          renderItem={({ item }) => (
            <LinearGradient
              colors={item.bg}
              style={styles.heroCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>{item.title}</Text>
                <Text style={[styles.heroTitleRed, { color: item.btnColor }]}>{item.titleRed}</Text>
                <Text style={styles.heroSub}>{item.sub}</Text>
                <TouchableOpacity
                  style={[styles.heroBtn, { backgroundColor: item.btnColor }]}
                  onPress={() => navigation.navigate('Book')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.heroBtnText}>Book a Delivery</Text>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
                </TouchableOpacity>
              </View>
              <View style={styles.heroImg}>
                <Image
                  source={require('../../../assets/rider.png')}
                  style={styles.heroImage}
                  resizeMode="contain"
                />
              </View>
            </LinearGradient>
          )}
        />
        {/* Dots */}
        <View style={styles.heroDots}>
          {HERO_SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === heroIdx && styles.dotActive]} />
          ))}
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.qaCard}>
          {QUICK_ACTIONS.map((q, i) => (
            <TouchableOpacity
              key={i}
              style={styles.qaItem}
              onPress={() => navigation.navigate(q.tab)}
              activeOpacity={0.75}
            >
              <View style={[styles.qaIcon, { backgroundColor: q.bg }]}>
                <Ionicons name={q.icon} size={26} color={q.color} />
              </View>
              <Text style={styles.qaLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── OUR SERVICES ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Our Services</Text>
        </View>

        <View style={styles.servicesStack}>
          {SERVICES.map((s, i) => (
            <TouchableOpacity key={i} style={styles.serviceCard} activeOpacity={0.82}>
              {/* Left gradient accent bar */}
              <LinearGradient
                colors={s.accent}
                style={styles.serviceAccentBar}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              />

              {/* Icon box */}
              <View style={[styles.serviceIconBox, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={26} color={s.color} />
              </View>

              {/* Text */}
              <View style={styles.serviceTextWrap}>
                <View style={styles.serviceNameRow}>
                  <Text style={styles.serviceName}>{s.name}</Text>
                  <View style={[styles.serviceTag, { backgroundColor: s.bg }]}>
                    <Text style={[styles.serviceTagText, { color: s.color }]}>{s.tag}</Text>
                  </View>
                </View>
                <Text style={styles.serviceDesc}>{s.desc}</Text>
              </View>

              {/* Arrow */}
              {/* <View style={[styles.serviceArrowBox, { backgroundColor: s.bg }]}>
                <Ionicons name="arrow-forward" size={16} color={s.color} />
              </View> */}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── RECENT ORDERS ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {orders.length === 0 ? (
          <View style={styles.emptyOrders}>
            <Ionicons name="cube-outline" size={32} color={COLORS.gray300} />
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        ) : (
          orders.map((o) => {
            const b = STATUS_BADGE[o.status] || { bg: '#F3F4F6', color: '#6B7280', label: o.status };
            return (
              <TouchableOpacity
                key={o._id}
                style={styles.orderCard}
                onPress={() => navigation.navigate('OrderDetail', { orderId: o._id })}
                activeOpacity={0.8}
              >
                <View style={[styles.orderIcon, { backgroundColor: b.bg }]}>
                  <Ionicons name="cube-outline" size={22} color={b.color} />
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderId}>#{o._id?.slice(-7).toUpperCase()}</Text>
                  <Text style={styles.orderAddr} numberOfLines={1}>
                    Deliver to {o.drop?.address}
                  </Text>
                  <Text style={styles.orderTime}>{fmtAgo(o.createdAt)}</Text>
                </View>
                <View style={styles.orderRight}>
                  <View style={[styles.orderBadge, { backgroundColor: b.bg }]}>
                    <Text style={[styles.orderBadgeText, { color: b.color }]}>{b.label}</Text>
                  </View>
                  <Text style={styles.orderFare}>{fmtCurrency(o.fare)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────
const CARD_W = width - 32;

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },

  // ── Header ──────────────────────────────────
  header: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.lg,
    paddingBottom: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  // Spacer mirrors the notification button width so logo stays truly centered
  headerSpacer: { width: 38 },

  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  logoName: {
    fontSize: 14, fontWeight: FONT_WEIGHT.black,
    color: COLORS.primary, letterSpacing: 0.5,
  },
  logoTag: {
    fontSize: 7, fontWeight: FONT_WEIGHT.bold,
    color: COLORS.red, letterSpacing: 1.5, marginTop: 1,
  },

  // Notification button
  notifBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.gray50,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: COLORS.red,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
    paddingHorizontal: 2,
  },
  notifCount: { fontSize: 8, fontWeight: FONT_WEIGHT.black, color: COLORS.white },

  // Notification panel
  notifPanel: {
    position: 'absolute', top: Platform.OS === 'ios' ? 100 : 72,
    right: SIZES.lg, left: SIZES.lg,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLg,
    zIndex: 999,
    ...SHADOWS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  notifPanelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SIZES.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  notifPanelTitle: {
    fontSize: SIZES.fontLg, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900,
  },
  notifItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: SIZES.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  notifItemUnread: { backgroundColor: '#F5F8FF' },
  notifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  notifMsg:  { fontSize: SIZES.fontSm, color: COLORS.gray600, fontWeight: FONT_WEIGHT.medium, lineHeight: 20 },
  notifTime: { fontSize: SIZES.fontXs, color: COLORS.gray400, marginTop: 3 },
  notifEmpty: { alignItems: 'center', gap: 8, paddingVertical: SIZES.xxl },
  notifEmptyText: { fontSize: SIZES.fontMd, color: COLORS.gray400, fontWeight: FONT_WEIGHT.medium },

  // ── Location ─────────────────────────────────
  locationBar: {
    backgroundColor: COLORS.white,
    margin: SIZES.lg, marginBottom: SIZES.md,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  locationLeft:  { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  locationIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  deliverTo:   { fontSize: SIZES.fontXs, color: COLORS.gray400, fontWeight: FONT_WEIGHT.medium },
  cityRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  city:        { fontSize: SIZES.fontLg, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900 },
  currentRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  currentText: { fontSize: SIZES.fontXs, color: COLORS.primary, fontWeight: FONT_WEIGHT.semibold },
  changeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: SIZES.radiusSm, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: COLORS.primaryLight,
  },
  changeBtnText: { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },

  // ── Hero ─────────────────────────────────────
  heroList: { marginHorizontal: SIZES.lg },
  heroCard: {
    width: CARD_W, borderRadius: SIZES.radiusXl,
    padding: SIZES.xl, paddingRight: 0,
    flexDirection: 'row', alignItems: 'stretch',
    overflow: 'hidden', minHeight: 190,
  },
  heroContent:  { flex: 1, paddingRight: SIZES.sm },
  heroTitle:    { fontSize: 20, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900, lineHeight: 26 },
  heroTitleRed: { fontSize: 20, fontWeight: FONT_WEIGHT.black, lineHeight: 26, marginBottom: 8 },
  heroSub:      { fontSize: SIZES.fontSm, color: COLORS.gray600, fontWeight: FONT_WEIGHT.medium, lineHeight: 20, marginBottom: SIZES.lg },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 11, paddingHorizontal: SIZES.lg,
    borderRadius: SIZES.radiusMd, alignSelf: 'flex-start',
    ...SHADOWS.md,
  },
  heroBtnText: { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black, color: COLORS.white },
  heroImg:     { width: 160, height: '100%', justifyContent: 'flex-end', alignItems: 'flex-end' },
  heroImage:   { width: 180, height: '100%' },
  heroDots:    { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: SIZES.sm, marginBottom: SIZES.md },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.gray200 },
  dotActive:   { width: 18, backgroundColor: COLORS.primary },

  // ── Quick Actions ────────────────────────────
  qaCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.lg, marginBottom: SIZES.lg,
    borderRadius: SIZES.radiusLg, padding: SIZES.lg,
    flexDirection: 'row', justifyContent: 'space-around',
    ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  qaItem:  { alignItems: 'center', gap: 8 },
  qaIcon: {
    width: 56, height: 56, borderRadius: SIZES.radiusMd,
    alignItems: 'center', justifyContent: 'center',
  },
  qaLabel: { fontSize: 11, fontWeight: FONT_WEIGHT.bold, color: COLORS.gray800, textAlign: 'center' },

  // ── Section headers ──────────────────────────
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SIZES.lg, marginBottom: SIZES.md,
  },
  sectionTitle: { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900, letterSpacing: -0.3 },
  sectionLink:  { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },

  // ── Services (stacked full-width cards) ──────
  servicesStack: {
    paddingHorizontal: SIZES.lg,
    gap: SIZES.md,
    marginBottom: SIZES.xl,
  },
  serviceCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLg,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.sm,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: SIZES.md,
    paddingRight: SIZES.md,
  },
  // Left colored accent bar
  serviceAccentBar: {
    width: 5,
    alignSelf: 'stretch',
    marginRight: SIZES.md,
    borderTopLeftRadius: SIZES.radiusLg,
    borderBottomLeftRadius: SIZES.radiusLg,
  },
  serviceIconBox: {
    width: 52, height: 52, borderRadius: SIZES.radiusMd,
    alignItems: 'center', justifyContent: 'center',
    marginRight: SIZES.md, flexShrink: 0,
  },
  serviceTextWrap: { flex: 1 },
  serviceNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap',
  },
  serviceName: {
    fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900,
  },
  serviceTag: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: SIZES.radiusFull,
  },
  serviceTagText: {
    fontSize: 9, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.3,
  },
  serviceDesc: {
    fontSize: SIZES.fontXs, color: COLORS.gray500,
    fontWeight: FONT_WEIGHT.medium, lineHeight: 17,
  },
  serviceArrowBox: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: SIZES.sm, flexShrink: 0,
  },

  // ── Orders ───────────────────────────────────
  orderCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.lg, marginBottom: SIZES.sm,
    borderRadius: SIZES.radiusLg, padding: SIZES.md,
    flexDirection: 'row', alignItems: 'center', gap: SIZES.md,
    ...SHADOWS.xs, borderWidth: 1, borderColor: COLORS.border,
  },
  orderIcon: {
    width: 48, height: 48, borderRadius: SIZES.radiusMd,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  orderInfo:      { flex: 1, minWidth: 0 },
  orderId:        { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900 },
  orderAddr:      { fontSize: SIZES.fontSm, color: COLORS.gray500, fontWeight: FONT_WEIGHT.medium, marginTop: 2 },
  orderTime:      { fontSize: SIZES.fontXs, color: COLORS.gray400, marginTop: 2 },
  orderRight:     { alignItems: 'flex-end', gap: 6 },
  orderBadge:     { paddingHorizontal: 9, paddingVertical: 4, borderRadius: SIZES.radiusFull },
  orderBadgeText: { fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.bold },
  orderFare:      { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900 },
  emptyOrders:    { alignItems: 'center', gap: 6, padding: SIZES.xxl },
  emptyText:      { fontSize: SIZES.fontMd, color: COLORS.gray400, fontWeight: FONT_WEIGHT.medium },
});