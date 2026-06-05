import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AudioPlayer } from 'expo-audio';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Helper to play notification sound
const playNotificationSound = async () => {
  try {
    const audioPlayer = new AudioPlayer(require('../../assets/sounds/notif_driver.mp3'));
    await audioPlayer.play();
    console.log("[Audio] Successfully played notification sound in foreground");
  } catch (e) {
    console.warn("[Audio] Failed to play native sound in foreground:", e);
  }
};

export function usePushNotifications(userUid) {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [fcmToken, setFcmToken] = useState('');
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (!userUid) return;

    registerForPushNotificationsAsync().then(tokens => {
      if (tokens) {
        setExpoPushToken(tokens.expoToken);
        setFcmToken(tokens.deviceToken);
        
        // Save FCM token to Firestore so Cloud Functions can dispatch to it
        if (tokens.deviceToken) {
          console.log("[FCM] ✅ Token berhasil didapat:", tokens.deviceToken.substring(0, 30) + "...");
          setDoc(doc(db, 'drivers', userUid), {
            fcmToken: tokens.deviceToken
          }, { merge: true })
            .then(() => console.log("[FCM] ✅ Token tersimpan ke Firestore"))
            .catch(err => {
              console.error("[FCM] ❌ Gagal simpan token ke Firestore:", err.code, err.message);
            });
        } else {
          console.warn("[FCM] ⚠️ Token kosong, tidak disimpan");
        }
      } else {
        console.warn("[FCM] ⚠️ registerForPushNotificationsAsync() mengembalikan null");
      }
    }).catch(err => {
      console.error("[FCM] ❌ Error saat registrasi:", err);
    });

    // This listener is fired whenever a notification is received while the app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log("[PushNotifications] Received notification in foreground:", notification);
      const data = notification.request?.content?.data;
      if (data && data.type === 'NEW_ORDER') {
        console.log("[PushNotifications] New order notification! Playing sound.");
        playNotificationSound();
      }
    });

    // This listener is fired whenever a user taps on or interacts with a notification 
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("[PushNotifications] User interacted with notification:", response);
      // Here we could route the user to a specific screen based on response.notification.request.content.data
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [userUid]);

  return { expoPushToken, fcmToken };
}

async function registerForPushNotificationsAsync() {
  let expoToken = '';
  let deviceToken = '';

    console.log("[FCM] Memulai registrasi notifikasi...");
    console.log("[FCM] isDevice:", Device.isDevice, "| OS:", Platform.OS);
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('new-orders', {
        name: 'Pesanan Masuk',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#cafd00',
        sound: 'notif_driver',
      });
      console.log("[FCM] ✅ Notification channel 'new-orders' dibuat");
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log("[FCM] Status izin notifikasi saat ini:", existingStatus);
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log("[FCM] Status izin setelah request:", finalStatus);
      }
      
      if (finalStatus !== 'granted') {
        console.warn('[FCM] ❌ Izin notifikasi DITOLAK oleh user!');
        return null;
      }

      try {
        // Get raw FCM device token (needed for direct Firebase Cloud Messaging)
        console.log("[FCM] Mengambil device push token...");
        const devicePushToken = await Notifications.getDevicePushTokenAsync();
        deviceToken = devicePushToken.data;
        console.log("[FCM] ✅ Token type:", devicePushToken.type);
      } catch (e) {
        console.warn('[FCM] ❌ Gagal mengambil device token:', e);
      }
    } else {
      console.warn('Must use physical device for Push Notifications');
    }

  return { expoToken, deviceToken };
}
