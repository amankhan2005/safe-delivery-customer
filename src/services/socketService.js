import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidCoord, safeNum } from '../utils/safeCoords';

const BASE_URL = 'https://safe-delivery-backend.onrender.com';

let socket = null;
let _connecting = false;

export async function connectSocket() {
  if (socket?.connected) return socket;
  if (_connecting) {
    await new Promise(r => setTimeout(r, 1500));
    return socket;
  }
  const token = await AsyncStorage.getItem('sd_customer_token');
  if (!token) return null;
  _connecting = true;
  if (socket) { try { socket.disconnect(); } catch (_) {} socket = null; }
  try {
    socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 15000,
      forceNew: true,
    });
    socket.on('connect',       () => { _connecting = false; });
    socket.on('connect_error', () => { _connecting = false; });
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        setTimeout(() => { try { if (socket) socket.connect(); } catch (_) {} }, 3000);
      }
    });
  } catch (_) { _connecting = false; socket = null; }
  _connecting = false;
  return socket;
}

export function disconnectSocket() {
  if (socket) { try { socket.disconnect(); } catch (_) {} socket = null; }
}

export function subscribeRideEvents(orderId, callback) {
  if (!socket) return () => {};
  const room = `order_${orderId}`;
  try { socket.emit('join_room', room); } catch (_) {}
  const events = ['ride:rider_assigned','ride:picked_up','ride:in_transit','ride:arrived','ride:delivered','ride:cancelled'];
  const handlers = {};
  events.forEach(e => {
    handlers[e] = (data) => { try { callback(e, data); } catch (_) {} };
    try { socket.on(e, handlers[e]); } catch (_) {}
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
      // Always validate — socket data is completely untrusted
      const lat = safeNum(data?.lat);
      const lng = safeNum(data?.lng);
      if (!isValidCoord(lat, lng)) return;
      // Always pass Number() — never strings to MapView
      callback({ lat: Number(lat), lng: Number(lng) });
    } catch (_) {}
  };
  try { socket.on('rider:location', handler); } catch (_) {}
  return () => { try { socket?.off('rider:location', handler); } catch (_) {} };
}