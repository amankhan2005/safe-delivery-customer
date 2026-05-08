import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://safe-delivery-backend.onrender.com/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 35000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('sd_customer_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (_) {}
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      try { await AsyncStorage.removeItem('sd_customer_token'); } catch (_) {}
    }
    return Promise.reject(error);
  }
);

// Retry only on network errors or 5xx — not on 4xx client errors
const withRetry = async (fn, retries = 3, delayMs = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isNetwork   = !err.response;
      const isServerErr = err.response?.status >= 500;
      const isLast      = i === retries - 1;
      if ((!isNetwork && !isServerErr) || isLast) throw err;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
};

export const pingBackend = () =>
  axios.get('https://safe-delivery-backend.onrender.com/health', { timeout: 35000 })
    .catch(() => {});

const NO_CACHE = {
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const signup          = (data) => withRetry(() => api.post('/auth/signup', data));
export const sendPhoneOTP    = (data) => withRetry(() => api.post('/auth/send-phone-otp', data));    // NEW
export const verifyPhoneOTP  = (data) => withRetry(() => api.post('/auth/verify-phone-otp', data));  // payload: {phone, otp}
export const verifyEmailOTP  = (data) => withRetry(() => api.post('/auth/verify-email-otp', data));
export const resendOTP       = (data) => withRetry(() => api.post('/auth/resend-otp', data));
export const login           = (data) => withRetry(() => api.post('/auth/login', data), 4, 2000);
export const forgotPassword  = (data) => withRetry(() => api.post('/auth/forgot-password', data));
export const resendForgotOTP = (data) => withRetry(() => api.post('/auth/resend-forgot-otp', data));
export const verifyResetOTP  = (data) => withRetry(() => api.post('/auth/verify-reset-otp', data));
export const resetPassword   = (data) => withRetry(() => api.post('/auth/reset-password', data));
export const changePassword  = (data) => withRetry(() => api.post('/auth/change-password', data));
export const getMe           = ()     => withRetry(() => api.get('/auth/me'), 3, 2000);
export const saveFcmToken    = (data) => api.post('/auth/fcm-token', data).catch(() => {});
export const deleteAccount   = (data) => withRetry(() => api.delete('/auth/delete-account', { data }));

// ─── ORDERS ───────────────────────────────────────────────────────────────────
export const calculateFare   = (data) => withRetry(() => api.post('/orders/calculate-fare', data));
export const createOrder     = (data) => api.post('/orders/create', data);
export const getMyOrders     = ()     => withRetry(() => api.get('/orders/my-orders', NO_CACHE));
export const getOrderById    = (id)   => withRetry(() => api.get(`/orders/${id}`, NO_CACHE));
export const getOrderOTP     = (id)   => api.get(`/orders/${id}/otp`, NO_CACHE);
export const cancelOrder     = (id, data) => api.post(`/orders/${id}/cancel`, data);
export const getAdminPricing = ()     => withRetry(() => api.get('/orders/pricing'));
export const rateDriver      = (orderId, data) => api.post(`/orders/${orderId}/rate-driver`, data);

// ─── SUPPORT ──────────────────────────────────────────────────────────────────
export const submitInquiry   = (data) => api.post('/inquiry', data);

export default api;