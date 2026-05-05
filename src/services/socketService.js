/**
 * socketService.js — Customer App
 *
 * Manages the Socket.IO connection for real-time features:
 *  - Rider live location updates
 *  - Ride status events (assigned, picked_up, in_transit, arrived, delivered)
 *  - Cancelled notifications
 */

import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = __DEV__
  ? 'http://192.168.29.123:5000'
  : 'https://safe-delivery-backend.onrender.com';

let socket = null;

/**
 * Connect to socket server with JWT auth.
 * Call this once after login / on app start.
 */
export async function connectSocket() {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('sd_customer_token');
  if (!token) return null;

  socket = io(BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  return socket;
}

/**
 * Disconnect socket (call on logout).
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Subscribe to rider location updates for a specific order.
 * callback: ({ lat, lng, riderId, orderId }) => void
 * Returns unsubscribe function.
 */
export function subscribeRiderLocation(orderId, callback) {
  if (!socket) return () => {};

  // Ask server to track this order
  socket.emit('customer:track_order', { orderId });

  const handler = (data) => {
    if (data.orderId === orderId) callback(data);
  };

  socket.on('rider:location', handler);

  return () => socket?.off('rider:location', handler);
}

/**
 * Subscribe to ride status events.
 * Events: ride:rider_assigned, ride:picked_up, ride:in_transit,
 *         ride:arrived, ride:delivered, ride:cancelled
 * callback: (eventName, data) => void
 * Returns unsubscribe function.
 */
export function subscribeRideEvents(orderId, callback) {
  if (!socket) return () => {};

  const events = [
    'ride:rider_assigned',
    'ride:picked_up',
    'ride:in_transit',
    'ride:arrived',
    'ride:delivered',
    'ride:cancelled',
    'ride:status',
  ];

  const handlers = {};

  events.forEach((event) => {
    handlers[event] = (data) => {
      if (!data.orderId || data.orderId === orderId) {
        callback(event, data);
      }
    };
    socket.on(event, handlers[event]);
  });

  return () => {
    events.forEach((event) => {
      if (socket) socket.off(event, handlers[event]);
    });
  };
}

export function getSocket() {
  return socket;
}