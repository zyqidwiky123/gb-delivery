package com.arodriverkotlin.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.arodriverkotlin.service.VerificationService
import kotlinx.coroutines.launch

@Composable
fun VerificationScreen(
    orderId: String,
    onVerified: () -> Unit,
    onCancel: () -> Unit,
    onCompleteWithoutPin: () -> Unit
) {
    var pin by remember { mutableStateOf("") }
    var isVerifying by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Masukkan PIN Verifikasi", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Text("Masukkan PIN 4 digit dari penumpang", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = pin,
            onValueChange = { if (it.length <= 4) { pin = it; errorMessage = null } },
            label = { Text("PIN") },
            singleLine = true,
            modifier = Modifier.width(200.dp)
        )

        if (errorMessage != null) {
            Text(errorMessage!!, color = MaterialTheme.colorScheme.error)
        }

        Spacer(Modifier.height(16.dp))

        Button(
            onClick = {
                if (pin.length != 4) {
                    errorMessage = "PIN harus 4 digit"
                    return@Button
                }
                isVerifying = true
                scope.launch {
                    val valid = VerificationService.verifyPin(orderId, pin)
                    isVerifying = false
                    if (valid) onVerified()
                    else errorMessage = "PIN salah atau sudah expired"
                }
            },
            enabled = !isVerifying
        ) {
            if (isVerifying) CircularProgressIndicator(modifier = Modifier.size(16.dp))
            else Text("Verifikasi")
        }

        Spacer(Modifier.height(8.dp))

        TextButton(onClick = onCompleteWithoutPin) {
            Text("Selesaikan Tanpa PIN")
        }

        TextButton(onClick = onCancel) {
            Text("Batal")
        }
    }
}
