package com.arodriverkotlin.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.arodriverkotlin.background.WatchdogWorker
import com.arodriverkotlin.service.SessionService

class WatchdogReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val uid = SessionService.getStoredUid(context)
        if (uid != null) {
            SessionService.start(context, uid)
            SessionService.ensureTripServiceRunning(context)
            Log.i("WATCHDOG", "Health check: services restarted for $uid")
        }
    }

    companion object {
        fun schedule(context: Context) {
            WatchdogWorker.schedule(context)
        }
    }
}
