import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, Platform,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { calculateFare, createOrder } from '../../api';
import useAuthStore from '../../store/authStore';
import useLocation from '../../hooks/useLocation';
import { fmtCurrency } from '../../utils/helpers';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';

const PARCEL_TYPES = [
  {
    id: 'doc',
    label: 'Documents',
    sub: 'Papers & files',
    icon: 'document-text-outline',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
  {
    id: 'small',
    label: 'Small Box',
    sub: 'Up to 5 kg',
    icon: 'cube-outline',
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
  },
  {
    id: 'large',
    label: 'Large Box',
    sub: 'Up to 20 kg',
    icon: 'archive-outline',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  {
    id: 'frag',
    label: 'Fragile',
    sub: 'Handle with care',
    icon: 'flower-outline',
    color: '#DB2777',
    bg: '#FDF2F8',
    border: '#FBCFE8',
  },
];

// Static prohibited items — purely visual, no logic
const PROHIBITED_ITEMS = [
  { icon: 'cut-outline',          label: 'Blades & Knives'  },
  { icon: 'alert-circle-outline', label: 'Hazardous Items'  },
  { icon: 'flame-outline',        label: 'Flammable Goods'  },
  { icon: 'skull-outline',        label: 'Toxic Substances' },
];

export default function BookScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);
  const { location: currentLocation, address: currentAddress } = useLocation();
  const [step,        setStep]        = useState(1);
  const [parcelType,  setParcelType]  = useState('small');
  const [form, setForm] = useState({
    pickupAddress: '', pickupContact: '', pickupPhone: '',
    dropAddress:   '', dropContact:   '', dropPhone:   '',
    notes: '', promoCode: '',
  });
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropCoords,   setDropCoords]   = useState(null);
  const [fare,        setFare]        = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [ordering,    setOrdering]    = useState(false);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const PICKUP = pickupCoords || currentLocation || { lat: 6.3005, lng: -10.7969 };
  const DROP   = dropCoords   || { lat: 6.3500, lng: -10.8200 };

  React.useEffect(() => {
    if (currentAddress && !form.pickupAddress) {
      setForm(f => ({ ...f, pickupAddress: currentAddress }));
    }
  }, [currentAddress]);

  const handleCalc = async () => {
    if (!form.pickupAddress.trim() || !form.dropAddress.trim()) {
      return Toast.show({ type: 'error', text1: 'Enter pickup & drop addresses' });
    }
    setCalculating(true);
    try {
      const res = await calculateFare({
        pickupLat: PICKUP.lat, pickupLng: PICKUP.lng,
        dropLat: DROP.lat, dropLng: DROP.lng,
        promoCode: form.promoCode || undefined,
      });
      setFare(res.data.data);
      setStep(2);
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.error || 'Could not calculate fare' });
    } finally { setCalculating(false); }
  };

  const handleOrder = async () => {
    setOrdering(true);
    try {
      const res = await createOrder({
        pickup: {
          address: form.pickupAddress, lat: PICKUP.lat, lng: PICKUP.lng,
          contactName: form.pickupContact || user?.name,
          contactPhone: form.pickupPhone  || user?.phone,
        },
        drop: {
          address: form.dropAddress, lat: DROP.lat, lng: DROP.lng,
          contactName: form.dropContact, contactPhone: form.dropPhone,
        },
        notes: form.notes, promoCode: form.promoCode || undefined,
      });
      Toast.show({ type: 'success', text1: 'Order Placed!', text2: 'Finding your rider...' });
      navigation.getParent()?.navigate('OrderDetail', { orderId: res.data.data.orderId }) || navigation.navigate('OrderDetail', { orderId: res.data.data.orderId });
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.error || 'Failed' });
    } finally { setOrdering(false); }
  };

  const activeParcel = PARCEL_TYPES.find(p => p.id === parcelType);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <LinearGradient colors={['#0A2F9A', '#1B4FD8']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Book Delivery</Text>
            <Text style={styles.headerSub}>Fast & reliable courier</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Step indicator */}
        <View style={styles.steps}>
          {['Route', 'Details', 'Confirm'].map((s, i) => (
            <React.Fragment key={s}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, i < step && styles.stepDotDone, i === step - 1 && styles.stepDotActive]}>
                  {i < step - 1
                    ? <Ionicons name="checkmark" size={12} color={COLORS.white} />
                    : <Text style={styles.stepNum}>{i + 1}</Text>
                  }
                </View>
                <Text style={[styles.stepLabel, i === step - 1 && styles.stepLabelActive]}>{s}</Text>
              </View>
              {i < 2 && <View style={[styles.stepLine, i < step - 1 && styles.stepLineDone]} />}
            </React.Fragment>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {step === 1 && (
          <>
            {/* ── Route Card ── */}
            <View style={styles.card}>
              <View style={styles.sectionLabel}>
                <View style={styles.sectionLabelBar} />
                <Text style={styles.sectionLabelText}>Delivery Route</Text>
              </View>

              <View style={styles.routeBox}>
                {/* Pickup */}
                <View style={styles.routeRow}>
                  <View style={styles.routeIndicatorCol}>
                    <View style={[styles.routePulse, { borderColor: '#22C55E' }]}>
                      <View style={[styles.routeDot, { backgroundColor: '#22C55E' }]} />
                    </View>
                    <View style={styles.routeVLine} />
                  </View>
                  <View style={styles.routeField}>
                    <Text style={styles.routeTag}>PICKUP</Text>
                    <TextInput
                      style={styles.routeInput}
                      placeholder="Enter pickup address"
                      placeholderTextColor={COLORS.gray400}
                      value={form.pickupAddress}
                      onChangeText={set('pickupAddress')}
                    />
                  </View>
                  <View style={styles.routeIconBtn}>
                    <Ionicons name="locate-outline" size={16} color={COLORS.primary} />
                  </View>
                </View>

                <View style={styles.routeDivider} />

                {/* Drop */}
                <View style={styles.routeRow}>
                  <View style={styles.routeIndicatorCol}>
                    <View style={[styles.routePulse, { borderColor: '#EF4444' }]}>
                      <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
                    </View>
                  </View>
                  <View style={styles.routeField}>
                    <Text style={styles.routeTag}>DROP-OFF</Text>
                    <TextInput
                      style={styles.routeInput}
                      placeholder="Enter drop address"
                      placeholderTextColor={COLORS.gray400}
                      value={form.dropAddress}
                      onChangeText={set('dropAddress')}
                    />
                  </View>
                  <View style={styles.routeIconBtn}>
                    <Ionicons name="search-outline" size={16} color={COLORS.primary} />
                  </View>
                </View>
              </View>
            </View>

            {/* ── Parcel Type Card ── */}
            <View style={styles.card}>
              <View style={styles.sectionLabel}>
                <View style={styles.sectionLabelBar} />
                <Text style={styles.sectionLabelText}>What are you sending?</Text>
              </View>

              <View style={styles.parcelGrid}>
                {PARCEL_TYPES.map(p => {
                  const isActive = parcelType === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.parcelCard,
                        {
                          borderColor: isActive ? p.color : '#E5E7EB',
                          backgroundColor: isActive ? p.bg : COLORS.white,
                          borderWidth: isActive ? 2 : 1.5,
                        },
                      ]}
                      onPress={() => setParcelType(p.id)}
                      activeOpacity={0.75}
                    >
                      {isActive && (
                        <View style={[styles.parcelCheck, { backgroundColor: p.color }]}>
                          <Ionicons name="checkmark" size={9} color="#fff" />
                        </View>
                      )}
                      <View style={[
                        styles.parcelIconWrap,
                        { backgroundColor: isActive ? p.color : p.bg, borderColor: isActive ? p.color : p.border },
                      ]}>
                        <Ionicons name={p.icon} size={22} color={isActive ? '#fff' : p.color} />
                      </View>
                      <Text style={[styles.parcelCardLabel, { color: isActive ? p.color : COLORS.gray800 }]}>
                        {p.label}
                      </Text>
                      <Text style={[styles.parcelCardSub, { color: isActive ? p.color + 'BB' : COLORS.gray400 }]}>
                        {p.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {activeParcel && (
                <View style={[styles.selectedSummary, { backgroundColor: activeParcel.bg, borderColor: activeParcel.border }]}>
                  <Ionicons name={activeParcel.icon} size={14} color={activeParcel.color} />
                  <Text style={[styles.selectedSummaryText, { color: activeParcel.color }]}>
                    {activeParcel.label} selected — {activeParcel.sub}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Prohibited Items Notice (purely visual) ── */}
            <View style={styles.prohibitedCard}>
              <View style={styles.prohibitedHeader}>
                <View style={styles.prohibitedHeaderLeft}>
                  <View style={styles.prohibitedIconHeader}>
                    <Ionicons name="ban-outline" size={14} color="#C0392B" />
                  </View>
                  <Text style={styles.prohibitedTitle}>Prohibited Items</Text>
                </View>
                <View style={styles.prohibitedPolicyBadge}>
                  <Text style={styles.prohibitedPolicyText}>Carrier Policy</Text>
                </View>
              </View>

              <View style={styles.prohibitedDivider} />

              <View style={styles.prohibitedGrid}>
                {PROHIBITED_ITEMS.map((item) => (
                  <View key={item.icon} style={styles.prohibitedItem}>
                    <View style={styles.prohibitedItemIcon}>
                      <Ionicons name={item.icon} size={17} color="#C0392B" />
                      <View style={styles.prohibitedSlash} pointerEvents="none">
                        <View style={styles.prohibitedSlashLine} />
                      </View>
                    </View>
                    <Text style={styles.prohibitedItemLabel} numberOfLines={2}>{item.label}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.prohibitedNoteRow}>
                <Ionicons name="information-circle-outline" size={13} color="#7F8C8D" />
                <Text style={styles.prohibitedNote}>
                  Weapons, knives, and hazardous items are strictly not permitted for delivery.
                </Text>
              </View>
            </View>

            {/* ── Promo Code ── */}
            <View style={styles.card}>
              <View style={styles.sectionLabel}>
                <View style={styles.sectionLabelBar} />
                <Text style={styles.sectionLabelText}>Promo Code</Text>
              </View>
              <Input
                placeholder="Enter promo code (optional)"
                value={form.promoCode}
                onChangeText={set('promoCode')}
                leftIcon={<Ionicons name="pricetag-outline" size={16} color={COLORS.gray400} />}
              />
            </View>

            <Button
              title="Get Fare Estimate"
              onPress={handleCalc}
              loading={calculating}
              size="lg"
              style={{ marginHorizontal: SIZES.lg }}
              iconRight={<Ionicons name="arrow-forward" size={18} color={COLORS.white} />}
            />
          </>
        )}

        {step === 2 && (
          <>
            {/* Fare card */}
            <LinearGradient colors={['#0F3BAF', '#1B4FD8', '#2563EB']} style={styles.fareCard}>
              <View style={styles.fareInner}>
                <View>
                  <Text style={styles.fareCardLabel}>Total Fare</Text>
                  <Text style={styles.fareCardAmt}>{fmtCurrency(fare?.totalFare)}</Text>
                  <View style={styles.fareRow}>
                    <View style={styles.fareMetaChip}>
                      <Ionicons name="navigate-outline" size={12} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.fareItem}>{fare?.distanceMiles} miles</Text>
                    </View>
                    {fare?.discount > 0 && (
                      <View style={styles.discountBadge}>
                        <Ionicons name="pricetag-outline" size={11} color="#fff" />
                        <Text style={styles.discountText}>-{fmtCurrency(fare.discount)} off</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.fareIcon}>
                  <Ionicons name="receipt-outline" size={40} color="rgba(255,255,255,0.15)" />
                </View>
              </View>
            </LinearGradient>

            {/* Sender */}
            <View style={styles.card}>
              <View style={styles.sectionLabel}>
                <View style={[styles.sectionLabelBar, { backgroundColor: '#22C55E' }]} />
                <Text style={styles.sectionLabelText}>Sender Details</Text>
              </View>
              <Input placeholder="Sender name"  value={form.pickupContact} onChangeText={set('pickupContact')} leftIcon={<Ionicons name="person-outline" size={16} color={COLORS.gray400} />} />
              <Input placeholder="Sender phone" value={form.pickupPhone}   onChangeText={set('pickupPhone')}   keyboardType="phone-pad" leftIcon={<Ionicons name="call-outline" size={16} color={COLORS.gray400} />} />
            </View>

            {/* Receiver */}
            <View style={styles.card}>
              <View style={styles.sectionLabel}>
                <View style={[styles.sectionLabelBar, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.sectionLabelText}>Receiver Details</Text>
              </View>
              <Input placeholder="Receiver name"    value={form.dropContact} onChangeText={set('dropContact')} leftIcon={<Ionicons name="person-outline" size={16} color={COLORS.gray400} />} />
              <Input placeholder="Receiver phone"   value={form.dropPhone}   onChangeText={set('dropPhone')}   keyboardType="phone-pad" leftIcon={<Ionicons name="call-outline" size={16} color={COLORS.gray400} />} />
              <Input placeholder="Notes (optional)" value={form.notes}       onChangeText={set('notes')}       leftIcon={<Ionicons name="chatbubble-outline" size={16} color={COLORS.gray400} />} />
            </View>

            {/* Pay method */}
            <View style={styles.payCard}>
              <View style={styles.payIconWrap}>
                <Ionicons name="cash-outline" size={22} color={COLORS.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payTitle}>Cash on Delivery</Text>
                <Text style={styles.paySub}>Pay {fmtCurrency(fare?.totalFare)} when parcel is delivered</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.green} />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.editBtn} onPress={() => setStep(1)}>
                <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <Button
                title={`Place Order • ${fmtCurrency(fare?.totalFare)}`}
                onPress={handleOrder}
                loading={ordering}
                size="lg"
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}

        <View style={{ height: SIZES.huge }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#F4F6FB' },
  header:       { paddingTop: Platform.OS === 'ios' ? 52 : SIZES.xl, paddingBottom: SIZES.xl, paddingHorizontal: SIZES.xl },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.lg },
  headerCenter: { alignItems: 'center' },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: COLORS.white, letterSpacing: -0.3 },
  headerSub:    { fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: FONT_WEIGHT.medium },

  steps:          { flexDirection: 'row', alignItems: 'center' },
  stepItem:       { alignItems: 'center', gap: 4 },
  stepDot:        { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  stepDotActive:  { backgroundColor: COLORS.white },
  stepDotDone:    { backgroundColor: '#22C55E' },
  stepNum:        { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.bold, color: 'rgba(255,255,255,0.8)' },
  stepLabel:      { fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: FONT_WEIGHT.semibold },
  stepLabelActive:{ color: COLORS.white, fontWeight: FONT_WEIGHT.bold },
  stepLine:       { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: SIZES.xl, marginHorizontal: 4 },
  stepLineDone:   { backgroundColor: '#22C55E' },

  scroll:        { flex: 1 },
  scrollContent: { padding: SIZES.lg, paddingTop: SIZES.md, gap: SIZES.md },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SIZES.lg,
    ...SHADOWS.sm,
  },

  sectionLabel:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SIZES.md },
  sectionLabelBar: { width: 4, height: 18, borderRadius: 2, backgroundColor: COLORS.primary },
  sectionLabelText:{ fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black, color: COLORS.gray900, letterSpacing: -0.1 },

  // Route
  routeBox:          { backgroundColor: '#F8FAFF', borderRadius: 12, padding: SIZES.md, borderWidth: 1, borderColor: '#DBEAFE' },
  routeRow:          { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  routeIndicatorCol: { alignItems: 'center', width: 22 },
  routePulse:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  routeDot:          { width: 8, height: 8, borderRadius: 4 },
  routeVLine:        { width: 2, height: 26, backgroundColor: '#CBD5E1', marginTop: 3 },
  routeField:        { flex: 1 },
  routeTag:          { fontSize: 9, fontWeight: FONT_WEIGHT.bold, color: COLORS.gray400, letterSpacing: 1, marginBottom: 3 },
  routeInput:        { fontSize: SIZES.fontMd, color: COLORS.gray900, fontWeight: FONT_WEIGHT.semibold, paddingVertical: 2 },
  routeDivider:      { height: 1, backgroundColor: '#E2E8F0', marginVertical: SIZES.sm, marginLeft: 30 },
  routeIconBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },

  // Parcel — 2×2 card grid
  parcelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
    marginBottom: SIZES.sm,
  },
  parcelCard: {
    width: '47.5%',
    borderRadius: 12,
    padding: SIZES.md,
    gap: 5,
    position: 'relative',
    overflow: 'hidden',
  },
  parcelCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parcelIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  parcelCardLabel: {
    fontSize: SIZES.fontSm,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: -0.1,
  },
  parcelCardSub: {
    fontSize: SIZES.fontXs - 1,
    fontWeight: FONT_WEIGHT.medium,
  },
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    marginTop: 4,
  },
  selectedSummaryText: {
    fontSize: SIZES.fontXs,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Prohibited
  prohibitedCard: {
    backgroundColor: '#FEF9F9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F5C6C6',
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  prohibitedHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.md, paddingTop: SIZES.md, paddingBottom: SIZES.sm },
  prohibitedHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  prohibitedIconHeader:  { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FDECEA', borderWidth: 1, borderColor: '#F5C6C6', alignItems: 'center', justifyContent: 'center' },
  prohibitedTitle:       { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.bold, color: '#C0392B', letterSpacing: 0.2 },
  prohibitedPolicyBadge: { backgroundColor: '#FDECEA', borderRadius: SIZES.radiusFull, borderWidth: 1, borderColor: '#F5C6C6', paddingHorizontal: 8, paddingVertical: 3 },
  prohibitedPolicyText:  { fontSize: SIZES.fontXs - 1, fontWeight: FONT_WEIGHT.bold, color: '#C0392B', letterSpacing: 0.5, textTransform: 'uppercase' },
  prohibitedDivider:     { height: 1, backgroundColor: '#F5C6C6', marginHorizontal: SIZES.md },
  prohibitedGrid:        { flexDirection: 'row', paddingHorizontal: SIZES.md, paddingVertical: SIZES.md, gap: SIZES.sm },
  prohibitedItem:        { flex: 1, alignItems: 'center', gap: 5 },
  prohibitedItemIcon:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FDECEA', borderWidth: 1.5, borderColor: '#F5C6C6', alignItems: 'center', justifyContent: 'center' },
  prohibitedSlash:       { position: 'absolute', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-45deg' }] },
  prohibitedSlashLine:   { width: 30, height: 2, backgroundColor: '#C0392B', borderRadius: 1, opacity: 0.9 },
  prohibitedItemLabel:   { fontSize: SIZES.fontXs - 1, fontWeight: FONT_WEIGHT.semibold, color: '#7F3030', textAlign: 'center', lineHeight: 14 },
  prohibitedNoteRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FDF3F3', borderTopWidth: 1, borderTopColor: '#F5C6C6', paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm + 1 },
  prohibitedNote:        { flex: 1, fontSize: SIZES.fontXs, color: '#7F8C8D', fontWeight: FONT_WEIGHT.medium, lineHeight: 17 },

  // Fare
  fareCard:     { borderRadius: 16, padding: SIZES.xl, ...SHADOWS.blue, overflow: 'hidden' },
  fareInner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fareCardLabel:{ fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.7)', fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  fareCardAmt:  { fontSize: 42, fontWeight: FONT_WEIGHT.black, color: COLORS.white, letterSpacing: -1, marginBottom: SIZES.sm },
  fareRow:      { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  fareMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  fareItem:     { fontSize: SIZES.fontSm, color: 'rgba(255,255,255,0.85)', fontWeight: FONT_WEIGHT.semibold },
  fareIcon:     {},
  discountBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: SIZES.radiusFull },
  discountText: { fontSize: SIZES.fontSm, color: COLORS.white, fontWeight: FONT_WEIGHT.bold },

  // Contacts
  payCard:    { backgroundColor: '#F0FDF4', borderRadius: 14, padding: SIZES.lg, flexDirection: 'row', alignItems: 'center', gap: SIZES.md, borderWidth: 1, borderColor: '#86EFAC' },
  payIconWrap:{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  payTitle:   { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black, color: '#166534' },
  paySub:     { fontSize: SIZES.fontXs, color: '#16A34A', fontWeight: FONT_WEIGHT.medium, marginTop: 2 },

  actionRow:   { flexDirection: 'row', gap: SIZES.md, alignItems: 'center' },
  editBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primaryLight, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.lg, height: 58 },
  editBtnText: { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },
});