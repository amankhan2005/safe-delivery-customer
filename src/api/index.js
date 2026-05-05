import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Switch between local and production
const BASE_URL = __DEV__
  ? 'http://192.168.29.123:5000/api'  
  : 'https://safe-delivery-backend.onrender.com/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token automatically
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('sd_customer_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('sd_customer_token');
    }
    return Promise.reject(error);
  }
);

// ─── AUTH ────────────────────────────────────────────────────────
export const signup         = (data) => api.post('/auth/signup', data);
export const verifyPhoneOTP = (data) => api.post('/auth/verify-phone-otp', data);
export const verifyEmailOTP = (data) => api.post('/auth/verify-email-otp', data);
export const resendOTP      = (data) => api.post('/auth/resend-otp', data);
export const login          = (data) => api.post('/auth/login', data);
export const sendLoginOTP   = (data) => api.post('/auth/send-login-otp', data);
export const verifyLoginOTP = (data) => api.post('/auth/verify-login-otp', data);
export const forgotPassword = (data) => api.post('/auth/forgot-password', data);
export const verifyResetOTP = (data) => api.post('/auth/verify-reset-otp', data);
export const resetPassword  = (data) => api.post('/auth/reset-password', data);
export const changePassword = (data) => api.post('/auth/change-password', data);
export const getMe          = ()     => api.get('/auth/me');
export const saveFcmToken   = (data) => api.post('/auth/fcm-token', data);

// ─── ORDERS ──────────────────────────────────────────────────────
export const calculateFare  = (data) => api.post('/orders/calculate-fare', data);
export const createOrder    = (data) => api.post('/orders/create', data);
export const getMyOrders    = ()     => api.get('/orders/my-orders');
export const getOrderById   = (id)   => api.get(`/orders/${id}`);
export const getOrderOTP    = (id)   => api.get(`/orders/${id}/otp`);
export const cancelOrder    = (id, data) => api.post(`/orders/${id}/cancel`, data);

// ─── PRICING
export const getAdminPricing = () => api.get('/orders/pricing');
// ─── RATINGS
export const rateDriver = (orderId, data) => api.post(`/orders/${orderId}/rate-driver`, data);

// ─── SUPPORT ─────────────────────────────────────────────────────
export const submitInquiry  = (data) => api.post('/inquiry', data);

export default api;