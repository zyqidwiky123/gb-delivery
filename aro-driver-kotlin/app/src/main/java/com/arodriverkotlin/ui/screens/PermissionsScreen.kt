package com.arodriverkotlin.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BatteryFull
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.arodriverkotlin.R
import com.arodriverkotlin.background.BatteryOptimizationHelper
import com.arodriverkotlin.ui.theme.AroBlack
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.ui.theme.Warning

@Composable
fun PermissionsScreen(onAllGranted: () -> Unit) {
    val ctx = LocalContext.current

    val locationGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val bgLocationGranted = if (android.os.Build.VERSION.SDK_INT >= 30)
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
    else true
    val notifGranted = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU)
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    else true

    val fullScreenIntentGranted = if (android.os.Build.VERSION.SDK_INT >= 34)
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.USE_FULL_SCREEN_INTENT) == PackageManager.PERMISSION_GRANTED
    else true

    val batteryHelper = remember { BatteryOptimizationHelper(ctx) }
    var batteryExempt by remember { mutableStateOf(batteryHelper.isIgnoringBatteryOptimizations()) }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                batteryExempt = batteryHelper.isIgnoringBatteryOptimizations()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val foregroundStepDone = locationGranted && notifGranted

    val allPermissionsGranted = locationGranted && notifGranted && fullScreenIntentGranted

    var requested by remember { mutableStateOf(allPermissionsGranted) }

    // Step 2: Background location (API 30+ only, must be requested separately)
    var bgLocationDeniedOnce by remember { mutableStateOf(false) }
    var bgLocationSkipped by remember { mutableStateOf(false) }
    val bgLocationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted) bgLocationDeniedOnce = true
        requested = true
    }

    // Step 1: Foreground permissions (location + notif)
    val foregroundLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        val locOk = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val notifOk = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU)
            granted[Manifest.permission.POST_NOTIFICATIONS] == true
        else true
        if (locOk && notifOk) {
            requested = true
        }
    }

    val bgLocationDone = bgLocationGranted || bgLocationSkipped || android.os.Build.VERSION.SDK_INT < 30

    if (allPermissionsGranted && bgLocationDone) {
        onAllGranted()
        return
    }

    Box(
        Modifier.fillMaxSize().background(AroBlack),
        contentAlignment = Alignment.Center
    ) {
        Column(
            Modifier.fillMaxWidth().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Image(
                painter = painterResource(R.drawable.aro_logo),
                contentDescription = "ARO DRIVE",
                modifier = Modifier.size(100.dp),
                contentScale = ContentScale.Fit,
            )

            Spacer(Modifier.height(32.dp))

            Text(
                "Izinkan Akses",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 24.sp,
            )

            Spacer(Modifier.height(8.dp))

            Text(
                "ARO DRIVE membutuhkan izin berikut:",
                color = Muted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(24.dp))

            PermissionItem(
                icon = Icons.Default.LocationOn,
                title = "Lokasi",
                desc = "Melacak posisi untuk navigasi dan pemesanan",
                granted = locationGranted,
            )

            if (android.os.Build.VERSION.SDK_INT >= 30) {
                Spacer(Modifier.height(12.dp))
                PermissionItem(
                    icon = Icons.Default.LocationOn,
                    title = "Lokasi (selalu aktif)",
                    desc = "Mengirim lokasi saat aplikasi di latar belakang",
                    granted = bgLocationGranted,
                )
            }

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                Spacer(Modifier.height(12.dp))
                PermissionItem(
                    icon = Icons.Default.Notifications,
                    title = "Notifikasi",
                    desc = "Menerima pemberitahuan pesanan baru",
                    granted = notifGranted,
                )
            }

            if (android.os.Build.VERSION.SDK_INT >= 34) {
                Spacer(Modifier.height(12.dp))
                PermissionItem(
                    icon = Icons.Default.Fullscreen,
                    title = "Layar Penuh",
                    desc = "Notifikasi pesanan muncul dalam layar penuh",
                    granted = fullScreenIntentGranted,
                )
            }

            Spacer(Modifier.height(12.dp))
            PermissionItem(
                icon = Icons.Default.BatteryFull,
                title = "Tanpa Batasan Baterai",
                desc = "Aplikasi tetap berjalan tanpa dioptimasi baterai",
                granted = batteryExempt,
            )

            // MIUI-specific guidance
            if (isXiaomiMiui()) {
                Spacer(Modifier.height(16.dp))
                Text(
                    "Penting untuk perangkat Xiaomi:",
                    color = Warning,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "1. Buka Settings → Apps → ARO DRIVE → Autostart → NYALAKAN\n" +
                    "2. Di Recent Apps, lock ARO DRIVE (tahan ikon → kunci)",
                    color = Muted,
                    fontSize = 10.sp,
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.parse("package:${ctx.packageName}")
                        }
                        ctx.startActivity(intent)
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF333333),
                        contentColor = Color.White
                    ),
                    modifier = Modifier.fillMaxWidth().height(44.dp)
                ) {
                    Text("BUKA PENGATURAN APLIKASI", fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 0.5.sp)
                }
            }

            Spacer(Modifier.height(24.dp))

            if (!foregroundStepDone) {
                Button(
                    onClick = {
                        val perms = mutableListOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION,
                        )
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                            perms.add(Manifest.permission.POST_NOTIFICATIONS)
                        }
                        foregroundLauncher.launch(perms.toTypedArray())
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AroGreen,
                        contentColor = AroBlack
                    ),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text(
                        "IZINKAN",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        letterSpacing = 1.sp,
                    )
                }
            }

            if (foregroundStepDone && !fullScreenIntentGranted && android.os.Build.VERSION.SDK_INT >= 34) {
                Button(
                    onClick = {
                        val intent = Intent(
                            Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                            Uri.parse("package:${ctx.packageName}")
                        )
                        ctx.startActivity(intent)
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AroGreen,
                        contentColor = AroBlack
                    ),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text(
                        "BUKA PENGATURAN LAYAR PENUH",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        letterSpacing = 1.sp,
                    )
                }
            }

            // Background location (API 30+)
            if (foregroundStepDone && android.os.Build.VERSION.SDK_INT >= 30 && !bgLocationGranted) {
                Spacer(Modifier.height(16.dp))
                Text(
                    "Lokasi Latar Belakang",
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "ARO DRIVE perlu lokasi latar belakang untuk mengirim posisi kamu saat aplikasi tidak aktif.",
                    color = Muted,
                    fontSize = 11.sp,
                )
                Spacer(Modifier.height(8.dp))
                if (bgLocationDeniedOnce) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { bgLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION) },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF333333),
                                contentColor = Color.White
                            ),
                            modifier = Modifier.weight(1f).height(44.dp)
                        ) {
                            Text("COBA LAGI", fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        }
                        Button(
                            onClick = {
                                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                    data = Uri.parse("package:${ctx.packageName}")
                                }
                                ctx.startActivity(intent)
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF333333),
                                contentColor = Color.White.copy(alpha = 0.7f)
                            ),
                            modifier = Modifier.weight(1f).height(44.dp)
                        ) {
                            Text("PENGATURAN", fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        }
                    }
                } else {
                    Button(
                        onClick = {
                            bgLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AroGreen,
                            contentColor = AroBlack
                        ),
                        modifier = Modifier.fillMaxWidth().height(52.dp)
                    ) {
                        Text(
                            "IZINKAN LOKASI BACKGROUND",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            letterSpacing = 1.sp,
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = { bgLocationSkipped = true },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF333333),
                        contentColor = Color.White.copy(alpha = 0.6f)
                    ),
                    modifier = Modifier.fillMaxWidth().height(44.dp)
                ) {
                    Text(
                        "LEWATI",
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        letterSpacing = 1.sp,
                    )
                }
            }

            if (allPermissionsGranted && !batteryExempt) {
                Button(
                    onClick = {
                        val intent = Intent(
                            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                            android.net.Uri.parse("package:${ctx.packageName}")
                        )
                        ctx.startActivity(intent)
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AroGreen,
                        contentColor = AroBlack
                    ),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text(
                        "BUKA PENGATURAN BATERAI",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        letterSpacing = 1.sp,
                    )
                }

                Spacer(Modifier.height(8.dp))

                Button(
                    onClick = { onAllGranted() },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF333333),
                        contentColor = Color.White.copy(alpha = 0.6f)
                    ),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text(
                        "LEWATI",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        letterSpacing = 1.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun PermissionItem(
    icon: ImageVector,
    title: String,
    desc: String,
    granted: Boolean,
) {
    Row(
        Modifier.fillMaxWidth().background(
            if (granted) AroGreen.copy(alpha = 0.1f) else Color(0xFF1A1A2E),
            RoundedCornerShape(12.dp)
        ).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = if (granted) AroGreen else Muted, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(12.dp))
        Column {
            Text(title, color = if (granted) AroGreen else Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text(desc, color = Muted, fontSize = 11.sp)
        }
    }
}

private fun isXiaomiMiui(): Boolean {
    return try {
        val manufacturer = Build.MANUFACTURER.lowercase()
        val brand = Build.BRAND.lowercase()
        manufacturer.contains("xiaomi") || brand.contains("xiaomi") ||
            System.getProperty("ro.miui.ui.version.name") != null
    } catch (_: Exception) {
        false
    }
}
