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
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.models.UiState
import com.arodriverkotlin.service.rupiah
import com.arodriverkotlin.ui.components.OrderCard
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

    LazyColumn(
        Modifier.fillMaxSize().background(Surface),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Header with balance
        item {
            Row(
                Modifier.fillMaxWidth(),
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
        }

        if (completed.isEmpty()) {
            item {
                Box(Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) {
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
            }
        } else {
            items(completed, key = { it.id }) { order ->
                OrderCard(order)
            }
        }
    }
}
