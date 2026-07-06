package com.arodriverkotlin.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

class GoogleLocationEngine(private val context: Context) : LocationEngine {

    private val fused: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    private var gmsCallback: com.google.android.gms.location.LocationCallback? = null

    override val isGooglePlayServicesAvailable: Boolean
        get() = GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS

    override fun requestUpdates(config: LocationConfig, callback: LocationCallback) {
        if (!hasPermission()) return

        val request = mapToGmsRequest(config)
        val gmsCallback = createGmsCallback(callback)
        this.gmsCallback = gmsCallback

        fused.requestLocationUpdates(request, gmsCallback, Looper.getMainLooper())
    }

    override fun removeUpdates() {
        gmsCallback?.let { fused.removeLocationUpdates(it) }
        gmsCallback = null
    }

    override suspend fun getLastLocation(): LocationData? = suspendCancellableCoroutine { cont ->
        if (!hasPermission()) {
            cont.resume(null)
            return@suspendCancellableCoroutine
        }
        fused.getCurrentLocation(
            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            CancellationTokenSource().token
        ).addOnSuccessListener { loc ->
            cont.resume(loc?.toLocationData())
        }.addOnFailureListener {
            cont.resume(null)
        }
    }

    private fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun mapToGmsRequest(config: LocationConfig): LocationRequest {
        val priority = when (config.priority) {
            LocationPriority.HIGH_ACCURACY -> Priority.PRIORITY_HIGH_ACCURACY
            LocationPriority.BALANCED -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
            LocationPriority.LOW_POWER -> Priority.PRIORITY_LOW_POWER
        }
        return LocationRequest.Builder(priority, config.intervalMs)
            .setMinUpdateIntervalMillis(config.minIntervalMs)
            .setMaxUpdateDelayMillis(config.maxWaitTimeMs)
            .build()
    }

    private fun createGmsCallback(callback: LocationCallback): com.google.android.gms.location.LocationCallback {
        return object : com.google.android.gms.location.LocationCallback() {
            override fun onLocationResult(result: com.google.android.gms.location.LocationResult) {
                val locations = result.locations?.map { it.toLocationData() } ?: emptyList()
                callback.onLocationResult(LocationResult(locations))
            }
        }
    }

    private fun Location.toLocationData() = LocationData(
        latitude = latitude,
        longitude = longitude,
        accuracy = accuracy,
        speed = speed,
        bearing = bearing,
        altitude = altitude,
        provider = provider,
        timestamp = time
    )
}
