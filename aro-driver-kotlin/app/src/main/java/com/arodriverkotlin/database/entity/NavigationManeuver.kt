package com.arodriverkotlin.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "navigation_maneuvers")
data class NavigationManeuver(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val orderId: String,
    val sequence: Int,
    val lat: Double,
    val lng: Double,
    val instruction: String,
    val distanceToNext: Double,
    val timestamp: Long,
    var isCompleted: Boolean = false
)