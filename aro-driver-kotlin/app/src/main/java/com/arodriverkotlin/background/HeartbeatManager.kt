package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ServerValue
import kotlinx.coroutines.*

class HeartbeatManager(
    private val context: Context,
    private val uid: String
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null

    companion object {
        private const val TAG = "HeartbeatManager"
        private const val DEFAULT_INTERVAL_MS = 60_000L
    }

    fun start(intervalMs: Long = DEFAULT_INTERVAL_MS) {
        stop()
        job = scope.launch {
            while (isActive) {
                try {
                    sendHeartbeat()
                } catch (e: Exception) {
                    Log.w(TAG, "Heartbeat failed", e)
                }
                delay(intervalMs)
            }
        }
        Log.i(TAG, "Heartbeat started (interval=${intervalMs}ms)")
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    private suspend fun sendHeartbeat() {
        FirebaseDatabase.getInstance()
            .getReference("drivers/$uid")
            .child("lastActive")
            .setValue(ServerValue.TIMESTAMP)
            .await()
    }

    fun shutdown() {
        stop()
        scope.cancel()
    }

    private suspend fun <T> com.google.android.gms.tasks.Task<T>.await(): T {
        return kotlinx.coroutines.tasks.await(this)
    }
}
