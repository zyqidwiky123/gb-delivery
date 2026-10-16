package com.arodriverkotlin.map

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.arodriverkotlin.models.DriverOrder
import com.arodriverkotlin.location.LocationData
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.GlassBg
import kotlinx.coroutines.launch
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.tasks.await
import com.arodriverkotlin.util.LocationUtils
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.CopyrightOverlay
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline
import org.osmdroid.views.overlay.mylocation.GpsMyLocationProvider
import org.osmdroid.views.overlay.mylocation.MyLocationNewOverlay

// FASE 3 — MapScreen versi OSM (osmdroid). Props & tampilan IDENTIK dengan versi
// Google Maps (rollback-safe). Lokasi tetap FusedLocation (gratis, on-device).

private const val DEFAULT_LAT = -8.0983
private const val DEFAULT_LNG = 112.1681
private val JATIM_BOUNDS = BoundingBox(-6.7, 114.6, -8.8, 111.0)

/** Target navigasi aktif: pickup berikut / titik antar (dipakai rute fallback + intent). */
private fun resolveNavTarget(order: DriverOrder): Pair<Double, Double>? {
    if (order.pickups.isNotEmpty()) {
        val idx = order.pickupsDone.toInt()
        val target = order.pickups.getOrNull(idx)
        if (target?.lat != null && target.lng != null) return target.lat to target.lng
    }
    if (order.status == "picked_up" && order.dropLat != null && order.dropLng != null) {
        return order.dropLat to order.dropLng
    }
    if (order.pickupLat != null && order.pickupLng != null) {
        return order.pickupLat to order.pickupLng
    }
    if (order.dropLat != null && order.dropLng != null) {
        return order.dropLat to order.dropLng
    }
    return null
}

