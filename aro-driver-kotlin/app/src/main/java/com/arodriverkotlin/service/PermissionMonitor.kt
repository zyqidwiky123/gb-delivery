package com.arodriverkotlin.service

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat

class PermissionMonitor(
    private val context: Context,
    private val onPermissionLost: (String) -> Unit
) {
    private val requiredPermissions = listOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.POST_NOTIFICATIONS,
        Manifest.permission.ACCESS_BACKGROUND_LOCATION
    )

    fun checkAllPermissions(): Map<String, Boolean> {
        val result = mutableMapOf<String, Boolean>()
        for (perm in requiredPermissions) {
            val granted = ContextCompat.checkSelfPermission(context, perm) == PackageManager.PERMISSION_GRANTED
            result[perm] = granted
            if (!granted) onPermissionLost(perm)
        }
        return result
    }

    fun isLocationPermissionGranted(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    fun isDegradedMode(): Boolean {
        return checkAllPermissions().values.any { !it }
    }
}
