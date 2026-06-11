package com.arodriverkotlin.ui.components

import android.Manifest
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import com.google.android.gms.location.LocationServices
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import kotlinx.coroutines.delay
import kotlinx.coroutines.tasks.await

@Composable
fun LocationReporter(enabled: Boolean, onLocation: (Double, Double) -> Unit) {
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {}
    LaunchedEffect(enabled) {
        if (!enabled) return@LaunchedEffect
        launcher.launch(arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ))
        val fused = LocationServices.getFusedLocationProviderClient(context)
        while (true) {
            runCatching {
                val loc = fused.lastLocation.await()
                if (loc != null) onLocation(loc.latitude, loc.longitude)
            }
            delay(60_000)
        }
    }
    DisposableEffect(Unit) { onDispose { } }
}
