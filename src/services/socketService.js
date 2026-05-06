import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://safe-delivery-backend.onrender.com';

let socket = null;

export async function connectSocket() {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('sd_customer_token');
  if (!token) return null;

  // Disconnect old socket if exists
  if (socket) { socket.disconnect(); socket = null; }

  socket = io(BASE_URL, {
    auth:                { token },
    transports:          ['websocket'],
    reconnection:        true,
    reconnectionAttempts: 5,
    reconnectionDelay:   2000,
    timeout:             10000,
  });

  socket.on('connect',       () => {});
  socket.on('connect_error', () => {});
  socket.on('disconnect',    () => {});

  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}

export function subscribeRideEvents(orderId, callback) {
  if (!socket) return () => {};
  const room = `order_${orderId}`;
  socket.emit('join_room', room);

  const events = [
    'ride:rider_assigned', 'ride:picked_up', 'ride:in_transit',
    'ride:arrived', 'ride:delivered', 'ride:cancelled',
  ];
  const handlers = {};
  events.forEach(e => {
    handlers[e] = (data) => {
      try { callback(e, data); } catch (_) {}
    };
    socket.on(e, handlers[e]);
  });

  return () => {
    try { socket?.emit('leave_room', room); } catch (_) {}
    events.forEach(e => { try { socket?.off(e, handlers[e]); } catch (_) {} });
  };
}

export function subscribeRiderLocation(orderId, callback) {
  if (!socket) return () => {};
  const handler = (data) => {
    try {
      // KEY FIX: strict null check — data.lat could be 0 (valid coord)
      if (data?.lat != null && data?.lng != null) callback(data);
    } catch (_) {}
  };
  socket.on('rider:location', handler);
  return () => { try { socket?.off('rider:location', handler); } catch (_) {} };
}