package com.arodriverkotlin.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_locations")
data class PendingLocation(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val uid: String,
    val lat: Double,
    val lng: Double,
    val orderId: String?,
    val timestamp: Long,
    var retryCount: Int = 0,
    var lastAttempt: Long = 0
)