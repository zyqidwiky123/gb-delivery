package com.arodriverkotlin.receiver

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import com.arodriverkotlin.service.ForegroundService

class WatchdogReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val prefs = context.getSharedPreferences("foreground_service", Context.MODE_PRIVATE)
        val uid = prefs.getString("driver_uid", null)
        if (uid != null) {
            ForegroundService.start(context, uid)
            Log.i("WATCHDOG", "Health check: service restarted for $uid")
        }
    }

    companion object {
        fun schedule(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, WatchdogReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context, 0, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            alarmManager.setRepeating(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + 300_000,
                300_000,
                pendingIntent
            )
        }
    }
}
