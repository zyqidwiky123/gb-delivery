package com.arodriverkotlin

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.MaterialTheme
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : ComponentActivity() {

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        createNotificationChannels()
        requestNotificationPermission()
        getFcmToken()

        setContent {
            MaterialTheme {
                AroDriverApp()
            }
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        try {
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
                val soundUri = Uri.parse("android.resource://${resources.getResourcePackageName(R.raw.notifdriver)}/${R.raw.notifdriver}")
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build()
                val incomingChannel = NotificationChannel(
                    "aro_drive_orders",
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
        } catch (_: Exception) {}
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun getFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
            }
        }
    }
}
