package com.arodriverkotlin

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.util.Log
import com.arodriverkotlin.service.ConfigService
import com.arodriverkotlin.service.IncomingOrderNotifier
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AroDriverApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        // Initialize Crashlytics
        FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(true)
        createNotificationChannels()

        // Crash upload handler
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val prefs = getSharedPreferences("foreground_service", MODE_PRIVATE)
                val uid = prefs.getString("driver_uid", null)
                if (uid != null) {
                    FirebaseFirestore.getInstance()
                        .collection("drivers").document(uid)
                        .collection("diagnostics").add(mapOf(
                            "type" to "crash",
                            "timestamp" to FieldValue.serverTimestamp(),
                            "error" to throwable.message
                        ))
                }
            } catch (e: Exception) {
                Log.e("AroDriverApplication", "Gagal upload crash diagnostics", e)
            }
            defaultHandler?.uncaughtException(thread, throwable)
        }

        // Fetch Remote Config
        CoroutineScope(Dispatchers.IO).launch {
            try {
                ConfigService.fetchAndActivate()
                Log.i("CONFIG", "Remote Config fetched and activated")
            } catch (e: Exception) {
                Log.w("CONFIG", "Remote Config fetch failed", e)
            }
        }
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
        } catch (e: Exception) {
            Log.e("AroDriverApplication", "Gagal buat notif channel", e)
        }

        IncomingOrderNotifier.createChannel(this)
    }
}
