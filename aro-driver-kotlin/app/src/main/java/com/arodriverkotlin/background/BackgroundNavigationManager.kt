package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import com.arodriverkotlin.database.AppDatabase
import com.arodriverkotlin.database.entity.NavigationManeuver
import com.arodriverkotlin.service.DirectionsService
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlin.math.pow

class BackgroundNavigationManager(
    private val context: Context,
    private val uid: String
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val db = AppDatabase.getInstance(context)
    private val maneuverDao = db.navigationManeuverDao()

    suspend fun startNavigation(orderId: String, origin: LatLng, destination: LatLng, apiKey: String) {
        try {
            val route = DirectionsService.fetchRoute(origin, destination, apiKey)
            if (route.isNotEmpty()) {
                persistManeuvers(orderId, route)
                Log.i(TAG, "Navigation started for order $orderId with ${route.size} points")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start navigation", e)
        }
    }

    private suspend fun persistManeuvers(orderId: String, route: List<LatLng>) {
        val maneuvers = route.mapIndexed { index, point ->
            NavigationManeuver(
                orderId = orderId,
                sequence = index,
                lat = point.latitude,
                lng = point.longitude,
                instruction = generateInstruction(index, route),
                distanceToNext = if (index < route.lastIndex) {
                    calculateDistance(point, route[index + 1])
                } else 0.0,
                timestamp = System.currentTimeMillis()
            )
        }
        maneuverDao.insertAll(maneuvers)
    }

    suspend fun getNextManeuver(orderId: String): NavigationManeuver? {
        return maneuverDao.getNextManeuver(orderId)
    }

    suspend fun completeManeuver(orderId: String, sequence: Int) {
        maneuverDao.markCompleted(orderId, sequence)
    }

    suspend fun clearNavigation(orderId: String) {
        maneuverDao.deleteByOrderId(orderId)
    }

    private fun generateInstruction(index: Int, route: List<LatLng>): String {
        if (index == 0) return "Start navigation"
        if (index == route.lastIndex) return "Arrived at destination"
        return "Continue on route"
    }

    private fun calculateDistance(from: LatLng, to: LatLng): Double {
        val R = 6371000.0
        val dLat = Math.toRadians(to.latitude - from.latitude)
        val dLon = Math.toRadians(to.longitude - from.longitude)
        val a = Math.sin(dLat / 2).pow(2) +
                Math.cos(Math.toRadians(from.latitude)) * Math.cos(Math.toRadians(to.latitude)) *
                Math.sin(dLon / 2).pow(2)
        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c
    }

    fun shutdown() {
        scope.cancel()
    }

    companion object {
        private const val TAG = "BackgroundNavigationManager"
    }
}