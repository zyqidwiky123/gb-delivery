package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.HashMap

class BackgroundDiagnostics(
    private val context: Context,
    private val uid: String
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var serviceStartTime = System.currentTimeMillis()
    private var locationFixes = 0L
    private var locationUploads = 0L
    private var locationUploadFailures = 0L
    private var queueDepth = 0
    private var fcmReceived = 0L
    private var geofenceTriggers = 0L
    private var crashes = 0L

    private val transitionBuffer = mutableListOf<Map<String, Any?>>()
    private val transitionBufferMaxSize = 50

    fun start() {
        scope.launch {
            while (isActive) {
                delay(UPLOAD_INTERVAL_MS)
                uploadDiagnostics()
            }
        }
    }

    fun recordLocationFix() {
        locationFixes++
    }

    fun recordLocationUpload(success: Boolean) {
        if (success) locationUploads++ else locationUploadFailures++
    }

    fun recordQueueDepth(depth: Int) {
        queueDepth = depth
    }

    fun recordFcmReceived() {
        fcmReceived++
    }

    fun recordGeofenceTrigger() {
        geofenceTriggers++
    }

    fun recordCrash() {
        crashes++
    }

    fun recordTransition(fromState: String, toState: String, orderId: String?) {
        synchronized(transitionBuffer) {
            transitionBuffer.add(mapOf(
                "from" to fromState,
                "to" to toState,
                "orderId" to orderId,
                "timestamp" to System.currentTimeMillis()
            ))
            if (transitionBuffer.size > transitionBufferMaxSize) {
                transitionBuffer.removeFirst()
            }
        }
    }

    suspend fun uploadTransitions() {
        val batch = synchronized(transitionBuffer) {
            val copy = transitionBuffer.toList()
            transitionBuffer.clear()
            copy
        }
        if (batch.isEmpty()) return
        try {
            for (entry in batch) {
                FirebaseFirestore.getInstance()
                    .collection("drivers").document(uid)
                    .collection("diagnostics").add(entry + mapOf("type" to "transition"))
                    .await()
            }
        } catch (_: Exception) {}
    }

    private suspend fun uploadDiagnostics() {
        val uptime = System.currentTimeMillis() - serviceStartTime
        val data = HashMap<String, Any>().apply {
            put("uid", uid)
            put("serviceUptimeMs", uptime)
            put("locationFixes", locationFixes)
            put("locationUploads", locationUploads)
            put("locationUploadFailures", locationUploadFailures)
            put("queueDepth", queueDepth)
            put("fcmReceived", fcmReceived)
            put("geofenceTriggers", geofenceTriggers)
            put("crashes", crashes)
            put("appVersion", getAppVersion())
            put("androidVersion", android.os.Build.VERSION.RELEASE)
            put("deviceModel", android.os.Build.MODEL)
            put("timestamp", FieldValue.serverTimestamp())
        }

        try {
            FirebaseFirestore.getInstance()
                .collection("diagnostics")
                .document("background_engine")
                .collection("sessions")
                .add(data)
                .await()
            Log.d(TAG, "Diagnostics uploaded successfully")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to upload diagnostics", e)
        }
    }

    private fun getAppVersion(): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "unknown"
        } catch (_: Exception) {
            "unknown"
        }
    }

    fun shutdown() {
        scope.cancel()
        scope.launch { uploadDiagnostics() } // Final upload
    }

    companion object {
        private const val TAG = "BackgroundDiagnostics"
        private const val UPLOAD_INTERVAL_MS = 24 * 60 * 60 * 1000L // 24 hours
    }
}