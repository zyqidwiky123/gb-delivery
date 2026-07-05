package com.arodriverkotlin.location

import android.content.Context
import android.os.Build
import android.provider.Settings

class LocationQualityMonitor(private val context: Context) {

    enum class GpsSignalStatus {
        NONE, WEAK, GOOD, EXCELLENT
    }

    companion object {
        private const val ACCURACY_SAMPLE_SIZE = 10
        private const val WEAK_ACCURACY_THRESHOLD = 50f
        private const val GOOD_ACCURACY_THRESHOLD = 10f
    }

    private val accuracySamples = mutableListOf<Float>()

    @Volatile var avgAccuracy: Float = 0f
        private set
    @Volatile var isWeakGps: Boolean = false
        private set
    @Volatile var gpsSignalStatus: GpsSignalStatus = GpsSignalStatus.NONE
        private set

    fun onLocationUpdate(location: LocationData) {
        val accuracy = location.accuracy ?: return

        synchronized(accuracySamples) {
            accuracySamples.add(accuracy)
            if (accuracySamples.size > ACCURACY_SAMPLE_SIZE) {
                accuracySamples.removeFirst()
            }
            avgAccuracy = accuracySamples.average().toFloat()
        }

        isWeakGps = avgAccuracy > WEAK_ACCURACY_THRESHOLD
        gpsSignalStatus = when {
            avgAccuracy <= GOOD_ACCURACY_THRESHOLD -> GpsSignalStatus.EXCELLENT
            avgAccuracy <= WEAK_ACCURACY_THRESHOLD -> GpsSignalStatus.GOOD
            else -> GpsSignalStatus.WEAK
        }
    }

    fun isMockLocationEnabled(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.Secure.getInt(
                context.contentResolver,
                Settings.Secure.ALLOW_MOCK_LOCATION, 0
            ) != 0
        }
        return false
    }

    fun isMockLocation(location: LocationData): Boolean {
        return isMockLocationEnabled()
    }
}
