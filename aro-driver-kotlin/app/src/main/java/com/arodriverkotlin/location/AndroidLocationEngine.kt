package com.arodriverkotlin.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

class AndroidLocationEngine(private val context: Context) : LocationEngine {

    private val locationManager: LocationManager =
        context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    private var activeListener: LocationListener? = null

    override val isGooglePlayServicesAvailable: Boolean = false

    override fun requestUpdates(config: LocationConfig, callback: LocationCallback) {
        if (!hasPermission()) return

        val provider = selectBestProvider()

        val listener = createListener(callback)
        activeListener = listener

        try {
            locationManager.requestLocationUpdates(
                provider,
                config.intervalMs,
                config.smallestDisplacementM,
                listener
            )
        } catch (_: IllegalArgumentException) {
            val fallback = if (provider == LocationManager.GPS_PROVIDER)
                LocationManager.NETWORK_PROVIDER
            else LocationManager.GPS_PROVIDER
            try {
                locationManager.requestLocationUpdates(
                    fallback,
                    config.intervalMs,
                    config.smallestDisplacementM,
                    listener
                )
            } catch (_: Exception) {}
        }
    }

    override fun removeUpdates() {
        activeListener?.let { locationManager.removeUpdates(it) }
        activeListener = null
    }

    override suspend fun getLastLocation(): LocationData? = suspendCancellableCoroutine { cont ->
        if (!hasPermission()) {
            cont.resume(null)
            return@suspendCancellableCoroutine
        }
        val providers = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        )
        for (provider in providers) {
            try {
                val loc = locationManager.getLastKnownLocation(provider)
                if (loc != null) {
                    cont.resume(loc.toLocationData())
                    return@suspendCancellableCoroutine
                }
            } catch (_: Exception) {}
        }
        cont.resume(null)
    }

    private fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun selectBestProvider(): String {
        return if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            LocationManager.GPS_PROVIDER
        } else if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
            LocationManager.NETWORK_PROVIDER
        } else {
            LocationManager.PASSIVE_PROVIDER
        }
    }

    private fun createListener(callback: LocationCallback): LocationListener {
        return object : LocationListener {
            override fun onLocationChanged(location: Location) {
                callback.onLocationResult(
                    LocationResult(listOf(location.toLocationData()))
                )
            }
            override fun onProviderEnabled(provider: String) {
                callback.onProviderEnabled(provider)
            }
            override fun onProviderDisabled(provider: String) {
                callback.onProviderDisabled(provider)
            }
            @Deprecated("Deprecated in API 29")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
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
