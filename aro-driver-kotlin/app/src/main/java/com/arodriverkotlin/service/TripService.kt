package com.arodriverkotlin.service

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.arodriverkotlin.MainActivity
import com.arodriverkotlin.R
import com.arodriverkotlin.background.BackgroundDiagnostics
import com.arodriverkotlin.background.GeofenceEventHandler
import com.arodriverkotlin.background.GeofenceManager
import com.arodriverkotlin.background.OfflineQueueProcessor
import com.arodriverkotlin.background.OrderTimeoutManager
import com.arodriverkotlin.background.SmartWakeLock
import com.arodriverkotlin.database.AppDatabase
import com.arodriverkotlin.database.entity.PendingLocation
import com.arodriverkotlin.location.LocationData
import com.arodriverkotlin.location.LocationKit
import com.arodriverkotlin.location.LocationConfig
import com.arodriverkotlin.location.LocationPriority
import com.arodriverkotlin.models.ServiceType
import com.arodriverkotlin.order.OrderDispatcher
import com.arodriverkotlin.order.OrderStateMachine
import kotlinx.coroutines.*

class TripService : Service() {

    private lateinit var locationKit: LocationKit
    private lateinit var geofenceManager: GeofenceManager
    private var offlineQueueProcessor: OfflineQueueProcessor? = null
    private var orderTimeoutManager: OrderTimeoutManager? = null
    private var diagnostics: BackgroundDiagnostics? = null
    private var smartWakeLock: SmartWakeLock? = null
    private var stateMachine: OrderStateMachine<*>? = null

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var driverUid: String? = null
    private var currentOrderId: String? = null
    private var locationPermissionRevoked = false

    private var currentIntervalMs = 5000L
    private var currentMinIntervalMs = 2000L
    private var smoothedSpeed = 0f
    private val SPEED_SMOOTHING = 0.3f

    private val locationBuffer = mutableListOf<PendingLocation>()
    private val BUFFER_MAX = ConfigService.getBufferMaxSize()

