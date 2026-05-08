import { useState, useEffect, useRef } from 'react';
import * as ExpoLocation from 'expo-location';
import { detectLocation } from '../api/locationApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeNum, isValidCoord } from '../utils/safeCoords';

const CACHE_KEY = 'sd_country_config';
const CACHE_TTL = 30 * 60 * 1000;

const LIBERIA_FALLBACK = {
  countryKey: 'LIBERIA', country: 'Liberia', countryCode: 'LR',
  environment: 'production',
  center: { lat: 6.4281, lng: -9.4295 },
  bounds: { south: 4.35, west: -11.49, north: 8.55, east: -7.37 },
  defaultZoom: 7, currency: 'USD',
};

export default function useCountry() {
  const [countryConfig, setCountryConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    init();
    return () => { mountedRef.current = false; };
  }, []);

  const init = async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, ts } = JSON.parse(cached);
          if (data && Date.now() - ts < CACHE_TTL) {
            if (mountedRef.current) { setCountryConfig(data); setLoading(false); }
            return;
          }
        } catch (_) {
          try { await AsyncStorage.removeItem(CACHE_KEY); } catch (_) {}
        }
      }
      await detect();
    } catch (_) {
      if (mountedRef.current) { setCountryConfig(LIBERIA_FALLBACK); setError('Detection failed'); }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const detect = async () => {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (!mountedRef.current) return LIBERIA_FALLBACK;
      let body = {};
      if (status === 'granted') {
        try {
          const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
          if (!mountedRef.current) return LIBERIA_FALLBACK;
          const lat = safeNum(loc?.coords?.latitude);
          const lng = safeNum(loc?.coords?.longitude);
          if (isValidCoord(lat, lng)) body = { lat: Number(lat), lng: Number(lng) };
        } catch (_) {}
      }
      const res = await detectLocation(body);
      if (!mountedRef.current) return LIBERIA_FALLBACK;
      const config = res?.data?.data;
      if (!config) throw new Error('No config');
      if (mountedRef.current) setCountryConfig(config);
      try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: config, ts: Date.now() })); } catch (_) {}
      return config;
    } catch (_) {
      if (mountedRef.current) setCountryConfig(LIBERIA_FALLBACK);
      return LIBERIA_FALLBACK;
    }
  };

  return { countryConfig, countryKey: countryConfig?.countryKey || 'LIBERIA', loading, error, refresh: detect };
}