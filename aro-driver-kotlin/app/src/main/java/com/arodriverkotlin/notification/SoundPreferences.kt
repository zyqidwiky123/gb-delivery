package com.arodriverkotlin.notification

data class SoundPreferences(
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
    val selectedSoundUri: String = "default"
)
