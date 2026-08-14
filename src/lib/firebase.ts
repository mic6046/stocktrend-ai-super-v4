import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBOwzWjs4eGoqrFfb5mLaM1rtWaYsuovew',
  authDomain: 'stocktrend-ai-super.firebaseapp.com',
  projectId: 'stocktrend-ai-super',
  storageBucket: 'stocktrend-ai-super.firebasestorage.app',
  messagingSenderId: '357117913612',
  appId: '1:357117913612:web:055a557a7dd4d76f0fdc29',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

/**
 * Long polling is more reliable than WebChannel on iOS Safari, Android Chrome PWAs,
 * and flaky mobile networks — critical for same-account sync across devices.
 */
export const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
});
