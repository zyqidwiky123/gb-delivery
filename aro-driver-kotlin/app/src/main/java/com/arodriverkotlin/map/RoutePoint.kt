package com.arodriverkotlin.map

/**
 * FASE 3 — titik rute netral, pengganti com.google.android.gms.maps.model.LatLng.
 * Dipakai HomeScreen (state routePoints) dan OsrmRouteService.
 */
data class RoutePoint(val lat: Double, val lng: Double)
