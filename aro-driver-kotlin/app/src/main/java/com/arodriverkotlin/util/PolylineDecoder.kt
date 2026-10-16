package com.arodriverkotlin.util

import com.arodriverkotlin.map.RoutePoint

/**
 * FASE 3 — decoder polyline format Google Encoded Polyline Algorithm.
 * Pengganti com.google.maps.android.PolyUtil (dep android-maps-utils dihapus).
 * Kompatibel dengan OSRM `geometries=polyline` maupun Directions API lama.
 */
object PolylineDecoder {
    fun decode(encoded: String): List<RoutePoint> {
        val points = ArrayList<RoutePoint>()
        var index = 0
        var lat = 0
        var lng = 0
        while (index < encoded.length) {
            var b: Int
            var shift = 0
            var result = 0
            do {
                b = encoded[index++].code - 63
                result = result or ((b and 0x1f) shl shift)
                shift += 5
            } while (b >= 0x20)
            val dlat = if ((result and 1) != 0) (result shr 1).inv() else result shr 1
            lat += dlat

            shift = 0
            result = 0
            do {
                b = encoded[index++].code - 63
                result = result or ((b and 0x1f) shl shift)
                shift += 5
            } while (b >= 0x20)
            val dlng = if ((result and 1) != 0) (result shr 1).inv() else result shr 1
            lng += dlng

            points.add(RoutePoint(lat.toDouble() / 1E5, lng.toDouble() / 1E5))
        }
        return points
    }
}
