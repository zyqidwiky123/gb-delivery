import { getToken, onMessage } from "firebase/messaging";
import { messaging, db } from "./config";
import { doc, updateDoc } from "firebase/firestore";

export const requestPermissionAndGetToken = async (uid) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY // Ensure this is set in .env
      });
      if (token) {
        console.log("FCM Token obtained:", token);
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, { fcmToken: token });
        return token;
      } else {
        console.log("No registration token available. Request permission to generate one.");
      }
    } else {
      console.log("Notification permission denied.");
    }
  } catch (error) {
    console.error("An error occurred while retrieving token:", error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("Received foreground message:", payload);
      resolve(payload);
    });
  });
