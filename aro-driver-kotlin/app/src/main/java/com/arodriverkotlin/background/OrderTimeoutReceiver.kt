package com.arodriverkotlin.background

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
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
                if (!checkOrderStillPending(orderId)) {
                    Log.d(TAG, "Order $orderId no longer pending, skipping auto-reject")
                    return@launch
                }
                OrderService.rejectOrder(orderId, uid)
                Log.i(TAG, "Order $orderId auto-rejected, re-dispatch triggered")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to auto-reject order $orderId", e)
            }
        }
    }

    private suspend fun checkOrderStillPending(orderId: String): Boolean {
        return try {
            val snap = FirebaseFirestore.getInstance()
                .collection("orders").document(orderId).get().await()
            snap.exists() && snap.getString("status") == "searching"
        } catch (_: Exception) {
            false
        }
    }

    companion object {
        private const val TAG = "OrderTimeoutReceiver"
    }
}