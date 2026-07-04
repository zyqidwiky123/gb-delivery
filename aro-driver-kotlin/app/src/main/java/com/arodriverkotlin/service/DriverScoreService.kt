package com.arodriverkotlin.service

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

object DriverScoreService {
    private val firestore = FirebaseFirestore.getInstance()

    suspend fun getScore(uid: String): com.arodriverkotlin.models.DriverScore {
        val snap = firestore.collection("drivers").document(uid).get().await()
        return com.arodriverkotlin.models.DriverScore(
            acceptanceRate = snap.getDouble("acceptanceRate")?.toFloat() ?: 0f,
            completionRate = snap.getDouble("completionRate")?.toFloat() ?: 0f,
            cancellationRate = snap.getDouble("cancellationRate")?.toFloat() ?: 0f,
            averageRating = snap.getDouble("rating")?.toFloat() ?: 0f,
            totalTrips = snap.getLong("totalTrips")?.toInt() ?: 0
        )
    }

    suspend fun getCancellationPenalty(uid: String): Long {
        val snap = firestore.collection("drivers").document(uid).get().await()
        return snap.getLong("cancellationPenalty") ?: 5000L
    }
}
