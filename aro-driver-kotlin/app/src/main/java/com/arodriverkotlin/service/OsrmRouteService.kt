package com.arodriverkotlin.service

import android.util.Log
import com.arodriverkotlin.map.RoutePoint
import com.arodriverkotlin.util.PolylineDecoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL

/**
 * FASE 3 — routing visual via OSRM public demo (gratis, tanpa API key).
 * Pengganti DirectionsService (Google Directions API, butuh billing GCP).
 *
 * Catatan fair-use: OSRM public adalah demo — throttle pemanggilan tetap
 * dijaga di HomeScreen (30m origin / 5m dest). Gagal -> emptyList() dan
 * MapScreen menggambar garis lurus sebagai fallback (peta tidak blank).
 * Ongkir TIDAK terpengaruh (tetap haversine lokal).
 */
object OsrmRouteService {

    suspend fun fetchRoute(
        origin: RoutePoint,
        destination: RoutePoint,
        baseUrl: String,
    ): List<RoutePoint> = withContext(Dispatchers.IO) {
        try {
            val base = baseUrl.trim().trimEnd('/').ifEmpty {
                "https://router.project-osrm.org/route/v1/driving"
            }
            val url = "$base/${origin.lng},${origin.lat};${destination.lng},${destination.lat}" +
                "?overview=full&geometries=polyline"
            val obj = JSONObject(URL(url).readText())
            if (obj.optString("code") != "Ok") return@withContext emptyList()

            val routes = obj.optJSONArray("routes") ?: return@withContext emptyList()
            if (routes.length() == 0) return@withContext emptyList()

            val encoded = routes.getJSONObject(0).optString("geometry", "")
            if (encoded.isEmpty()) return@withContext emptyList()

            PolylineDecoder.decode(encoded)
        } catch (e: Exception) {
            Log.w("OsrmRouteService", "Gagal fetch/decode rute OSRM", e)
            emptyList()
        }
    }
}
