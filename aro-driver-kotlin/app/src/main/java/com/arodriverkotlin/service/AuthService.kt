package com.arodriverkotlin.service

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

object AuthService {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()

    val currentUser: FirebaseUser? get() = auth.currentUser

    suspend fun loginOrRegister(email: String, password: String): FirebaseUser {
        val result = try {
            auth.signInWithEmailAndPassword(email, password).await()
        } catch (_: Exception) {
            auth.createUserWithEmailAndPassword(email, password).await()
        }
        return result.user ?: error("User tidak ditemukan")
    }

    suspend fun ensureDriverProfile(uid: String, email: String) {
        val driverRef = db.collection("drivers").document(uid)
        if (!driverRef.get().await().exists()) {
            driverRef.set(
                mapOf(
                    "name" to "Driver",
                    "email" to email,
                    "isOnline" to false,
                    "status" to "offline",
                    "balance" to 0,
                    "rating" to 0.0,
                    "level" to "Mitra",
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()
        }
        db.collection("users").document(uid).set(
            mapOf(
                "role" to "driver",
                "email" to email,
                "isActive" to true,
                "updatedAt" to FieldValue.serverTimestamp(),
            ),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()

        // Init RTDB driver node if not exists
        val rtdb = FirebaseDatabase.getInstance().reference
        val rtdbSnap = rtdb.child("drivers/$uid").get().await()
        if (!rtdbSnap.exists()) {
            val existing = driverRef.get().await()
            rtdb.child("drivers/$uid").updateChildren(
                mapOf(
                    "isOnline" to (existing.getBoolean("isOnline") ?: false),
                    "status" to (existing.getString("status") ?: "offline"),
                    "todayOnlineMs" to (existing.getLong("todayOnlineMs") ?: 0),
                )
            ).await()
        }
    }

    fun logout() {
        auth.signOut()
    }
}
