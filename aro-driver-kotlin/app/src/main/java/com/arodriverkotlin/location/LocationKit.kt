package com.arodriverkotlin.location

import android.content.Context
import android.util.Log

class LocationKit(private val context: Context) {

    val engine: LocationEngine
    val qualityMonitor: LocationQualityMonitor

    private var activeCallback: LocationCallback? = null
    private var currentConfig: LocationConfig? = null
    private var currentOnResult: ((LocationData) -> Unit)? = null

    companion object {
        private const val TAG = "LocationKit"
    }

    init {
        qualityMonitor = LocationQualityMonitor(context)
        engine = if (GoogleLocationEngine(context).isGooglePlayServicesAvailable) {
            Log.i(TAG, "Selected engine: GoogleLocationEngine (GMS)")
            GoogleLocationEngine(context)
        } else {
            Log.i(TAG, "Selected engine: AndroidLocationEngine (non-GMS)")
            AndroidLocationEngine(context)
        }
    }

    fun startTracking(config: LocationConfig, onResult: (LocationData) -> Unit) {
        currentConfig = config
        currentOnResult = onResult

        val callback = object : LocationCallback {
            override fun onLocationResult(result: LocationResult) {
                result.locations.forEach { loc ->
                    qualityMonitor.onLocationUpdate(loc)
                    onResult(loc)
                }
            }
            override fun onProviderEnabled(provider: String) {
                Log.i(TAG, "Provider enabled: $provider")
            }
            override fun onProviderDisabled(provider: String) {
                Log.w(TAG, "Provider disabled: $provider")
            }
        }
        activeCallback = callback
        engine.requestUpdates(config, callback)
    }

    fun stopTracking() {
        engine.removeUpdates()
        activeCallback = null
        currentConfig = null
    }

    fun updateConfig(intervalMs: Long? = null, minIntervalMs: Long? = null, priority: LocationPriority? = null) {
        val oldConfig = currentConfig ?: return
        val onResult = currentOnResult ?: return
        val newConfig = oldConfig.copy(
            intervalMs = intervalMs ?: oldConfig.intervalMs,
            minIntervalMs = minIntervalMs ?: oldConfig.minIntervalMs,
            priority = priority ?: oldConfig.priority
        )
        stopTracking()
        startTracking(newConfig, onResult)
    }

    suspend fun getLastLocation(): LocationData? {
        return engine.getLastLocation()
    }

    fun isMockLocationEnabled(): Boolean = qualityMonitor.isMockLocationEnabled()

    fun isGpsEnabled(): Boolean {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as android.location.LocationManager
        return lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)
    }
}
