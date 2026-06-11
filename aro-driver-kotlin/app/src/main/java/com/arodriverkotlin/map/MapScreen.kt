package com.arodriverkotlin.map

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.models.DriverOrder
import com.arodriverkotlin.service.LocationData
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.GlassBg
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.Polyline
import com.google.maps.android.compose.rememberCameraPositionState
import kotlinx.coroutines.launch
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.tasks.await

@Composable
fun MapScreen(
    driverLocation: LocationData?,
    activeOrder: DriverOrder?,
    onLocateMe: () -> Unit = {},
    routePoints: List<LatLng> = emptyList(),
) {
    val ctx = LocalContext.current
    val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main)

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    var autoFollow by remember { mutableStateOf(true) }

    val cameraState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(
            LatLng(driverLocation?.lat ?: -8.0983, driverLocation?.lng ?: 112.1681),
            15f
        )
    }

    // Auto-follow when driver location updates
    LaunchedEffect(driverLocation) {
        if (driverLocation != null && autoFollow) {
            cameraState.animate(CameraUpdateFactory.newLatLngZoom(
                LatLng(driverLocation.lat, driverLocation.lng), 16f
            ))
        }
    }

    // Request single location update if location is null
    suspend fun requestSingleLocation() {
        try {
            val fused = LocationServices.getFusedLocationProviderClient(ctx)
            val loc = fused.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).await()
            if (loc != null) {
                onLocateMe()
                cameraState.animate(CameraUpdateFactory.newLatLngZoom(
                    LatLng(loc.latitude, loc.longitude), 16f
                ))
            }
        } catch (_: Exception) {}
    }

    Box(Modifier.fillMaxSize()) {
        GoogleMap(
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = cameraState,
            properties = MapProperties(
                isMyLocationEnabled = true,
            ),
            uiSettings = MapUiSettings(
                compassEnabled = false,
                mapToolbarEnabled = false,
                zoomControlsEnabled = false,
                myLocationButtonEnabled = false,
            ),
        ) {
            if (activeOrder != null) {
                activeOrder.pickupLat?.let { lat ->
                    activeOrder.pickupLng?.let { lng ->
                        Marker(
                            state = MarkerState(position = LatLng(lat, lng)),
                            icon = BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_ORANGE),
                            title = "Ambil: ${activeOrder.pickupAddress}",
                            zIndex = 5f,
                        )
                    }
                }
                activeOrder.dropLat?.let { lat ->
                    activeOrder.dropLng?.let { lng ->
                        Marker(
                            state = MarkerState(position = LatLng(lat, lng)),
                            icon = BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_RED),
                            title = "Antar: ${activeOrder.destinationAddress}",
                            zIndex = 5f,
                        )
                    }
                }
            }
            if (routePoints.size > 1) {
                Polyline(points = routePoints, color = AroGreen, width = 6f)
            }
        }

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
                            cameraState.animate(CameraUpdateFactory.newLatLngZoom(
                                LatLng(driverLocation.lat, driverLocation.lng), 16f
                            ))
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
                val dest = when {
                    activeOrder.status == "picked_up" && activeOrder.dropLat != null ->
                        "${activeOrder.dropLat},${activeOrder.dropLng}"
                    activeOrder.pickupLat != null -> "${activeOrder.pickupLat},${activeOrder.pickupLng}"
                    else -> null
                }
                if (dest != null) {
                    val uri = "https://www.google.com/maps/dir/?api=1&origin=${driverLocation.lat},${driverLocation.lng}&destination=$dest&travelmode=driving"
                    Row(
                        Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .background(GlassBg)
                            .clickable {
                                ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri)))
                            }
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
