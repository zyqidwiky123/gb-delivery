package com.arodriverkotlin.service

import android.util.Log
import com.arodriverkotlin.background.SmartWakeLock
import com.arodriverkotlin.notification.NotificationEngine
import com.arodriverkotlin.notification.NotificationModel
import com.arodriverkotlin.notification.NotificationType
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "MessagingService"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        saveToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return

        ServiceCoordinator.startSession(this, uid)

        val fcmWakeLock = SmartWakeLock.acquireForFcm(this)
        try {
            val data = message.data
            if (data["type"] == "NEW_ORDER") {
                val orderId = data["orderId"]
                val title = data["title"] ?: getString(com.arodriverkotlin.R.string.incoming_order_title)
                val body = data["body"] ?: getString(com.arodriverkotlin.R.string.incoming_order_body)
                if (orderId != null) {
                    Log.d(TAG, "NEW_ORDER FCM received: $orderId")
                    NotificationEngine.handle(this, NotificationModel(
                        id = orderId,
                        type = NotificationType.ORDER,
                        title = title,
                        body = body,
                        deepLink = "order/$orderId",
                        payload = mapOf("orderId" to orderId, "uid" to uid)
                    ))
                }
            }
        } finally {
            if (fcmWakeLock.isHeld) fcmWakeLock.release()
        }
    }

    private fun saveToken(token: String) {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        FirebaseFirestore.getInstance().collection("drivers").document(uid)
            .set(
                mapOf("fcmToken" to token, "updatedAt" to FieldValue.serverTimestamp()),
                com.google.firebase.firestore.SetOptions.merge()
            )
            .addOnFailureListener { error ->
                Log.e("MessagingService", "Gagal menyimpan token FCM", error)
            }
    }
}
