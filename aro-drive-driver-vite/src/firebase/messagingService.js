import { getToken, onMessage } from "firebase/messaging";
import { messaging, db } from "./config";
import { doc, updateDoc } from "firebase/firestore";

// Audio for notifications
const notificationSound = new Audio("/notif-driver.mp3");
notificationSound.preload = 'auto'; // Ensure it's preloaded


export const requestPermissionAndGetToken = async (uid) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
      if (token) {
        console.log("FCM Token obtained for Driver:", token);
        
        // Write FCM Token to both collections for robust lookup
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, { fcmToken: token }).catch(e => console.error("Error updating users collection FCM:", e));
        
        const driverRef = doc(db, "drivers", uid);
        await updateDoc(driverRef, { fcmToken: token }).catch(e => console.error("Error updating drivers collection FCM:", e));
        
        return token;
      }
    }
  } catch (error) {
    console.error("Error retrieving driver token:", error);
  }
};

export const registerOnMessageListener = (callback) => {
  return onMessage(messaging, (payload) => {
    console.log("Driver received foreground message:", payload);
    
    // Attempt to play internal sound as backup
    notificationSound.play().catch(e => console.log("Foreground buzzer skipped (blocked or unnecessary):", e));
    
    // Vibrate if supported
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
    }
    
    callback(payload);
  });
};
