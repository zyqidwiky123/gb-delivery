import { db } from "./config";
import { doc, updateDoc } from "firebase/firestore";

// Lazy-load messaging instance — only initialized when actually needed (not for guests)
let _messagingInstance = null;

const getMessagingLazy = async () => {
  if (_messagingInstance) return _messagingInstance;
  const { getMessaging } = await import("firebase/messaging");
  // getMessaging() auto-detects the already-initialized default Firebase app from config.js
  _messagingInstance = getMessaging();
  return _messagingInstance;
};

export const requestPermissionAndGetToken = async (uid) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messaging = await getMessagingLazy();
      const { getToken } = await import("firebase/messaging");
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
      if (token) {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, { fcmToken: token });
        return token;
      }
    }
  } catch (error) {
    // Error logging intentionally kept — critical for debugging FCM issues
    if (typeof console !== 'undefined') console.error("An error occurred while retrieving token:", error);
  }
};

/**
 * Persistent message listener — calls callback for every foreground notification.
 * Returns an unsubscribe function for cleanup.
 */
export const onMessageListener = (callback) => {
  let unsubscribe = null;

  getMessagingLazy().then(async (messaging) => {
    const { onMessage } = await import("firebase/messaging");
    unsubscribe = onMessage(messaging, (payload) => {
      callback(payload);
    });
  }).catch((err) => {
    if (typeof console !== 'undefined') console.error("Failed to initialize messaging listener:", err);
  });

  // Return cleanup function
  return () => {
    if (typeof unsubscribe === 'function') unsubscribe();
  };
};
