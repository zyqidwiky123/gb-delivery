package com.arodriverkotlin.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.arodriverkotlin.service.ForegroundService
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.google.firebase.auth.FirebaseAuth

class BootReceiver : BroadcastReceiver() {

    private const val TAG = "BootReceiver"

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == null) return

        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                Log.i(TAG, "Boot event received: $action")
                WatchdogReceiver.schedule(context)
                checkAndStartForegroundService(context)
            }
        }
    }

    private fun checkAndStartForegroundService(context: Context) {
        val uid = FirebaseAuth.getInstance().currentUser?.uid
        if (uid == null) {
            Log.d(TAG, "No authenticated user, skipping service start")
            return
        }

        val rtdb = FirebaseDatabase.getInstance().reference
        rtdb.child("drivers/$uid/isOnline").addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot) {
                val isOnline = snapshot.getValue(Boolean::class.java) ?: false
                if (isOnline) {
                    Log.i(TAG, "Driver was online, restarting ForegroundService")
                    ForegroundService.start(context, uid)
                } else {
                    Log.d(TAG, "Driver was offline, not starting service")
                }
            }

            override fun onCancelled(error) {
                Log.w(TAG, "Failed to read isOnline from RTDB", error.toException())
            }
        })
    }
}