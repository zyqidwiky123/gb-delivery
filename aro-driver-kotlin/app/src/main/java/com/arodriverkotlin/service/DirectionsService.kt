package com.arodriverkotlin.service

import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.PolyUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL

object DirectionsService {

    suspend fun fetchRoute(
        origin: LatLng,
        destination: LatLng,
        apiKey: String,
    ): List<LatLng> = withContext(Dispatchers.IO) {
        try {
            val url = "https://maps.googleapis.com/maps/api/directions/json?" +
                "origin=${origin.latitude},${origin.longitude}" +
                "&destination=${destination.latitude},${destination.longitude}" +
                "&mode=driving&key=$apiKey"
            val json = URL(url).readText()
            val obj = JSONObject(json)
            if (obj.getString("status") != "OK") return@withContext emptyList()

            val routes = obj.getJSONArray("routes")
            if (routes.length() == 0) return@withContext emptyList()

            val points = routes.getJSONObject(0)
                .getJSONObject("overview_polyline")
                .getString("points")
            PolyUtil.decode(points)
        } catch (_: Exception) {
            emptyList()
        }
    }
}