@Composable
fun MapScreen(
    driverLocation: LocationData?,
    activeOrder: DriverOrder?,
    onLocateMe: () -> Unit = {},
    routePoints: List<RoutePoint> = emptyList(),
) {
    val ctx = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main)

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    var autoFollow by remember { mutableStateOf(true) }
    var lastCameraLatLng by remember { mutableStateOf<RoutePoint?>(null) }

    val mapView = remember {
        OsmTileSource.init(ctx)
        MapView(ctx).apply {
            setTileSource(OsmTileSource.DARK)
            setMultiTouchControls(true)
            minZoomLevel = 12.0
            maxZoomLevel = 20.0
            setScrollableAreaLimitDouble(JATIM_BOUNDS)
            controller.setZoom(15.0)
            val start = if (driverLocation != null) {
                GeoPoint(driverLocation.latitude, driverLocation.longitude)
            } else {
                GeoPoint(DEFAULT_LAT, DEFAULT_LNG)
            }
            controller.setCenter(start)
            overlays.add(CopyrightOverlay(ctx))
        }
    }

    val myLocationOverlay = remember {
        MyLocationNewOverlay(GpsMyLocationProvider(ctx), mapView).apply {
            enableMyLocation()
        }.also { mapView.overlays.add(it) }
    }

    // Forward lifecycle ke osmdroid (wajib — cegah leak & baterai bocor)
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> {
                    mapView.onResume()
                    try { myLocationOverlay.enableMyLocation() } catch (e: Exception) {
                        Log.w("MapScreen", "Gagal enable my-location", e)
                    }
                }
                Lifecycle.Event.ON_PAUSE -> {
                    try { myLocationOverlay.disableMyLocation() } catch (e: Exception) {
                        Log.w("MapScreen", "Gagal disable my-location", e)
                    }
                    mapView.onPause()
                }
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            mapView.onDetach()
        }
    }

    // Auto-follow saat lokasi driver update (threshold 15m agar tidak jitter)
    LaunchedEffect(driverLocation) {
        if (driverLocation != null && autoFollow) {
            val shouldAnimate = lastCameraLatLng == null || LocationUtils.calculateDistance(
                lastCameraLatLng!!.lat, lastCameraLatLng!!.lng,
                driverLocation.latitude, driverLocation.longitude
            ) > 15.0
            if (shouldAnimate) {
                mapView.controller.animateTo(
                    GeoPoint(driverLocation.latitude, driverLocation.longitude)
                )
                mapView.controller.setZoom(16.0)
                lastCameraLatLng = RoutePoint(driverLocation.latitude, driverLocation.longitude)
            }
        }
    }

    // Fit bounds saat rute pertama muncul (reset tiap ganti order)
    var fittedOrderId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(routePoints, activeOrder?.id) {
        val order = activeOrder
        if (order != null && driverLocation != null && fittedOrderId != order.id) {
            val points = ArrayList<GeoPoint>()
            points.add(GeoPoint(driverLocation.latitude, driverLocation.longitude))
            routePoints.forEach { points.add(GeoPoint(it.lat, it.lng)) }
            order.pickups.forEach { p ->
                if (p.lat != null && p.lng != null) points.add(GeoPoint(p.lat, p.lng))
            }
            if (order.pickupLat != null && order.pickupLng != null) {
                points.add(GeoPoint(order.pickupLat, order.pickupLng))
            }
            if (order.dropLat != null && order.dropLng != null) {
                points.add(GeoPoint(order.dropLat, order.dropLng))
            }
            try {
                if (points.size > 1) {
                    mapView.zoomToBoundingBox(BoundingBox.fromGeoPoints(points), false, 120)
                    fittedOrderId = order.id
                }
            } catch (e: Exception) {
                Log.w("MapScreen", "Gagal zoom ke bounds", e)
            }
        }
        if (order == null) fittedOrderId = null
    }

    // Request single location update if location is null
    suspend fun requestSingleLocation() {
        try {
            val fused = LocationServices.getFusedLocationProviderClient(ctx)
            val loc = fused.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).await()
            if (loc != null) {
                onLocateMe()
                mapView.controller.animateTo(GeoPoint(loc.latitude, loc.longitude))
                mapView.controller.setZoom(16.0)
            }
        } catch (e: Exception) {
            Log.w("MapScreen", "Gagal request single location", e)
        }
    }

    Box(Modifier.fillMaxSize()) {
        AndroidView(
            factory = { mapView },
            modifier = Modifier.fillMaxSize(),
            update = { view ->
                refreshOverlays(
                    view = view,
                    activeOrder = activeOrder,
                    driverLocation = driverLocation,
                    routePoints = routePoints,
                )
            }
        )

        Column(
            Modifier.align(Alignment.BottomEnd).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalAlignment = Alignment.End,
        ) {
            FloatingActionButton(
                onClick = {
                    val hasPermission = ctx.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                    if (!hasPermission) {
                        permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                        return@FloatingActionButton
                    }
                    autoFollow = true
                    if (driverLocation != null) {
                        scope.launch {
                            mapView.controller.animateTo(
                                GeoPoint(driverLocation.latitude, driverLocation.longitude)
                            )
                            mapView.controller.setZoom(16.0)
                        }
                    } else {
                        scope.launch { requestSingleLocation() }
                    }
                },
                shape = CircleShape,
                containerColor = GlassBg,
                contentColor = AroGreen,
                elevation = FloatingActionButtonDefaults.elevation(0.dp),
            ) {
                Icon(Icons.Default.MyLocation, null, modifier = Modifier.size(22.dp))
            }

            if (activeOrder != null && driverLocation != null) {
                val dest = resolveNavTarget(activeOrder)
                if (dest != null) {
                    Row(
                        Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .background(GlassBg)
                            .clickable { openNavigation(ctx, driverLocation, dest) }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Navigation, null, tint = AroGreen, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("NAVIGASI", color = AroGreen, fontWeight = FontWeight.Bold, fontSize = 12.sp, letterSpacing = 1.sp)
                    }
                }
            }
        }
    }
}

/**
 * FASE 3 — intent netral `geo:` (buka app peta apapun, gratis).
 * Fallback ke Google Maps web jika tidak ada app yang menangani geo:.
 */
private fun openNavigation(
    ctx: android.content.Context,
    driverLocation: LocationData,
    dest: Pair<Double, Double>,
) {
    val (destLat, destLng) = dest
    val geoUri = Uri.parse("geo:${driverLocation.latitude},${driverLocation.longitude}?q=$destLat,$destLng")
    try {
        ctx.startActivity(Intent(Intent.ACTION_VIEW, geoUri))
    } catch (e: Exception) {
        Log.w("MapScreen", "geo: intent gagal, fallback ke web maps", e)
        val webUri = Uri.parse(
            "https://www.google.com/maps/dir/?api=1" +
                "&origin=${driverLocation.latitude},${driverLocation.longitude}" +
                "&destination=$destLat,$destLng&travelmode=driving"
        )
        try {
            ctx.startActivity(Intent(Intent.ACTION_VIEW, webUri))
        } catch (e2: Exception) {
            Log.w("MapScreen", "Fallback navigasi gagal", e2)
        }
    }
}

