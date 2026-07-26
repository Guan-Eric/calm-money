import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  // @ts-expect-error React Native–only; present in the RN Firebase Auth bundle
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'calm-money-demo',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'calm-money-demo.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '0',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:0:web:demo',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/** Keep the user signed in across app launches on iOS/Android. */
function createAuth(): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Already initialized (Fast Refresh) or persistence unavailable
    return getAuth(app);
  }
}

export const auth: Auth = createAuth();
export { app };
export const db = getFirestore(app);
export const functions = getFunctions(app);

export const isFirebaseConfigured =
  Boolean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY) &&
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY !== 'demo-api-key';
