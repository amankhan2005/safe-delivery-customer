import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { safeNum, isValidCoord } from '../utils/safeCoords';

export default function useLocation() {
  const [location, setLocation] = useState(null);
  const [address,  setAddress]  = useState('Current Location');
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const getLocation = async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mountedRef.current) return;
      if (status !== 'granted') { setError('Location permission denied'); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!mountedRef.current) return;

      // safeNum — expo-location can return strings on some Android versions
      const lat = safeNum(loc?.coords?.latitude);
      const lng = safeNum(loc?.coords?.longitude);
      if (!isValidCoord(lat, lng)) { setError('Could not get valid location'); return; }

      setLocation({ lat: Number(lat), lng: Number(lng) });

      try {
        const [geo] = await Location.reverseGeocodeAsync({ latitude: Number(lat), longitude: Number(lng) });
        if (!mountedRef.current) return;
        if (geo) {
          const parts = [geo.street, geo.district, geo.city].filter(Boolean);
          setAddress(parts.join(', ') || 'Current Location');
        }
      } catch (_) {}
    } catch (e) {
      if (mountedRef.current) setError(e?.message || 'Location unavailable');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => { getLocation(); }, []); // eslint-disable-line

  return { location, address, error, loading, refresh: getLocation };
}