package com.arodriverkotlin.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.automirrored.filled.ListAlt
import androidx.compose.ui.graphics.vector.ImageVector

enum class Tab(val label: String, val icon: ImageVector) {
    Home("Home", Icons.Default.Home),
    Orders("Orders", Icons.AutoMirrored.Filled.ListAlt),
    Wallet("Wallet", Icons.Default.AttachMoney),
    Profile("Profile", Icons.Default.Person),
}
