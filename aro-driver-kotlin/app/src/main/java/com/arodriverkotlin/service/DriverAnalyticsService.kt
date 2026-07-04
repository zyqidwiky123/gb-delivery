package com.arodriverkotlin.service

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import kotlinx.coroutines.tasks.await

object DriverAnalyticsService {
    private val firestore = FirebaseFirestore.getInstance()

    suspend fun logEvent(uid: String, eventName: String, params: Map<String, Any> = emptyMap()) {
        try {
            firestore.collection("drivers").document(uid)
                .collection("analytics")
                .add(mapOf(
                    "eventName" to eventName,
                    "params" to params,
                    "createdAt" to FieldValue.serverTimestamp()
                )).await()
        } catch (_: Exception) {}
    }
}
