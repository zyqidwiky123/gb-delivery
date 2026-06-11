package com.arodriverkotlin.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.ui.theme.AroBlack
import com.arodriverkotlin.ui.theme.AroGreen
import com.arodriverkotlin.ui.theme.Muted
import com.arodriverkotlin.ui.theme.Outline
import com.arodriverkotlin.ui.theme.SurfaceLow
import com.arodriverkotlin.R


@Composable
fun LoginScreen(message: String?, onLogin: (String, String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Box(
        Modifier
            .fillMaxSize()
            .background(AroBlack)
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Image(
                painter = painterResource(R.drawable.aro_logo),
                contentDescription = "ARO DRIVE",
                modifier = Modifier.size(100.dp),
                contentScale = ContentScale.Fit,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "ARO DRIVE",
                color = AroGreen,
                fontWeight = FontWeight.Black,
                fontSize = 32.sp,
                letterSpacing = (-0.5).sp,
            )
            Text(
                "Portal Pengemudi",
                color = Muted,
                fontSize = 14.sp,
                letterSpacing = 2.sp,
            )
            Spacer(Modifier.height(40.dp))
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email Mitra") },
                leadingIcon = {
                    Icon(Icons.Default.Email, null, tint = Muted)
                },
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
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Kata Sandi") },
                leadingIcon = {
                    Icon(Icons.Default.Lock, null, tint = Muted)
                },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
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
            if (message != null) {
                Spacer(Modifier.height(12.dp))
                Text(message, color = com.arodriverkotlin.ui.theme.Error, fontSize = 13.sp)
            }
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = { onLogin(email, password) },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = AroGreen,
                    contentColor = AroBlack
                ),
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                Text(
                    "MASUK",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    letterSpacing = 1.sp,
                )
            }
        }
    }
}
