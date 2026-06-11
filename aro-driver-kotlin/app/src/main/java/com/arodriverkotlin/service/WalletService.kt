package com.arodriverkotlin.service

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

object WalletService {
    private val db = FirebaseFirestore.getInstance()

    suspend fun requestTopup(uid: String, name: String, amount: Long, method: String = "manual") {
        db.collection("topup_requests").add(
            mapOf(
                "driverId" to uid,
                "driverName" to name,
                "amount" to amount,
                "method" to method,
                "status" to "pending",
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp(),
            )
        ).await()
    }
}
