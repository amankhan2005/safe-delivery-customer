import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, FlatList, ActivityIndicator,
  Platform, Keyboard, StatusBar,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLocationSuggestions, getPlaceDetails } from '../../api/locationApi';
import { COLORS, SIZES, SHADOWS, FONT_WEIGHT } from '../../theme';

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// Clean readable address — never show lat/lng
async function getReverseAddress(lat, lng) {
  try {
    const results = await ExpoLocation.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results?.[0]) {
      const r = results[0];
      return [r.name, r.street, r.district, r.city, r.region, r.country]
        .filter(Boolean).join(', ');
    }
  } catch (_) {}
  return '';
}

export default function MapPickerScreen({ navigation, route }) {
  const { mode = 'pickup', initialCoords, countryKey = 'LIBERIA', bounds, callbackKey } = route.params || {};

  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);

  const DEFAULT_CENTRES = {
    LIBERIA: { latitude: 6.3005, longitude: -10.7969 },
    INDIA:   { latitude: 20.5937, longitude: 78.9629 },
  };
  const defaultCentre = DEFAULT_CENTRES[countryKey] || DEFAULT_CENTRES.LIBERIA;

  const [region, setRegion] = useState({
    latitude:      initialCoords?.lat || defaultCentre.latitude,
    longitude:     initialCoords?.lng || defaultCentre.longitude,
    latitudeDelta: 0.01, longitudeDelta: 0.01,
  });

  const [address,       setAddress]       = useState('');
  const [searchText,    setSearchText]    = useState('');
  const [suggestions,   setSuggestions]   = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [mapType,       setMapType]       = useState('standard');
  const [gpsLoading,    setGpsLoading]    = useState(false);
  const [geocoding,     setGeocoding]     = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const searchDebounce  = useRef(null);
  const geocodeDebounce = useRef(null);

  useEffect(() => {
    if (!initialCoords) getCurrentGPS();
    else doReverseGeocode(initialCoords.lat, initialCoords.lng);
  }, []);

  const doReverseGeocode = async (lat, lng) => {
    setGeocoding(true);
    const addr = await getReverseAddress(lat, lng);
    setAddress(addr);
    setGeocoding(false);
  };

  const getCurrentGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsLoading(false); return; }
      const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      const cLat = bounds ? clamp(lat, bounds.south, bounds.north) : lat;
      const cLng = bounds ? clamp(lng, bounds.west,  bounds.east)  : lng;
      const newRegion = { latitude: cLat, longitude: cLng, latitudeDelta: 0.008, longitudeDelta: 0.008 };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 600);
      doReverseGeocode(cLat, cLng);
    } catch (_) {}
    setGpsLoading(false);
  };

  const onRegionChangeComplete = useCallback(async (newRegion) => {
    if (bounds) {
      const cLat = clamp(newRegion.latitude, bounds.south, bounds.north);
      const cLng = clamp(newRegion.longitude, bounds.west,  bounds.east);
      if (cLat !== newRegion.latitude || cLng !== newRegion.longitude) {
        const clamped = { ...newRegion, latitude: cLat, longitude: cLng };
        setRegion(clamped);
        mapRef.current?.animateToRegion(clamped, 300);
        doReverseGeocode(cLat, cLng);
        return;
      }
    }
    setRegion(newRegion);
    setSearchText('');
    clearTimeout(geocodeDebounce.current);
    geocodeDebounce.current = setTimeout(() => doReverseGeocode(newRegion.latitude, newRegion.longitude), 500);
  }, [bounds]);

  // ── Search ──────────────────────────────────────────────────────────────────
  const handleSearchChange = (text) => {
    setSearchText(text);
    clearTimeout(searchDebounce.current);
    if (text.trim().length < 2) { setSuggestions([]); return; }

    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await getLocationSuggestions(text.trim(), countryKey);
        setSuggestions(res?.data?.data?.suggestions || []);
      } catch (_) { setSuggestions([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const handleSuggestionSelect = async (item) => {
    Keyboard.dismiss();
    setSuggestions([]);
    setSearchFocused(false);
    const label = item.description || item.mainText || '';
    setSearchText(label);
    setAddress(label);
    try {
      const res = await getPlaceDetails(item.placeId);
      const { lat, lng, address: addr } = res.data.data;
      const newRegion = { latitude: lat, longitude: lng, latitudeDelta: 0.008, longitudeDelta: 0.008 };
      setRegion(newRegion);
      setAddress(addr || label);
      mapRef.current?.animateToRegion(newRegion, 600);
    } catch (_) {}
  };

  const handleConfirm = () => {
    const finalAddress = address || searchText;
    if (!finalAddress) return;
    if (callbackKey && global._mapPickerCallbacks?.[callbackKey]) {
      global._mapPickerCallbacks[callbackKey]({ lat: region.latitude, lng: region.longitude, address: finalAddress });
      delete global._mapPickerCallbacks[callbackKey];
    }
    navigation.goBack();
  };

  const modeLabel = mode === 'pickup' ? 'Pickup Location' : 'Drop Location';
  const modeColor = mode === 'pickup' ? '#22C55E' : '#EF4444';
  const hasAddress = !!(address || searchText);

  return (
    <View style={S.root}>
      <StatusBar barStyle="dark-content" />

      <MapView
        ref={mapRef}
        style={S.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      />

      {/* Crosshair */}
      <View style={S.crosshairWrap} pointerEvents="none">
        <View style={[S.crosshairPin, { borderColor: modeColor }]}>
          <View style={[S.crosshairDot, { backgroundColor: modeColor }]} />
        </View>
        <View style={[S.crosshairShadow, { backgroundColor: modeColor + '30' }]} />
      </View>

      {/* Geocoding indicator on crosshair */}
      {geocoding && (
        <View style={S.geocodingPill} pointerEvents="none">
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={S.geocodingText}>Getting address...</Text>
        </View>
      )}

      {/* Top bar */}
      <View style={[S.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={S.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.gray900} />
        </TouchableOpacity>

        <View style={[S.searchBox, searchFocused && S.searchBoxFocused]}>
          <Ionicons name="search-outline" size={16} color={COLORS.gray400} />
          <TextInput
            style={S.searchInput}
            placeholder={`Search ${mode === 'pickup' ? 'pickup' : 'drop'} address...`}
            placeholderTextColor={COLORS.gray400}
            value={searchText}
            onChangeText={handleSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searching && <ActivityIndicator size="small" color={COLORS.primary} />}
          {!searching && searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); setSuggestions([]); }}>
              <Ionicons name="close-circle" size={16} color={COLORS.gray400} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[S.iconBtn, mapType === 'satellite' && { backgroundColor: COLORS.primary }]}
          onPress={() => setMapType(t => t === 'standard' ? 'satellite' : 'standard')}
        >
          <Ionicons name="earth-outline" size={18} color={mapType === 'satellite' ? '#fff' : COLORS.gray700} />
        </TouchableOpacity>
      </View>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <View style={[S.dropdown, { top: insets.top + 68 }]}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={S.suggestionRow} onPress={() => handleSuggestionSelect(item)} activeOpacity={0.7}>
                <View style={S.suggestionIcon}>
                  <Ionicons name="location-outline" size={14} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.suggestionMain} numberOfLines={1}>{item.mainText}</Text>
                  <Text style={S.suggestionSub}  numberOfLines={1}>{item.secondaryText}</Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F1F5F9', marginLeft: 48 }} />}
          />
        </View>
      )}

      {/* GPS button */}
      <TouchableOpacity style={[S.gpsBtn, { bottom: insets.bottom + 168 }]} onPress={getCurrentGPS} disabled={gpsLoading}>
        {gpsLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="locate" size={20} color={COLORS.primary} />}
      </TouchableOpacity>

      {/* Bottom sheet */}
      <View style={[S.bottomSheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <View style={[S.modeIndicator, { backgroundColor: modeColor }]} />
          <Text style={S.modeLabel}>{modeLabel}</Text>
        </View>

        <View style={[S.addressPreview, !hasAddress && { borderColor: '#E5E7EB' }]}>
          <Ionicons name="location" size={16} color={hasAddress ? modeColor : COLORS.gray300} />
          <Text style={[S.addressText, !hasAddress && { color: COLORS.gray400 }]} numberOfLines={2}>
            {geocoding ? 'Getting address...' : (address || searchText || 'Move map or search to select location')}
          </Text>
        </View>

        <TouchableOpacity
          style={[S.confirmBtn, { backgroundColor: hasAddress ? modeColor : '#D1D5DB' }]}
          onPress={handleConfirm}
          disabled={!hasAddress}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={S.confirmText}>Confirm {modeLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  map:  { ...StyleSheet.absoluteFillObject },

  crosshairWrap: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -44, alignItems: 'center' },
  crosshairPin:  { width: 40, height: 40, borderRadius: 20, borderWidth: 3, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  crosshairDot:  { width: 14, height: 14, borderRadius: 7 },
  crosshairShadow: { width: 20, height: 6, borderRadius: 3, marginTop: 2 },

  geocodingPill: { position: 'absolute', top: '50%', alignSelf: 'center', marginTop: 10, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, elevation: 4 },
  geocodingText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 8, zIndex: 10 },

  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },

  searchBox: { flex: 1, height: 44, backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, borderWidth: 1.5, borderColor: 'transparent', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  searchBoxFocused: { borderColor: COLORS.primary },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500', minHeight: 40, paddingVertical: 0 },

  dropdown: { position: 'absolute', left: 12, right: 12, backgroundColor: '#fff', borderRadius: 12, maxHeight: 280, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, overflow: 'hidden', zIndex: 20 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  suggestionIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  suggestionMain: { fontSize: 14, color: '#111827', fontWeight: '600' },
  suggestionSub:  { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  gpsBtn: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },

  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingTop: 24, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, zIndex: 10 },
  modeIndicator: { width: 8, height: 8, borderRadius: 4 },
  modeLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8 },
  addressPreview: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#DBEAFE', marginBottom: 14 },
  addressText: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '600', lineHeight: 20 },
  confirmBtn: { height: 52, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 3 },
  confirmText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});