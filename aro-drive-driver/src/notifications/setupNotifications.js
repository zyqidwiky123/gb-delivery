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

// ─── Background FCM Task ──────────────────────────────────────────────────
// Ensures data-only FCM messages still display a notification when app is
// in background/killed. For FCM with `notification` field, the OS auto-
// displays; this task provides a notifee fallback for any missed notifications.
export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[BackgroundNotification] Error:', error);
    return;
  }

  const type = data?.type;
  const orderId = data?.orderId;

  console.log('[BackgroundNotification] Received in background:', { type, orderId });

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
          smallIcon: 'ic_launcher',
          color: '#cafd00',
          sound: 'notif_driver',
          vibrationPattern: [250, 250, 250],
          visibility: AndroidVisibility.PUBLIC,
        },
      });
    } catch (err) {
      console.warn('[BackgroundNotification] Failed to display notification:', err);
    }
  }
});

/**
 * Create the Android channel used by FCM (background/killed) and local alerts (foreground).
 * Must run as early as possible — before login — so killed-state FCM can display.
 */
export async function initializeNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(NEW_ORDER_CHANNEL_ID, {
    name: 'Pesanan Masuk',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'notif_driver.mp3',
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
    lightColor: '#cafd00',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });

  await notifee.createChannel({
    id: NEW_ORDER_CHANNEL_ID,
    name: 'Pesanan Masuk',
    importance: AndroidImportance.HIGH,
    sound: 'notif_driver',
    vibration: true,
    vibrationPattern: [250, 250, 250],
    lights: true,
    lightColor: '#cafd00',
    visibility: AndroidVisibility.PUBLIC,
  });

  // Register background FCM task (only once per app install)
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (!isRegistered) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      console.log('[Notifications] Background notification task registered.');
    }
  } catch (err) {
    console.warn('[Notifications] Failed to register background task:', err);
  }
}

// ─── Notifee Background Event Handler ─────────────────────────────────────
// Required for handling notification interactions (tap, dismiss) when app is
// in background or killed state.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('[Notifee] Background event:', type, detail);
  const { notification, pressAction } = detail;

  if (pressAction?.id === 'default') {
    const data = notification?.data;
    if (data?.type === 'NEW_ORDER' && data?.orderId) {
      console.log('[Notifee] User tapped order notification in background:', data.orderId);
    }
  }
});

// Run channel setup immediately when the bundle loads (before React mounts).
initializeNotificationChannels().catch((err) => {
  console.warn('[Notifications] Failed to initialize channels:', err);
});
