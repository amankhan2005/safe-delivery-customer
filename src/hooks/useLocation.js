import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export default function useLocation() {
  const [location, setLocation] = useState(null);
  const [address,  setAddress]  = useState('Current Location');
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const getLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });

      // Reverse geocode
      const [geo] = await Location.reverseGeocodeAsync({
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geo) {
        const parts = [geo.street, geo.district, geo.city].filter(Boolean);
        setAddress(parts.join(', ') || 'Current Location');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { getLocation(); }, []);

  return { location, address, error, loading, refresh: getLocation };
}
