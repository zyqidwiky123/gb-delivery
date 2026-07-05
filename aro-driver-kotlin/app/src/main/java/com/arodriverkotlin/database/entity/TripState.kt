package com.arodriverkotlin.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "trip_state")
data class TripState(
    @PrimaryKey val uid: String,
    val state: String,
    val orderId: String? = null,
    val serviceType: String = "transport",
    val pickupLat: Double? = null,
    val pickupLng: Double? = null,
    val dropoffLat: Double? = null,
    val dropoffLng: Double? = null,
    val updatedAt: Long = System.currentTimeMillis(),
    val version: Int = 0
)