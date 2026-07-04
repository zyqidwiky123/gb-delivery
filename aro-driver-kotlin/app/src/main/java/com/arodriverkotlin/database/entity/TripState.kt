package com.arodriverkotlin.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "trip_state")
data class TripState(
    @PrimaryKey val uid: String,
    val state: String, // "IDLE", "OFFERED", "ACCEPTED", "ARRIVING", "AT_PICKUP", "PICKED_UP", "EN_ROUTE", "AT_DROPOFF", "COMPLETED"
    val orderId: String?,
    val pickupLat: Double?,
    val pickupLng: Double?,
    val dropoffLat: Double?,
    val dropoffLng: Double?,
    val updatedAt: Long,
    val version: Int = 1
)