package com.arodriverkotlin.service

import android.net.Uri
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.tasks.await
import java.util.UUID

object DriverService {
    private val db = FirebaseFirestore.getInstance()
    private val storage = FirebaseStorage.getInstance()

    suspend fun toggleOnline(uid: String, currentOnline: Boolean) {
        val online = !currentOnline
        db.collection("drivers").document(uid).set(
            mapOf(
                "isOnline" to online,
                "status" to if (online) "online" else "offline",
                "statusChangedAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp(),
                (if (online) "onlineAt" else "offlineAt") to FieldValue.serverTimestamp(),
                (if (online) "offlineAt" else "onlineAt") to null,
            ),
            com.google.firebase.firestore.SetOptions.merge()
        ).await()
    }

    suspend fun updateLocation(uid: String, lat: Double, lng: Double) {
        db.collection("drivers").document(uid).update(
            mapOf(
                "location" to mapOf("lat" to lat, "lng" to lng),
                "lastLocationUpdate" to FieldValue.serverTimestamp(),
            )
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
