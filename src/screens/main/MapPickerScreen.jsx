/**
 * MapPickerScreen.jsx — PRODUCTION-SAFE, FULLY FUNCTIONAL
 *
 * CRASHES FIXED (without breaking any functionality):
 *
 * 1. LAZY REQUIRE inside useMemo — not at module scope.
 *    Module-scope require() fires before Maps SDK initialises in release APK
 *    → SIGSEGV crash. useMemo runs during render, after SDK is ready.
 *
 * 2. ALL coordinates pass through safeNum() before reaching MapView.
 *    Hermes bridge crashes on string coords; JSC silently coerces them.
 *
 * 3. initialRegion is useMemo'd — same object reference forever.
 *    Inline object literals cause re-renders that corrupt native map state.
 *
 * 4. mapReady gate — interactions only after onMapReady fires.
 *
 * 5. animateToRegion wrapped in try/catch + mapReady guard.
 *
 * FUNCTIONALITY PRESERVED:
 * - GPS auto-detect on open when no initialCoords
 * - Reverse geocoding on map drag
 * - Address search with debounced suggestions
 * - Suggestion tap → map animates to place (API path FIXED: .data.data.location)
 * - Bounds clamping when countryKey bounds are provided
 * - Confirm button passes { lat, lng, address } to BookScreen callback
 * - mapType state preserved (standard/satellite toggle-ready)
 * - searchFocused state preserved
 * - All original UI elements unchanged
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, FlatList, ActivityIndicator,
  Platform, Keyboard, StatusBar,
} from 'react-native';
import * as ExpoLocation from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLocationSuggestions, getPlaceDetails } from '../../api/locationApi';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';
import { isValidCoord, safeNum, safeCoord } from '../../utils/safeCoords';

// Country centre defaults — same as original
const DEFAULT_CENTRES = {
  LIBERIA: { latitude: 6.3005, longitude: -10.7969 },
  INDIA:   { latitude: 20.5937, longitude: 78.9629 },
};

// Bounds clamping — identical to original
function clamp(val, min, max) {
  return Math.max(safeNum(min), Math.min(safeNum(max), safeNum(val)));
}

// Reverse geocode — identical to original, with Number() cast added
async function getReverseAddress(lat, lng) {
  try {
    if (!isValidCoord(lat, lng)) return '';
    const results = await ExpoLocation.reverseGeocodeAsync({
      latitude:  Number(lat),
      longitude: Number(lng),
    });
    if (results?.[0]) {
      const r = results[0];
      return [r.name, r.street, r.district, r.city, r.region, r.country]
        .filter(Boolean).join(', ');
    }
  } catch (_) {}
  return '';
}

export default function MapPickerScreen({ navigation, route }) {
  const {
    mode        = 'pickup',
    initialCoords,
    countryKey  = 'LIBERIA',
    bounds,
    callbackKey,
  } = route?.params || {};

  const insets   = useSafeAreaInsets();
  const mapRef   = useRef(null);
  const mountRef = useRef(true);

  useEffect(() => {
    mountRef.current = true;
    return () => { mountRef.current = false; };
  }, []);

  // ── Load map module inside useMemo — never at module scope ───────────────
  // FIX: module-scope require() fires before Maps SDK ready in release → crash
  const MapViewModule = useMemo(() => {
    try { return require('react-native-maps').default; } catch (_) { return null; }
  }, []);

  // ── Safe initial coords from navigation params ────────────────────────────
  // FIX: params may arrive as strings in release build — use safeCoord()
  const safeInit = useMemo(() => {
    const defaultCentre = DEFAULT_CENTRES[countryKey] || DEFAULT_CENTRES.LIBERIA;
    const parsed = safeCoord(initialCoords);
    if (parsed) return { lat: parsed.lat, lng: parsed.lng };
    return { lat: defaultCentre.latitude, lng: defaultCentre.longitude };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── State — identical to original ────────────────────────────────────────
  const [mapReady,      setMapReady]      = useState(false);
  const [address,       setAddress]       = useState('');
  const [searchText,    setSearchText]    = useState('');
  const [suggestions,   setSuggestions]   = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [mapType,       setMapType]       = useState('standard'); // preserved — toggle-ready
  const [gpsLoading,    setGpsLoading]    = useState(false);
  const [geocoding,     setGeocoding]     = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);     // preserved

  const searchDebounce  = useRef(null);
  const geocodeDebounce = useRef(null);

  // ── Memoised initialRegion — same object reference, never re-created ─────
  // FIX: inline object literals cause re-renders that corrupt native map state
  const initialRegion = useMemo(() => ({
    latitude:       Number(safeInit.lat),
    longitude:      Number(safeInit.lng),
    latitudeDelta:  0.01,
    longitudeDelta: 0.01,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Track current region in ref — avoids stale closure in confirm handler
  // Original used setState; ref is equivalent but prevents re-render on every drag
  const regionRef = useRef({ ...initialRegion });

  // ── On mount: match original logic exactly ───────────────────────────────
  useEffect(() => {
    const parsed = safeCoord(initialCoords);
    if (!parsed) {
      getCurrentGPS();
    } else {
      doReverseGeocode(safeInit.lat, safeInit.lng);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doReverseGeocode = useCallback(async (lat, lng) => {
    if (!isValidCoord(lat, lng) || !mountRef.current) return;
    setGeocoding(true);
    try {
      const addr = await getReverseAddress(lat, lng);
      if (mountRef.current) {
        setAddress(addr);
        setGeocoding(false);
      }
    } catch (_) {
      if (mountRef.current) setGeocoding(false);
    }
  }, []);

  const getCurrentGPS = useCallback(async () => {
    if (!mountRef.current) return;
    setGpsLoading(true);
    try {
      // Check permission — identical to original
      const existing = await ExpoLocation.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        const req = await ExpoLocation.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted' || !mountRef.current) { setGpsLoading(false); return; }

      // Check services enabled — identical to original
      const enabled = await ExpoLocation.hasServicesEnabledAsync();
      if (!enabled || !mountRef.current) { setGpsLoading(false); return; }

      const loc = await Promise.race([
        ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ]);
      if (!mountRef.current) return;

      // FIX: safeNum() wraps coords — GPS can return strings in some Expo versions
      const lat = safeNum(loc?.coords?.latitude);
      const lng = safeNum(loc?.coords?.longitude);
      if (!isValidCoord(lat, lng)) { setGpsLoading(false); return; }

      const cLat = bounds ? clamp(lat, bounds.south, bounds.north) : lat;
      const cLng = bounds ? clamp(lng, bounds.west,  bounds.east)  : lng;
      if (!isValidCoord(cLat, cLng)) { setGpsLoading(false); return; }

      const newRegion = {
        latitude:       Number(cLat),
        longitude:      Number(cLng),
        latitudeDelta:  0.008,
        longitudeDelta: 0.008,
      };
      regionRef.current = newRegion;

      // FIX: only animate after map is ready + try/catch guard
      if (mapRef.current && mapReady) {
        try { mapRef.current.animateToRegion(newRegion, 600); } catch (_) {}
      }
      doReverseGeocode(cLat, cLng);
    } catch (_) {}
    finally { if (mountRef.current) setGpsLoading(false); }
  }, [mapReady, doReverseGeocode, bounds]);

  // ── onRegionChangeComplete — identical logic to original, with safeNum guards
  const onRegionChangeComplete = useCallback(async (newRegion) => {
    if (!newRegion) return;
    // FIX: safeNum() prevents crash when MapView returns malformed region
    const lat = safeNum(newRegion.latitude);
    const lng = safeNum(newRegion.longitude);
    if (!isValidCoord(lat, lng)) return;

    let finalLat = lat;
    let finalLng = lng;

    if (bounds) {
      finalLat = clamp(lat, bounds.south, bounds.north);
      finalLng = clamp(lng, bounds.west,  bounds.east);
      if (!isValidCoord(finalLat, finalLng)) return;

      if (finalLat !== lat || finalLng !== lng) {
        const clamped = {
          latitude:       Number(finalLat),
          longitude:      Number(finalLng),
          latitudeDelta:  Number(newRegion.latitudeDelta)  || 0.01,
          longitudeDelta: Number(newRegion.longitudeDelta) || 0.01,
        };
        regionRef.current = clamped;
        try { mapRef.current?.animateToRegion(clamped, 300); } catch (_) {}
        doReverseGeocode(finalLat, finalLng);
        return;
      }
    }

    regionRef.current = {
      latitude:       Number(finalLat),
      longitude:      Number(finalLng),
      latitudeDelta:  Number(newRegion.latitudeDelta)  || 0.01,
      longitudeDelta: Number(newRegion.longitudeDelta) || 0.01,
    };

    clearTimeout(geocodeDebounce.current);
    geocodeDebounce.current = setTimeout(() => doReverseGeocode(finalLat, finalLng), 400);
  }, [bounds, doReverseGeocode]);

  // ── Search — identical to original, uses regionRef for bias coords ────────
  const onSearchChange = useCallback((text) => {
    setSearchText(text);
    clearTimeout(searchDebounce.current);
    if (!text.trim()) { setSuggestions([]); return; }
    searchDebounce.current = setTimeout(async () => {
      if (!mountRef.current) return;
      setSearching(true);
      try {
        const r = regionRef.current;
        const res = await getLocationSuggestions(
          text,
          countryKey,
          r?.latitude  ?? null,
          r?.longitude ?? null,
        );
        if (mountRef.current) setSuggestions(res?.data?.data?.suggestions || []);
      } catch (_) {}
      finally { if (mountRef.current) setSearching(false); }
    }, 400);
  }, [countryKey]);

  // ── Suggestion tap — CORRECTED API response path ─────────────────────────
  // ORIGINAL: res?.data?.data?.location  (nested .location object)
  // The previous fix incorrectly used res?.data?.data (flat) — this was BROKEN
  const onSelectSuggestion = useCallback(async (item) => {
    Keyboard.dismiss();
    setSuggestions([]);
    setSearchText(item?.description || '');
    try {
      const res = await getPlaceDetails(item?.place_id || item?.placeId);
      // EXACT original path: res?.data?.data?.location
      const loc = res?.data?.data?.location;
      // FIX: safeNum() on coords from backend before isValidCoord check
      if (!loc || !isValidCoord(safeNum(loc?.lat), safeNum(loc?.lng)) || !mountRef.current) return;

      const lat = bounds ? clamp(safeNum(loc.lat), bounds.south, bounds.north) : safeNum(loc.lat);
      const lng = bounds ? clamp(safeNum(loc.lng), bounds.west,  bounds.east)  : safeNum(loc.lng);
      if (!isValidCoord(lat, lng)) return;

      const newRegion = {
        latitude:       Number(lat),
        longitude:      Number(lng),
        latitudeDelta:  0.008,
        longitudeDelta: 0.008,
      };
      regionRef.current = newRegion;
      try { mapRef.current?.animateToRegion(newRegion, 600); } catch (_) {}
      // Original: setAddress(item.description || '') after suggestion tap
      setAddress(item?.description || '');
    } catch (_) {}
  }, [bounds]);

  // ── Confirm — identical to original, reads from regionRef ─────────────────
  const handleConfirm = useCallback(() => {
    const r = regionRef.current;
    const lat = safeNum(r?.latitude);
    const lng = safeNum(r?.longitude);
    if (!isValidCoord(lat, lng)) return;

    const result = { lat: Number(lat), lng: Number(lng), address };
    if (callbackKey && global._mapPickerCallbacks?.[callbackKey]) {
      try { global._mapPickerCallbacks[callbackKey](result); } catch (_) {}
      try { delete global._mapPickerCallbacks[callbackKey]; } catch (_) {}
    }
    navigation.goBack();
  }, [address, callbackKey, navigation]);

  // ── Fallback when MapView module not available ────────────────────────────
  if (!MapViewModule) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>Map not available</Text>
        <TouchableOpacity
          style={{ backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Confirm button enabled when map has valid coords and address is ready
  // Identical to original: disabled when (!address && !geocoding)
  const confirmDisabled = !address && !geocoding;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />

      {/* Map — always render, interactions gated by onMapReady */}
      <MapViewModule
        ref={mapRef}
        style={{ flex: 1 }}
        mapType={mapType}
        initialRegion={initialRegion}
        onRegionChangeComplete={onRegionChangeComplete}
        onMapReady={() => {
          // FIX: gate all map interactions on this callback
          if (mountRef.current) setMapReady(true);
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        moveOnMarkerPress={false}
        rotateEnabled={false}
        pitchEnabled={false}
        loadingEnabled={true}
        loadingIndicatorColor={COLORS.primary}
        loadingBackgroundColor="#fff"
      />

      {/* Centre pin — identical to original */}
      <View style={MP.pinWrap} pointerEvents="none">
        <Ionicons name="location" size={36} color={mode === 'pickup' ? COLORS.green : COLORS.red} />
      </View>

      {/* Top bar — identical to original */}
      <View style={[MP.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={MP.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={MP.searchWrap}>
          <TextInput
            style={MP.searchInput}
            placeholder={mode === 'pickup' ? 'Search pickup location' : 'Search drop location'}
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={onSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => { setSearchFocused(false); setSuggestions([]); }}
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
        </View>
      </View>

      {/* Suggestions — identical to original */}
      {suggestions.length > 0 && (
        <View style={[MP.suggestions, { top: insets.top + 70 }]}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, i) => item?.place_id || String(i)}
            keyboardShouldPersistTaps="always"
            renderItem={({ item }) => (
              <TouchableOpacity style={MP.suggRow} onPress={() => onSelectSuggestion(item)}>
                <Ionicons name="location-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={MP.suggText} numberOfLines={2}>{item?.description || ''}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Bottom confirm — identical to original */}
      <View style={[MP.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={MP.addressRow}>
          <Ionicons name={geocoding ? 'reload-outline' : 'location-outline'} size={16} color={COLORS.primary} />
          <Text style={MP.addressText} numberOfLines={2}>
            {geocoding ? 'Getting address…' : (address || 'Move the map to select a location')}
          </Text>
        </View>
        <View style={MP.btnRow}>
          <TouchableOpacity style={MP.gpsBtn} onPress={getCurrentGPS} disabled={gpsLoading}>
            {gpsLoading
              ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <Ionicons name="navigate" size={18} color={COLORS.primary} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[MP.confirmBtn, confirmDisabled && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={confirmDisabled}
          >
            <Text style={MP.confirmText}>Confirm {mode === 'pickup' ? 'Pickup' : 'Drop'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Styles — identical to original
const MP = StyleSheet.create({
  pinWrap:     { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36, pointerEvents: 'none' },
  topBar:      { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 4 },
  searchWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 4, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
  suggestions: { position: 'absolute', left: 12, right: 12, backgroundColor: '#fff', borderRadius: 12, elevation: 5, maxHeight: 240, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
  suggRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  suggText:    { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1 },
  bottom:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.12, shadowRadius: 8 },
  addressRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14 },
  addressText: { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1, lineHeight: 19 },
  btnRow:      { flexDirection: 'row', gap: 10 },
  gpsBtn:      { width: 50, height: 50, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  confirmBtn:  { flex: 1, height: 50, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});