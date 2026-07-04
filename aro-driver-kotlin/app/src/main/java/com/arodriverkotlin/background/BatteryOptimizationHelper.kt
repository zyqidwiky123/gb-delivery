package com.arodriverkotlin.background

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log

class BatteryOptimizationHelper(private val context: Context) {

    companion object {
        private const val TAG = "BatteryOptimizationHelper"
    }

    fun isIgnoringBatteryOptimizations(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun requestBatteryOptimizationWhitelist(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (pm.isIgnoringBatteryOptimizations(context.packageName)) {
            return true
        }

        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.data = android.net.Uri.parse("package:" + context.packageName)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request battery optimization whitelist", e)
            return false
        }
    }

    fun requestBatteryOptimizationWhitelistWithCallback(callback: (Boolean) -> Unit) {
        // This would typically be called from an Activity
        // The result comes via onActivityResult
        requestBatteryOptimizationWhitelist()
        
        // Check after a short delay
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            callback(isIgnoringBatteryOptimizations())
        }, 2000)
    }

    fun getBatteryOptimizationStatus(): String {
        return when {
            Build.VERSION.SDK_INT < Build.VERSION_CODES.M -> "Not applicable (API < 23)"
            isIgnoringBatteryOptimizations() -> "Whitelisted"
            else -> "Not whitelisted"
        }
    }

    fun shouldShowBatteryOptimizationDialog(): Boolean {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !isIgnoringBatteryOptimizations()
    }
}