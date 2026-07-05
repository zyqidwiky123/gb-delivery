package com.arodriverkotlin.background

import android.content.Context
import android.os.PowerManager

class SmartWakeLock(private val context: Context) {
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private var tripWakeLock: PowerManager.WakeLock? = null
    private var incomingWakeLock: PowerManager.WakeLock? = null

    fun acquireForActiveTrip() {
        releaseTrip()
        tripWakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "ARO:TripWakeLock"
        ).apply { acquire() }
    }

    fun acquireForIncomingOrder() {
        releaseIncoming()
        incomingWakeLock = powerManager.newWakeLock(
            PowerManager.SCREEN_DIM_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "ARO:IncomingWakeLock"
        ).apply { acquire(10_000L) }
    }

    fun releaseAll() {
        releaseTrip()
        releaseIncoming()
    }

    private fun releaseTrip() {
        tripWakeLock?.let {
            if (it.isHeld) it.release()
            tripWakeLock = null
        }
    }

    private fun releaseIncoming() {
        incomingWakeLock?.let {
            if (it.isHeld) it.release()
            incomingWakeLock = null
        }
    }

    companion object {
        fun acquireForFcm(context: Context): PowerManager.WakeLock {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "ARO:FcmWakeLock"
            )
            wakeLock.acquire(10_000L)
            return wakeLock
        }
    }
}