/**
 * Bangun ulang marker + polyline setiap recomposition.
 * CopyrightOverlay & MyLocationNewOverlay dipertahankan (tidak ikut di-clear).
 */
private fun refreshOverlays(
    view: MapView,
    activeOrder: DriverOrder?,
    driverLocation: LocationData?,
    routePoints: List<RoutePoint>,
) {
    val keep = view.overlays.filter { it is CopyrightOverlay || it is MyLocationNewOverlay }
    view.overlays.clear()
    view.overlays.addAll(keep)

    val order = activeOrder
    if (order != null) {
        val pickups = order.pickups
        val pickupsDone = order.pickupsDone.toInt()
        val isPickedUp = order.status == "picked_up"

        val validPickups = pickups.filter { it.lat != null && it.lng != null }
        if (validPickups.isNotEmpty()) {
            validPickups.forEachIndexed { index, pickup ->
                val isDone = index < pickupsDone
                val isActive = index == pickupsDone
                view.overlays.add(
                    Marker(view).apply {
                        position = GeoPoint(pickup.lat!!, pickup.lng!!)
                        icon = createPickupMarkerIcon(view.context, index + 1, isActive, isDone)
                        title = if (isActive) "Ambil: ${pickup.address}" else "Titik ${index + 1}: ${pickup.address}"
                        snippet = if (isDone) "Sudah dijemput" else if (isActive) "Tujuan anda" else "Menunggu"
                    }
                )
            }
        } else if (order.pickupLat != null && order.pickupLng != null && !isPickedUp) {
            view.overlays.add(
                Marker(view).apply {
                    position = GeoPoint(order.pickupLat, order.pickupLng)
                    icon = createDotMarkerIcon(view.context, android.graphics.Color.rgb(255, 152, 0))
                    title = "Ambil: ${order.pickupAddress}"
                }
            )
        }

        if (isPickedUp && order.dropLat != null && order.dropLng != null) {
            view.overlays.add(
                Marker(view).apply {
                    position = GeoPoint(order.dropLat, order.dropLng)
                    icon = createDotMarkerIcon(view.context, android.graphics.Color.rgb(244, 67, 54))
                    title = "Antar: ${order.destinationAddress}"
                }
            )
        }
    }

    val line: List<GeoPoint> = when {
        routePoints.size > 1 -> routePoints.map { GeoPoint(it.lat, it.lng) }
        // Fallback garis lurus driver -> target (pola sama seperti web Fase 2)
        driverLocation != null && activeOrder != null -> {
            resolveNavTarget(activeOrder)?.let { (tLat, tLng) ->
                listOf(
                    GeoPoint(driverLocation.latitude, driverLocation.longitude),
                    GeoPoint(tLat, tLng)
                )
            } ?: emptyList()
        }
        else -> emptyList()
    }
    if (line.size > 1) {
        view.overlays.add(
            Polyline().apply {
                setPoints(line)
                outlinePaint.color = android.graphics.Color.rgb(76, 175, 80)
                outlinePaint.strokeWidth = 6f
            }
        )
    }
    view.invalidate()
}

private fun createPickupMarkerIcon(number: Int, isActive: Boolean, isDone: Boolean, context: android.content.Context): Drawable {
    val size = 96
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    val bgColor = when {
        isDone -> android.graphics.Color.rgb(120, 120, 120)
        isActive -> android.graphics.Color.rgb(76, 175, 80)
        else -> android.graphics.Color.rgb(255, 152, 0)
    }

    val circlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = bgColor
        style = Paint.Style.FILL
    }
    canvas.drawCircle(size / 2f, size / 2f, size / 2f - 2f, circlePaint)

    val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }
    canvas.drawCircle(size / 2f, size / 2f, size / 2f - 4f, borderPaint)

    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        textSize = 42f
        textAlign = Paint.Align.CENTER
        isFakeBoldText = true
    }
    val y = size / 2f - (textPaint.descent() + textPaint.ascent()) / 2f
    canvas.drawText(number.toString(), size / 2f, y, textPaint)

    return BitmapDrawable(context.resources, bitmap)
}

private fun createDotMarkerIcon(context: android.content.Context, color: Int): Drawable {
    val size = 72
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        style = Paint.Style.FILL
    }
    canvas.drawCircle(size / 2f, size / 2f, size / 2f - 4f, paint)
    val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 4f
    }
    canvas.drawCircle(size / 2f, size / 2f, size / 2f - 6f, border)
    return BitmapDrawable(context.resources, bitmap)
}
