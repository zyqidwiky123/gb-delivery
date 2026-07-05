package com.arodriverkotlin.util

import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.provider.Settings
import kotlin.math.*

object LocationUtils {
    fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val R = 6371000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c
    }

    fun isGpsProviderEnabled(context: Context): Boolean {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
    }

    fun isMockSettingOn(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.Secure.getInt(
                context.contentResolver,
                Settings.Secure.ALLOW_MOCK_LOCATION, 0
            ) != 0
        }
        return false
    }

    fun isLocationFromMockProvider(location: Location): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
            location.isFromMockProvider
        } else false
    }
}

fun distanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    return LocationUtils.calculateDistance(lat1, lon1, lat2, lon2)
}
