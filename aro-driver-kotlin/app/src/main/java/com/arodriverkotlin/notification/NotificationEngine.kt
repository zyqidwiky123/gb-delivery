package com.arodriverkotlin.notification

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.arodriverkotlin.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

object NotificationEngine {

    private const val TAG = "NotificationEngine"

    @Volatile var isAppInForeground: Boolean = false
        set(value) {
            field = value
            Log.d(TAG, "Foreground state: $value")
        }

    private var pushProvider: PushNotificationProvider? = null

    fun init(context: Context) {
        pushProvider = PushNotificationProvider(context)
    }

    fun handle(context: Context, notif: NotificationModel) {
        Log.d(TAG, "Handling notification: type=${notif.type} id=${notif.id}")

        if (isAppInForeground) {
            InAppNotificationManager.show(notif)
        } else {
            pushProvider?.show(notif)
        }
    }

    fun onNotificationClicked(context: Context, intent: Intent) {
        val deepLink = intent.getStringExtra("deepLink") ?: return
        Log.i(TAG, "Navigating to: $deepLink")
        DeepLinkRegistry.navigate(context, deepLink)
    }

    object InAppNotificationManager {
        private val _currentNotification = MutableStateFlow<NotificationModel?>(null)
        val currentNotification: StateFlow<NotificationModel?> = _currentNotification

        private var dismissJob: Job? = null

        fun show(notif: NotificationModel) {
            _currentNotification.value = notif
            dismissJob?.cancel()
            dismissJob = CoroutineScope(Dispatchers.Main).launch {
                delay(5000)
                dismiss()
            }
        }

        fun dismiss() {
            _currentNotification.value = null
            dismissJob?.cancel()
        }
    }

    class PushNotificationProvider(private val context: Context) {

        fun show(notif: NotificationModel) {
            val channelId = when (notif.type) {
                NotificationType.ORDER -> NotificationChannels.ORDERS
                NotificationType.CHAT -> NotificationChannels.CHAT
                NotificationType.PROMO -> NotificationChannels.PROMO
                NotificationType.SYSTEM -> NotificationChannels.SYSTEM
                NotificationType.SAFETY -> NotificationChannels.SAFETY
            }

            val intent = context.packageManager.getLaunchIntentForPackage(
                context.packageName
            )?.apply {
                putExtra("deepLink", notif.deepLink)
                notif.payload.forEach { (k, v) -> putExtra(k, v) }
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                notif.id.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(notif.title)
                .setContentText(notif.body)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(notif.priority)
                .setCategory(android.app.Notification.CATEGORY_CALL)

            if (notif.deepLink != null) {
                builder.setFullScreenIntent(pendingIntent, true)
            }

            context.getSystemService(NotificationManager::class.java)
                .notify(notif.id.hashCode(), builder.build())
        }
    }
}
