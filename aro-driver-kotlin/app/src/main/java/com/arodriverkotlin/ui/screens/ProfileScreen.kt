package com.arodriverkotlin.ui.screens

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.arodriverkotlin.models.BankAccount
import com.arodriverkotlin.models.UiState
import com.arodriverkotlin.ui.theme.AroBlack
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Error
import com.arodriverkotlin.ui.theme.GlassBg
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.ui.theme.Outline
import com.arodriverkotlin.ui.theme.Surface
import com.arodriverkotlin.ui.theme.SurfaceHigh
import com.arodriverkotlin.service.DriverService
import com.arodriverkotlin.ui.theme.SurfaceLow
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.arodriverkotlin.ui.theme.Warning
import com.arodriverkotlin.viewmodel.DriverViewModel

@Composable
fun ProfileScreen(
    vm: DriverViewModel,
    state: UiState,
    onLogout: () -> Unit = {},
    onEditProfile: () -> Unit = {},
) {
    val ctx = LocalContext.current
    val p = state.profile
    val name = p?.displayName ?: p?.email?.takeWhile { it != '@' } ?: "Driver"

    // Bank accounts state
    var bankAccounts by remember { mutableStateOf(p?.bankAccounts ?: emptyList()) }
    var showAddBank by remember { mutableStateOf(false) }
    var newBankName by remember { mutableStateOf("") }
    var newAccountNumber by remember { mutableStateOf("") }
    var newAccountHolder by remember { mutableStateOf("") }

    // Photo picker
    val scope = remember { CoroutineScope(Dispatchers.Main) }
    val photoLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            scope.launch {
                try {
                    val url = DriverService.uploadPhoto(state.userId ?: return@launch, it)
                    vm.updateProfileFields(photoUrl = url)
                } catch (e: Exception) {
                    Log.w("ProfileScreen", "Gagal upload foto profil", e)
                }
            }
        }
    }
    val qrisLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            scope.launch {
                try {
                    val url = DriverService.uploadQris(state.userId ?: return@launch, it)
                    vm.updateProfileFields(qrisUrl = url)
                } catch (e: Exception) {
                    Log.w("ProfileScreen", "Gagal upload QRIS", e)
                }
            }
        }
    }

    LazyColumn(
        Modifier.fillMaxSize().background(Surface),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Column(
                Modifier.fillMaxWidth().background(SurfaceHigh, RoundedCornerShape(20.dp)).padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    Modifier.size(80.dp).clip(CircleShape).background(Surface).clickable { photoLauncher.launch("image/*") },
                    contentAlignment = Alignment.Center
                ) {
                    if (p?.photoUrl?.isNotEmpty() == true) {
                        AsyncImage(
                            model = p.photoUrl,
                            contentDescription = null,
                            modifier = Modifier.size(80.dp).clip(CircleShape),
                            contentScale = ContentScale.Crop,
                        )
                    } else {
                        Icon(Icons.Default.Person, null, tint = Muted, modifier = Modifier.size(40.dp))
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text(name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text(p?.email ?: "", color = Muted, fontSize = 13.sp)
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    StatChip("Peringkat", "${p?.rating ?: 0.0}")
                    StatChip("Selesai", "${p?.completedOrders ?: 0}")
                }
            }
        }

        // Vehicle Info
        item {
            Column(
                Modifier.fillMaxWidth().background(SurfaceHigh, RoundedCornerShape(16.dp)).padding(16.dp)
            ) {
                Text("Info Kendaraan", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("Tipe", color = Muted, fontSize = 10.sp)
                        Text(p?.vehicleType ?: "-", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Plat Nomor", color = Muted, fontSize = 10.sp)
                        Box(
                            Modifier.background(Color.White, RoundedCornerShape(4.dp)).padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(p?.plateNumber ?: "XX 0000 XX", color = AroBlack, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        // Bank Accounts
        item {
            Column(
                Modifier.fillMaxWidth().background(SurfaceHigh, RoundedCornerShape(16.dp)).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Daftar Rekening", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    if (!showAddBank) {
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(AroGreen.copy(alpha = 0.15f))
                                .clickable { showAddBank = true }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Add, null, tint = AroGreen, modifier = Modifier.size(14.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Tambah", color = AroGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                if (bankAccounts.isEmpty() && !showAddBank) {
                    Text("Belum ada rekening terdaftar", color = Muted, fontSize = 12.sp)
                }

                bankAccounts.forEach { acc ->
                    Row(
                        Modifier.fillMaxWidth().background(GlassBg, RoundedCornerShape(12.dp)).padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(acc.bankName, color = AroGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Text(acc.accountNumber, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            Text(acc.accountHolder, color = Muted, fontSize = 11.sp)
                        }
                        Box(
                            Modifier.size(32.dp).clip(CircleShape).background(Error.copy(alpha = 0.15f)).clickable {
                                val updated = bankAccounts.filter { it != acc }
                                val mapped = updated.map { mapOf("bankName" to it.bankName, "accountNumber" to it.accountNumber, "accountHolder" to it.accountHolder) }
                                vm.updateProfileFields(bankAccounts = mapped)
                                bankAccounts = updated
                            },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Delete, null, tint = Error, modifier = Modifier.size(16.dp))
                        }
                    }
                }

                if (showAddBank) {
                    Column(Modifier.fillMaxWidth().background(GlassBg, RoundedCornerShape(12.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Tambah Rekening Baru", color = AroGreen, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Box(Modifier.size(28.dp).clip(CircleShape).background(GlassBg).clickable { showAddBank = false }, contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.Close, null, tint = Muted, modifier = Modifier.size(16.dp))
                            }
                        }
                        OutlinedTextField(
                            value = newBankName,
                            onValueChange = { newBankName = it },
                            label = { Text("Bank") },
                            singleLine = true,
                            shape = RoundedCornerShape(8.dp),
                            colors = smallTextFieldColors(),
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = newAccountNumber,
                            onValueChange = { newAccountNumber = it },
                            label = { Text("No Rekening") },
                            singleLine = true,
                            shape = RoundedCornerShape(8.dp),
                            colors = smallTextFieldColors(),
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = newAccountHolder,
                            onValueChange = { newAccountHolder = it },
                            label = { Text("Atas Nama") },
                            singleLine = true,
                            shape = RoundedCornerShape(8.dp),
                            colors = smallTextFieldColors(),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Button(
                            onClick = {
                                if (newBankName.isNotBlank() && newAccountNumber.isNotBlank() && newAccountHolder.isNotBlank()) {
                                    val newAcc = BankAccount(newBankName, newAccountNumber, newAccountHolder)
                                    val updated = bankAccounts + newAcc
                                    val mapped = updated.map { mapOf("bankName" to it.bankName, "accountNumber" to it.accountNumber, "accountHolder" to it.accountHolder) }
                                    vm.updateProfileFields(bankAccounts = mapped)
                                    bankAccounts = updated
                                    newBankName = ""; newAccountNumber = ""; newAccountHolder = ""
                                    showAddBank = false
                                }
                            },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = AroGreen, contentColor = AroBlack),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Simpan Rekening", fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        }
                    }
                }
            }
        }

        // QRIS Upload
        item {
            Column(
                Modifier.fillMaxWidth().background(SurfaceHigh, RoundedCornerShape(16.dp)).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("QRIS Kustom", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(
                        if (p?.qrisUrl?.isNotEmpty() == true) "Aktif" else "Belum Diupload",
                        color = if (p?.qrisUrl?.isNotEmpty() == true) AroGreen else Error,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Text("Upload QRIS agar pelanggan bisa bayar non-tunai.", color = Muted, fontSize = 11.sp)
                Box(
                    Modifier.fillMaxWidth().heightIn(min = 80.dp).background(GlassBg, RoundedCornerShape(12.dp)).clickable { qrisLauncher.launch("image/*") },
                    contentAlignment = Alignment.Center
                ) {
                    if (p?.qrisUrl?.isNotEmpty() == true) {
                        AsyncImage(
                            model = p.qrisUrl,
                            contentDescription = null,
                            modifier = Modifier.fillMaxWidth().padding(8.dp),
                        )
                    } else {
                        Text("Tap untuk upload QRIS", color = Muted, fontSize = 12.sp)
                    }
                }
            }
        }

        // Settings
        item {
            SettingRow("Online Mode", trailing = {
                Switch(
                    checked = state.profile?.isOnline ?: false,
                    onCheckedChange = { vm.toggleOnline() },
                    // Note: DriverShell.kt TopBar also has toggleOnline without checked param
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = AroGreen,
                        uncheckedThumbColor = Color.White,
                        uncheckedTrackColor = SurfaceHigh,
                    )
                )
            })
        }
        item {
            SettingRow(
                "Pengaturan Akun",
                trailing = { Icon(Icons.Default.ChevronRight, null, tint = Muted) },
                onClick = onEditProfile,
            )
        }
        item {
            SettingRow(
                "WhatsApp Admin",
                trailing = { Icon(Icons.Default.ChevronRight, null, tint = Muted) },
                onClick = {
                    val i = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/6285748343842"))
                    ctx.startActivity(i)
                }
            )
        }
        item {
            SettingRow(
                "Syarat & Ketentuan Mitra",
                trailing = { Icon(Icons.Default.ChevronRight, null, tint = Muted) },
                onClick = {
                    // Placeholder - open T&C URL
                }
            )
        }
        item {
            SettingRow(
                "Keluar",
                icon = Icons.Default.ExitToApp, iconTint = Error,
                trailing = { Icon(Icons.Default.ChevronRight, null, tint = Muted) },
                onClick = onLogout
            )
        }
        item { Spacer(Modifier.height(40.dp)) }
    }
}

@Composable
private fun StatChip(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        Text(label, color = Muted, fontSize = 11.sp, letterSpacing = 0.5.sp)
    }
}

@Composable
private fun SettingRow(
    label: String,
    icon: ImageVector? = null,
    iconTint: Color = Muted,
    trailing: @Composable () -> Unit = {},
    onClick: (() -> Unit)? = null,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(GlassBg, RoundedCornerShape(12.dp))
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        icon?.let {
            Icon(it, null, tint = iconTint, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(12.dp))
        }
        Text(
            label,
            color = Color.White,
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp,
            modifier = Modifier.weight(1f)
        )
        trailing()
    }
}

@Composable
private fun smallTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = AroGreen,
    unfocusedBorderColor = Outline,
    focusedLabelColor = AroGreen,
    unfocusedLabelColor = Muted,
    cursorColor = AroGreen,
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    focusedContainerColor = SurfaceLow,
    unfocusedContainerColor = SurfaceLow,
)
