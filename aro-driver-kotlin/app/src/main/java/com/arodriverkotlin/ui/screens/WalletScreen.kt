package com.arodriverkotlin.ui.screens

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.AddCard
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.models.Transaction
import com.arodriverkotlin.models.UiState
import com.arodriverkotlin.service.rupiah
import com.arodriverkotlin.ui.theme.AroBlack
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Error
import com.arodriverkotlin.ui.theme.GlassBg
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.ui.theme.Outline
import com.arodriverkotlin.ui.theme.Surface
import com.arodriverkotlin.ui.theme.SurfaceHigh
import com.arodriverkotlin.ui.theme.SurfaceLow
import com.arodriverkotlin.viewmodel.DriverViewModel

@Composable
fun WalletScreen(state: UiState, vm: DriverViewModel) {
    val ctx = LocalContext.current
    val transactions = state.allTransactions
    val balance = state.profile?.balance ?: 0
    var showTopupModal by remember { mutableStateOf(false) }
    var topupAmount by remember { mutableLongStateOf(10000) }
    val p = state.profile

    // Daily earnings grouping
    val completedOrders = state.completedToday
    val dailyEarnings = completedOrders.filter { it.status == "completed" }

    LazyColumn(
        Modifier.fillMaxSize().background(Surface),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Balance Card
        item {
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceHigh)
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.AccountBalanceWallet, null,
                        tint = AroGreen,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "ARO-CREDIT",
                        color = Muted,
                        fontSize = 11.sp,
                        letterSpacing = 1.sp,
                    )
                    Text(
                        balance.rupiah(),
                        color = Color.White,
                        fontSize = 36.sp,
                        fontWeight = FontWeight.Black,
                    )
                    // Low balance warning
                    if (balance <= 10000) {
                        Spacer(Modifier.height(8.dp))
                        Row(
                            Modifier
                                .background(Error.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Warning, null, tint = Error, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Saldo Rendah", color = Error, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Action Buttons: Topup & Withdraw
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Top Up
                Column(
                    Modifier
                        .weight(1f)
                        .background(SurfaceHigh, RoundedCornerShape(16.dp))
                        .clickable { showTopupModal = true }
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Box(
                        Modifier.size(44.dp).background(AroGreen.copy(alpha = 0.1f), RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.AddCard, null, tint = AroGreen, modifier = Modifier.size(24.dp))
                    }
                    Text("Top Up Saldo", color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Black)
                }
                // Withdraw
                Column(
                    Modifier
                        .weight(1f)
                        .background(SurfaceHigh, RoundedCornerShape(16.dp))
                        .clickable {
                            if (balance <= 0) return@clickable
                            val waNumber = "6285748343842"
                            val msg = Uri.encode("Halo Admin ARO DRIVE, saya mau Tarik Tunai.\n\nID Driver: ${state.userId}\nNama: ${p?.name}\nSaldo: Rp ${                balance.toString()}")
                            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$waNumber?text=$msg")))
                        }
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Box(
                        Modifier.size(44.dp).background(GlassBg, RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.AccountBalance, null, tint = Muted, modifier = Modifier.size(24.dp))
                    }
                    Text("Tarik Tunai", color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Black)
                }
            }
        }

        // Earnings summary
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Column(
                    Modifier.weight(1f).background(SurfaceHigh, RoundedCornerShape(16.dp)).padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Hari Ini", color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    Text(state.todayEarnings.rupiah(), color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
                Column(
                    Modifier.weight(1f).background(AroGreen.copy(alpha = 0.05f), RoundedCornerShape(16.dp)).padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Bulan Ini", color = AroGreen, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    Text(state.monthlyEarnings.rupiah(), color = AroGreen, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Info card
        item {
            Row(
                Modifier.fillMaxWidth().background(AroGreen.copy(alpha = 0.05f), RoundedCornerShape(12.dp)).padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.Info, null, tint = AroGreen, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    "Saldo Wallet dikurangi otomatis setiap pesanan selesai. Top-up saldo untuk terus menerima order.",
                    color = Muted,
                    fontSize = 11.sp,
                )
            }
        }

        // Transaction History
        item {
            Text(
                "Riwayat Transaksi",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
            )
        }
        if (transactions.isEmpty()) {
            item {
                Box(Modifier.fillMaxWidth().padding(top = 20.dp), contentAlignment = Alignment.Center) {
                    Text("Belum ada transaksi", color = Muted, fontSize = 14.sp, textAlign = TextAlign.Center)
                }
            }
        } else {
            items(transactions, key = { it.id }) { tx ->
                TransactionItem(tx)
            }
        }

        // Daily earnings
        if (dailyEarnings.isNotEmpty()) {
            item {
                Text(
                    "Riwayat Pendapatan Harian",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
            }
            dailyEarnings.forEach { order ->
                item(key = order.id) {
                    var expanded by remember { mutableStateOf(false) }
                    Column(
                        Modifier.fillMaxWidth().background(GlassBg, RoundedCornerShape(12.dp)).clickable { expanded = !expanded }.padding(12.dp)
                    ) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column {
                                Text("#ARO-${order.id.takeLast(5).uppercase()}", color = AroGreen, fontSize = 10.sp, fontWeight = FontWeight.Black)
                                Text(order.customerName, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            Icon(
                                if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                null, tint = Muted
                            )
                        }
                        if (expanded) {
                            Spacer(Modifier.height(8.dp))
                            val net = order.deliveryFee - order.platformFee
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("Ongkir", color = Muted, fontSize = 10.sp)
                                    Text(order.deliveryFee.rupiah(), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                                if (order.platformFee > 0) {
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Komisi (10%)", color = Error, fontSize = 10.sp)
                                        Text("-${order.platformFee.rupiah()}", color = Error, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                                Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("Bersih", color = AroGreen, fontSize = 11.sp, fontWeight = FontWeight.Black)
                                    Text(net.rupiah(), color = AroGreen, fontSize = 13.sp, fontWeight = FontWeight.Black)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Topup Modal
    if (showTopupModal) {
        Box(
            Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.7f)),
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceHigh)
            ) {
                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("Top Up Saldo", color = Color.White, fontWeight = FontWeight.Black, fontSize = 22.sp)
                    Text("Konfirmasi via WhatsApp", color = Muted, fontSize = 11.sp)

                    // Amount presets
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(10000L, 50000L, 100000L).forEach { amt ->
                            Box(
                                Modifier
                                    .weight(1f)
                                    .background(
                                        if (topupAmount == amt) AroGreen.copy(alpha = 0.2f) else GlassBg,
                                        RoundedCornerShape(8.dp)
                                    )
                                    .clickable { topupAmount = amt }
                                    .padding(vertical = 12.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "${amt / 1000}k",
                                    color = if (topupAmount == amt) AroGreen else Muted,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = if (topupAmount > 0) topupAmount.toString() else "",
                        onValueChange = { topupAmount = it.toLongOrNull() ?: 0 },
                        label = { Text("Rp") },
                        keyboardOptions = KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number),
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

                    Row(
                        Modifier.fillMaxWidth().background(GlassBg, RoundedCornerShape(8.dp)).padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Info, null, tint = AroGreen, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Setelah submit, Anda akan diarahkan ke WhatsApp Admin.", color = Muted, fontSize = 10.sp)
                    }

                    Button(
                        onClick = {
                            if (topupAmount < 10000) return@Button
                            vm.requestTopup(topupAmount)
                            val waNumber = "6285748343842"
                            val msg = Uri.encode("Halo Admin ARO DRIVE, saya mau Top-up Saldo.\n\nID Driver: ${state.userId}\nNama: ${p?.name}\nNominal: Rp ${topupAmount.toString()}")
                            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$waNumber?text=$msg")))
                            showTopupModal = false
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = AroGreen, contentColor = AroBlack),
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) {
                        Text("LANJUT KE WHATSAPP", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun TransactionItem(tx: Transaction) {
    val isCredit = tx.type == "credit"
    Row(
        Modifier
            .fillMaxWidth()
            .background(GlassBg, RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                tx.description,
                color = Color.White,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                tx.createdAt, color = Muted, fontSize = 11.sp,
            )
        }
        Text(
            "${if (isCredit) "+" else "-"}${tx.amount.rupiah()}",
            color = if (isCredit) AroGreen else Error,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
        )
    }
}
