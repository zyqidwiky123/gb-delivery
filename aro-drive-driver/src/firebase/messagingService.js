import { doc, updateDoc } from "firebase/firestore";
import { db } from "./config";
import { Platform, Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import { Audio } from "expo-av";

// Configure Expo notifications behavior
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldVibrate: true,
    }),
  });
}

// Native Sound Playback Helper
const playNotificationSound = async () => {
  try {
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/notif-driver.mp3')
    );
    await sound.playAsync();
    // Unload the sound from memory when it finishes playing
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync().catch(e => console.log("[Audio] Unload sound error:", e));
      }
    });
  } catch (e) {
    console.log("[Audio] Failed to play native sound:", e);
  }
};

export const requestPermissionAndGetToken = async (uid) => {
  if (Platform.OS === 'web') {
    console.log("Web push tokens not configured natively.");
    return null;
  }
  
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log("Notification permission not granted");
      return null;
    }

    // Get FCM Device Token dynamically
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data;

    if (token) {
      console.log("Native Push Token obtained for Driver:", token);
      
      // Write FCM Token to both collections for robust lookup
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, { fcmToken: token }).catch(e => console.error("Error updating users collection FCM:", e));
      
      const driverRef = doc(db, "drivers", uid);
      await updateDoc(driverRef, { fcmToken: token }).catch(e => console.error("Error updating drivers collection FCM:", e));
      
      return token;
    }
  } catch (error) {
    console.error("Error retrieving driver native push token:", error);
  }
};

export const registerOnMessageListener = (callback) => {
  if (Platform.OS === 'web') return () => {};

  // Register foreground notification received listener
  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log("Driver received native foreground notification:", notification);
    
    // Play sound and vibrate as alert feedback
    playNotificationSound();
    if (Platform.OS === 'android') {
      Vibration.vibrate([200, 100, 200]);
    } else {
      Vibration.vibrate();
    }
    
    const data = notification.request.content.data;
    callback(data);
  });

  return () => {
    subscription.remove();
  };
};

