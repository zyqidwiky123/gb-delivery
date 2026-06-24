package com.arodriverkotlin.service

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.arodriverkotlin.MainActivity
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlin.math.*

class ForegroundService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback

    @Volatile private var lastUploadedLat = 0.0
    @Volatile private var lastUploadedLng = 0.0
    @Volatile private var lastUploadTime = 0L

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var incomingListener: ListenerRegistration? = null

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
                val distance = if (lastUploadTime > 0L) {
                    calculateDistance(lastUploadedLat, lastUploadedLng, loc.latitude, loc.longitude)
                } else Double.MAX_VALUE

                val timeSinceLastUpload = now - lastUploadTime
                val hasActiveOrder = currentOrderId != null

                val shouldUpload =
                    distance >= MOVEMENT_THRESHOLD_M ||
                    (!hasActiveOrder && timeSinceLastUpload >= IDLE_HEARTBEAT_MS)

                if (shouldUpload) {
                    lastUploadedLat = loc.latitude
                    lastUploadedLng = loc.longitude
                    lastUploadTime = now
                    val lat = loc.latitude
                    val lng = loc.longitude
                    val orderId = currentOrderId
                    serviceScope.launch {
                        try {
                            DriverService.updateLocation(uid, lat, lng)
                            if (orderId != null) {
                                DriverService.updateOrderLocation(orderId, lat, lng)
                            }
                        } catch (_: Exception) {}
                    }
                }
            }
        }
    }

    private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val R = 6371000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = (sin(dLat / 2).pow(2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2).pow(2)).coerceIn(0.0, 1.0)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)

        val uid = intent?.getStringExtra(EXTRA_UID) ?: storedDriverUid()
        if (uid != null) {
            driverUid = uid
            persistDriverUid(uid)
            startLocationUpdates()
            startListeningForOrders(uid)
        } else {
            Log.w(TAG, "Service dimulai tanpa UID driver; service dihentikan")
            stopSelf()
            return START_NOT_STICKY
        }
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
            .addSnapshotListener { snap, error ->
                if (error != null) {
                    Log.e(TAG, "Listener pesanan masuk gagal", error)
                    return@addSnapshotListener
                }

                snap?.documentChanges
                    ?.filter { it.type == DocumentChange.Type.ADDED }
                    ?.forEach { change ->
                        IncomingOrderNotifier.show(
                            context = this,
                            orderId = change.document.id,
                            title = "ARO DRIVE",
                            body = "Ada pesanan baru!",
                        )
                    }
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
        @Volatile var currentOrderId: String? = null
        @Volatile var latestLat: Double? = null
        @Volatile var latestLng: Double? = null

        private const val MOVEMENT_THRESHOLD_M = 100.0
        private const val IDLE_HEARTBEAT_MS = 15 * 60 * 1000L
        private const val TAG = "ForegroundService"
        private const val PREFS_NAME = "foreground_service"
        private const val STORED_DRIVER_UID = "driver_uid"
        private const val EXTRA_UID = "EXTRA_UID"
        private const val FOREGROUND_CHANNEL_ID = "aro_drive_foreground_service"
        private const val NOTIFICATION_ID = 1001

        fun start(ctx: Context, uid: String) {
            val intent = Intent(ctx, ForegroundService::class.java).apply {
                putExtra(EXTRA_UID, uid)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }

        fun stop(ctx: Context) {
            ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(STORED_DRIVER_UID)
                .apply()
            ctx.stopService(Intent(ctx, ForegroundService::class.java))
        }
    }

    private fun persistDriverUid(uid: String) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putString(STORED_DRIVER_UID, uid)
            .apply()
    }

    private fun storedDriverUid(): String? =
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString(STORED_DRIVER_UID, null)
}
