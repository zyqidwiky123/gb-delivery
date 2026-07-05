package com.arodriverkotlin.location

data class LocationConfig(
    val priority: LocationPriority,
    val intervalMs: Long = 5000L,
    val minIntervalMs: Long = 2000L,
    val smallestDisplacementM: Float = 0f,
    val maxWaitTimeMs: Long = intervalMs * 2
)

enum class LocationPriority {
    HIGH_ACCURACY,
    BALANCED,
    LOW_POWER
}
