package com.arodriverkotlin.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log

object ServiceCoordinator {

    private const val TAG = "ServiceCoordinator"

    var onSessionStateChanged: ((isOnline: Boolean, uid: String?) -> Unit)? = null
    var onTripStateChanged: ((isInTrip: Boolean, orderId: String?) -> Unit)? = null

    private var receiverRegistered = false

    fun startSession(context: Context, uid: String, driverName: String? = null) {
        Log.i(TAG, "Starting session for uid=$uid")
        SessionService.start(context, uid, driverName)
        registerReceiver(context)
    }

    fun stopSession(context: Context) {
        Log.i(TAG, "Stopping session")
        SessionService.stop(context)
        unregisterReceiver(context)
    }

    fun startTrip(context: Context, uid: String, orderId: String, serviceType: String = "transport") {
        Log.i(TAG, "Starting trip for order=$orderId type=$serviceType")
        TripService.start(context, uid, orderId, serviceType)
    }

    fun stopTrip(context: Context) {
        Log.i(TAG, "Stopping trip")
        TripService.stop(context)
    }

    fun stopAll(context: Context) {
        stopTrip(context)
        stopSession(context)
    }

    private val sessionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val uid = intent.getStringExtra(SessionService.EXTRA_UID_EVENT)
            val isOnline = intent.getBooleanExtra(SessionService.EXTRA_IS_ONLINE, false)
            onSessionStateChanged?.invoke(isOnline, uid)
        }
    }

    private fun registerReceiver(context: Context) {
        if (receiverRegistered) return
        context.registerReceiver(
            sessionReceiver,
            IntentFilter(SessionService.EVENT_SESSION_STATE_CHANGED)
        )
        receiverRegistered = true
    }

    private fun unregisterReceiver(context: Context) {
        if (!receiverRegistered) return
        try {
            context.unregisterReceiver(sessionReceiver)
        } catch (_: IllegalArgumentException) {}
        receiverRegistered = false
    }
}
