package com.arodriverkotlin.background

import android.content.Context
import android.os.PowerManager

class SmartWakeLock(private val context: Context) {
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private var orderWakeLock: PowerManager.WakeLock? = null
    private var fcmWakeLock: PowerManager.WakeLock? = null

    fun acquireForOrder() {
        releaseOrder()
        orderWakeLock = powerManager.newWakeLock(
            PowerManager.SCREEN_DIM_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "ARO:OrderWakeLock"
        ).apply { acquire(10 * 60 * 1000L) }
    }

    fun acquireForFcm() {
        releaseFcm()
        fcmWakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "ARO:FcmWakeLock"
        ).apply { acquire(10_000L) }
    }

    fun releaseAll() {
        releaseOrder()
        releaseFcm()
    }

    private fun releaseOrder() {
        orderWakeLock?.let {
            if (it.isHeld) it.release()
            orderWakeLock = null
        }
    }

    private fun releaseFcm() {
        fcmWakeLock?.let {
            if (it.isHeld) it.release()
            fcmWakeLock = null
        }
    }
}
