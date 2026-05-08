/**
 * locationApi.js
 * Connects to backend /api/location/* endpoints.
 */

import api from './index';

/**
 * Detect user's country from GPS coordinates (or IP fallback).
 * body: { lat?, lng? }
 */
export const detectLocation = (body = {}) =>
  api.post('/location/detect', body);

/**
 * Get autocomplete suggestions restricted to a country.
 * params: { q: string, country: 'LIBERIA' | 'INDIA' }
 */
export const getLocationSuggestions = (q, country, lat = null, lng = null) =>
  api.get('/location/suggestions', {
    params: {
      q,
      country,
      ...(lat != null && lng != null ? { lat, lng } : {}),
    },
  });

/**
 * Resolve a Google Place ID to { lat, lng, address }.
 */
export const getPlaceDetails = (placeId) =>
  api.get(`/location/place/${placeId}`);

/**
 * Validate that pickup and drop are in the same country.
 */
export const validateRideLocations = (data) =>
  api.post('/location/validate-ride', data);

/**
 * Get map config (bounds, center, zoom) for a country.
 */
export const getMapConfig = (country) =>
  api.get('/location/config', { params: { country } });

/**
 * Get rider's live location for a specific order (REST fallback).
 */
export const getRiderLocation = (orderId) =>
  api.get(`/orders/${orderId}/rider-location`);