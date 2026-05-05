import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  PhoneAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAAQ7saVI5BoQNtgKCv0J7nb_p76Y2Py-o',         
  authDomain: 'safe-delivery-92c0b.firebaseapp.com',
  projectId:'safe-delivery-92c0b',
  storageBucket:'safe-delivery-92c0b.firebasestorage.app',
  messagingSenderId:'499170612962',
  appId: '1:499170612962:web:f19c9c95acae263c3c30bb'
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