package com.arodriverkotlin.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_actions")
data class PendingAction(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val uid: String,
    val actionType: String, // "accept", "reject", "arrive", "pickup", "complete", "cancel"
    val orderId: String,
    val payload: String, // JSON payload
    val timestamp: Long,
    var retryCount: Int = 0,
    var lastAttempt: Long = 0,
    var isSynced: Boolean = false
)