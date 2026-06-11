package com.arodriverkotlin.ui.screens

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.service.AuthService
import com.arodriverkotlin.models.UiState
import com.arodriverkotlin.ui.theme.AroBlack
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Error
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.ui.theme.Outline
import com.arodriverkotlin.ui.theme.Surface
import com.arodriverkotlin.ui.theme.SurfaceHigh
import com.arodriverkotlin.ui.theme.SurfaceLow
import com.arodriverkotlin.viewmodel.DriverViewModel
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.auth.FirebaseAuth

@Composable
fun EditProfileScreen(
    vm: DriverViewModel,
    state: UiState,
    onBack: () -> Unit,
) {
    val p = state.profile
    var name by remember { mutableStateOf(p?.name ?: p?.displayName ?: "") }
    var whatsapp by remember { mutableStateOf(p?.phone ?: "") }
    var vehicleType by remember { mutableStateOf(p?.vehicleType ?: "") }
    var plateNumber by remember { mutableStateOf(p?.plateNumber ?: "") }
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }

    Column(
        Modifier.fillMaxSize().background(Surface).padding(16.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(SurfaceHigh)
                    .clickable { onBack() },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.ArrowBack, null, tint = Color.White, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Text(
                "Edit Profil Mitra",
                color = AroGreen,
                fontWeight = FontWeight.Black,
                fontSize = 20.sp,
            )
        }

        message?.let {
            Text(
                it,
                color = if (it.startsWith("Profile")) AroGreen else Error,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        // Profile Info
        Text("Detail Personal & Kendaraan", color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Black)
        Column(
            Modifier.fillMaxWidth().background(SurfaceHigh, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Nama Lengkap") },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = textFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = whatsapp,
                onValueChange = { whatsapp = it },
                label = { Text("Nomor WhatsApp") },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = textFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = vehicleType,
                onValueChange = { vehicleType = it },
                label = { Text("Tipe Kendaraan") },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = textFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = plateNumber,
                onValueChange = { plateNumber = it.uppercase() },
                label = { Text("Plat Nomor") },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = textFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = {
                    vm.updateProfileFields(
                        name = name,
                        whatsapp = whatsapp,
                        vehicleType = vehicleType,
                        plateNumber = plateNumber,
                    )
                    message = "Profile diperbarui."
                },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AroGreen, contentColor = AroBlack),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text("PERBARUI PROFIL", fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }

        // Change Password
        Text("Keamanan Akun", color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Black)
        Column(
            Modifier.fillMaxWidth().background(SurfaceHigh, RoundedCornerShape(16.dp)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(
                value = currentPassword,
                onValueChange = { currentPassword = it },
                label = { Text("Kata Sandi Saat Ini") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = textFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = newPassword,
                onValueChange = { newPassword = it },
                label = { Text("Kata Sandi Baru") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = textFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = confirmPassword,
                onValueChange = { confirmPassword = it },
                label = { Text("Konfirmasi Password Baru") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = textFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = {
                    if (newPassword != confirmPassword) {
                        message = "Konfirmasi password tidak cocok."
                        return@Button
                    }
                    if (newPassword.length < 6) {
                        message = "Password minimal 6 karakter."
                        return@Button
                    }
                    val user = FirebaseAuth.getInstance().currentUser
                    if (user == null || user.email == null) {
                        message = "Silakan login ulang."
                        return@Button
                    }
                    val credential = EmailAuthProvider.getCredential(user.email!!, currentPassword)
                    user.reauthenticate(credential)
                        .addOnSuccessListener {
                            user.updatePassword(newPassword)
                                .addOnSuccessListener {
                                    message = "Kata sandi berhasil diubah!"
                                    currentPassword = ""
                                    newPassword = ""
                                    confirmPassword = ""
                                }
                                .addOnFailureListener { e ->
                                    message = "Gagal: ${e.message}"
                                }
                        }
                        .addOnFailureListener {
                            message = "Kata sandi saat ini salah."
                        }
                },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SurfaceLow, contentColor = Color.White),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text("GANTI KATA SANDI", fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun textFieldColors() = OutlinedTextFieldDefaults.colors(
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
