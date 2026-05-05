import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  PhoneAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY             || '',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN         || '',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID          || '',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET      || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID              || '',
};

let app;
let auth;

try {
  app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  console.log('[Firebase] Initialized. Project:', firebaseConfig.projectId);
} catch (e) {
  console.error('[Firebase] Init error:', e.message);
}

export { auth, PhoneAuthProvider, signInWithCredential };
export default app;