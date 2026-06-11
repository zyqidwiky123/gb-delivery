package com.arodriverkotlin.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
    val notifGranted = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU)
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    else true

    val allGranted = locationGranted && notifGranted

    var requested by remember { mutableStateOf(allGranted) }

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        val locOk = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val notifOk = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU)
            granted[Manifest.permission.POST_NOTIFICATIONS] == true
        else true
        if (locOk && notifOk) {
            onAllGranted()
        }
    }

    if (requested) {
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
                "ARO DRIVE membutuhkan izin berikut untuk menjalankan aplikasi dengan baik:",
                color = Muted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(24.dp))

            PermissionItem(
                icon = Icons.Default.LocationOn,
                title = "Lokasi",
                desc = "Melacak posisi Anda untuk navigasi dan pemesanan",
                granted = locationGranted,
            )

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                Spacer(Modifier.height(16.dp))
                PermissionItem(
                    icon = Icons.Default.Notifications,
                    title = "Notifikasi",
                    desc = "Menerima pemberitahuan pesanan baru",
                    granted = notifGranted,
                )
            }

            Spacer(Modifier.height(32.dp))

            Button(
                onClick = {
                    val perms = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
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
    }
}

@Composable
private fun PermissionItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    desc: String,
    granted: Boolean,
) {
    Column(
        Modifier.fillMaxWidth().background(
            if (granted) AroGreen.copy(alpha = 0.1f) else Color(0xFF1A1A2E),
            RoundedCornerShape(12.dp)
        ).padding(16.dp)
    ) {
        Icon(icon, null, tint = if (granted) AroGreen else Muted, modifier = Modifier.size(24.dp))
        Spacer(Modifier.height(6.dp))
        Text(title, color = if (granted) AroGreen else Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        Text(desc, color = Muted, fontSize = 12.sp)
    }
}
