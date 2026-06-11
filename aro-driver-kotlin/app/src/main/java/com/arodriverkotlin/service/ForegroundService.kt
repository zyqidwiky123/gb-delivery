package com.arodriverkotlin.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.arodriverkotlin.MainActivity
import com.arodriverkotlin.R
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class ForegroundService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var lastLocationWrite = 0L

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var incomingListener: ListenerRegistration? = null
    private var mediaPlayer: MediaPlayer? = null
    private var currentIncomingCount = 0

    private var driverUid: String? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return
                val uid = driverUid ?: return
                
                val now = System.currentTimeMillis()
                // Update firestore max once every 20 seconds
                if (now - lastLocationWrite >= 20_000) {
                    lastLocationWrite = now
                    serviceScope.launch {
                        try {
                            DriverService.updateLocation(uid, loc.latitude, loc.longitude)
                        } catch (_: Exception) {}
                    }
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val uid = intent?.getStringExtra("EXTRA_UID")
        if (uid != null) {
            driverUid = uid
            startLocationUpdates()
            startListeningForOrders(uid)
        }

        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        incomingListener?.remove()
        mediaPlayer?.release()
        serviceScope.cancel()
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000L)
            .setMinUpdateIntervalMillis(2000L)
            .build()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            try {
                fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
            } catch (_: Exception) {}
        }
    }

    private fun startListeningForOrders(uid: String) {
        incomingListener?.remove()
        incomingListener = FirebaseFirestore.getInstance().collection("orders")
            .whereEqualTo("status", "searching")
            .whereEqualTo("dispatch.offeredTo", uid)
            .addSnapshotListener { snap, _ ->
                val docs = snap?.documents ?: emptyList()
                val count = docs.size
                if (count > currentIncomingCount) {
                    playRingtone()
                }
                currentIncomingCount = count
            }
    }

    private fun playRingtone() {
        try {
            if (mediaPlayer?.isPlaying == true) return
            mediaPlayer?.release()
            mediaPlayer = MediaPlayer.create(this, R.raw.notifdriver).apply {
                setOnCompletionListener { it.release() }
                start()
            }
        } catch (_: Exception) {}
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ARO DRIVE",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Layanan latar belakang ARO DRIVE"
                setShowBadge(false)
            }
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("ARO DRIVE")
            .setContentText("Menjalankan layanan latar belakang...")
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setSilent(true)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "aro_drive_foreground"
        private const val NOTIFICATION_ID = 1001

        fun start(ctx: Context, uid: String) {
            val intent = Intent(ctx, ForegroundService::class.java).apply {
                putExtra("EXTRA_UID", uid)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, ForegroundService::class.java))
        }
    }
}
