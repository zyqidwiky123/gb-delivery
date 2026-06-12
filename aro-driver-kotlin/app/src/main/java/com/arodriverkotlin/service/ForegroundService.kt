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
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
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
    private var currentIncomingCount = 0

    private var driverUid: String? = null

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        
            locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return
                val uid = driverUid ?: return
                
                latestLat = loc.latitude
                latestLng = loc.longitude

                val now = System.currentTimeMillis()
                // Update firestore max once every 20 seconds
                if (now - lastLocationWrite >= 20_000) {
                    lastLocationWrite = now
                    val lat = loc.latitude
                    val lng = loc.longitude
                    serviceScope.launch {
                        try {
                            DriverService.updateLocation(uid, lat, lng)
                            val orderId = currentOrderId
                            if (orderId != null) {
                                DriverService.updateOrderLocation(orderId, lat, lng)
                            }
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
                    showIncomingRingtoneNotification()
                }
                currentIncomingCount = count
            }
    }

    private fun showIncomingRingtoneNotification() {
        try {
            playNotificationSound()
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            val soundUri = Uri.parse("android.resource://${packageName}/raw/notifdriver")
            ensureIncomingChannel(nm, soundUri)

            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val pendingIntent = PendingIntent.getActivity(
                this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val fullScreenPendingIntent = PendingIntent.getActivity(
                this, 1, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(this, INCOMING_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("ARO DRIVE")
                .setContentText("Ada pesanan baru!")
                .setAutoCancel(true)
                .setSound(soundUri)
                .setVibrate(longArrayOf(0, 300, 150, 300, 150, 300))
                .setContentIntent(pendingIntent)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .build()
            nm.notify(INCOMING_NOTIFICATION_ID, notification)
        } catch (_: Exception) {}
    }

    private fun playNotificationSound() {
        try {
            val soundUri = Uri.parse("android.resource://${packageName}/raw/notifdriver")
            MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@ForegroundService, soundUri)
                setOnPreparedListener { start() }
                setOnCompletionListener { release() }
                setOnErrorListener { _, _, _ -> release(); true }
                prepareAsync()
            }
        } catch (_: Exception) {}
    }

    private fun ensureIncomingChannel(nm: NotificationManager, soundUri: Uri) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        try {
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build()
            val channel = NotificationChannel(
                INCOMING_CHANNEL_ID,
                "Pesanan Masuk",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifikasi pesanan baru ARO DRIVE"
                enableVibration(true)
                setSound(soundUri, audioAttributes)
                enableLights(true)
            }
            nm.createNotificationChannel(channel)
        } catch (_: Exception) {}
    }

    private fun buildNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, FOREGROUND_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("ARO DRIVE")
            .setContentText("Menjalankan layanan latar belakang...")
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setSilent(true)
            .build()
    }

    companion object {
        var currentOrderId: String? = null
        var latestLat: Double? = null
        var latestLng: Double? = null

        private const val INCOMING_CHANNEL_ID = "aro_drive_incoming_v3"
        private const val FOREGROUND_CHANNEL_ID = "aro_drive_foreground_service"
        private const val NOTIFICATION_ID = 1001
        private const val INCOMING_NOTIFICATION_ID = 1002

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
