package com.arodriverkotlin.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.models.ServiceType
import com.arodriverkotlin.models.UiState
import com.arodriverkotlin.service.rupiah
import com.arodriverkotlin.ui.components.OrderCardProvider
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.ui.theme.Surface
import com.arodriverkotlin.ui.theme.SurfaceHigh

@Composable
fun OrdersScreen(state: UiState) {
    val completed = state.allOrders.filter {
        listOf("completed", "cancelled").contains(it.status)
    }
    val balance = state.profile?.balance ?: 0

    var selectedType by remember { mutableStateOf<String?>(null) }
    val types = remember {
        listOf(null as String?) + completed.map { it.serviceType }.distinct().sorted()
    }

    val filtered = if (selectedType == null) completed
        else completed.filter { it.serviceType == selectedType }

    Column(Modifier.fillMaxSize().background(Surface)) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Surface)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Riwayat Orders",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
            )
            Row(
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(SurfaceHigh)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("SALDO:", color = Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.size(4.dp))
                Text(balance.rupiah(), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }

        if (types.size > 1) {
            TabRow(
                selectedTabIndex = types.indexOf(selectedType).coerceAtLeast(0),
                containerColor = Surface,
                contentColor = AroGreen,
            ) {
                types.forEach { type ->
                    val label = if (type == null) "Semua"
                        else ServiceType.fromString(type).displayName
                    Tab(
                        selected = selectedType == type,
                        onClick = { selectedType = type },
                        text = {
                            Text(
                                label,
                                fontWeight = if (selectedType == type) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 12.sp,
                            )
                        }
                    )
                }
            }
        }

        if (filtered.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.CheckCircle, null, tint = Muted, modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Belum ada riwayat pesanan",
                        color = Muted,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filtered, key = { it.id }) { order ->
                    OrderCardProvider(order = order, onAccept = {}, onReject = {})
                }
            }
        }
    }
}