    companion object {
        const val ACTION_START_TRIP = "com.arodriverkotlin.START_TRIP"
        const val ACTION_STOP_TRIP = "com.arodriverkotlin.STOP_TRIP"
        const val ACTION_UPDATE_CONFIG = "com.arodriverkotlin.UPDATE_TRIP_CONFIG"
        const val EXTRA_UID = "extra_uid"
        const val EXTRA_ORDER_ID = "extra_order_id"
        const val EXTRA_SERVICE_TYPE = "extra_service_type"

        const val PREFS_NAME = "trip_service"
        const val KEY_ACTIVE_ORDER_ID = "active_order_id"
        const val NOTIFICATION_ID = 1002
        const val CHANNEL_ID = "aro_drive_trip_service"

        private const val TAG = "TripService"

        @Volatile var isInTrip: Boolean = false
            private set
        @Volatile var currentOrderId: String? = null
        @Volatile var latestLat: Double? = null
        @Volatile var latestLng: Double? = null
        @Volatile var locationPermissionRevoked: Boolean = false

        fun start(context: Context, uid: String, orderId: String, serviceType: String = "transport") {
            isInTrip = true
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_ACTIVE_ORDER_ID, orderId)
                .apply()

            val intent = Intent(context, TripService::class.java).apply {
                action = ACTION_START_TRIP
                putExtra(EXTRA_UID, uid)
                putExtra(EXTRA_ORDER_ID, orderId)
                putExtra(EXTRA_SERVICE_TYPE, serviceType)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            isInTrip = false
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_ACTIVE_ORDER_ID)
                .apply()
            context.stopService(Intent(context, TripService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        locationKit = LocationKit(this)
        geofenceManager = GeofenceManager(this, "", ConfigService)
        smartWakeLock = SmartWakeLock(this)

        GeofenceEventHandler.setHandler { context, geofenceId, transitionType ->
            Log.i(TAG, "Geofence transition: $geofenceId, type=$transitionType")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_TRIP -> {
                val uid = intent.getStringExtra(EXTRA_UID) ?: return START_STICKY
                val orderId = intent.getStringExtra(EXTRA_ORDER_ID) ?: return START_STICKY
                val serviceType = intent.getStringExtra(EXTRA_SERVICE_TYPE) ?: "transport"

                driverUid = uid
                currentOrderId = orderId

                startForeground(NOTIFICATION_ID, buildNotification(orderId))

                locationPermissionRevoked = ContextCompat.checkSelfPermission(
                    this, Manifest.permission.ACCESS_FINE_LOCATION
                ) != PackageManager.PERMISSION_GRANTED

                initializeTrip(uid, orderId, serviceType)
            }
            ACTION_STOP_TRIP -> {
                cleanupTrip()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE_CONFIG -> {
                updateTripConfig()
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        cleanupTrip()
        super.onDestroy()
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
            flushLocationBuffer()
        }
    }

    private fun initializeTrip(uid: String, orderId: String, serviceType: String = "transport") {
        if (!locationPermissionRevoked) {
            startLocationUpdates()
            fetchAndUploadLastLocation(uid)
        }

        geofenceManager = GeofenceManager(this, uid, ConfigService)

        orderTimeoutManager = OrderTimeoutManager(this, uid, ConfigService.getAcceptTimeoutMs())

        stateMachine = OrderDispatcher.createStateMachine(
            ServiceType.fromString(serviceType), uid, orderId
        )

        diagnostics = BackgroundDiagnostics(this, uid).apply { start() }

        smartWakeLock?.acquireForActiveTrip()

        offlineQueueProcessor = OfflineQueueProcessor(this, uid).apply { onStart() }

        scope.launch {
            while (isActive) {
                delay(ConfigService.getBufferFlushIntervalMs())
                flushLocationBuffer()
            }
        }
    }

    private fun cleanupTrip() {
        locationKit.stopTracking()
        geofenceManager.shutdown()
        orderTimeoutManager?.shutdown()
        offlineQueueProcessor?.onStop()
        diagnostics?.shutdown()
        smartWakeLock?.releaseAll()
        scope.cancel()
        isInTrip = false
    }

    private fun startLocationUpdates() {
        locationKit.startTracking(
            config = LocationConfig(
                priority = LocationPriority.HIGH_ACCURACY,
                intervalMs = currentIntervalMs,
                minIntervalMs = currentMinIntervalMs,
            ),
            onResult = { loc ->
                handleLocationUpdate(loc)
            }
        )
    }

    private fun handleLocationUpdate(loc: LocationData) {
        val uid = driverUid ?: return
        val orderId = currentOrderId

        smoothedSpeed = smoothedSpeed * (1f - SPEED_SMOOTHING) +
            (loc.speed ?: 0f) * SPEED_SMOOTHING

        val pending = PendingLocation(
            uid = uid,
            lat = loc.latitude,
            lng = loc.longitude,
            timestamp = System.currentTimeMillis(),
            orderId = orderId
        )
        synchronized(locationBuffer) {
            locationBuffer.add(pending)
            if (locationBuffer.size > BUFFER_MAX) locationBuffer.removeFirst()
        }

        adjustLocationInterval()
    }

    private fun adjustLocationInterval() {
        val speedKmh = smoothedSpeed * 3.6f
        currentIntervalMs = when {
            speedKmh > 40f -> 5000L
            speedKmh > 20f -> 3000L
            else -> 2000L
        }
        currentMinIntervalMs = currentIntervalMs / 2
        locationKit.updateConfig(
            intervalMs = currentIntervalMs,
            minIntervalMs = currentMinIntervalMs
        )
    }

    private fun fetchAndUploadLastLocation(uid: String) {
        scope.launch {
            val loc = locationKit.getLastLocation()
            if (loc != null) {
                DriverService.updateLocation(uid, loc.latitude, loc.longitude)
            }
        }
    }

    private fun updateTripConfig() {
    }

    private fun flushLocationBuffer() {
        val toFlush = synchronized(locationBuffer) {
            val copy = locationBuffer.toList()
            locationBuffer.clear()
            copy
        }
        if (toFlush.isEmpty()) return
        scope.launch {
            AppDatabase.getInstance(this@TripService).locationDao().insertAll(toFlush)
        }
    }

    private fun buildNotification(orderId: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("orderId", orderId)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("ARO DRIVE")
            .setContentText("Dalam perjalanan — #$orderId")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pendingIntent)
            .build()
    }
}
