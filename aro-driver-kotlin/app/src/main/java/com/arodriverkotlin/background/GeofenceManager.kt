package com.arodriverkotlin.background

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingClient
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices

class GeofenceManager(
    private val context: Context,
    private val uid: String,
    private val configService: com.arodriverkotlin.service.ConfigService
) {

    private val geofencingClient: GeofencingClient = LocationServices.getGeofencingClient(context)

    private const val TAG = "GeofenceManager"
    private val GEOFENCE_RADIUS_METERS: Float by lazy { configService.getGeofenceRadiusMeters() }
    private const val GEOFENCE_EXPIRATION = Geofence.NEVER_EXPIRE
    private const val GEOFENCE_TRANSITION_TYPES = Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT

    private val activeGeofences = mutableMapOf<String, Geofence>()

    fun addPickupGeofence(orderId: String, lat: Double, lng: Double) {
        val geofence = Geofence.Builder()
            .setRequestId("pickup_$orderId")
            .setCircularRegion(lat, lng, GEOFENCE_RADIUS_METERS)
            .setExpirationDuration(GEOFENCE_EXPIRATION)
            .setTransitionTypes(GEOFENCE_TRANSITION_TYPES)
            .setLoiteringDelay(10_000)
            .build()

        activeGeofences["pickup_$orderId"] = geofence
        registerGeofences()
    }

    fun addDropoffGeofence(orderId: String, lat: Double, lng: Double) {
        val geofence = Geofence.Builder()
            .setRequestId("dropoff_$orderId")
            .setCircularRegion(lat, lng, GEOFENCE_RADIUS_METERS)
            .setExpirationDuration(GEOFENCE_EXPIRATION)
            .setTransitionTypes(GEOFENCE_TRANSITION_TYPES)
            .setLoiteringDelay(10_000)
            .build()

        activeGeofences["dropoff_$orderId"] = geofence
        registerGeofences()
    }

    fun removeGeofencesForOrder(orderId: String) {
        val toRemove = listOf("pickup_$orderId", "dropoff_$orderId")
        activeGeofences.keys.removeAll { it in toRemove }
        geofencingClient.removeGeofences(toRemove)
            .addOnSuccessListener { Log.d(TAG, "Removed geofences for $orderId") }
            .addOnFailureListener { e -> Log.w(TAG, "Failed to remove geofences", e) }
    }

    fun clearAllGeofences() {
        val requestIds = activeGeofences.keys.toList()
        activeGeofences.clear()
        if (requestIds.isNotEmpty()) {
            geofencingClient.removeGeofences(requestIds)
                .addOnSuccessListener { Log.d(TAG, "Cleared all geofences") }
                .addOnFailureListener { e -> Log.w(TAG, "Failed to clear geofences", e) }
        }
    }

    private fun registerGeofences() {
        if (activeGeofences.isEmpty()) return

        val request = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofences(activeGeofences.values)
            .build()

        val pendingIntent = createGeofencePendingIntent()

        geofencingClient.addGeofences(request, pendingIntent)
            .addOnSuccessListener { Log.d(TAG, "Geofences registered: ${activeGeofences.size}") }
            .addOnFailureListener { e -> Log.w(TAG, "Failed to register geofences", e) }
    }

    private fun createGeofencePendingIntent(): PendingIntent {
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        intent.action = GeofenceBroadcastReceiver.ACTION_GEOFENCE_EVENT
        return PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    fun shutdown() {
        clearAllGeofences()
    }
}