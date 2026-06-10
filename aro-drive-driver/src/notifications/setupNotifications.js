import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';

export const NEW_ORDER_CHANNEL_ID = 'driver-orders-notifee-v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-V2';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[BGTask] Error:', error);
    return;
  }

  const type = data?.type;
  const orderId = data?.orderId;

  if (type === 'NEW_ORDER' && orderId) {
    try {
      await notifee.displayNotification({
        id: `new-order-bg-${orderId}`,
        title: 'Ada Order Baru!',
        body: `Ayo ambil orderan ARO-${String(orderId).slice(-5).toUpperCase()}!`,
        data: { type, orderId },
        android: {
          channelId: NEW_ORDER_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'default' },
          smallIcon: 'notification_icon',
          color: '#cafd00',
          sound: 'notif_driver',
          vibrationPattern: [250, 250, 250],
          visibility: AndroidVisibility.PUBLIC,
        },
      });
    } catch (err) {
      console.warn('[BGTask] Failed displayNotification:', err);
    }
  }
});

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;
  if (pressAction?.id === 'default') {
    const data = notification?.data;
    if (data?.type === 'NEW_ORDER' && data?.orderId) {
      console.log('[Notifee] User tapped order notification:', data.orderId);
    }
  }
});

export async function initializeNotificationChannels() {
  if (Platform.OS !== 'android') return;

  try {
    const existing = await notifee.getChannel(NEW_ORDER_CHANNEL_ID);
    if (existing) return;

    await notifee.createChannel({
      id: NEW_ORDER_CHANNEL_ID,
      name: 'Pesanan Masuk',
      description: 'Notifikasi order baru untuk driver',
      importance: AndroidImportance.HIGH,
      sound: 'notif_driver',
      vibration: true,
      vibrationPattern: [250, 250, 250],
      lights: true,
      lightColor: '#cafd00',
      visibility: AndroidVisibility.PUBLIC,
    });

    console.log('[Notifications] Notifee channel created:', NEW_ORDER_CHANNEL_ID);
  } catch (err) {
    console.warn('[Notifications] Failed to create notifee channel:', err);
  }

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (!isRegistered) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      console.log('[Notifications] Background task registered.');
    }
  } catch (err) {
    console.warn('[Notifications] Failed to register background task:', err);
  }
}

initializeNotificationChannels().catch(() => {});
