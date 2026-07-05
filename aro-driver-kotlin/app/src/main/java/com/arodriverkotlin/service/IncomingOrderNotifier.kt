package com.arodriverkotlin.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import com.arodriverkotlin.MainActivity
import com.arodriverkotlin.R

object IncomingOrderNotifier {
    const val CHANNEL_ID = "aro_drive_incoming_v7"
    const val GROUP_KEY_ORDERS = "com.arodriverkotlin.orders"

    private const val TAG = "IncomingOrderNotifier"
    private const val PREFS_NAME = "incoming_order_notifications"
    private const val NOTIFIED_ORDER_IDS = "notified_order_ids"
    private const val MAX_REMEMBERED_ORDERS = 50
    private const val ESCALATION_DELAY_MS = 30_000L

    private fun isXiaomiMiui(): Boolean {
        return try {
            val manufacturer = Build.MANUFACTURER.lowercase()
            val brand = Build.BRAND.lowercase()
            manufacturer.contains("xiaomi") || brand.contains("xiaomi") ||
                System.getProperty("ro.miui.ui.version.name") != null
        } catch (_: Exception) {
            false
        }
    }

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        try {
            val notificationManager = context.getSystemService(NotificationManager::class.java)

            // Delete old channel if it existed (v6 → v7 migration)
            try {
                notificationManager.deleteNotificationChannel("aro_drive_incoming_v6")
            } catch (_: Exception) {}

            val soundUri = if (isXiaomiMiui()) {
                Settings.System.DEFAULT_NOTIFICATION_URI
            } else {
                customSoundUri(context)
            }

            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pesanan Masuk",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Notifikasi pesanan baru ARO DRIVE"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 150, 300, 150, 300)
                setSound(soundUri, notificationAudioAttributes())
                enableLights(true)
            }
            notificationManager.createNotificationChannel(channel)
        } catch (error: Exception) {
            Log.e(TAG, "Gagal membuat channel pesanan masuk", error)
        }
    }

    @Synchronized
    fun show(context: Context, orderId: String, title: String, body: String, uid: String? = null) {
        if (orderId.isNotBlank() && wasAlreadyNotified(context, orderId)) {
            Log.d(TAG, "Notifikasi duplikat dilewati untuk order $orderId")
            return
        }

        try {
            createChannel(context)

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra("orderId", orderId)
            }
            val requestCode = orderId.hashCode()
            val pendingIntent = PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val fullScreenPendingIntent = PendingIntent.getActivity(
                context,
                requestCode xor FULL_SCREEN_REQUEST_MASK,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setVibrate(longArrayOf(0, 300, 150, 300, 150, 300))
                .setContentIntent(pendingIntent)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setGroup(GROUP_KEY_ORDERS)
                .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_SUMMARY)

            if (uid != null) {
                val acceptIntent = Intent(context, NotificationActionReceiver::class.java).apply {
                    action = NotificationActionReceiver.ACTION_ACCEPT
                    putExtra(NotificationActionReceiver.EXTRA_ORDER_ID, orderId)
                    putExtra(NotificationActionReceiver.EXTRA_UID, uid)
                }
                val acceptPendingIntent = PendingIntent.getBroadcast(
                    context,
                    requestCode xor ACCEPT_REQUEST_MASK,
                    acceptIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )

                val rejectIntent = Intent(context, NotificationActionReceiver::class.java).apply {
                    action = NotificationActionReceiver.ACTION_REJECT
                    putExtra(NotificationActionReceiver.EXTRA_ORDER_ID, orderId)
                    putExtra(NotificationActionReceiver.EXTRA_UID, uid)
                }
                val rejectPendingIntent = PendingIntent.getBroadcast(
                    context,
                    requestCode xor REJECT_REQUEST_MASK,
                    rejectIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )

                builder.addAction(R.drawable.ic_notification, "TERIMA", acceptPendingIntent)
                builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "TOLAK", rejectPendingIntent)
            }

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                builder.setSound(Settings.System.DEFAULT_NOTIFICATION_URI)
            }

            val notificationId = if (orderId.isBlank()) {
                (System.currentTimeMillis() and Int.MAX_VALUE.toLong()).toInt()
            } else {
                orderId.hashCode()
            }
            context.getSystemService(NotificationManager::class.java)
                .notify(notificationId, builder.build())

            if (orderId.isNotBlank()) rememberNotifiedOrder(context, orderId)

            if (uid != null) {
                scheduleEscalation(context, orderId, title, body, uid)
            }
        } catch (error: Exception) {
            Log.e(TAG, "Gagal menampilkan notifikasi order $orderId", error)
        }
    }

    fun escalatePriority(context: Context, orderId: String, title: String, body: String) {
        try {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra("orderId", orderId)
            }
            val requestCode = orderId.hashCode()
            val pendingIntent = PendingIntent.getActivity(
                context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("⚠️ $title")
                .setContentText("Order $body — Segera respon!")
                .setAutoCancel(true)
                .setVibrate(longArrayOf(0, 500, 200, 500, 200, 500, 200, 500))
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(pendingIntent, true)
                .setGroup(GROUP_KEY_ORDERS)
                .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_SUMMARY)

            val notificationId = orderId.hashCode()
            context.getSystemService(NotificationManager::class.java)
                .notify(notificationId, builder.build())

            Log.d(TAG, "Priority escalated for order $orderId")
        } catch (error: Exception) {
            Log.e(TAG, "Failed to escalate notification for $orderId", error)
        }
    }

    private fun scheduleEscalation(context: Context, orderId: String, title: String, body: String, uid: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        val escalationIntent = Intent(context, NotificationEscalationReceiver::class.java).apply {
            putExtra("orderId", orderId)
            putExtra("title", title)
            putExtra("body", body)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            orderId.hashCode() xor ESCALATION_REQUEST_MASK,
            escalationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val triggerAt = System.currentTimeMillis() + ESCALATION_DELAY_MS
        alarmManager.set(android.app.AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    }

    private fun customSoundUri(context: Context): Uri =
        Uri.parse("android.resource://${context.packageName}/raw/notifdriver")

    private fun notificationAudioAttributes(): AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

    private fun wasAlreadyNotified(context: Context, orderId: String): Boolean =
        readNotifiedOrders(context).contains(orderId)

    private fun rememberNotifiedOrder(context: Context, orderId: String) {
        val ids = readNotifiedOrders(context).filterNot { it == orderId }.toMutableList()
        ids += orderId
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(NOTIFIED_ORDER_IDS, ids.takeLast(MAX_REMEMBERED_ORDERS).joinToString("|"))
            .apply()
    }

    private fun readNotifiedOrders(context: Context): List<String> =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(NOTIFIED_ORDER_IDS, null)
            ?.split('|')
            ?.filter(String::isNotBlank)
            .orEmpty()

    private const val FULL_SCREEN_REQUEST_MASK = 0x40000000
    private const val ACCEPT_REQUEST_MASK = 0x10000000
    private const val REJECT_REQUEST_MASK = 0x20000000
    private const val ESCALATION_REQUEST_MASK = 0x30000000
}
