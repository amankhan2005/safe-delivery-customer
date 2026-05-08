/**
 * safeCoords.js
 * Single source of truth for all coordinate validation.
 * Every value touching MapView/Marker MUST pass through these functions.
 */

export const FALLBACK_COORDS = {
  LIBERIA: { latitude: 6.4281,  longitude: -9.4295 },
  INDIA:   { latitude: 28.6139, longitude: 77.2090 },
  DEFAULT: { latitude: 6.4281,  longitude: -9.4295 },
};

// Convert ANY value to a real JS Number. Returns NaN on failure.
export function safeNum(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(n) ? NaN : n;
}

// Strict WGS-84 validation.
export function isValidCoord(lat, lng) {
  const la = safeNum(lat);
  const lo = safeNum(lng);
  return (
    !isNaN(la) && !isNaN(lo) &&
    isFinite(la) && isFinite(lo) &&
    la >= -90 && la <= 90 &&
    lo >= -180 && lo <= 180
  );
}

// Sanitise a coord object from any source.
export function safeCoord(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const rawLat = obj.lat !== undefined ? obj.lat : obj.latitude;
  const rawLng = obj.lng !== undefined ? obj.lng : obj.longitude;
  const lat = safeNum(rawLat);
  const lng = safeNum(rawLng);
  if (isValidCoord(lat, lng)) return { lat: Number(lat), lng: Number(lng) };
  return null;
}

// Build a valid MapView region object. Returns null if invalid.
export function safeRegion(lat, lng, deltaLat = 0.01, deltaLng = 0.01) {
  const la = safeNum(lat);
  const lo = safeNum(lng);
  if (!isValidCoord(la, lo)) return null;
  return {
    latitude:       Number(la),
    longitude:      Number(lo),
    latitudeDelta:  Number(deltaLat)  || 0.01,
    longitudeDelta: Number(deltaLng) || 0.01,
  };
}

// Build a Marker coordinate prop. Returns null if invalid.
export function safeMarkerCoord(lat, lng) {
  const la = safeNum(lat);
  const lo = safeNum(lng);
  if (!isValidCoord(la, lo)) return null;
  return { latitude: Number(la), longitude: Number(lo) };
}

// Build tracking map region — exact original logic with safety guards.
export function buildTrackingRegion(riderCoords, rawPickupLat, rawPickupLng, rawDropLat, rawDropLng) {
  const pickupLat = safeNum(rawPickupLat);
  const pickupLng = safeNum(rawPickupLng);
  const dropLat   = safeNum(rawDropLat);
  const dropLng   = safeNum(rawDropLng);
  const riderSafe = safeCoord(riderCoords);
  const hasPickup = isValidCoord(pickupLat, pickupLng);
  const hasDrop   = isValidCoord(dropLat, dropLng);

  if (riderSafe) {
    const cLat = (riderSafe.lat + (hasPickup ? pickupLat : riderSafe.lat)) / 2;
    const cLng = (riderSafe.lng + (hasPickup ? pickupLng : riderSafe.lng)) / 2;
    return safeRegion(cLat, cLng, 0.04, 0.04);
  }
  if (hasPickup) {
    const cLat = (pickupLat + (hasDrop ? dropLat : pickupLat)) / 2;
    const cLng = (pickupLng + (hasDrop ? dropLng : pickupLng)) / 2;
    return safeRegion(cLat, cLng, 0.04, 0.04);
  }
  return null;
}