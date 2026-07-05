package com.arodriverkotlin.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.arodriverkotlin.background.WatchdogWorker
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
            WatchdogWorker.schedule(context)
        }
    }
}
