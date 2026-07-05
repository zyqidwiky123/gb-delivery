package com.arodriverkotlin.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.arodriverkotlin.models.DriverProfile
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class NotificationActionReceiver : BroadcastReceiver() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()

        val action = intent.action ?: run { pendingResult.finish(); return }
        val orderId = intent.getStringExtra(EXTRA_ORDER_ID) ?: run { pendingResult.finish(); return }
        val uid = intent.getStringExtra(EXTRA_UID) ?: run { pendingResult.finish(); return }

        scope.launch {
            try {
                when (action) {
                    ACTION_ACCEPT -> {
                        val profile = fetchProfile(uid)
                        OrderService.acceptOrder(orderId, uid, profile)
                        Log.i(TAG, "Notification accept: order $orderId accepted")
                    }
                    ACTION_REJECT -> {
                        OrderService.rejectOrder(orderId, uid)
                        Log.i(TAG, "Notification reject: order $orderId rejected")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to handle notification action $action for $orderId", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    private suspend fun fetchProfile(uid: String): DriverProfile {
        val snap = FirebaseFirestore.getInstance()
            .collection("drivers").document(uid).get().await()
        return DriverProfile(
            id = uid,
            name = snap.getString("name") ?: snap.getString("displayName") ?: "Driver",
            phone = snap.getString("phone") ?: "",
            email = snap.getString("email") ?: "",
            photoUrl = snap.getString("photoUrl") ?: "",
            vehicleType = snap.getString("vehicleType") ?: "motorcycle",
            plateNumber = snap.getString("plateNumber") ?: "",
            balance = snap.getLong("balance") ?: 0,
            isOnline = snap.getBoolean("isOnline") ?: true,
            status = snap.getString("status") ?: "online"
        )
    }

    companion object {
        private const val TAG = "NotificationActionReceiver"
        const val ACTION_ACCEPT = "com.arodriverkotlin.ACCEPT_ORDER"
        const val ACTION_REJECT = "com.arodriverkotlin.REJECT_ORDER"
        const val EXTRA_ORDER_ID = "orderId"
        const val EXTRA_UID = "uid"
    }
}
