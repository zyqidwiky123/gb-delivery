package com.arodriverkotlin.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.PowerManager
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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.arodriverkotlin.ui.theme.AroBlack
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Muted

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

    val powerManager = ctx.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
    val batteryExempt = powerManager.isIgnoringBatteryOptimizations(ctx.packageName)

    val allGranted = locationGranted && bgLocationGranted && notifGranted

    var requested by remember { mutableStateOf(allGranted) }

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        val locOk = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val bgOk = if (android.os.Build.VERSION.SDK_INT >= 30)
            granted[Manifest.permission.ACCESS_BACKGROUND_LOCATION] == true
        else true
        val notifOk = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU)
            granted[Manifest.permission.POST_NOTIFICATIONS] == true
        else true
        if (locOk && bgOk && notifOk) {
            val pm = ctx.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
            if (pm.isIgnoringBatteryOptimizations(ctx.packageName)) {
                onAllGranted()
            }
            // If battery not exempt, user needs to tap the button below
        }
    }

    val permissionsStepDone = locationGranted && bgLocationGranted && notifGranted

    if (requested && batteryExempt) {
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

            Spacer(Modifier.height(12.dp))
            PermissionItem(
                icon = Icons.Default.BatteryFull,
                title = "Tanpa Batasan Baterai",
                desc = "Aplikasi tetap berjalan tanpa dioptimasi baterai",
                granted = batteryExempt,
            )

            Spacer(Modifier.height(24.dp))

            if (!permissionsStepDone) {
                Button(
                    onClick = {
                        val perms = mutableListOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION,
                        )
                        if (android.os.Build.VERSION.SDK_INT >= 30) {
                            perms.add(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                        }
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                            perms.add(Manifest.permission.POST_NOTIFICATIONS)
                        }
                        launcher.launch(perms.toTypedArray())
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

            if (permissionsStepDone && !batteryExempt) {
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

                TextButton(
                    onClick = { onAllGranted() },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        "Nanti Saja",
                        color = Muted,
                        fontSize = 13.sp,
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
