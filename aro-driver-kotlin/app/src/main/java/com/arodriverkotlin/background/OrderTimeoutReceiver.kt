package com.arodriverkotlin.background

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import com.arodriverkotlin.service.OrderService

class OrderTimeoutReceiver : BroadcastReceiver() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != OrderTimeoutManager.ALARM_ACTION) return

        val orderId = intent.getStringExtra("orderId") ?: return
        val uid = intent.getStringExtra("uid") ?: return

        Log.i(TAG, "Alarm fired for order $orderId - auto-rejecting")

        scope.launch {
            try {
                // Auto-reject the order and trigger re-dispatch
                OrderService.rejectOrder(orderId)
                
                // Log for re-dispatch tracking (backend handles re-dispatch)
                Log.i(TAG, "Order $orderId auto-rejected, re-dispatch triggered")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to auto-reject order $orderId", e)
            }
        }
    }

    companion object {
        private const val TAG = "OrderTimeoutReceiver"
    }
}