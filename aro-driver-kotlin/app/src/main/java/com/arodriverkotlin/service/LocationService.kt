package com.arodriverkotlin.service

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.arodriverkotlin.location.LocationData
import com.arodriverkotlin.location.LocationKit
import com.arodriverkotlin.location.LocationConfig
import com.arodriverkotlin.location.LocationPriority
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

object LocationService {

    fun hasPermission(app: Application): Boolean {
        return ContextCompat.checkSelfPermission(app, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    suspend fun getLastKnownLocation(context: android.content.Context): LocationData? {
        val kit = LocationKit(context)
        return kit.getLastLocation()
    }

    fun observeLocation(context: android.content.Context): Flow<LocationData> = callbackFlow {
        val kit = LocationKit(context)
        kit.startTracking(
            config = LocationConfig(
                priority = LocationPriority.HIGH_ACCURACY,
                intervalMs = 5000L,
                minIntervalMs = 2000L
            ),
            onResult = { trySend(it) }
        )
        awaitClose { kit.stopTracking() }
    }
}
