package com.arodriverkotlin.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.arodriverkotlin.service.SessionService

class BootReceiver : BroadcastReceiver() {

    private val TAG = "BootReceiver"

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == null) return

        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                Log.i(TAG, "Boot event received: $action")
                val uid = SessionService.getStoredUid(context)
                if (uid != null) {
                    SessionService.start(context, uid)
                    SessionService.ensureTripServiceRunning(context)
                }
            }
        }
    }
}
