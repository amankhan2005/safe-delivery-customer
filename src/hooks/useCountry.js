/**
 * useCountry.js
 *
 * Detects user's country (LIBERIA / INDIA) on app open.
 * Uses GPS first → backend detect endpoint → caches result.
 */

import { useState, useEffect } from 'react';
import * as ExpoLocation from 'expo-location';
import { detectLocation } from '../api/locationApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'sd_country_config';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export default function useCountry() {
  const [countryConfig, setCountryConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    try {
      // Check cache first
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setCountryConfig(data);
          setLoading(false);
          return;
        }
      }

      await detect();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const detect = async () => {
    try {
      // Try GPS first
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      let body = {};

      if (status === 'granted') {
        const loc = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });
        body = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      }

      const res = await detectLocation(body);
      const config = res.data.data;

      setCountryConfig(config);

      // Cache it
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: config, ts: Date.now() })
      );

      return config;
    } catch (e) {
      // Fallback to LIBERIA if detection completely fails
      const fallback = {
        countryKey: 'LIBERIA',
        country: 'Liberia',
        countryCode: 'LR',
        environment: 'production',
        center: { lat: 6.3, lng: -9.4 },
        bounds: { south: 4.35, west: -11.49, north: 8.55, east: -7.37 },
        defaultZoom: 7,
        currency: 'USD',
      };
      setCountryConfig(fallback);
      return fallback;
    }
  };

  return {
    countryConfig,
    countryKey: countryConfig?.countryKey || 'LIBERIA',
    loading,
    error,
    refresh: detect,
  };
}