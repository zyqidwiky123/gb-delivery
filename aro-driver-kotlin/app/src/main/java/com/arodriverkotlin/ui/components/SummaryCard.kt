package com.arodriverkotlin.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.models.UiState
import com.arodriverkotlin.service.rupiah
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.ui.theme.SurfaceHigh
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet

@Composable
fun SummaryCard(state: UiState) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(SurfaceHigh, RoundedCornerShape(16.dp))
            .padding(20.dp)
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    "Saldo ARO-Credit",
                    color = Muted,
                    fontSize = 12.sp,
                    letterSpacing = 0.5.sp,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    (state.profile?.balance ?: 0).rupiah(),
                    color = AroGreen,
                    fontWeight = FontWeight.Black,
                    fontSize = 28.sp,
                    letterSpacing = (-0.5).sp,
                )
            }
            Icon(
                Icons.Default.AccountBalanceWallet,
                null,
                tint = if (state.profile?.isOnline == true) AroGreen else Muted,
                modifier = Modifier.weight(1f).padding(start = 16.dp),
            )
        }
        Spacer(Modifier.height(12.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            StatItem("Hari Ini", state.todayEarnings.rupiah())
            StatItem("Order", "${state.allOrders.size}")
            StatItem("Rating", "${state.profile?.rating ?: 0.0}")
        }
    }
}

@Composable
private fun StatItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Text(label, color = Muted, fontSize = 11.sp, letterSpacing = 0.3.sp)
    }
}
