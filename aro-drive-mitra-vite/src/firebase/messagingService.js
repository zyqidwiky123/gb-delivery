import { getToken, onMessage } from "firebase/messaging";
import { messaging, db } from "./config";
import { doc, updateDoc } from "firebase/firestore";

export const requestPermissionAndGetToken = async (uid) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: "BOy3U2W54_T-Wun4_P97z6H8G76h8G76h8G76h8G76h8G76h8G76h8G76h8G76h8" // Example VAPID, user should use their own
      });
      if (token) {
        console.log("FCM Token obtained for Merchant:", token);
        const merchantRef = doc(db, "merchants", uid);
        await updateDoc(merchantRef, { fcmToken: token });
        return token;
      }
    }
  } catch (error) {
    console.error("Error retrieving merchant token:", error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("Merchant received foreground message:", payload);
      
      // Vibrate if supported
      if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200]);
      }
      
      resolve(payload);
    });
  });
