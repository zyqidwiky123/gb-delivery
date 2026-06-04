import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Web FCM messaging is not supported out-of-the-box in React Native without setup.
// import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Debugging Aid: Cek jika API Key hilang
if (!firebaseConfig.apiKey) {
  console.error("FATAL ERROR: Firebase API Key is missing! Check your environment variables.");
}

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(require('@react-native-async-storage/async-storage').default)
});
export const db = initializeFirestore(app, {});
export const storage = getStorage(app);
// export const messaging = getMessaging(app);
