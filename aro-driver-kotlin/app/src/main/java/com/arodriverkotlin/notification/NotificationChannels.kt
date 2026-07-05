package com.arodriverkotlin.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.arodriverkotlin.R

object NotificationChannels {

    const val ORDERS = "aro_drive_orders"
    const val CHAT = "aro_drive_chat"
    const val PROMO = "aro_drive_promo"
    const val SYSTEM = "aro_drive_system"
    const val SAFETY = "aro_drive_safety"
    const val FOREGROUND = "aro_drive_foreground_service"

    fun registerAll(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val nm = context.getSystemService(NotificationManager::class.java)

        nm.createNotificationChannel(
            NotificationChannel(
                ORDERS, "Pesanan Masuk", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifikasi pesanan baru"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 150, 300, 150, 300)
                setSound(customSoundUri(context), notificationAudioAttributes())
                enableLights(true)
            }
        )

        nm.createNotificationChannel(
            NotificationChannel(
                CHAT, "Pesan", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Pesan dari pelanggan"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 200, 100, 200)
                setSound(Settings.System.DEFAULT_NOTIFICATION_URI, notificationAudioAttributes())
                enableLights(true)
            }
        )

        nm.createNotificationChannel(
            NotificationChannel(
                PROMO, "Promo", NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Promo dan informasi"
                setSound(null, null)
                enableVibration(false)
            }
        )

        nm.createNotificationChannel(
            NotificationChannel(
                SYSTEM, "Sistem", NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Pembaruan sistem"
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
            }
        )

        nm.createNotificationChannel(
            NotificationChannel(
                SAFETY, "Keamanan", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Peringatan keamanan dan darurat"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                setSound(Settings.System.DEFAULT_NOTIFICATION_URI, notificationAudioAttributes())
                enableLights(true)
            }
        )

        nm.createNotificationChannel(
            NotificationChannel(
                FOREGROUND, "ARO DRIVE", NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Layanan latar belakang"
                setShowBadge(false)
                setSound(null, null)
            }
        )
    }

    fun migrateIfNeeded(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.deleteNotificationChannel("aro_drive_incoming_v7")
        nm.deleteNotificationChannel("aro_drive_incoming_v6")
    }

    private fun customSoundUri(context: Context): Uri =
        Uri.parse("android.resource://${context.packageName}/raw/notifdriver")

    private fun notificationAudioAttributes(): AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
}
