package com.arodriverkotlin.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Error
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.ui.theme.Warning

@Composable
fun ServiceBadge(serviceType: String) {
    val label = when (serviceType.lowercase()) {
        "food", "makanan" -> "ARO FOOD"
        "ride", "ojek" -> "ARO RIDE"
        "send", "kirim" -> "ARO SEND"
        "shop", "belanja" -> "ARO SHOP"
        else -> "ARO ${serviceType.uppercase()}"
    }
    Box(
        Modifier
            .background(AroGreen.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            label,
            color = AroGreen,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
        )
    }
}

@Composable
fun StatusBadge(status: String) {
    val (color, label) = when (status.lowercase()) {
        "completed" -> AroGreen to "SELESAI"
        "accepted" -> Color(0xFF3B82F6) to "DITERIMA"
        "picked_up" -> Warning to "DIJEMPUT"
        "searching" -> Color(0xFFA855F7) to "CARI DRIVER"
        "cancelled" -> Error to "BATAL"
        else -> Muted to status.uppercase()
    }
    Box(
        Modifier
            .background(color.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(
            label,
            color = color,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.3.sp,
        )
    }
}
