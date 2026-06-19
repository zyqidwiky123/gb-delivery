package com.arodriverkotlin

import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.arodriverkotlin.navigation.DriverShell
import com.arodriverkotlin.service.ForegroundService
import com.arodriverkotlin.ui.screens.LoginScreen
import com.arodriverkotlin.ui.screens.PermissionsScreen
import com.arodriverkotlin.ui.theme.AroBlack
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.viewmodel.DriverViewModel

@Composable
fun AroDriverApp(vm: DriverViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val ctx = LocalContext.current

    val permissionsOk = remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED &&
            (android.os.Build.VERSION.SDK_INT < 30 ||
             ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED) &&
            (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU ||
             ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
        )
    }

    if (!permissionsOk.value) {
        PermissionsScreen(onAllGranted = { permissionsOk.value = true })
        return
    }

    Surface(color = AroBlack, modifier = Modifier.fillMaxSize()) {
        when {
            state.loading -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AroGreen)
                }
            }
            state.userId == null -> LoginScreen(state.message, vm::login)
            state.message == "ROLE_BLOCKED" -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "Akun Anda tidak memiliki akses driver.\nHubungi admin.",
                        color = Muted,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            else -> {
                DriverShell(vm, state, vm::logout)

                val isOnline = state.profile?.isOnline == true
                val uid = state.userId
                DisposableEffect(isOnline, uid) {
                    if (isOnline && uid != null) {
                        ForegroundService.start(ctx, uid)
                    } else {
                        ForegroundService.stop(ctx)
                    }
                    onDispose {
                        ForegroundService.stop(ctx)
                    }
                }
            }
        }
    }
}
