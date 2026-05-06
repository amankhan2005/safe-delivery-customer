import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  PhoneAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            'AIzaSyAAQ7saVI5BoQNtgKCv0J7nb_p76Y2Py-o',
  authDomain:        'safe-delivery-92c0b.firebaseapp.com',
  projectId:         'safe-delivery-92c0b',
  storageBucket:     'safe-delivery-92c0b.firebasestorage.app',
  messagingSenderId: '499170612962',
  appId:             '1:499170612962:web:f19c9c95acae263c3c30bb',
};

let app;
let auth;

try {
  // Prevent duplicate app initialization on hot reload / fast refresh
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    // Only call initializeAuth on a fresh app instance
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    // App already initialized — reuse existing instance + auth
    app  = getApp();
    auth = getAuth(app);
  }
} catch (e) {
  // Log initialization errors so they are visible in Metro / device logs
  console.log('[Firebase] Initialization error:', e?.message || e);

  // Last-resort fallback: if initializeAuth threw but the app exists, try getAuth
  try {
    if (!app)  app  = getApp();
    if (!auth) auth = getAuth(app);
  } catch (fallbackErr) {
    console.log('[Firebase] Fallback getAuth error:', fallbackErr?.message || fallbackErr);
  }
}

export { auth, PhoneAuthProvider, signInWithCredential };
export default app;