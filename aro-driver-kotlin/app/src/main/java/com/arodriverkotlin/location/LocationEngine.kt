package com.arodriverkotlin.location

interface LocationEngine {
    fun requestUpdates(config: LocationConfig, callback: LocationCallback)
    fun removeUpdates()
    suspend fun getLastLocation(): LocationData?
    val isGooglePlayServicesAvailable: Boolean
}

data class LocationData(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float? = null,
    val speed: Float? = null,
    val bearing: Float? = null,
    val altitude: Double? = null,
    val provider: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

interface LocationCallback {
    fun onLocationResult(result: LocationResult)
    fun onProviderEnabled(provider: String)
    fun onProviderDisabled(provider: String)
}

data class LocationResult(
    val locations: List<LocationData>,
    val lastLocation: LocationData? get() = locations.lastOrNull()
)
