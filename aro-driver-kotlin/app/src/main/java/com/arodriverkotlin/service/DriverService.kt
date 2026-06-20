package com.arodriverkotlin.service

import android.net.Uri
import android.util.Log
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ServerValue
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.tasks.await
import java.util.UUID

object DriverService {
    private val db = FirebaseFirestore.getInstance()
    private val rtdb = FirebaseDatabase.getInstance().reference
    private val storage = FirebaseStorage.getInstance()

    suspend fun toggleOnline(uid: String, currentOnline: Boolean) {
        val online = !currentOnline
        val fsUpdate = mutableMapOf<String, Any>(
            "isOnline" to online,
            "status" to if (online) "online" else "offline",
            "statusChangedAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp(),
            "lastActive" to FieldValue.serverTimestamp(),
        )
        val rtdbUpdate = mutableMapOf<String, Any>(
            "isOnline" to online,
            "status" to if (online) "online" else "offline",
            "statusChangedAt" to ServerValue.TIMESTAMP,
            "lastActive" to ServerValue.TIMESTAMP,
        )
        if (online) {
            fsUpdate["onlineAt"] = FieldValue.serverTimestamp()
            fsUpdate["offlineAt"] = FieldValue.delete()
            fsUpdate["onlineSessionStartAt"] = FieldValue.serverTimestamp()
            rtdbUpdate["onlineAt"] = ServerValue.TIMESTAMP
            rtdbUpdate["offlineAt"] = null
            rtdbUpdate["onlineSessionStartAt"] = ServerValue.TIMESTAMP
        } else {
            fsUpdate["offlineAt"] = FieldValue.serverTimestamp()
            rtdbUpdate["offlineAt"] = ServerValue.TIMESTAMP
            try {
                val snap = rtdb.child("drivers/$uid").get().await()
                val todayMs = snap.child("todayOnlineMs").getValue(Long::class.java) ?: 0L
                val sessionStartTs = snap.child("onlineSessionStartAt").getValue(Long::class.java)
                    ?: snap.child("onlineAt").getValue(Long::class.java)
                if (sessionStartTs != null) {
                    val elapsed = System.currentTimeMillis() - sessionStartTs
                    val newTodayMs = todayMs + elapsed
                    fsUpdate["todayOnlineMs"] = newTodayMs
                    rtdbUpdate["todayOnlineMs"] = newTodayMs
                }
            } catch (e: Exception) {
                Log.w("DRIVER", "Failed to read RTDB session for accumulation", e)
            }
            fsUpdate["onlineSessionStartAt"] = FieldValue.delete()
            rtdbUpdate["onlineSessionStartAt"] = null
        }
        db.collection("drivers").document(uid).set(fsUpdate, SetOptions.merge()).await()
        rtdb.child("drivers/$uid").updateChildren(rtdbUpdate).await()
    }

    suspend fun updateLocation(uid: String, lat: Double, lng: Double) {
        rtdb.child("drivers/$uid").updateChildren(
            mapOf(
                "location/lat" to lat,
                "location/lng" to lng,
                "lastLocationUpdate" to ServerValue.TIMESTAMP,
                "lastActive" to ServerValue.TIMESTAMP,
            )
        ).await()
    }

    suspend fun updateOrderLocation(orderId: String, lat: Double, lng: Double) {
        db.collection("orders").document(orderId).update(
            "driverLocation", mapOf("lat" to lat, "lng" to lng)
        ).await()
    }

    suspend fun updateProfile(uid: String, data: Map<String, Any>) {
        db.collection("drivers").document(uid).update(data).await()
    }

    suspend fun uploadPhoto(uid: String, uri: Uri): String {
        val ref = storage.reference.child("profile_pics/$uid/${UUID.randomUUID()}")
        ref.putFile(uri).await()
        val downloadUrl = ref.downloadUrl.await()
        val url = downloadUrl.toString()
        db.collection("drivers").document(uid).update("photoUrl", url).await()
        return url
    }

    suspend fun uploadQris(uid: String, uri: Uri): String {
        val ref = storage.reference.child("qris/$uid/${UUID.randomUUID()}")
        ref.putFile(uri).await()
        val downloadUrl = ref.downloadUrl.await()
        val url = downloadUrl.toString()
        db.collection("drivers").document(uid).update("qrisUrl", url).await()
        return url
    }
}
