package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics
import java.io.File
import java.io.FileWriter
import java.text.SimpleDateFormat
import java.util.*

object CrashReporter {

    private const val TAG = "CrashReporter"
    private const val CRASH_DIR = "crashes"

    private lateinit var crashDir: File
    private var initialized = false

    fun init(context: Context) {
        crashDir = File(context.filesDir, CRASH_DIR)
        if (!crashDir.exists()) crashDir.mkdirs()
        initialized = true
        uploadPendingCrashes(context)
    }

    fun recordException(context: Context, throwable: Throwable, metadata: Map<String, String>? = null) {
        if (!initialized) return

        try {
            metadata?.forEach { (key, value) ->
                FirebaseCrashlytics.getInstance().setCustomKey(key, value)
            }
            FirebaseCrashlytics.getInstance().recordException(throwable)
        } catch (_: Exception) {}

        try {
            writeLocalCrashLog(throwable, metadata)
        } catch (_: Exception) {}
    }

    fun logEvent(context: Context, event: String, data: Map<String, Any>? = null) {
        if (!initialized) return

        try {
            val timestamp = SimpleDateFormat("yyyy-MM-dd_HH:mm:ss", Locale.US)
                .format(Date())
            val logFile = File(crashDir, "events.log")
            val writer = FileWriter(logFile, true)
            writer.append("[$timestamp] $event")
            data?.forEach { (k, v) -> writer.append(" | $k=$v") }
            writer.append("\n")
            writer.close()
        } catch (_: Exception) {}
    }

    private fun writeLocalCrashLog(throwable: Throwable, metadata: Map<String, String>?) {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val file = File(crashDir, "crash_$timestamp.log")
        val writer = FileWriter(file)
        writer.append("Timestamp: $timestamp\n")
        writer.append("Exception: ${throwable.javaClass.name}: ${throwable.message}\n")
        metadata?.forEach { (k, v) -> writer.append("$k: $v\n") }
        writer.append("Stacktrace:\n")
        throwable.stackTrace.forEach { writer.append("\tat $it\n") }
        writer.close()
    }

    private fun uploadPendingCrashes(context: Context) {
        val files = crashDir.listFiles { f -> f.name.startsWith("crash_") && f.name.endsWith(".log") }
            ?: return
        FirebaseCrashlytics.getInstance().apply {
            files.forEach { file ->
                setCustomKey("local_crash_file", file.name)
                recordException(RuntimeException("Local crash: ${file.readText().take(500)}"))
            }
        }
        files.forEach { it.delete() }
    }
}
