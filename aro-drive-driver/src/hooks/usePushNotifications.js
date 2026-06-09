import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Vibration, AppState } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { createAudioPlayer } from 'expo-audio';
import {
  NEW_ORDER_CHANNEL_ID,
  initializeNotificationChannels,
} from '../notifications/setupNotifications';

const NEW_ORDER_SOUND = require('../../assets/sounds/notif_driver.mp3');

export { NEW_ORDER_CHANNEL_ID };

// Helper to play notification sound
export const playNotificationSound = async () => {
  try {
    const audioPlayer = createAudioPlayer(NEW_ORDER_SOUND);
    audioPlayer.volume = 1;
    audioPlayer.play();
    console.log('[Audio] Successfully played notification sound in foreground');
  } catch (e) {
    console.warn('[Audio] Failed to play native sound in foreground:', e);
  }
};

export const ensureNewOrderNotificationChannel = initializeNotificationChannels;

export const showNewOrderNotification = async (order = {}) => {
  try {
    await initializeNotificationChannels();

    await notifee.displayNotification({
      id: `new-order-${order.id || Date.now()}`,
      title: 'Ada Order Baru!',
      body: `Ayo ambil orderan ARO-${String(order.id || '').slice(-5).toUpperCase() || 'BARU'}!`,
      data: {
        type: 'NEW_ORDER',
        orderId: order.id || '',
      },
      android: {
        channelId: NEW_ORDER_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
        smallIcon: 'ic_launcher',
        color: '#cafd00',
        sound: 'notif_driver',
        vibrationPattern: [250, 250, 250],
        visibility: AndroidVisibility.PUBLIC,
      },
    });

    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 250, 250, 250]);
    } else {
      Vibration.vibrate();
    }
  } catch (e) {
    console.warn('[PushNotifications] Failed to show local order notification:', e);
  }
};

async function saveFcmToken(userUid, deviceToken) {
  if (!userUid || !deviceToken) return;

  const payload = {
    fcmToken: deviceToken,
    fcmTokenUpdatedAt: new Date().toISOString(),
  };

  await Promise.all([
    setDoc(doc(db, 'drivers', userUid), payload, { merge: true }),
    setDoc(doc(db, 'users', userUid), payload, { merge: true }),
  ]);
}

async function registerForPushNotificationsAsync() {
  console.log('[FCM] Memulai registrasi notifikasi...');
  console.log('[FCM] isDevice:', Device.isDevice, '| OS:', Platform.OS);

  await initializeNotificationChannels();

  if (!Device.isDevice) {
    console.warn('Must use physical device for Push Notifications');
    return null;
  }

  await notifee.requestPermission();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('[FCM] Status izin notifikasi saat ini:', existingStatus);

  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
    console.log('[FCM] Status izin setelah request:', finalStatus);
  }

  if (finalStatus !== 'granted') {
    console.warn('[FCM] Izin notifikasi DITOLAK oleh user!');
    return null;
  }

  let deviceToken = '';
  try {
    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    deviceToken = devicePushToken.data;
    console.log('[FCM] Token type:', devicePushToken.type);
    console.log('[FCM] Token berhasil didapat:', deviceToken.substring(0, 30) + '...');
  } catch (e) {
    console.warn('[FCM] Gagal mengambil device token:', e);
    return null;
  }

  return { deviceToken };
}

export function usePushNotifications(userUid) {
  const [fcmToken, setFcmToken] = useState('');
  const notificationListener = useRef();
  const responseListener = useRef();
  const appStateRef = useRef(AppState.currentState);

  const syncPushToken = useCallback(async () => {
    if (!userUid) return;

    try {
      const tokens = await registerForPushNotificationsAsync();
      if (!tokens?.deviceToken) return;

      setFcmToken(tokens.deviceToken);
      await saveFcmToken(userUid, tokens.deviceToken);
      console.log('[FCM] Token tersimpan ke Firestore');
    } catch (err) {
      console.error('[FCM] Error saat registrasi:', err);
    }
  }, [userUid]);

  useEffect(() => {
    initializeNotificationChannels().catch(() => {});
  }, []);

  useEffect(() => {
    if (!userUid) return;

    syncPushToken();

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      appStateRef.current = nextState;

      if (wasBackground && nextState === 'active') {
        syncPushToken();
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[PushNotifications] Received notification in foreground:', notification);
      const data = notification.request?.content?.data;
      if (data?.type === 'NEW_ORDER') {
        playNotificationSound();
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[PushNotifications] User interacted with notification:', response);
    });

    return () => {
      appStateSubscription.remove();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userUid, syncPushToken]);

  return { fcmToken };
}
