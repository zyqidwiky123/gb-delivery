package com.arodriverkotlin.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.models.DriverOrder
import com.arodriverkotlin.service.rupiah
import com.arodriverkotlin.ui.theme.AroBlack
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Error
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.ui.theme.SurfaceHigh
import com.arodriverkotlin.ui.theme.Warning

@Composable
fun OrderCard(
    order: DriverOrder,
    primary: Pair<String, () -> Unit>? = null,
    secondary: Pair<String, () -> Unit>? = null,
) {
    val ctx = LocalContext.current

    Column(
        Modifier
            .fillMaxWidth()
            .background(SurfaceHigh, RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "#ARO-${order.id.takeLast(5).uppercase()}",
                    color = Color.White,
                    fontWeight = FontWeight.Black,
                    fontSize = 13.sp,
                )
                if (order.voucherUsed) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "GRATIS ONGKIR",
                        color = Warning,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black,
                        modifier = Modifier
                            .background(Warning.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                StatusBadge(order.status)
                Text(
                    order.total.rupiah(),
                    color = AroGreen,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
            }
        }

        Spacer(Modifier.height(8.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            ServiceBadge(order.serviceType)
            Icon(
                Icons.Default.Circle, null,
                tint = Muted.copy(alpha = 0.3f),
                modifier = Modifier.size(4.dp)
            )
            Text(
                order.customer.name.ifEmpty { order.customerName },
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
        }

        Spacer(Modifier.height(6.dp))
        RouteLine(order.pickupAddress, order.destinationAddress)

        if (order.note.isNotBlank()) {
            Spacer(Modifier.height(6.dp))
            Text(
                "Catatan: ${order.note}",
                color = Muted,
                fontSize = 11.sp,
            )
        }

        // Customer WhatsApp
        val waNumber = order.customer.wa.ifEmpty { order.customerPhone }
        if (waNumber.isNotBlank() && order.status in listOf("accepted", "picked_up")) {
            Spacer(Modifier.height(6.dp))
            val cleanWa = waNumber.replace(Regex("\\D"), "")
                .let { if (it.startsWith("0")) "62${it.drop(1)}" else if (!it.startsWith("62")) "62$it" else it }
            val waIntent = Intent(Intent.ACTION_VIEW, Uri.parse(
                "https://wa.me/$cleanWa?text=${Uri.encode("Halo ${order.customer.name}, saya driver ARO-DRIVE. Saya sedang memproses pesanan ARO-${order.id.takeLast(5).uppercase()} Anda.")}"
            ))
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                Button(
                    onClick = { ctx.startActivity(waIntent) },
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF25D366),
                        contentColor = Color.White
                    ),
                ) {
                    Text("Chat WA", fontWeight = FontWeight.Bold, fontSize = 10.sp)
                }
            }
        }

        // Items list
        if (order.items.isNotEmpty() && order.status != "searching") {
            Spacer(Modifier.height(8.dp))
            Text(
                "Detail Pesanan",
                color = Muted,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
            )
            Spacer(Modifier.height(4.dp))
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                    .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                order.items.forEach { item ->
                    Column {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "${item.qty}x ${item.name}",
                                color = Color.White.copy(alpha = 0.8f),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                (item.price * item.qty).rupiah(),
                                color = Color.White.copy(alpha = 0.4f),
                                fontSize = 11.sp,
                            )
                        }
                        if (item.desc.isNotBlank()) {
                            Text(
                                item.desc,
                                color = Color.White.copy(alpha = 0.5f),
                                fontSize = 10.sp,
                            )
                        }
                    }
                }
            }
        }

        // Sender & Receiver for ARO SEND
        if (order.serviceType.lowercase() == "send" && (order.sender != null || order.receiver != null)) {
            Spacer(Modifier.height(8.dp))
            Text(
                "Detail Pengiriman Paket",
                color = AroGreen,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
            )
            Spacer(Modifier.height(4.dp))
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF131313).copy(alpha = 0.9f), RoundedCornerShape(8.dp))
                    .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                order.sender?.let { s ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("PENGIRIM", color = AroGreen, fontSize = 8.sp, fontWeight = FontWeight.Black)
                            Text(s.name, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text(s.phone, color = Muted, fontSize = 10.sp)
                        }
                        if (s.phone.isNotBlank()) {
                            val clean = s.phone.replace(Regex("\\D"), "")
                                .let { if (it.startsWith("0")) "62${it.drop(1)}" else if (!it.startsWith("62")) "62$it" else it }
                            Button(
                                onClick = { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$clean"))) },
                                shape = RoundedCornerShape(6.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = AroGreen.copy(alpha = 0.15f), contentColor = AroGreen),
                            ) { Text("WA", fontSize = 9.sp, fontWeight = FontWeight.Bold) }
                        }
                    }
                }
                order.receiver?.let { r ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("PENERIMA", color = Warning, fontSize = 8.sp, fontWeight = FontWeight.Black)
                            Text(r.name, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text(r.phone, color = Muted, fontSize = 10.sp)
                        }
                        if (r.phone.isNotBlank()) {
                            val clean = r.phone.replace(Regex("\\D"), "")
                                .let { if (it.startsWith("0")) "62${it.drop(1)}" else if (!it.startsWith("62")) "62$it" else it }
                            Button(
                                onClick = { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$clean"))) },
                                shape = RoundedCornerShape(6.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Warning.copy(alpha = 0.15f), contentColor = Warning),
                            ) { Text("WA", fontSize = 9.sp, fontWeight = FontWeight.Bold) }
                        }
                    }
                }
            }
        }

        // Payment Breakdown
        if (order.status != "searching") {
            Spacer(Modifier.height(8.dp))
            val actualShop = order.actualShoppingCost.takeIf { it > 0 } ?: order.subtotal.takeIf { it > 0 } ?: order.shoppingCost
            val pureDelivery = order.deliveryFee - order.appServiceFee
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(AroGreen.copy(alpha = 0.05f), RoundedCornerShape(8.dp))
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    "Rincian Pembayaran",
                    color = AroGreen,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                )
                Spacer(Modifier.height(4.dp))
                PaymentRow("Total Belanja", actualShop.rupiah())
                PaymentRow("Ongkir (Murni)", pureDelivery.rupiah())
                if (order.appServiceFee > 0) {
                    PaymentRow("Biaya Layanan", order.appServiceFee.rupiah())
                }
                if (order.pickupFee > 0) {
                    PaymentRow("Biaya Jemput (+${"%.1f".format(order.pickupDistance)}km)", order.pickupFee.rupiah(), Color(0xFFFFD166))
                }
                Row(
                    Modifier.fillMaxWidth().padding(top = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Total Tagihan", color = AroGreen, fontWeight = FontWeight.Black, fontSize = 10.sp)
                    Text(order.total.rupiah(), color = AroGreen, fontWeight = FontWeight.Black, fontSize = 14.sp)
                }
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Metode Bayar", color = Muted, fontSize = 8.sp)
                    Text(order.paymentMethod, color = if (order.paymentMethod == "TUNAI") Color(0xFFFF9800) else Color(0xFF2196F3), fontSize = 8.sp, fontWeight = FontWeight.Black)
                }
            }
        }

        if (order.expiresAt != null) {
            Spacer(Modifier.height(6.dp))
            Text(
                "Offer expired: ${order.expiresAt.toDate()}",
                color = Warning,
                fontSize = 11.sp,
            )
        }

        if (primary != null || secondary != null) {
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                primary?.let {
                    Button(
                        onClick = it.second,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AroGreen,
                            contentColor = AroBlack
                        ),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(it.first, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
                secondary?.let {
                    Button(
                        onClick = it.second,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF333333),
                            contentColor = Color.White
                        ),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(it.first, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun PaymentRow(label: String, value: String, valueColor: Color = Color.White) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = Color.White.copy(alpha = 0.6f), fontSize = 10.sp)
        Text(value, color = valueColor, fontWeight = FontWeight.Bold, fontSize = 10.sp)
    }
}

@Composable
private fun RouteLine(pickup: String, dropoff: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Default.Circle, null,
                tint = AroGreen,
                modifier = Modifier.size(10.dp)
            )
            Text(
                " $pickup",
                color = Muted, fontSize = 12.sp,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Default.Circle, null,
                tint = Error,
                modifier = Modifier.size(10.dp)
            )
            Text(
                " $dropoff",
                color = Muted, fontSize = 12.sp,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
