package com.arodriverkotlin.service

import com.google.firebase.remoteconfig.FirebaseRemoteConfig
import com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings
import kotlinx.coroutines.tasks.await

object ConfigService {
    private val remoteConfig: FirebaseRemoteConfig = FirebaseRemoteConfig.getInstance()

    private val defaults: Map<String, Any> = mapOf(
        "maps_api_key" to "",
        // FASE 3 (mode gratis/OSM): endpoint routing & geocode tanpa API key.
        // Isi via Firebase Console > Remote Config jika perlu ganti host.
        "osrm_url" to "https://router.project-osrm.org/route/v1/driving",
        "nominatim_url" to "https://nominatim.openstreetmap.org",
        // Pilihan tile peta driver: "carto_dark" | "osm_standard".
        // Bisa diubah dari Firebase Console tanpa update APK.
        "map_tiles" to "carto_dark",
        "accept_timeout_seconds" to 20L,
        "geofence_radius_meters" to 100L,
        "location_interval_idle_ms" to 30000L,
        "location_interval_offline_ms" to 30000L,
        "location_min_interval_active_ms" to 1500L,
        "location_min_interval_idle_ms" to 15000L,
        "idle_heartbeat_ms" to 300000L,
        "movement_threshold_m" to 100L,
        "buffer_flush_interval_ms" to 30000L,
        "buffer_max_size" to 50L,
        "max_backoff_ms" to 120000L,
        "websocket_url" to "",
    )

    init {
        val configSettings = FirebaseRemoteConfigSettings.Builder()
            .setMinimumFetchIntervalInSeconds(300)
            .build()
        remoteConfig.setConfigSettingsAsync(configSettings)
        remoteConfig.setDefaultsAsync(defaults)
    }

    suspend fun fetchAndActivate() {
        remoteConfig.fetchAndActivate().await()
    }

    fun getMapsApiKey(): String = remoteConfig.getString("maps_api_key")

    /** FASE 3: base URL OSRM (default public demo, gratis). */
    fun getOsrmUrl(): String = remoteConfig.getString("osrm_url")

    /** FASE 3: base URL Nominatim (default public, gratis). */
    fun getNominatimUrl(): String = remoteConfig.getString("nominatim_url")

    /** FASE 3 fix blank-map: pilihan tile source ("carto_dark" | "osm_standard"). */
    fun getMapTiles(): String = remoteConfig.getString("map_tiles")

    fun getAcceptTimeoutMs(): Long = remoteConfig.getLong("accept_timeout_seconds") * 1000

    fun getGeofenceRadiusMeters(): Float = remoteConfig.getLong("geofence_radius_meters").toFloat()

    fun getLocationIntervalIdleMs(): Long = remoteConfig.getLong("location_interval_idle_ms")

    fun getLocationIntervalOfflineMs(): Long = remoteConfig.getLong("location_interval_offline_ms")

    fun getLocationMinIntervalActiveMs(): Long = remoteConfig.getLong("location_min_interval_active_ms")

    fun getLocationMinIntervalIdleMs(): Long = remoteConfig.getLong("location_min_interval_idle_ms")

    fun getIdleHeartbeatMs(): Long = remoteConfig.getLong("idle_heartbeat_ms")

    fun getMovementThresholdM(): Double = remoteConfig.getLong("movement_threshold_m").toDouble()

    fun getBufferFlushIntervalMs(): Long = remoteConfig.getLong("buffer_flush_interval_ms")

    fun getBufferMaxSize(): Int = remoteConfig.getLong("buffer_max_size").toInt()

    fun getMaxBackoffMs(): Long = remoteConfig.getLong("max_backoff_ms")

    fun getString(key: String): String = remoteConfig.getString(key)

    fun getLong(key: String): Long = remoteConfig.getLong(key)
}
