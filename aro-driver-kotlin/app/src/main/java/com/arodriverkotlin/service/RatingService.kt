package com.arodriverkotlin.service

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

data class Rating(
    val userId: String = "",
    val userName: String = "",
    val rating: Float = 0f,
    val comment: String = "",
    val createdAt: Long = 0L
)

object RatingService {
    private val firestore = FirebaseFirestore.getInstance()

    suspend fun getAverageRating(uid: String): Float {
        val snap = firestore.collection("drivers").document(uid).get().await()
        return snap.getDouble("rating")?.toFloat() ?: 0f
    }

    suspend fun getRatingCount(uid: String): Int {
        val snap = firestore.collection("drivers").document(uid).get().await()
        return snap.getLong("ratingCount")?.toInt() ?: 0
    }

    suspend fun getLatestRatings(uid: String, limit: Int = 10): List<Rating> {
        val ratings = firestore.collection("drivers").document(uid)
            .collection("ratings")
            .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .limit(limit)
            .get().await()
        return ratings.map { doc ->
            Rating(
                userId = doc.getString("userId") ?: "",
                userName = doc.getString("userName") ?: "",
                rating = doc.getDouble("rating")?.toFloat() ?: 0f,
                comment = doc.getString("comment") ?: "",
                createdAt = doc.getTimestamp("createdAt")?.toDate()?.time ?: 0L
            )
        }
    }
}
