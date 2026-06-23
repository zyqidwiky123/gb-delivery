package com.arodriverkotlin.navigation

import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Icon
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.R
import com.arodriverkotlin.models.UiState
import com.arodriverkotlin.ui.screens.EditProfileScreen
import com.arodriverkotlin.ui.screens.HomeScreen
import com.arodriverkotlin.ui.theme.AroBlack
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.GlassBg
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.ui.theme.Surface
import com.arodriverkotlin.ui.theme.SurfaceHigh
import com.arodriverkotlin.viewmodel.DriverViewModel
import com.arodriverkotlin.ui.screens.OrdersScreen
import com.arodriverkotlin.ui.screens.WalletScreen
import com.arodriverkotlin.ui.screens.ProfileScreen

private data class TabItem(
    val label: String,
    val icon: ImageVector,
    val screen: @Composable (DriverViewModel, UiState) -> Unit,
)

@Composable
fun DriverShell(vm: DriverViewModel, state: UiState, onLogout: () -> Unit) {
    var selected by rememberSaveable { mutableIntStateOf(0) }
    var showEditProfile by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(state.message) {
        state.message?.let { msg ->
            if (msg == "Online" || msg == "Offline") {
                Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            } else {
                snackbarHostState.showSnackbar(msg)
            }
            vm.dismissMessage()
        }
    }

    val navTabs = remember(onLogout) {
        listOf(
            TabItem("Beranda", Icons.Default.Home, { vm, s -> HomeScreen(vm, s) }),
            TabItem("Pesanan", Icons.Default.History, { vm, s -> OrdersScreen(s) }),
            TabItem("Dompet", Icons.Default.AccountBalanceWallet, { vm, s -> WalletScreen(s, vm) }),
            TabItem("Profil", Icons.Default.AccountCircle, { vm, s -> ProfileScreen(vm, s, onLogout, onEditProfile = { showEditProfile = true }) }),
        )
    }

    if (showEditProfile) {
        EditProfileScreen(
            vm = vm,
            state = state,
            onBack = { showEditProfile = false },
        )
    } else {
        Box(Modifier.fillMaxSize().background(Surface)) {
            Column(Modifier.fillMaxSize()) {
                TopBar(state, vm::toggleOnline)
                Box(Modifier.weight(1f)) {
                    navTabs[selected].screen(vm, state)
                }
                BottomNav(navTabs, selected) { selected = it }
            }
            SnackbarHost(snackbarHostState, modifier = Modifier.align(Alignment.BottomCenter))
        }
    }
}

@Composable
private fun TopBar(state: UiState, onToggleOnline: () -> Unit) {
    val name = state.profile?.displayName ?: state.profile?.email?.takeWhile { it != '@' } ?: "Driver"
    Row(
        Modifier
            .fillMaxWidth()
            .background(Surface)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Image(
            painter = painterResource(R.drawable.aro_logo),
            contentDescription = "ARO DRIVE",
            modifier = Modifier.size(40.dp),
            contentScale = ContentScale.Fit,
        )
        Spacer(Modifier.width(12.dp))
        Column {
            Text(
                name,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
            )
            Text(
                if (state.profile?.isOnline == true) "Online" else "Offline",
                color = if (state.profile?.isOnline == true) AroGreen else Muted,
                fontSize = 12.sp,
            )
        }
        Spacer(Modifier.weight(1f))
        val onlineText = if (state.profile?.isOnline == true) "ONLINE" else "OFF"
        val bg = if (state.profile?.isOnline == true) AroGreen else SurfaceHigh
        val fg = if (state.profile?.isOnline == true) AroBlack else Color.White
        Box(
            Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(bg)
                .clickable { onToggleOnline() }
                .padding(horizontal = 12.dp, vertical = 6.dp)
        ) {
            Text(
                onlineText,
                color = fg,
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
                letterSpacing = 1.sp,
            )
        }
    }
}

@Composable
private fun BottomNav(tabs: List<TabItem>, selected: Int, onSelect: (Int) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(GlassBg)
            .padding(4.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        tabs.forEachIndexed { i, t ->
            val active = i == selected
            Column(
                Modifier
                    .weight(1f)
                    .clickable { onSelect(i) }
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (active) AroGreen.copy(alpha = 0.1f) else Color.Transparent)
                    .padding(vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    t.icon, null,
                    tint = if (active) AroGreen else Muted,
                    modifier = Modifier.size(22.dp)
                )
                Text(
                    t.label,
                    color = if (active) AroGreen else Muted,
                    fontSize = 10.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                    letterSpacing = 0.3.sp,
                )
            }
        }
    }
}
