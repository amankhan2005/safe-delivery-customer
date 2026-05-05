import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, Platform, ActivityIndicator,
  TextInput, Keyboard, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { calculateFare, createOrder, getAdminPricing } from '../../api';
import { getLocationSuggestions, getPlaceDetails } from '../../api/locationApi';
import useAuthStore from '../../store/authStore';
import useCountry from '../../hooks/useCountry';
import { fmtCurrency } from '../../utils/helpers';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';
import LiveTrackingModal from '../../components/LiveTrackingModal';

if (!global._mapPickerCallbacks) global._mapPickerCallbacks = {};

const PARCEL_TYPES = [
  { id: 'doc',   label: 'Documents', sub: 'Papers & files',   icon: 'document-text-outline', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { id: 'small', label: 'Small Box', sub: 'Up to 5 kg',       icon: 'cube-outline',           color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { id: 'large', label: 'Large Box', sub: 'Up to 20 kg',      icon: 'archive-outline',        color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'frag',  label: 'Fragile',   sub: 'Handle with care', icon: 'flower-outline',         color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8' },
];

const PROHIBITED_ITEMS = [
  { icon: 'cut-outline',          label: 'Blades & Knives'  },
  { icon: 'alert-circle-outline', label: 'Hazardous Items'  },
  { icon: 'flame-outline',        label: 'Flammable Goods'  },
  { icon: 'skull-outline',        label: 'Toxic Substances' },
];

const WEIGHT_MAP = { doc: '<1lb', small: '1-5lb', large: '5-10lb', frag: '<1lb' };

export default function BookScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);
  const { countryKey, countryConfig } = useCountry();

  const [step,       setStep]       = useState(1);
  const [parcelType, setParcelType] = useState('small');
  const [form, setForm] = useState({
    pickupAddress: '', pickupContact: '', pickupPhone: '',
    dropAddress:   '', dropContact:   '', dropPhone:   '',
    notes: '', promoCode: '',
  });
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropCoords,   setDropCoords]   = useState(null);

  // ── Fare state ────────────────────────────────────────────────────────────
  const [baseFareData,   setBaseFareData]   = useState(null); // raw from backend (no promo)
  const [fareData,       setFareData]       = useState(null); // final (after promo applied)
  const [previewLoading, setPreviewLoading] = useState(false);
  const [ordering,       setOrdering]       = useState(false);
  const [fareError,      setFareError]      = useState('');
  const [estimateFetched, setEstimateFetched] = useState(false); // true after "Get Estimate" pressed

  // ── Live tracking modal ──────────────────────────────────────────────────
  const [trackingOrderId,   setTrackingOrderId]   = useState(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  // ── Pricing / promos ──────────────────────────────────────────────────────
  const [promos, setPromos] = useState([]);

  // ── Address search suggestions ────────────────────────────────────────────
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions,   setDropSuggestions]   = useState([]);
  const [pickupSearching,   setPickupSearching]   = useState(false);
  const [dropSearching,     setDropSearching]     = useState(false);
  const [pickupFocused,     setPickupFocused]     = useState(false);
  const [dropFocused,       setDropFocused]       = useState(false);
  const pickupDebounce = useRef(null);
  const dropDebounce   = useRef(null);

  const resetScreen = () => {
    setStep(1);
    setParcelType('small');
    setForm({ pickupAddress: '', pickupContact: '', pickupPhone: '', dropAddress: '', dropContact: '', dropPhone: '', notes: '', promoCode: '' });
    setPickupCoords(null);
    setDropCoords(null);
    setBaseFareData(null);
    setFareData(null);
    setEstimateFetched(false);
    setFareError('');
  };

  // ── Load promos on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAdminPricing();
        // /orders/pricing returns { success, data: { pricing: { promoCodes: [] } } }
        const pricing = res?.data?.data?.pricing
          ?? res?.data?.pricing
          ?? res?.data?.data
          ?? null;

        // Backend already filters — just use what it sends
        const rawCodes = Array.isArray(pricing?.promoCodes) ? pricing.promoCodes : [];
        // Only basic sanity check — backend handles eligibility
        const active = rawCodes.filter(p => p && p.code && p.discount > 0);
        setPromos(active);
      } catch (e) {
        // Silent fail — promos are optional
      }
    };
    load();
  }, []);

  // ── When location changes, reset estimate so user must press button again ──
  // (no auto-fetch)
  useEffect(() => {
    setBaseFareData(null);
    setFareData(null);
    setEstimateFetched(false);
    setFareError('');
  }, [pickupCoords, dropCoords]);

  // ── Re-apply promo whenever promo code or baseFareData changes ─────────────
  useEffect(() => {
    if (!baseFareData) { setFareData(null); return; }

    const promoCode = form.promoCode.trim().toUpperCase();
    const promo = promos.find(p => p.code === promoCode);

    if (!promo || !promoCode) {
      setFareData({ ...baseFareData, promoDiscount: 0 });
      setFareError('');
      return;
    }

    if (baseFareData.fare < (promo.minOrderFare || 0)) {
      setFareError(`Min order $${promo.minOrderFare} required for ${promo.code}`);
      setFareData({ ...baseFareData, promoDiscount: 0 });
      return;
    }

    let discount = 0;
    if (promo.type === 'flat') discount = Math.min(promo.discount, baseFareData.fare);
    else discount = Math.round(baseFareData.fare * promo.discount / 100 * 100) / 100;

    const finalFare = Math.max(baseFareData.fare - discount, 0);
    setFareData({
      ...baseFareData,
      fare: Math.round(finalFare * 100) / 100,
      promoDiscount: Math.round(discount * 100) / 100,
    });
    setFareError('');
  }, [baseFareData, form.promoCode, promos]);

  const setField = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  // ── Address search ────────────────────────────────────────────────────────
  const handleAddressSearch = (mode, text) => {
    if (mode === 'pickup') {
      setForm(f => ({ ...f, pickupAddress: text }));
      setPickupCoords(null); // reset coords when typing
      clearTimeout(pickupDebounce.current);
      if (text.trim().length < 2) { setPickupSuggestions([]); return; }
      pickupDebounce.current = setTimeout(async () => {
        setPickupSearching(true);
        try {
          const res = await getLocationSuggestions(text.trim(), countryKey);
          setPickupSuggestions(res?.data?.data?.suggestions || []);
        } catch (_) { setPickupSuggestions([]); }
        finally { setPickupSearching(false); }
      }, 400);
    } else {
      setForm(f => ({ ...f, dropAddress: text }));
      setDropCoords(null);
      clearTimeout(dropDebounce.current);
      if (text.trim().length < 2) { setDropSuggestions([]); return; }
      dropDebounce.current = setTimeout(async () => {
        setDropSearching(true);
        try {
          const res = await getLocationSuggestions(text.trim(), countryKey);
          setDropSuggestions(res?.data?.data?.suggestions || []);
        } catch (_) { setDropSuggestions([]); }
        finally { setDropSearching(false); }
      }, 400);
    }
  };

  const selectSuggestion = async (mode, item) => {
    Keyboard.dismiss();
    if (mode === 'pickup') {
      setPickupSuggestions([]);
      setPickupFocused(false);
      setForm(f => ({ ...f, pickupAddress: item.description || item.mainText }));
    } else {
      setDropSuggestions([]);
      setDropFocused(false);
      setForm(f => ({ ...f, dropAddress: item.description || item.mainText }));
    }
    try {
      const res = await getPlaceDetails(item.placeId);
      const { lat, lng, address } = res.data.data;
      if (mode === 'pickup') {
        setPickupCoords({ lat, lng });
        setForm(f => ({ ...f, pickupAddress: address || item.description || item.mainText }));
      } else {
        setDropCoords({ lat, lng });
        setForm(f => ({ ...f, dropAddress: address || item.description || item.mainText }));
      }
    } catch (_) {}
  };

  const openMapPicker = (mode) => {
    const callbackKey = `${mode}_${Date.now()}`;
    global._mapPickerCallbacks[callbackKey] = ({ lat, lng, address }) => {
      if (mode === 'pickup') {
        setPickupCoords({ lat, lng });
        setForm(f => ({ ...f, pickupAddress: address }));
      } else {
        setDropCoords({ lat, lng });
        setForm(f => ({ ...f, dropAddress: address }));
      }
    };
    navigation.navigate('MapPicker', {
      mode,
      initialCoords: mode === 'pickup' ? pickupCoords : dropCoords,
      countryKey,
      bounds: countryConfig?.bounds,
      callbackKey,
    });
  };

  // ── Haversine for same-location check ───────────────────────────────────
  const haversineMiles = (lat1, lng1, lat2, lng2) => {
    const R = 3958.8, toRad = v => v * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // ── "Get Estimate" — fetch fare, then show result + proceed ──────────────
  const handleGetEstimate = async () => {
    if (!pickupCoords || !dropCoords) {
      return Toast.show({ type: 'error', text1: 'Select both pickup and drop locations', visibilityTime: 3000 });
    }

    // Same location check
    const approxDist = haversineMiles(pickupCoords.lat, pickupCoords.lng, dropCoords.lat, dropCoords.lng);
    if (approxDist < 0.1) {
      setFareError('Pickup and drop locations are too close or the same. Please choose different locations.');
      return;
    }

    setPreviewLoading(true);
    setFareError('');
    try {
      const res = await calculateFare({
        pickupLat: pickupCoords.lat, pickupLng: pickupCoords.lng,
        dropLat:   dropCoords.lat,   dropLng:   dropCoords.lng,
      });
      const d = res.data.data;

      // Same location server check
      if (d.distanceMiles <= 0.1) {
        setFareError('Pickup and drop are too close. Please choose two different locations.');
        setBaseFareData(null); setFareData(null);
        return;
      }

      // 80-mile max distance check (from pickup location)
      if (d.distanceMiles > 80) {
        setFareError(`Drop location is ${d.distanceMiles.toFixed(1)} miles from pickup — we only service within 80 miles of the pickup point. Please select a closer drop location.`);
        setBaseFareData(null); setFareData(null);
        return;
      }

      setBaseFareData(d);
      setEstimateFetched(true);
    } catch (e) {
      const msg = e.response?.data?.error || 'Could not calculate fare. Please try again.';
      setFareError(msg);
      setBaseFareData(null); setFareData(null);
    } finally { setPreviewLoading(false); }
  };

  // ── "Proceed" — only available after estimate fetched ────────────────────
  const handleProceed = () => {
    if (!fareData) return Toast.show({ type: 'error', text1: 'Get estimate first' });
    if (fareError) return Toast.show({ type: 'error', text1: fareError });
    setStep(2);
  };

  const handleOrder = async () => {
    if (!form.dropContact.trim() || !form.dropPhone.trim()) {
      return Toast.show({ type: 'error', text1: 'Enter receiver name and phone' });
    }
    if (!fareData || !pickupCoords || !dropCoords) {
      return Toast.show({ type: 'error', text1: 'Please get fare estimate first' });
    }
    setOrdering(true);
    try {
      const res = await createOrder({
        pickup: {
          address: form.pickupAddress,
          lat: pickupCoords.lat,
          lng: pickupCoords.lng,
          contactName: form.pickupContact || user?.name || '',
          contactPhone: form.pickupPhone || user?.phone || '',
        },
        drop: {
          address: form.dropAddress,
          lat: dropCoords.lat,
          lng: dropCoords.lng,
          contactName: form.dropContact,
          contactPhone: form.dropPhone,
        },
        parcelWeight: WEIGHT_MAP[parcelType] || '1-5lb',
        notes: form.notes || '',
        promoCode: form.promoCode.trim() || undefined,
        preCalculatedFare: fareData.fare,
        preCalculatedDistance: fareData.distanceMiles,
      });
      const orderId = res.data.data.orderId;
      resetScreen();
      setTrackingOrderId(orderId);
      setShowTrackingModal(true);
      Toast.show({ type: 'success', text1: '🚀 Order Placed!', text2: 'Finding your rider...', visibilityTime: 3000 });
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Failed to place order';
      Toast.show({ type: 'error', text1: msg, visibilityTime: 4000 });
      // Don't reset — let user retry without re-entering details
    } finally { setOrdering(false); }
  };

  const activeParcel  = PARCEL_TYPES.find(p => p.id === parcelType);
  const fareAmount    = fareData?.fare ?? 0;
  const distMiles     = fareData?.distanceMiles ?? 0;
  const cpp           = fareData?.costPerMile ?? 0;
  const promoDisc     = fareData?.promoDiscount ?? 0;
  const surgeActive   = fareData?.surgeActive ?? false;
  const baseFareRaw   = baseFareData?.fare ?? 0;

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <LinearGradient colors={['#0A2F9A', '#1B4FD8']} style={S.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={S.headerRow}>
          <TouchableOpacity style={S.backBtn} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={S.headerCenter}>
            <Text style={S.headerTitle}>Book Delivery</Text>
            <Text style={S.headerSub}>{countryConfig?.country || 'Liberia'}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={S.steps}>
          {['Route', 'Details', 'Confirm'].map((label, i) => (
            <React.Fragment key={label}>
              <View style={S.stepItem}>
                <View style={[S.stepDot, i < step && S.stepDotDone, i === step - 1 && S.stepDotActive]}>
                  {i < step - 1
                    ? <Ionicons name="checkmark" size={12} color="#fff" />
                    : <Text style={S.stepNum}>{i + 1}</Text>}
                </View>
                <Text style={[S.stepLabel, i === step - 1 && S.stepLabelActive]}>{label}</Text>
              </View>
              {i < 2 && <View style={[S.stepLine, i < step - 1 && S.stepLineDone]} />}
            </React.Fragment>
          ))}
        </View>
      </LinearGradient>

      <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ══ STEP 1 ══ */}
        {step === 1 && (
          <>
            {/* Route card */}
            <View style={S.card}>
              <View style={S.sectionLabel}><View style={S.sectionBar} /><Text style={S.sectionTitle}>Delivery Route</Text></View>
              <View style={S.routeBox}>

                {/* ── PICKUP ── */}
                <View style={S.routeRow}>
                  <View style={S.routeIndCol}>
                    <View style={[S.routePulse, { borderColor: '#22C55E' }]}><View style={[S.routeDot, { backgroundColor: '#22C55E' }]} /></View>
                    <View style={S.routeVLine} />
                  </View>
                  <View style={S.routeField}>
                    <Text style={S.routeTag}>PICKUP</Text>
                    <View style={[S.addrInputWrap, pickupFocused && S.addrInputFocused]}>
                      <TextInput
                        style={S.addrInput}
                        placeholder="Type or tap map to select"
                        placeholderTextColor="#9CA3AF"
                        value={form.pickupAddress}
                        onChangeText={(t) => handleAddressSearch('pickup', t)}
                        onFocus={() => setPickupFocused(true)}
                        onBlur={() => setTimeout(() => { setPickupFocused(false); setPickupSuggestions([]); }, 200)}
                        returnKeyType="search"
                        autoCorrect={false}
                      />
                      {pickupSearching && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />}
                      {!!pickupCoords && !pickupSearching && (
                        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                      )}
                    </View>
                    {/* Pickup suggestions */}
                    {pickupFocused && pickupSuggestions.length > 0 && (
                      <View style={S.suggestBox}>
                        {pickupSuggestions.map(item => (
                          <TouchableOpacity
                            key={item.placeId}
                            style={S.suggestRow}
                            onPress={() => selectSuggestion('pickup', item)}
                            activeOpacity={0.7}
                          >
                            <View style={S.suggestIcon}>
                              <Ionicons name="location-outline" size={13} color={COLORS.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={S.suggestMain} numberOfLines={1}>{item.mainText}</Text>
                              <Text style={S.suggestSub}  numberOfLines={1}>{item.secondaryText}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={S.mapBtn} onPress={() => openMapPicker('pickup')}>
                    <Ionicons name="map-outline" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                <View style={S.routeDivider} />

                {/* ── DROP ── */}
                <View style={S.routeRow}>
                  <View style={S.routeIndCol}>
                    <View style={[S.routePulse, { borderColor: '#EF4444' }]}><View style={[S.routeDot, { backgroundColor: '#EF4444' }]} /></View>
                  </View>
                  <View style={S.routeField}>
                    <Text style={S.routeTag}>DROP-OFF</Text>
                    <View style={[S.addrInputWrap, dropFocused && S.addrInputFocused]}>
                      <TextInput
                        style={S.addrInput}
                        placeholder="Type or tap map to select"
                        placeholderTextColor="#9CA3AF"
                        value={form.dropAddress}
                        onChangeText={(t) => handleAddressSearch('drop', t)}
                        onFocus={() => setDropFocused(true)}
                        onBlur={() => setTimeout(() => { setDropFocused(false); setDropSuggestions([]); }, 200)}
                        returnKeyType="search"
                        autoCorrect={false}
                      />
                      {dropSearching && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />}
                      {!!dropCoords && !dropSearching && (
                        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                      )}
                    </View>
                    {/* Drop suggestions */}
                    {dropFocused && dropSuggestions.length > 0 && (
                      <View style={S.suggestBox}>
                        {dropSuggestions.map(item => (
                          <TouchableOpacity
                            key={item.placeId}
                            style={S.suggestRow}
                            onPress={() => selectSuggestion('drop', item)}
                            activeOpacity={0.7}
                          >
                            <View style={S.suggestIcon}>
                              <Ionicons name="location-outline" size={13} color="#EF4444" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={S.suggestMain} numberOfLines={1}>{item.mainText}</Text>
                              <Text style={S.suggestSub}  numberOfLines={1}>{item.secondaryText}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={S.mapBtn} onPress={() => openMapPicker('drop')}>
                    <Ionicons name="map-outline" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

              </View>

              {!!fareError && (
                <View style={S.errBox}>
                  <View style={S.errIconCircle}>
                    <Ionicons name="alert-circle" size={22} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.errTitle}>
                      {fareError.includes('same') ? 'Same Location' :
                       fareError.includes('80') || fareError.includes('miles') ? 'Too Far' :
                       'Cannot Proceed'}
                    </Text>
                    <Text style={S.errText}>{fareError}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setFareError('')} style={{ padding: 4 }}>
                    <Ionicons name="close" size={16} color="#B91C1C" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Parcel type */}
            <View style={S.card}>
              <View style={S.sectionLabel}><View style={S.sectionBar} /><Text style={S.sectionTitle}>What are you sending?</Text></View>
              <View style={S.parcelGrid}>
                {PARCEL_TYPES.map(p => {
                  const on = parcelType === p.id;
                  return (
                    <TouchableOpacity key={p.id} style={[S.parcelCard, { borderColor: on ? p.color : '#E5E7EB', backgroundColor: on ? p.bg : '#fff', borderWidth: on ? 2 : 1.5 }]} onPress={() => setParcelType(p.id)} activeOpacity={0.75}>
                      {on && <View style={[S.parcelCheck, { backgroundColor: p.color }]}><Ionicons name="checkmark" size={9} color="#fff" /></View>}
                      <View style={[S.parcelIconWrap, { backgroundColor: on ? p.color : p.bg, borderColor: on ? p.color : p.border }]}>
                        <Ionicons name={p.icon} size={22} color={on ? '#fff' : p.color} />
                      </View>
                      <Text style={[S.parcelLabel, { color: on ? p.color : '#1F2937' }]}>{p.label}</Text>
                      <Text style={[S.parcelSub, { color: on ? p.color + 'BB' : '#9CA3AF' }]}>{p.sub}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {activeParcel && (
                <View style={[S.selectedSummary, { backgroundColor: activeParcel.bg, borderColor: activeParcel.border }]}>
                  <Ionicons name={activeParcel.icon} size={14} color={activeParcel.color} />
                  <Text style={[S.selectedSummaryText, { color: activeParcel.color }]}>{activeParcel.label} — {activeParcel.sub}</Text>
                </View>
              )}
            </View>

            {/* Prohibited */}
            <View style={S.prohibCard}>
              <View style={S.prohibHeader}>
                <View style={S.prohibIconWrap}><Ionicons name="ban-outline" size={14} color="#C0392B" /></View>
                <Text style={S.prohibTitle}>Prohibited Items</Text>
              </View>
              <View style={S.prohibDivider} />
              <View style={S.prohibGrid}>
                {PROHIBITED_ITEMS.map(item => (
                  <View key={item.icon} style={S.prohibItem}>
                    <View style={S.prohibItemIcon}>
                      <Ionicons name={item.icon} size={17} color="#C0392B" />
                      <View style={S.prohibSlash} pointerEvents="none"><View style={S.prohibSlashLine} /></View>
                    </View>
                    <Text style={S.prohibItemLabel} numberOfLines={2}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Fare result card — shown ONLY after Get Estimate is pressed ── */}
            {estimateFetched && fareData && (
              <View style={S.fareResultCard}>
                <View style={S.fareResultHeader}>
                  <View style={S.fareResultIconWrap}>
                    <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={S.fareResultTitle}>Fare Estimate</Text>
                  {surgeActive && (
                    <View style={S.surgePill}>
                      <Ionicons name="trending-up-outline" size={11} color="#DC2626" />
                      <Text style={S.surgePillText}>Surge</Text>
                    </View>
                  )}
                </View>

                <View style={S.fareResultDivider} />

                {/* Base fare row */}
                <View style={S.fareRow}>
                  <Text style={S.fareRowLabel}>Base Fare</Text>
                  <Text style={[S.fareRowValue, promoDisc > 0 && S.fareRowStrike]}>
                    {fmtCurrency(baseFareRaw)}
                  </Text>
                </View>

                {/* Distance row */}
                <View style={S.fareRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="navigate-outline" size={12} color="#6B7280" />
                    <Text style={S.fareRowLabel}>Distance</Text>
                  </View>
                  <Text style={S.fareRowValue}>{distMiles} mi  ×  {fmtCurrency(cpp)}/mi</Text>
                </View>

                {/* Promo discount row — only if promo applied */}
                {promoDisc > 0 && (
                  <View style={S.fareRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="pricetag-outline" size={12} color="#16A34A" />
                      <Text style={[S.fareRowLabel, { color: '#16A34A' }]}>
                        Promo ({form.promoCode.toUpperCase()})
                      </Text>
                    </View>
                    <Text style={S.fareDiscountValue}>-{fmtCurrency(promoDisc)}</Text>
                  </View>
                )}

                <View style={S.fareResultTotalDivider} />

                {/* Final total */}
                <View style={S.fareRow}>
                  <Text style={S.fareTotalLabel}>Total Fare</Text>
                  <Text style={S.fareTotalValue}>{fmtCurrency(fareAmount)}</Text>
                </View>

                {/* Savings badge */}
                {promoDisc > 0 && (
                  <View style={S.savingsBadge}>
                    <Ionicons name="sparkles-outline" size={13} color="#16A34A" />
                    <Text style={S.savingsText}>
                      You save {fmtCurrency(promoDisc)} with {form.promoCode.toUpperCase()}!
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Promo Code — shown ONLY after estimate ── */}
            {estimateFetched && fareData && <View style={S.card}>
              <View style={S.sectionLabel}><View style={S.sectionBar} /><Text style={S.sectionTitle}>Promo Code</Text></View>
              <Input
                placeholder="Enter promo code (optional)"
                value={form.promoCode}
                onChangeText={(v) => setField('promoCode')(v.toUpperCase())}
                leftIcon={<Ionicons name="pricetag-outline" size={16} color={COLORS.gray400} />}
              />
              {promos.length > 0 ? (
                <View style={S.promoSection}>
                  <Text style={S.promoSectionLabel}>Available Offers</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                    {promos.map(p => {
                      const isSelected = form.promoCode.toUpperCase().trim() === p.code;
                      const discLabel  = p.type === 'flat' ? `-$${p.discount}` : `-${p.discount}%`;
                      // Eligible = no fare yet OR fare meets minimum
                      const eligible   = !baseFareData || baseFareData.fare >= (p.minOrderFare || 0);
                      return (
                        <TouchableOpacity
                          key={p.code}
                          activeOpacity={eligible ? 0.8 : 1}
                          onPress={() => eligible && setField('promoCode')(isSelected ? '' : p.code)}
                          style={[S.promoChip, isSelected && S.promoChipSelected, !eligible && S.promoChipDisabled]}
                        >
                          <Ionicons
                            name={eligible ? 'pricetag-outline' : 'lock-closed-outline'}
                            size={13}
                            color={isSelected ? '#fff' : eligible ? COLORS.primary : '#9CA3AF'}
                          />
                          <View style={{ gap: 2 }}>
                            <Text style={[S.promoChipCode, isSelected && { color: '#fff' }, !eligible && { color: '#9CA3AF' }]}>
                              {p.code}
                            </Text>
                            <Text style={[S.promoChipDisc, isSelected && { color: 'rgba(255,255,255,0.85)' }, !eligible && { color: '#9CA3AF' }]}>
                              {discLabel}
                            </Text>
                          </View>
                          {p.minOrderFare > 0 && (
                            <View style={[
                              S.promoMinBadge,
                              isSelected && { backgroundColor: 'rgba(255,255,255,0.2)' },
                              !eligible && { backgroundColor: '#FEF2F2' },
                            ]}>
                              <Text style={[
                                S.promoMinText,
                                isSelected && { color: 'rgba(255,255,255,0.9)' },
                                !eligible && { color: '#EF4444' },
                              ]}>
                                {`Min ${p.minOrderFare}`}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                <Text style={{ fontSize: SIZES.fontXs, color: COLORS.gray400, marginTop: 8 }}>
                  No active offers available
                </Text>
              )}
              {!!fareError && fareError.includes('required') && (
                <View style={[S.errBox, { marginTop: SIZES.sm }]}>
                  <View style={S.errIconWrap}><Ionicons name="alert-circle" size={20} color={COLORS.red} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.errTitle}>Promo Not Applicable</Text>
                    <Text style={S.errText}>{fareError}</Text>
                  </View>
                </View>
              )}
            </View>}

            {/* ── Buttons ── */}
            {!estimateFetched ? (
              /* GET ESTIMATE button */
              <Button
                title={
                  previewLoading ? 'Calculating...' :
                  (!pickupCoords || !dropCoords) ? 'Select both locations' :
                  'Get Fare Estimate'
                }
                onPress={handleGetEstimate}
                loading={previewLoading}
                disabled={!pickupCoords || !dropCoords || previewLoading}
                size="lg"
                style={{ marginHorizontal: SIZES.lg }}
                iconRight={!previewLoading && pickupCoords && dropCoords &&
                  <Ionicons name="calculator-outline" size={18} color="#fff" />}
              />
            ) : (
              /* PROCEED button — shown after estimate */
              <Button
                title={`Proceed  •  ${fmtCurrency(fareAmount)}`}
                onPress={handleProceed}
                disabled={!fareData || !!fareError}
                size="lg"
                style={{ marginHorizontal: SIZES.lg }}
                iconRight={<Ionicons name="arrow-forward" size={18} color="#fff" />}
              />
            )}
          </>
        )}

        {/* ══ STEP 2 ══ */}
        {step === 2 && (
          <>
            <LinearGradient colors={['#0F3BAF', '#1B4FD8', '#2563EB']} style={S.fareCard}>
              <View style={S.fareInner}>
                <View>
                  <Text style={S.fareLabel}>Total Fare</Text>
                  <Text style={S.fareAmt}>{fmtCurrency(fareAmount)}</Text>
                  <View style={S.fareChips}>
                    <View style={S.chip}><Ionicons name="navigate-outline" size={12} color="rgba(255,255,255,0.8)" /><Text style={S.chipText}>{distMiles} mi</Text></View>
                    <View style={S.chip}><Ionicons name="cash-outline" size={12} color="rgba(255,255,255,0.8)" /><Text style={S.chipText}>{fmtCurrency(cpp)}/mi</Text></View>
                    {surgeActive && <View style={[S.chip, { backgroundColor: 'rgba(239,68,68,0.3)' }]}><Ionicons name="trending-up-outline" size={12} color="#FCA5A5" /><Text style={[S.chipText, { color: '#FCA5A5' }]}>Surge</Text></View>}
                    {promoDisc > 0 && <View style={S.discBadge}><Ionicons name="pricetag-outline" size={11} color="#fff" /><Text style={S.discText}>-{fmtCurrency(promoDisc)}</Text></View>}
                  </View>
                </View>
                <Ionicons name="receipt-outline" size={40} color="rgba(255,255,255,0.15)" />
              </View>
            </LinearGradient>

            <View style={S.card}>
              <View style={S.sectionLabel}><View style={[S.sectionBar, { backgroundColor: '#22C55E' }]} /><Text style={S.sectionTitle}>Sender Details</Text></View>
              <Input placeholder="Sender name"  value={form.pickupContact} onChangeText={setField('pickupContact')} leftIcon={<Ionicons name="person-outline" size={16} color={COLORS.gray400} />} />
              <Input placeholder="Sender phone" value={form.pickupPhone}   onChangeText={setField('pickupPhone')} keyboardType="phone-pad" leftIcon={<Ionicons name="call-outline" size={16} color={COLORS.gray400} />} />
            </View>

            <View style={S.card}>
              <View style={S.sectionLabel}><View style={[S.sectionBar, { backgroundColor: '#EF4444' }]} /><Text style={S.sectionTitle}>Receiver Details</Text></View>
              <Input placeholder="Receiver name *"  value={form.dropContact} onChangeText={setField('dropContact')} leftIcon={<Ionicons name="person-outline" size={16} color={COLORS.gray400} />} />
              <Input placeholder="Receiver phone *" value={form.dropPhone}   onChangeText={setField('dropPhone')} keyboardType="phone-pad" leftIcon={<Ionicons name="call-outline" size={16} color={COLORS.gray400} />} />
              <Input placeholder="Notes (optional)" value={form.notes}       onChangeText={setField('notes')} leftIcon={<Ionicons name="chatbubble-outline" size={16} color={COLORS.gray400} />} />
            </View>

            <View style={S.payCard}>
              <View style={S.payIconWrap}><Ionicons name="cash-outline" size={22} color={COLORS.green} /></View>
              <View style={{ flex: 1 }}>
                <Text style={S.payTitle}>Cash on Delivery</Text>
                <Text style={S.paySub}>Pay {fmtCurrency(fareAmount)} when delivered</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.green} />
            </View>

            <View style={S.actionRow}>
              <TouchableOpacity style={S.editBtn} onPress={() => setStep(1)}>
                <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
                <Text style={S.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <Button title={`Place Order • ${fmtCurrency(fareAmount)}`} onPress={handleOrder} loading={ordering} size="lg" style={{ flex: 1 }} />
            </View>
          </>
        )}

        <View style={{ height: SIZES.huge }} />
      </ScrollView>
      {/* Live Tracking Modal */}
      <LiveTrackingModal
        orderId={trackingOrderId}
        visible={showTrackingModal}
        onClose={() => setShowTrackingModal(false)}
        onDelivered={() => {
          // Keep modal open to show delivered state
        }}
        navigation={navigation}
      />
    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F4F6FB' },
  header: { paddingTop: Platform.OS === 'ios' ? 52 : SIZES.xl, paddingBottom: SIZES.xl, paddingHorizontal: SIZES.xl },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.lg },
  headerCenter: { alignItems: 'center' },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: '#fff', letterSpacing: -0.3 },
  headerSub:    { fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  steps:         { flexDirection: 'row', alignItems: 'center' },
  stepItem:      { alignItems: 'center', gap: 4 },
  stepDot:       { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#fff' },
  stepDotDone:   { backgroundColor: '#22C55E' },
  stepNum:       { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.bold, color: 'rgba(255,255,255,0.8)' },
  stepLabel:     { fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: FONT_WEIGHT.semibold },
  stepLabelActive:{ color: '#fff', fontWeight: FONT_WEIGHT.bold },
  stepLine:      { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: SIZES.xl, marginHorizontal: 4 },
  stepLineDone:  { backgroundColor: '#22C55E' },
  scroll:        { flex: 1 },
  scrollContent: { padding: SIZES.lg, paddingTop: SIZES.md, gap: SIZES.md },
  card:       { backgroundColor: '#fff', borderRadius: 16, padding: SIZES.lg, ...SHADOWS.sm },
  sectionLabel:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SIZES.md },
  sectionBar:  { width: 4, height: 18, borderRadius: 2, backgroundColor: COLORS.primary },
  sectionTitle:{ fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black, color: '#111827' },
  routeBox:     { backgroundColor: '#F8FAFF', borderRadius: 12, padding: SIZES.md, borderWidth: 1, borderColor: '#DBEAFE' },

  // Address search input
  addrInputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4, marginTop: 3 },
  addrInputFocused:{ borderColor: COLORS.primary, borderWidth: 1.5 },
  addrInput:       { flex: 1, fontSize: SIZES.fontSm, color: '#111827', fontWeight: '500', paddingVertical: 4, minHeight: 32 },

  // Suggestions dropdown
  suggestBox:  { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 4, overflow: 'hidden', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6, zIndex: 99 },
  suggestRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  suggestIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  suggestMain: { fontSize: 13, color: '#111827', fontWeight: '600' },
  suggestSub:  { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  routeRow:     { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  routeIndCol:  { alignItems: 'center', width: 22 },
  routePulse:   { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  routeDot:     { width: 8, height: 8, borderRadius: 4 },
  routeVLine:   { width: 2, height: 26, backgroundColor: '#CBD5E1', marginTop: 3 },
  routeField:   { flex: 1 },
  routeTag:     { fontSize: 9, fontWeight: FONT_WEIGHT.bold, color: '#9CA3AF', letterSpacing: 1, marginBottom: 3 },
  routeAddr:    { fontSize: SIZES.fontMd, color: '#111827', fontWeight: FONT_WEIGHT.semibold, paddingVertical: 2 },
  routeAddrEmpty:{ color: '#9CA3AF', fontWeight: '400' },
  routeDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: SIZES.sm, marginLeft: 30 },
  mapBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  errBox:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: SIZES.md, backgroundColor: '#FEF2F2', borderRadius: 14, padding: SIZES.md, borderWidth: 1.5, borderColor: '#FECACA' },
  errIconCircle:{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  errIconWrap:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  errTitle:     { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.black, color: '#DC2626', marginBottom: 3 },
  errText:      { fontSize: SIZES.fontXs, color: '#7F1D1D', fontWeight: FONT_WEIGHT.medium, lineHeight: 18 },
  promoChipDisabled: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', opacity: 0.8 },
  parcelGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginBottom: SIZES.sm },
  parcelCard:   { width: '47.5%', borderRadius: 12, padding: SIZES.md, gap: 5, position: 'relative', overflow: 'hidden' },
  parcelCheck:  { position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  parcelIconWrap:{ width: 46, height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  parcelLabel:  { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.bold },
  parcelSub:    { fontSize: SIZES.fontXs - 1, fontWeight: FONT_WEIGHT.medium },
  selectedSummary:{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, marginTop: 4 },
  selectedSummaryText:{ fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.semibold },
  prohibCard:     { backgroundColor: '#FEF9F9', borderRadius: 14, borderWidth: 1, borderColor: '#F5C6C6', overflow: 'hidden', ...SHADOWS.sm },
  prohibHeader:   { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: SIZES.md, paddingTop: SIZES.md, paddingBottom: SIZES.sm },
  prohibIconWrap: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FDECEA', borderWidth: 1, borderColor: '#F5C6C6', alignItems: 'center', justifyContent: 'center' },
  prohibTitle:    { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.bold, color: '#C0392B' },
  prohibDivider:  { height: 1, backgroundColor: '#F5C6C6', marginHorizontal: SIZES.md },
  prohibGrid:     { flexDirection: 'row', paddingHorizontal: SIZES.md, paddingVertical: SIZES.md, gap: SIZES.sm },
  prohibItem:     { flex: 1, alignItems: 'center', gap: 5 },
  prohibItemIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FDECEA', borderWidth: 1.5, borderColor: '#F5C6C6', alignItems: 'center', justifyContent: 'center' },
  prohibSlash:    { position: 'absolute', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-45deg' }] },
  prohibSlashLine:{ width: 30, height: 2, backgroundColor: '#C0392B', borderRadius: 1, opacity: 0.9 },
  prohibItemLabel:{ fontSize: SIZES.fontXs - 1, fontWeight: FONT_WEIGHT.semibold, color: '#7F3030', textAlign: 'center', lineHeight: 14 },
  promoSection:      { marginTop: SIZES.sm },
  promoSectionLabel: { fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.bold, color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase' },
  promoChip:         { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginRight: 10, backgroundColor: '#EFF6FF' },
  promoChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  promoChipCode:     { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.black, color: COLORS.primary },
  promoChipDisc:     { fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.semibold, color: COLORS.primary },
  promoMinBadge:     { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  promoMinText:      { fontSize: 9, fontWeight: FONT_WEIGHT.bold, color: '#6B7280' },

  // ── Fare result card ──────────────────────────────────────────────────────
  fareResultCard:        { backgroundColor: '#fff', borderRadius: 16, padding: SIZES.lg, borderWidth: 1.5, borderColor: '#DBEAFE', ...SHADOWS.sm },
  fareResultHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SIZES.sm },
  fareResultIconWrap:    { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  fareResultTitle:       { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black, color: '#111827', flex: 1 },
  surgePill:             { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF2F2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FECACA' },
  surgePillText:         { fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: '#DC2626' },
  fareResultDivider:     { height: 1, backgroundColor: '#F1F5F9', marginBottom: SIZES.md },
  fareRow:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
  fareRowLabel:          { fontSize: SIZES.fontSm, color: '#6B7280', fontWeight: FONT_WEIGHT.medium },
  fareRowValue:          { fontSize: SIZES.fontSm, color: '#374151', fontWeight: FONT_WEIGHT.semibold },
  fareRowStrike:         { textDecorationLine: 'line-through', color: '#9CA3AF' },
  fareDiscountValue:     { fontSize: SIZES.fontSm, fontWeight: FONT_WEIGHT.bold, color: '#16A34A' },
  fareResultTotalDivider:{ height: 1, backgroundColor: '#E5E7EB', marginVertical: SIZES.sm },
  fareTotalLabel:        { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black, color: '#111827' },
  fareTotalValue:        { fontSize: SIZES.fontXl, fontWeight: FONT_WEIGHT.black, color: COLORS.primary },
  savingsBadge:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SIZES.sm, backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, borderWidth: 1, borderColor: '#86EFAC' },
  savingsText:           { fontSize: SIZES.fontXs, fontWeight: FONT_WEIGHT.bold, color: '#16A34A', flex: 1 },

  // Step 2
  fareCard:  { borderRadius: 16, padding: SIZES.xl, ...SHADOWS.blue, overflow: 'hidden' },
  fareInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fareLabel: { fontSize: SIZES.fontXs, color: 'rgba(255,255,255,0.7)', fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  fareAmt:   { fontSize: 42, fontWeight: FONT_WEIGHT.black, color: '#fff', letterSpacing: -1, marginBottom: SIZES.sm },
  fareChips: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap' },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText:  { fontSize: SIZES.fontSm, color: 'rgba(255,255,255,0.85)', fontWeight: FONT_WEIGHT.semibold },
  discBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  discText:  { fontSize: SIZES.fontSm, color: '#fff', fontWeight: FONT_WEIGHT.bold },
  payCard:    { backgroundColor: '#F0FDF4', borderRadius: 14, padding: SIZES.lg, flexDirection: 'row', alignItems: 'center', gap: SIZES.md, borderWidth: 1, borderColor: '#86EFAC' },
  payIconWrap:{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  payTitle:   { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.black, color: '#166534' },
  paySub:     { fontSize: SIZES.fontXs, color: '#16A34A', fontWeight: FONT_WEIGHT.medium, marginTop: 2 },
  actionRow:   { flexDirection: 'row', gap: SIZES.md, alignItems: 'center' },
  editBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primaryLight, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.lg, height: 58 },
  editBtnText: { fontSize: SIZES.fontMd, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },
});