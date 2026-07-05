package com.arodriverkotlin

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.arodriverkotlin.ui.components.InAppNotificationBanner
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : ComponentActivity() {

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        requestNotificationPermission()
        getFcmToken()
        handleDeepLink(intent)

        setContent {
            MaterialTheme {
                Box(Modifier.fillMaxSize()) {
                    AroDriverApp()
                    InAppNotificationBanner()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    override fun onStart() {
        super.onStart()
        com.arodriverkotlin.notification.NotificationEngine.isAppInForeground = true
    }

    override fun onStop() {
        super.onStop()
        com.arodriverkotlin.notification.NotificationEngine.isAppInForeground = false
    }

    private fun handleDeepLink(intent: Intent?) {
        intent?.getStringExtra("navigate_to")?.let { screen ->
            Log.i("DeepLink", "Navigating to: $screen")
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun getFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
            }
        }
    }
}
