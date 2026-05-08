/**
 * Firebase config for the Customer App.
 *
 * Phone Auth (FirebasePhoneAuthProvider, signInWithCredential) has been
 * REMOVED — phone OTP is now handled by the backend via Twilio SMS.
 *
 * Firebase is kept for:
 *  - FCM push notifications (via firebase/messaging)
 *  - Any analytics / crashlytics usage
 */
import { initializeApp, getApps, getApp } from 'firebase/app';

const firebaseConfig = {
  apiKey:            'AIzaSyAAQ7saVI5BoQNtgKCv0J7nb_p76Y2Py-o',
  authDomain:        'safe-delivery-92c0b.firebaseapp.com',
  projectId:         'safe-delivery-92c0b',
  storageBucket:     'safe-delivery-92c0b.firebasestorage.app',
  messagingSenderId: '499170612962',
  appId:             '1:499170612962:web:f19c9c95acae263c3c30bb',
};

let app;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.warn('[Firebase Customer] Init error:', e?.message);
  try { app = getApp(); } catch (_) {}
}

export default app;