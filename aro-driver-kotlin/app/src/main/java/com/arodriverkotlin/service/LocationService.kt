package com.arodriverkotlin.service

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.Priority
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

data class LocationData(val lat: Double, val lng: Double)

object LocationService {
    private const val LOCATION_UPDATE_INTERVAL_MS = 5000L
    private const val LOCATION_FASTEST_INTERVAL_MS = 2000L

    fun hasPermission(app: Application): Boolean {
        return ContextCompat.checkSelfPermission(app, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    suspend fun getLastKnownLocation(fused: FusedLocationProviderClient): LocationData? {
        return try {
            val loc = fused.lastLocation.await()
            loc?.let { LocationData(it.latitude, it.longitude) }
        } catch (_: Exception) { null }
    }

    fun observeLocation(fused: FusedLocationProviderClient): Flow<LocationData> = callbackFlow {
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return
                trySend(LocationData(loc.latitude, loc.longitude))
            }
        }
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_UPDATE_INTERVAL_MS)
            .setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL_MS)
            .build()
        try {
            fused.requestLocationUpdates(request, callback, null)
        } catch (_: Exception) {}
        awaitClose { fused.removeLocationUpdates(callback) }
    }
}
