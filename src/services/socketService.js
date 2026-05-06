import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Always use production URL in built APK
const BASE_URL = 'https://safe-delivery-backend.onrender.com';

let socket = null;

export async function connectSocket() {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('sd_customer_token');
  if (!token) return null;

  socket = io(BASE_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  socket.on('connect', () => {});
  socket.on('connect_error', () => {});
  socket.on('disconnect', () => {});

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function subscribeRideEvents(orderId, callback) {
  if (!socket) return () => {};
  const room = `order_${orderId}`;
  socket.emit('join_room', room);

  const events = [
    'ride:rider_assigned','ride:picked_up','ride:in_transit',
    'ride:arrived','ride:delivered','ride:cancelled',
  ];
  const handlers = {};
  events.forEach(e => {
    handlers[e] = (data) => callback(e, data);
    socket.on(e, handlers[e]);
  });

  return () => {
    socket?.emit('leave_room', room);
    events.forEach(e => socket?.off(e, handlers[e]));
  };
}

export function subscribeRiderLocation(orderId, callback) {
  if (!socket) return () => {};
  const handler = (data) => {
    if (data?.orderId === orderId || data?.lat) callback(data);
  };
  socket.on('rider:location', handler);
  return () => socket?.off('rider:location', handler);
}