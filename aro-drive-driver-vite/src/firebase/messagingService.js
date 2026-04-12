import { getToken, onMessage } from "firebase/messaging";
import { messaging, db } from "./config";
import { doc, updateDoc } from "firebase/firestore";

// Audio for notifications
const notificationSound = new Audio("/notif-driver.mp3");

export const requestPermissionAndGetToken = async (uid) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
      if (token) {
        console.log("FCM Token obtained for Driver:", token);
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, { fcmToken: token });
        return token;
      }
    }
  } catch (error) {
    console.error("Error retrieving driver token:", error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("Driver received foreground message:", payload);
      
      // Play sound
      notificationSound.play().catch(e => console.error("Error playing sound:", e));
      
      resolve(payload);
    });
  });
