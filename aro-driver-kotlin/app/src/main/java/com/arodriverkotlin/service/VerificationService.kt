package com.arodriverkotlin.service

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

object VerificationService {
    private const val PIN_LENGTH = 4
    private const val PIN_EXPIRY_MINUTES = 5L
    private val firestore = FirebaseFirestore.getInstance()

    suspend fun generateAndSendPin(orderId: String, phoneNumber: String): String {
        val pin = (1000 until 10000).random().toString()
        val expiry = System.currentTimeMillis() + PIN_EXPIRY_MINUTES * 60 * 1000
        firestore.collection("orders").document(orderId)
            .update(mapOf(
                "verificationPin" to pin,
                "pinExpiry" to expiry,
                "pinUpdatedAt" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )).await()
        return pin
    }

    suspend fun verifyPin(orderId: String, inputPin: String): Boolean {
        val snap = firestore.collection("orders").document(orderId).get().await()
        if (!snap.exists()) return false
        val storedPin = snap.getString("verificationPin") ?: return false
        val expiry = snap.getLong("pinExpiry") ?: return false
        if (System.currentTimeMillis() > expiry) return false
        if (inputPin != storedPin) return false
        firestore.collection("orders").document(orderId)
            .update(
                "verificationPin", com.google.firebase.firestore.FieldValue.delete(),
                "pinExpiry", com.google.firebase.firestore.FieldValue.delete()
            ).await()
        return true
    }
}
