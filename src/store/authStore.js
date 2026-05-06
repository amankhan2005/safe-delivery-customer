import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe } from '../api';

const useAuthStore = create((set, get) => ({
  token:   null,
  user:    null,
  loading: true,

  // Called on app start — restore session with retry
  init: async () => {
    try {
      const token = await AsyncStorage.getItem('sd_customer_token');
      if (token) {
        set({ token });
        try {
          const res = await getMe(); // already has retry built in
          set({ user: res.data.data.user, loading: false });
        } catch {
          // Token exists but /me failed — clear and show auth
          await AsyncStorage.removeItem('sd_customer_token');
          set({ token: null, user: null, loading: false });
        }
      } else {
        set({ loading: false });
      }
    } catch {
      await AsyncStorage.removeItem('sd_customer_token').catch(() => {});
      set({ token: null, user: null, loading: false });
    }
  },

  setAuth: async (token, user) => {
    await AsyncStorage.setItem('sd_customer_token', token);
    set({ token, user });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    await AsyncStorage.removeItem('sd_customer_token').catch(() => {});
    set({ token: null, user: null });
  },
}));

export default useAuthStore;