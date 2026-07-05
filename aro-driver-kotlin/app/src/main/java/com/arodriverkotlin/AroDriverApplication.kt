package com.arodriverkotlin

import android.app.Application
import android.os.Build
import android.util.Log
import com.arodriverkotlin.notification.NotificationChannels
import com.arodriverkotlin.notification.NotificationEngine
import com.arodriverkotlin.service.ConfigService
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AroDriverApplication : Application() {

    companion object {
        lateinit var instance: AroDriverApplication
            private set
        private const val TAG = "AroDriverApplication"
    }

    override fun onCreate() {
        instance = this
        super.onCreate()
        // Log device info for diagnostics
        logDeviceInfo()
        // Initialize Crashlytics
        FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(true)

        NotificationChannels.registerAll(this)
        NotificationChannels.migrateIfNeeded(this)
        NotificationEngine.init(this)

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

    private fun logDeviceInfo() {
        try {
            val manufacturer = Build.MANUFACTURER
            val model = Build.MODEL
            val brand = Build.BRAND
            val isMiui = try {
                System.getProperty("ro.miui.ui.version.name") != null
            } catch (_: Exception) { false }
            Log.i(TAG, "Device: $manufacturer $brand $model (MIUI: $isMiui) SDK: ${Build.VERSION.SDK_INT}")
            FirebaseCrashlytics.getInstance().apply {
                setCustomKey("device_manufacturer", manufacturer)
                setCustomKey("device_model", model)
                setCustomKey("device_brand", brand)
                setCustomKey("is_miui", isMiui)
                setCustomKey("sdk_int", Build.VERSION.SDK_INT)
            }
        } catch (_: Exception) {}
    }

}
