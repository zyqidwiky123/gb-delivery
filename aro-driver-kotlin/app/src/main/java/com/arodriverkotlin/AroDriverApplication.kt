package com.arodriverkotlin

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.arodriverkotlin.service.IncomingOrderNotifier

class AroDriverApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
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

        IncomingOrderNotifier.createChannel(this)
    }
}
