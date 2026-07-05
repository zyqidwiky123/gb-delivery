package com.arodriverkotlin.notification

import androidx.core.app.NotificationCompat

enum class NotificationType {
    ORDER, CHAT, PROMO, SYSTEM, SAFETY
}

data class NotificationModel(
    val id: String,
    val type: NotificationType,
    val title: String,
    val body: String,
    val deepLink: String? = null,
    val payload: Map<String, String> = emptyMap(),
    val priority: Int = NotificationCompat.PRIORITY_HIGH,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true
)
