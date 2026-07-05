package com.arodriverkotlin.background

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.GeofencingEvent

class GeofenceBroadcastReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_GEOFENCE_EVENT = "com.arodriverkotlin.GEOFENCE_EVENT"
        private const val TAG = "GeofenceBroadcastReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_GEOFENCE_EVENT) return

        val pendingResult = goAsync()
        try {
            val geofencingEvent = GeofencingEvent.fromIntent(intent)
            if (geofencingEvent == null) {
                Log.w(TAG, "No geofencing event in intent")
                return
            }

            if (geofencingEvent.hasError()) {
                Log.e(TAG, "Geofencing error: ${geofencingEvent.errorCode}")
                return
            }

            val transitionType = geofencingEvent.geofenceTransition
            val triggeringGeofences = geofencingEvent.triggeringGeofences

            for (geofence in triggeringGeofences ?: emptyList()) {
                val geofenceId = geofence.requestId
                Log.i(TAG, "Geofence transition: $geofenceId, type: $transitionType")

                GeofenceEventHandler.handleTransition(context, geofenceId, transitionType)
            }
        } finally {
            pendingResult.finish()
        }
    }
}

object GeofenceEventHandler {
    @Volatile private var handler: ((Context, String, Int) -> Unit)? = null

    fun setHandler(handler: ((Context, String, Int) -> Unit)?) {
        this.handler = handler
    }

    fun handleTransition(context: Context, geofenceId: String, transitionType: Int) {
        handler?.invoke(context, geofenceId, transitionType)
    }
}