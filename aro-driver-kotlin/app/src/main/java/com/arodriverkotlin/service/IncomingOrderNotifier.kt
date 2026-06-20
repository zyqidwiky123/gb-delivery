package com.arodriverkotlin.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.arodriverkotlin.MainActivity
import com.arodriverkotlin.R

object IncomingOrderNotifier {
    const val CHANNEL_ID = "aro_drive_incoming_v5"

    private const val TAG = "IncomingOrderNotifier"
    private const val PREFS_NAME = "incoming_order_notifications"
    private const val NOTIFIED_ORDER_IDS = "notified_order_ids"
    private const val MAX_REMEMBERED_ORDERS = 50

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        try {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pesanan Masuk",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Notifikasi pesanan baru ARO DRIVE"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 150, 300, 150, 300)
                setSound(soundUri(context), notificationAudioAttributes())
                enableLights(true)
            }
            context.getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        } catch (error: Exception) {
            Log.e(TAG, "Gagal membuat channel pesanan masuk", error)
        }
    }

    @Synchronized
    fun show(context: Context, orderId: String, title: String, body: String) {
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
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setVibrate(longArrayOf(0, 300, 150, 300, 150, 300))
                .setContentIntent(pendingIntent)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                builder.setSound(soundUri(context))
            }

            val notificationId = if (orderId.isBlank()) {
                (System.currentTimeMillis() and Int.MAX_VALUE.toLong()).toInt()
            } else {
                orderId.hashCode()
            }
            context.getSystemService(NotificationManager::class.java)
                .notify(notificationId, builder.build())

            if (orderId.isNotBlank()) rememberNotifiedOrder(context, orderId)
        } catch (error: Exception) {
            Log.e(TAG, "Gagal menampilkan notifikasi order $orderId", error)
        }
    }

    private fun soundUri(context: Context): Uri = Uri.parse(
        "${ContentResolver.SCHEME_ANDROID_RESOURCE}://${context.packageName}/${R.raw.notifdriver}",
    )

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
}
