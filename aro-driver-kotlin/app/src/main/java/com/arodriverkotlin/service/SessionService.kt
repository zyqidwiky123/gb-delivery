package com.arodriverkotlin.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.arodriverkotlin.MainActivity
import com.arodriverkotlin.R
import com.arodriverkotlin.background.WatchdogWorker

class SessionService : Service() {

    companion object {
        const val ACTION_START = "com.arodriverkotlin.START_SESSION"
        const val ACTION_STOP = "com.arodriverkotlin.STOP_SESSION"
        const val EXTRA_UID = "extra_uid"
        const val EXTRA_DRIVER_NAME = "extra_driver_name"

        const val EVENT_SESSION_STATE_CHANGED = "com.arodriverkotlin.SESSION_STATE_CHANGED"
        const val EXTRA_IS_ONLINE = "extra_is_online"
        const val EXTRA_UID_EVENT = "extra_uid"

        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "aro_drive_foreground_service"

        private const val PREFS_NAME = "session_service"
        private const val KEY_UID = "driver_uid"
        private const val KEY_IS_ONLINE = "is_online"

        private const val TAG = "SessionService"

        @Volatile var currentUid: String? = null
            private set
        @Volatile var isOnline: Boolean = false
            private set

        fun start(context: Context, uid: String, driverName: String? = null) {
            currentUid = uid
            isOnline = true
            persistState(context, uid, true)

            val intent = Intent(context, SessionService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_UID, uid)
                driverName?.let { putExtra(EXTRA_DRIVER_NAME, it) }
            }
            startForegroundServiceCompat(context, intent)

            WatchdogWorker.schedule(context)
            broadcastState(context, uid, true)
        }

        fun stop(context: Context) {
            isOnline = false
            persistState(context, currentUid ?: "", false)
            WatchdogWorker.cancel(context)

            TripService.stop(context)

            val intent = Intent(context, SessionService::class.java).apply {
                action = ACTION_STOP
            }
            context.stopService(intent)

            broadcastState(context, currentUid ?: "", false)
            currentUid = null
        }

        fun ensureTripServiceRunning(context: Context) {
            val uid = currentUid ?: return
            val prefs = context.getSharedPreferences(TripService.PREFS_NAME, Context.MODE_PRIVATE)
            val activeOrderId = prefs.getString(TripService.KEY_ACTIVE_ORDER_ID, null)
            if (activeOrderId != null) {
                TripService.start(context, uid, activeOrderId)
            }
        }

        private fun startForegroundServiceCompat(context: Context, intent: Intent) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        private fun persistState(context: Context, uid: String, online: Boolean) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_UID, uid)
                .putBoolean(KEY_IS_ONLINE, online)
                .apply()
        }

        private fun broadcastState(context: Context, uid: String, online: Boolean) {
            val intent = Intent(EVENT_SESSION_STATE_CHANGED).apply {
                putExtra(EXTRA_UID_EVENT, uid)
                putExtra(EXTRA_IS_ONLINE, online)
            }
            context.sendBroadcast(intent)
        }

        fun getStoredUid(context: Context): String? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return if (prefs.getBoolean(KEY_IS_ONLINE, false)) {
                prefs.getString(KEY_UID, null)
            } else null
        }
    }

    override fun onCreate() {
        super.onCreate()
        currentUid = getStoredUid(this)
        isOnline = currentUid != null
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val uid = intent.getStringExtra(EXTRA_UID) ?: return START_STICKY
                currentUid = uid
                isOnline = true
                startForeground(NOTIFICATION_ID, buildNotification(uid))
            }
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                val uid = getStoredUid(this)
                if (uid != null) {
                    currentUid = uid
                    isOnline = true
                    startForeground(NOTIFICATION_ID, buildNotification(uid))
                } else {
                    stopSelf()
                    return START_NOT_STICKY
                }
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        currentUid = null
        isOnline = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun buildNotification(uid: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("ARO DRIVE")
            .setContentText("Kamu sedang online — menunggu pesanan...")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pendingIntent)
            .build()
    }
}
