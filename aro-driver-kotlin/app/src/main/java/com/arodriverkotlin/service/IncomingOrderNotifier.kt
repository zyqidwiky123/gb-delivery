package com.arodriverkotlin.service

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.arodriverkotlin.MainActivity
import com.arodriverkotlin.R
import com.arodriverkotlin.notification.NotificationChannels
import com.arodriverkotlin.notification.NotificationEngine
import com.arodriverkotlin.notification.NotificationModel
import com.arodriverkotlin.notification.NotificationType

object IncomingOrderNotifier {
    const val GROUP_KEY_ORDERS = "com.arodriverkotlin.orders"

    private const val TAG = "IncomingOrderNotifier"
    private const val PREFS_NAME = "incoming_order_notifications"
    private const val NOTIFIED_ORDER_IDS = "notified_order_ids"
    private const val MAX_REMEMBERED_ORDERS = 50
    private const val ESCALATION_DELAY_MS = 30_000L

    @Synchronized
    fun show(context: Context, orderId: String, title: String, body: String, uid: String? = null) {
        if (orderId.isNotBlank() && wasAlreadyNotified(context, orderId)) {
            Log.d(TAG, "Notifikasi duplikat dilewati untuk order $orderId")
            return
        }

        NotificationEngine.handle(context, NotificationModel(
            id = orderId,
            type = NotificationType.ORDER,
            title = title,
            body = body,
            deepLink = "order/$orderId",
            payload = mapOf("orderId" to orderId, "uid" to uid.orEmpty()),
            priority = NotificationCompat.PRIORITY_HIGH
        ))

        if (orderId.isNotBlank()) rememberNotifiedOrder(context, orderId)

        if (uid != null) {
            scheduleEscalation(context, orderId, title, body, uid)
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

            val builder = NotificationCompat.Builder(context, NotificationChannels.ORDERS)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("\u26A0\uFE0F $title")
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
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
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
        alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    }

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

    private const val ESCALATION_REQUEST_MASK = 0x30000000
}
