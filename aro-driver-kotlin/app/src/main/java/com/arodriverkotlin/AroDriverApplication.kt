package com.arodriverkotlin

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build

class AroDriverApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun getNotificationSoundUri(): Uri {
        return Uri.parse("android.resource://${packageName}/${R.raw.notifdriver}")
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        try {
            val fgChannel = NotificationChannel(
                "aro_drive_foreground_service",
                "ARO DRIVE",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Layanan latar belakang ARO DRIVE"
                setShowBadge(false)
            }
            nm.createNotificationChannel(fgChannel)
        } catch (_: Exception) {}

        try {
            val soundUri = getNotificationSoundUri()
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build()
            val incomingChannel = NotificationChannel(
                "aro_drive_incoming_v3",
                "Pesanan Masuk",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifikasi pesanan baru ARO DRIVE"
                enableVibration(true)
                setSound(soundUri, audioAttributes)
                enableLights(true)
            }
            nm.createNotificationChannel(incomingChannel)
        } catch (_: Exception) {}
    }
}
