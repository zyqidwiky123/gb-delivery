package com.arodriverkotlin.ui.screens

import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults.SecondaryIndicator
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.map.MapScreen
import com.arodriverkotlin.models.DriverOrder
import com.arodriverkotlin.models.UiState
import com.arodriverkotlin.service.DirectionsService
import com.arodriverkotlin.service.ForegroundService
import com.arodriverkotlin.service.LocationData
import com.arodriverkotlin.service.rupiah
import com.google.android.gms.maps.model.LatLng
import com.arodriverkotlin.R
import com.arodriverkotlin.ui.components.OrderCard
import com.arodriverkotlin.ui.components.currentPickupAddress
import com.arodriverkotlin.ui.components.SummaryCard
import com.arodriverkotlin.ui.theme.AroBlack
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Error
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.ui.theme.Outline
import com.arodriverkotlin.ui.theme.Surface
import com.arodriverkotlin.ui.theme.SurfaceHigh
import com.arodriverkotlin.ui.theme.SurfaceLow
import com.arodriverkotlin.ui.theme.Warning
import com.arodriverkotlin.viewmodel.DriverViewModel
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

@Composable
fun HomeScreen(vm: DriverViewModel, state: UiState) {
    val ctx = LocalContext.current
    val loc = state.currentLat?.let { lat ->
        state.currentLng?.let { lng -> LocationData(lat, lng) }
    } ?: ForegroundService.latestLat?.let { lat ->
        ForegroundService.latestLng?.let { lng -> LocationData(lat, lng) }
    }
    val activeJob = state.active.firstOrNull()

        var showCostModal by remember { mutableStateOf(false) }
        var costModalOrderId by remember { mutableStateOf("") }
        var costAmount by remember { mutableStateOf("") }

    // Notification sound on new incoming order is now handled by ForegroundService

    // Route polyline from Directions API (30m origin / 5m dest throttle)
    var routePoints by remember { mutableStateOf<List<LatLng>>(emptyList()) }
    var lastRouteOrigin by remember { mutableStateOf<LatLng?>(null) }
    var lastRouteDest by remember { mutableStateOf<LatLng?>(null) }
    LaunchedEffect(activeJob?.id, activeJob?.status, loc) {
        if (activeJob != null && loc != null) {
            val origin = LatLng(loc.lat, loc.lng)
            val dest = when (activeJob.status) {
                "picked_up" -> if (activeJob.dropLat != null && activeJob.dropLng != null)
                    LatLng(activeJob.dropLat, activeJob.dropLng) else null
                else -> {
                    val pickups = activeJob.pickups
                    if (pickups.isNotEmpty()) {
                        val target = pickups.getOrNull(activeJob.pickupsDone.toInt())
                        if (target?.lat != null && target?.lng != null) LatLng(target.lat, target.lng) else null
                    } else if (activeJob.pickupLat != null && activeJob.pickupLng != null)
                        LatLng(activeJob.pickupLat, activeJob.pickupLng) else null
                }
            }
            val shouldFetch = dest != null && (
                routePoints.isEmpty() ||
                lastRouteOrigin == null || lastRouteDest == null ||
                distanceMeters(origin.latitude, origin.longitude, lastRouteOrigin!!.latitude, lastRouteOrigin!!.longitude) > 30.0 ||
                distanceMeters(dest.latitude, dest.longitude, lastRouteDest!!.latitude, lastRouteDest!!.longitude) > 5.0
            )
            if (shouldFetch) {
                routePoints = emptyList()
                val ai = ctx.packageManager.getApplicationInfo(ctx.packageName, PackageManager.GET_META_DATA)
                val apiKey = ai.metaData.getString("com.google.android.geo.API_KEY") ?: ""
                routePoints = DirectionsService.fetchRoute(origin, dest!!, apiKey)
                lastRouteOrigin = origin
                lastRouteDest = dest
            }
        } else {
            routePoints = emptyList()
        }
    }

    Column(Modifier.fillMaxSize().background(Surface)) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            MapScreen(
                driverLocation = loc,
                activeOrder = activeJob,
                onLocateMe = {},
                routePoints = routePoints,
            )
        }

        var tab by remember { mutableIntStateOf(0) }
        val tabs = listOf("BARU", "AKTIF")
        val incoming = state.incoming
        val activeList = state.active

        LaunchedEffect(activeList.isNotEmpty()) {
            if (activeList.isNotEmpty()) tab = 1
        }

        Column(
            Modifier
                .fillMaxWidth()
                .background(SurfaceLow.copy(alpha = 0.95f), RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
                .padding(bottom = 8.dp)
        ) {
            LazyColumn(
                Modifier.fillMaxWidth().heightIn(max = 420.dp),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                item {
                    SummaryCard(state)
                }
                item {
                    TabRow(
                        selectedTabIndex = tab,
                        containerColor = Color.Transparent,
                        contentColor = Color.Transparent,
                        indicator = { it1 ->
                            SecondaryIndicator(
                                Modifier.tabIndicatorOffset(it1[tab]).fillMaxWidth(),
                                color = AroGreen
                            )
                        },
                        divider = {}
                    ) {
                        tabs.forEachIndexed { i, t ->
                            Tab(
                                selected = tab == i,
                                onClick = { tab = i },
                                text = {
                                    Text(
                                        t,
                                        color = if (tab == i) AroGreen else Muted,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        letterSpacing = 0.5.sp,
                                    )
                                }
                            )
                        }
                    }
                }
                if (tab == 0) {
                    if (incoming.isEmpty()) {
                        item {
                            Box(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 16.dp), contentAlignment = Alignment.Center) {
                                Text("Tidak ada order baru", color = Muted, fontSize = 14.sp, textAlign = TextAlign.Center)
                            }
                        }
                    } else {
                        items(incoming, key = { it.id }) { order ->
                            IncomingOrderCard(
                                order = order,
                                onAccept = { vm.acceptOrder(order.id) },
                                onReject = { vm.rejectOrder(order.id) },
                            )
                        }
                    }
                } else {
                    if (activeList.isEmpty()) {
                        item {
                            Box(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 16.dp), contentAlignment = Alignment.Center) {
                                Text("Belum ada order aktif", color = Muted, fontSize = 14.sp, textAlign = TextAlign.Center)
                            }
                        }
                    } else {
                        items(activeList, key = { it.id }) { order ->
                            ActiveOrderCard(
                                order = order,
                                vm = vm,
                                onPickupClick = {
                                    if (order.serviceType.lowercase() in listOf("food", "shop")) {
                                        costModalOrderId = order.id
                                        costAmount = ""
                                        showCostModal = true
                                    } else {
                                        val total = order.pickupCount
                                        val done = order.pickupsDone
                                        val msg = if (total > 1) "Konfirmasi jemput titik ke-${done + 1} dari $total?" else "Konfirmasi jemput?"
                                        // Simple pickup without cost
                                        vm.pickupOrder(order.id)
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    // Cost Input Modal
    if (showCostModal) {
        Box(
            Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.7f)).clickable { showCostModal = false },
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier.padding(24.dp).fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceHigh)
            ) {
                Column(Modifier.padding(24.dp)) {
                    Text(
                        "Total Belanja Asli",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Masukkan total harga belanjaan sesuai struk asli (tanpa ongkir).",
                        color = Muted,
                        fontSize = 13.sp,
                    )
                    Spacer(Modifier.height(16.dp))
                    OutlinedTextField(
                        value = costAmount,
                        onValueChange = { costAmount = it.filter { c -> c.isDigit() } },
                        label = { Text("Rp") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AroGreen,
                            unfocusedBorderColor = Outline,
                            focusedLabelColor = AroGreen,
                            unfocusedLabelColor = Muted,
                            cursorColor = AroGreen,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedContainerColor = SurfaceLow,
                            unfocusedContainerColor = SurfaceLow,
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                        Button(
                            onClick = { showCostModal = false },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF333333), contentColor = Color.White),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Batal", fontWeight = FontWeight.Bold)
                        }
                        Button(
                            onClick = {
                                val amount = costAmount.toLongOrNull() ?: 0
                                if (amount < 0) return@Button
                                vm.pickupWithCost(costModalOrderId, amount)
                                showCostModal = false
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = AroGreen, contentColor = AroBlack),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Simpan", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun IncomingOrderCard(
    order: DriverOrder,
    onAccept: () -> Unit,
    onReject: () -> Unit,
) {
    var countdown by remember { mutableStateOf(60) }
    var autoRejected by remember { mutableStateOf(false) }

    LaunchedEffect(order.id) {
        val expiresAt = order.expiresAt?.toDate()?.time ?: return@LaunchedEffect
        while (countdown > 0) {
            kotlinx.coroutines.delay(1000)
            val secondsLeft = ((expiresAt - System.currentTimeMillis()) / 1000).toInt()
            countdown = maxOf(0, secondsLeft)
        }
        if (!autoRejected) {
            autoRejected = true
            onReject()
        }
    }

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceHigh)
    ) {
        Column(Modifier.padding(16.dp)) {
            // Countdown bar
            if (order.expiresAt != null) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Sisa Waktu",
                        color = Muted,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                    )
                    Text(
                        "${countdown}s",
                        color = if (countdown <= 10) Error else AroGreen,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                    )
                }
                Spacer(Modifier.height(4.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .background(Color.White.copy(alpha = 0.1f), RoundedCornerShape(3.dp))
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .background(
                                if (countdown <= 10) Error else AroGreen,
                                RoundedCornerShape(3.dp)
                            )
                    )
                }
                Spacer(Modifier.height(12.dp))
            }

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "#ARO-${order.id.takeLast(5).uppercase()}",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                )
                Text(
                    order.total.rupiah(),
                    color = AroGreen,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
            }
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    order.customer.name.ifEmpty { order.customerName },
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "ARO ${order.serviceType.uppercase()}",
                    color = AroGreen,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier
                        .background(AroGreen.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }
            Spacer(Modifier.height(6.dp))
            Text(currentPickupAddress(order), color = Muted, fontSize = 11.sp, maxLines = 1)
            Text(order.destinationAddress, color = Muted, fontSize = 11.sp, maxLines = 1)

            // Incoming payment detail
            Spacer(Modifier.height(8.dp))
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                    .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                val actualShop = order.actualShoppingCost.takeIf { it > 0 } ?: order.subtotal.takeIf { it > 0 } ?: order.shoppingCost
                Text("Belanja: ${actualShop.rupiah()}", color = Color.White.copy(alpha = 0.6f), fontSize = 10.sp)
                Text("Ongkir: ${(order.deliveryFee - order.appServiceFee).rupiah()}", color = Color.White.copy(alpha = 0.6f), fontSize = 10.sp)
                if (order.appServiceFee > 0) {
                    Text("Biaya Layanan: ${order.appServiceFee.rupiah()}", color = Color.White.copy(alpha = 0.6f), fontSize = 10.sp)
                }
            }

            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Button(
                    onClick = onReject,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF333333), contentColor = Color.White.copy(alpha = 0.6f)),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Tolak", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
                Button(
                    onClick = onAccept,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = AroGreen, contentColor = AroBlack),
                    modifier = Modifier.weight(2f)
                ) {
                    Text("Terima Pesanan", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun ActiveOrderCard(order: DriverOrder, vm: DriverViewModel, onPickupClick: () -> Unit) {
    OrderCard(
        order = order,
        primary = when (order.status) {
            "accepted" -> {
                val multiPickupText = if (order.pickupCount > 1)
                    "KONFIRMASI JEMPUT (${order.pickupsDone + 1}/${order.pickupCount})"
                else "AMBIL"
                multiPickupText to onPickupClick
            }
            "picked_up" -> "SELESAI" to { vm.completeOrder(order.id) }
            else -> null
        },
        secondary = when (order.status) {
            "accepted" -> "BATAL" to { vm.cancelOrder(order.id, "Batal oleh driver") }
            else -> null
        }
    )
}

private fun distanceMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val R = 6371000.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
            sin(dLng / 2) * sin(dLng / 2)
    val c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c
}
