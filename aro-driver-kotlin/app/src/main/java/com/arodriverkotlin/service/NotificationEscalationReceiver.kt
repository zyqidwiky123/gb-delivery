package com.arodriverkotlin.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class NotificationEscalationReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()

        val orderId = intent.getStringExtra("orderId") ?: run {
            pendingResult.finish(); return
        }
        val title = intent.getStringExtra("title") ?: run {
            pendingResult.finish(); return
        }
        val body = intent.getStringExtra("body") ?: run {
            pendingResult.finish(); return
        }

        try {
            IncomingOrderNotifier.escalatePriority(context, orderId, title, body)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to escalate notification for $orderId", e)
        } finally {
            pendingResult.finish()
        }
    }

    companion object {
        private const val TAG = "NotificationEscalationReceiver"
    }
}
