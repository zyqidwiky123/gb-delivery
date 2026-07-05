# Implementation Plan: Upgrade ARO Driver Services Architecture

> **Tujuan:** Meningkatkan arsitektur ARO Driver (aro-driver-kotlin) agar setara dengan Grab Driver
> di 5 aspek kritis: Foreground Service, Background Service, Location Service, Notification Service,
> dan Order System.
>
> **Referensi:** Analisis perbandingan dengan Grab Driver v5.338.0 (APK)

---

## Daftar Isi

1. [Arsitektur Target — Overview](#1-arsitektur-target--overview)
2. [Foreground Service — SessionService + TripService](#2-foreground-service--sessionservice--tripservice)
3. [Background Service — WebSocket + Offline Queue + Crash Reporting](#3-background-service--websocket--offline-queue--crash-reporting)
4. [Location Service — LocationKit Abstraction](#4-location-service--locationkit-abstraction)
5. [Notification Service — NotificationEngine + InApp + DeepLink](#5-notification-service--notificationengine--inapp--deeplink)
6. [Order System — Multi-Service Type + Generic State Machine](#6-order-system--multi-service-type--generic-state-machines)
7. [Dependencies & Build Config](#7-dependencies--build-config)
8. [AndroidManifest Changes](#8-androidmanifest-changes)
9. [Prioritas & Timeline](#9-prioritas--timeline)
10. [File Map](#10-file-map)

---

## 1. Arsitektur Target — Overview

### Current (Monolithic)

```
ForegroundService (1 service — all in one)
├── Location tracking (FusedLocationProvider)
├── Order listener (RTDB + Firestore)
├── TripStateMachine
├── GeofenceManager
├── OrderTimeoutManager
├── OfflineQueueProcessor
├── BackgroundDiagnostics
└── SmartWakeLock
```

### Target (Modular)

```
SessionService (foreground)
├── Manages driver session (online/offline)
├── Broadcasts state changes
├── Health monitor → restart services if dead
└── START_STICKY, runs while user is logged in

TripService (foreground)
├── Active ONLY during active order
├── Location tracking (via LocationKit)
├── OrderStateMachine (via OrderDispatcher)
├── Geofence monitoring
├── OrderTimeoutManager
└── SmartWakeLock

AudioService (foreground) — FUTURE
└── Audio recording during trip

WebSocket Persistent Connection
├── Real-time order updates
├── Location streaming
├── Heartbeat ping/pong (30s)
└── Auto-reconnect (exponential backoff)

OfflineQueueProcessor (background)
├── Priority queue (order_actions > locations)
├── Room DB persistence
├── Exponential backoff (max 50 retries)
└── Dead letter queue

CrashReporter (background)
├── Firebase Crashlytics (primary)
├── Local file log (fallback)
└── Diagnostics upload

NotificationEngine
├── PushNotificationProvider (system tray)
├── InAppNotificationManager (bottom sheet)
├── DeepLinkRegistry (screen routing)
└── Multiple channels

LocationKit
├── LocationEngine interface
│   ├── GoogleLocationEngine (GMS)
│   └── AndroidLocationEngine (non-GMS)
├── LocationQualityMonitor
└── AdaptiveLocationStrategy
```

---

## 2. Foreground Service — SessionService + TripService

### 2.1 Masalah Saat Ini

- `ForegroundService` (424 baris) menangani **semua tanggung jawab** — lokasi, order listener,
  geofence, timeout, state machine, offline queue, diagnostics
- Jika service crash, **semua fungsi mati**
- Tidak ada isolasi — satu bug di location callback bisa mengganggu order listener
- `onTrimMemory()` mem-flush buffer lokasi — tidak ideal karena trip state juga terdampak
- `START_STICKY` tanpa health check — sistem bisa auto-restart service dengan state stale

### 2.2 Target

```
SessionService (foreground, :background process)
├── Start saat user login — stop saat logout
├── Notifikasi: "ARO DRIVE — Kamu sedang online"
├── Broadcast events: SESSION_STARTED, SESSION_STOPPED, ONLINE_STATUS_CHANGED
├── Monitor health TripService — restart jika mati di tengah trip
└── Persist UID ke SharedPreferences

TripService (foreground, :background process)
├── Start saat order di-accept — stop saat complete/cancel
├── Notifikasi: "ARO DRIVE — Dalam perjalanan [orderId]"
├── Location tracking via LocationKit (HIGH_ACCURACY)
├── OrderStateMachine (per ServiceType)
├── Geofence monitoring (pickup + dropoff)
└── OrderTimeoutManager

ServiceCoordinator (singleton)
├── Lifecycle coordinator — manage start/stop services
├── Broadcast receiver untuk session state changes
└── Getter untuk current service state
```

### 2.3 File Baru

#### `service/SessionService.kt`

```kotlin
package com.arodriverkotlin.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.arodriverkotlin.MainActivity
import com.arodriverkotlin.R
import com.arodriverkotlin.background.WatchdogWorker

/**
 * SessionService — foreground service yang berjalan selama driver sedang login/online.
 *
 * Bertanggung jawab untuk:
 * 1. Menjaga proses driver tetap hidup
 * 2. Broadcast state perubahan (online/offline)
 * 3. Memonitor TripService dan me-restart jika mati di tengah trip
 * 4. Sebagai entry point untuk restart setelah boot
 *
 * Service ini berjalan di process terpisah (:background) agar tidak terpengaruh
 * jika MainActivity/UI process dihentikan sistem.
 */
class SessionService : Service() {

    companion object {
        const val ACTION_START = "com.arodriverkotlin.START_SESSION"
        const val ACTION_STOP = "com.arodriverkotlin.STOP_SESSION"
        const val EXTRA_UID = "extra_uid"
        const val EXTRA_DRIVER_NAME = "extra_driver_name"

        const val EVENT_SESSION_STATE_CHANGED = "com.arodriverkotlin.SESSION_STATE_CHANGED"
        const val EXTRA_IS_ONLINE = "extra_is_online"
        const val EXTRA_UID_EVENT = "extra_uid"

        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "aro_drive_foreground_service"

        private const val PREFS_NAME = "session_service"
        private const val KEY_UID = "driver_uid"
        private const val KEY_IS_ONLINE = "is_online"

        private const val TAG = "SessionService"

        @Volatile var currentUid: String? = null
            private set
        @Volatile var isOnline: Boolean = false
            private set

        /**
         * Start SessionService. Aman dipanggil dari mana saja.
         */
        fun start(context: Context, uid: String, driverName: String? = null) {
            currentUid = uid
            isOnline = true
            persistState(context, uid, true)

            val intent = Intent(context, SessionService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_UID, uid)
                driverName?.let { putExtra(EXTRA_DRIVER_NAME, it) }
            }
            startForegroundServiceCompat(context, intent)

            WatchdogWorker.schedule(context)
            broadcastState(context, uid, true)
        }

        /**
         * Stop SessionService.
         */
        fun stop(context: Context) {
            isOnline = false
            persistState(context, currentUid ?: "", false)
            WatchdogWorker.cancel(context)

            // Stop TripService jika masih jalan
            TripService.stop(context)

            val intent = Intent(context, SessionService::class.java).apply {
                action = ACTION_STOP
            }
            context.stopService(intent)

            broadcastState(context, currentUid ?: "", false)
            currentUid = null
        }

        /**
         * Restart TripService jika mati saat ada order aktif.
         * Dipanggil oleh WatchdogWorker.
         */
        fun ensureTripServiceRunning(context: Context) {
            val uid = currentUid ?: return
            val prefs = context.getSharedPreferences(TripService.PREFS_NAME, Context.MODE_PRIVATE)
            val activeOrderId = prefs.getString(TripService.KEY_ACTIVE_ORDER_ID, null)
            if (activeOrderId != null) {
                TripService.start(context, uid, activeOrderId)
            }
        }

        private fun startForegroundServiceCompat(context: Context, intent: Intent) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        private fun persistState(context: Context, uid: String, online: Boolean) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_UID, uid)
                .putBoolean(KEY_IS_ONLINE, online)
                .apply()
        }

        private fun broadcastState(context: Context, uid: String, online: Boolean) {
            val intent = Intent(EVENT_SESSION_STATE_CHANGED).apply {
                putExtra(EXTRA_UID_EVENT, uid)
                putExtra(EXTRA_IS_ONLINE, online)
            }
            context.sendBroadcast(intent)
        }

        fun getStoredUid(context: Context): String? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return if (prefs.getBoolean(KEY_IS_ONLINE, false)) {
                prefs.getString(KEY_UID, null)
            } else null
        }
    }

    // ── Lifecycle ──────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        currentUid = getStoredUid(this)
        isOnline = currentUid != null
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val uid = intent.getStringExtra(EXTRA_UID) ?: return START_STICKY
                currentUid = uid
                isOnline = true
                startForeground(NOTIFICATION_ID, buildNotification(uid))
            }
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                // Restart after kill — restore from prefs
                val uid = getStoredUid(this)
                if (uid != null) {
                    currentUid = uid
                    isOnline = true
                    startForeground(NOTIFICATION_ID, buildNotification(uid))
                } else {
                    stopSelf()
                    return START_NOT_STICKY
                }
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        currentUid = null
        isOnline = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    // ── Notification ───────────────────────────────────────────

    private fun buildNotification(uid: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("ARO DRIVE")
            .setContentText("Kamu sedang online — menunggu pesanan...")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pendingIntent)
            .build()
    }
}
```

#### `service/TripService.kt`

```kotlin
package com.arodriverkotlin.service

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.arodriverkotlin.MainActivity
import com.arodriverkotlin.R
import com.arodriverkotlin.background.GeofenceManager
import com.arodriverkotlin.background.OfflineQueueProcessor
import com.arodriverkotlin.background.OrderTimeoutManager
import com.arodriverkotlin.background.SmartWakeLock
import com.arodriverkotlin.background.BackgroundDiagnostics
import com.arodriverkotlin.database.AppDatabase
import com.arodriverkotlin.database.entity.PendingLocation
import com.arodriverkotlin.location.LocationKit
import com.arodriverkotlin.location.LocationResult
import com.arodriverkotlin.models.ServiceType
import com.arodriverkotlin.order.OrderDispatcher
import com.arodriverkotlin.order.OrderStateMachine
import com.arodriverkotlin.util.LocationUtils
import kotlinx.coroutines.*

/**
 * TripService — foreground service khusus untuk order aktif.
 *
 * Service ini HANYA berjalan saat driver sedang dalam order (accepted → completed/cancelled).
 * Tidak ada overlap dengan SessionService — trip dan session adalah tanggung jawab terpisah.
 *
 * Bertanggung jawab untuk:
 * 1. Location tracking intensif (HIGH_ACCURACY) selama trip
 * 2. Geofence monitoring (pickup + dropoff)
 * 3. OrderStateMachine sesuai ServiceType
 * 4. Order timeout management
 * 5. Location buffering & upload
 * 6. SmartWakeLock management (jaga device tetap aktif)
 */
class TripService : Service() {

    // ── Dependencies ───────────────────────────────────────────

    private lateinit var locationKit: LocationKit
    private lateinit var geofenceManager: GeofenceManager
    private var offlineQueueProcessor: OfflineQueueProcessor? = null
    private var orderTimeoutManager: OrderTimeoutManager? = null
    private var stateMachine: OrderStateMachine<*>? = null
    private var diagnostics: BackgroundDiagnostics? = null
    private var smartWakeLock: SmartWakeLock? = null

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var driverUid: String? = null
    private var currentOrderId: String? = null
    private var locationPermissionRevoked = false

    // Adaptive location parameters
    private var currentIntervalMs = 5000L
    private var currentMinIntervalMs = 2000L
    private var smoothedSpeed = 0f
    private val SPEED_SMOOTHING = 0.3f

    // Buffer lokasi — untuk offline queue
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

        fun start(context: Context, uid: String, orderId: String, serviceType: ServiceType = ServiceType.Transport) {
            isInTrip = true
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_ACTIVE_ORDER_ID, orderId)
                .apply()

            val intent = Intent(context, TripService::class.java).apply {
                action = ACTION_START_TRIP
                putExtra(EXTRA_UID, uid)
                putExtra(EXTRA_ORDER_ID, orderId)
                putExtra(EXTRA_SERVICE_TYPE, serviceType.key)
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

    // ── Lifecycle ──────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        locationKit = LocationKit(this)
        geofenceManager = GeofenceManager(this, "", ConfigService)
        smartWakeLock = SmartWakeLock(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_TRIP -> {
                val uid = intent.getStringExtra(EXTRA_UID) ?: return START_STICKY
                val orderId = intent.getStringExtra(EXTRA_ORDER_ID) ?: return START_STICKY
                val serviceTypeKey = intent.getStringExtra(EXTRA_SERVICE_TYPE) ?: "transport"
                val serviceType = ServiceType.fromString(serviceTypeKey)

                driverUid = uid
                currentOrderId = orderId

                startForeground(NOTIFICATION_ID, buildNotification(orderId))

                locationPermissionRevoked = ContextCompat.checkSelfPermission(
                    this, Manifest.permission.ACCESS_FINE_LOCATION
                ) != PackageManager.PERMISSION_GRANTED

                // Initialize subsystems
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
        // Saat UI hidden, flush buffer lokasi
        if (level >= ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
            flushLocationBuffer()
        }
    }

    // ── Initialization ─────────────────────────────────────────

    private fun initializeTrip(uid: String, orderId: String, serviceType: ServiceType) {
        // 1. Location tracking
        if (!locationPermissionRevoked) {
            startLocationUpdates()
            fetchAndUploadLastLocation(uid)
        }

        // 2. Geofence untuk pickup/dropoff
        geofenceManager = GeofenceManager(this, uid, ConfigService)

        // 3. Order state machine (sesuai ServiceType)
        stateMachine = OrderDispatcher.createStateMachine(serviceType, uid, orderId)

        // 4. Timeout manager
        orderTimeoutManager = OrderTimeoutManager(this, uid, ConfigService.getAcceptTimeoutMs())

        // 5. Diagnostics
        diagnostics = BackgroundDiagnostics(this, uid).apply { start() }

        // 6. SmartWakeLock — jaga device aktif
        smartWakeLock?.acquireForActiveTrip()

        // 7. Offline queue processor
        offlineQueueProcessor = OfflineQueueProcessor(this, uid).apply { onStart() }

        // 8. Periodic buffer flush
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

    // ── Location ───────────────────────────────────────────────

    private fun startLocationUpdates() {
        locationKit.startTracking(
            config = LocationKit.LocationConfig(
                priority = LocationKit.Priority.HIGH_ACCURACY,
                intervalMs = currentIntervalMs,
                minIntervalMs = currentMinIntervalMs,
            ),
            onResult = { loc ->
                handleLocationUpdate(loc)
            }
        )
    }

    private fun handleLocationUpdate(loc: LocationResult) {
        val uid = driverUid ?: return
        val orderId = currentOrderId

        // Update smoothed speed
        smoothedSpeed = smoothedSpeed * (1f - SPEED_SMOOTHING) +
            (loc.speed ?: 0f) * SPEED_SMOOTHING

        // Buffer location
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

        // Adaptive interval
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
        // Re-apply interval
        locationKit.updateConfig(
            intervalMs = currentIntervalMs,
            minIntervalMs = currentMinIntervalMs
        )
    }

    private fun fetchAndUploadLastLocation(uid: String) {
        scope.launch {
            val loc = locationKit.getLastLocation()
            if (loc != null) {
                DriverService.updateLocation(uid, loc.lat, loc.lng)
            }
        }
    }

    private fun updateTripConfig() {
        // Apply config changes from Remote Config without restart
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

    // ── Notification ───────────────────────────────────────────

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
```

#### `service/ServiceCoordinator.kt`

```kotlin
package com.arodriverkotlin.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import com.arodriverkotlin.models.ServiceType

/**
 * ServiceCoordinator — mengelola lifecycle SessionService dan TripService.
 *
 * Bertindak sebagai facade/coordinator pattern:
 * - Start/stop services dengan urutan yang benar
 * - Broadcast receiver untuk state changes
 * - Callback untuk event dari service
 */
object ServiceCoordinator {

    private const val TAG = "ServiceCoordinator"

    // Callback interface untuk komponen lain
    var onSessionStateChanged: ((isOnline: Boolean, uid: String?) -> Unit)? = null
    var onTripStateChanged: ((isInTrip: Boolean, orderId: String?) -> Unit)? = null

    private var receiverRegistered = false

    /**
     * Start session — driver login / online.
     */
    fun startSession(context: Context, uid: String, driverName: String? = null) {
        Log.i(TAG, "Starting session for uid=$uid")
        SessionService.start(context, uid, driverName)
        registerReceiver(context)
    }

    /**
     * Stop session — driver logout / offline.
     */
    fun stopSession(context: Context) {
        Log.i(TAG, "Stopping session")
        SessionService.stop(context)
        unregisterReceiver(context)
    }

    /**
     * Start trip — driver accept order.
     */
    fun startTrip(context: Context, uid: String, orderId: String, serviceType: ServiceType = ServiceType.Transport) {
        Log.i(TAG, "Starting trip for order=$orderId type=${serviceType.key}")
        TripService.start(context, uid, orderId, serviceType)
    }

    /**
     * Stop trip — driver complete/cancel order.
     */
    fun stopTrip(context: Context) {
        Log.i(TAG, "Stopping trip")
        TripService.stop(context)
    }

    /**
     * Full stop — session + trip.
     */
    fun stopAll(context: Context) {
        stopTrip(context)
        stopSession(context)
    }

    // ── Internal ───────────────────────────────────────────────

    private val sessionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val uid = intent.getStringExtra(SessionService.EXTRA_UID_EVENT)
            val isOnline = intent.getBooleanExtra(SessionService.EXTRA_IS_ONLINE, false)
            onSessionStateChanged?.invoke(isOnline, uid)
        }
    }

    private fun registerReceiver(context: Context) {
        if (receiverRegistered) return
        context.registerReceiver(
            sessionReceiver,
            IntentFilter(SessionService.EVENT_SESSION_STATE_CHANGED)
        )
        receiverRegistered = true
    }

    private fun unregisterReceiver(context: Context) {
        if (!receiverRegistered) return
        try {
            context.unregisterReceiver(sessionReceiver)
        } catch (_: IllegalArgumentException) {}
        receiverRegistered = false
    }
}
```

### 2.4 File Dimodifikasi

#### `receiver/BootReceiver.kt`

**Perubahan:** Start SessionService, bukan ForegroundService.

```kotlin
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                // Restore session dari SharedPreferences
                val uid = SessionService.getStoredUid(context)
                if (uid != null) {
                    SessionService.start(context, uid)
                    // Cek apakah ada trip aktif
                    SessionService.ensureTripServiceRunning(context)
                }
            }
        }
    }
}
```

#### `background/WatchdogWorker.kt`

**Perubahan:** Monitor kedua service secara independen.

```kotlin
class WatchdogWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val uid = SessionService.getStoredUid(applicationContext) ?: return Result.success()

        // 1. Pastikan SessionService berjalan
        if (!SessionService.isOnline) {
            SessionService.start(applicationContext, uid)
        }

        // 2. Pastikan TripService berjalan jika ada order aktif
        SessionService.ensureTripServiceRunning(applicationContext)

        // 3. Cek health WebSocket (RealTimeSocket)
        // RealTimeSocket.checkAndReconnect()

        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "watchdog_health_check"
        private const val INTERVAL_MINUTES = 15L

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val work = PeriodicWorkRequest.Builder(
                WatchdogWorker::class.java, INTERVAL_MINUTES, TimeUnit.MINUTES
            ).setConstraints(constraints).build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, work)
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
```

#### `service/MessagingService.kt`

**Perubahan:** Ganti `ForegroundService.start()` → `ServiceCoordinator.startSession()`.

```kotlin
class MessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        // Ensure session is alive
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        ServiceCoordinator.startSession(this, uid)

        // Handle FCM (fallback — primary via WebSocket)
        val data = message.data
        if (data["type"] == "NEW_ORDER") {
            val orderId = data["orderId"]
            if (orderId != null) {
                // NotificationEngine akan handle display
                NotificationEngine.handle(this, NotificationModel(
                    id = orderId,
                    type = NotificationType.ORDER,
                    title = data["title"] ?: getString(R.string.incoming_order_title),
                    body = data["body"] ?: getString(R.string.incoming_order_body),
                    deepLink = "order/$orderId",
                    payload = mapOf("orderId" to orderId, "uid" to uid)
                ))
            }
        }
    }
}
```

#### `viewmodel/DriverViewModel.kt`

**Perubahan:** Start/stop via ServiceCoordinator.

```kotlin
fun setOnline(online: Boolean) {
    viewModelScope.launch {
        if (online) {
            DriverService.toggleOnline(uid, false)
            ServiceCoordinator.startSession(getApplication(), uid)
        } else {
            ServiceCoordinator.stopSession(getApplication())
            DriverService.toggleOnline(uid, true)
        }
    }
}
```

---

## 3. Background Service — WebSocket + Offline Queue + Crash Reporting

### 3.1 Masalah Saat Ini

- **Order listener** via RTDB `ChildEventListener` — tidak auto-reconnect jika koneksi putus.
  Firebase SDK memang auto-reconnect, tapi tidak ada notifikasi ke app.
- **Offline queue** sudah baik (Room + retry + backoff), tapi tidak ada **priority queue** —
  action order (accept/reject) seharusnya diproses duluan daripada location update.
- **Crash monitoring** hanya Firebase Crashlytics — tidak ada fallback untuk offline crash.
- Tidak ada **persistent connection monitoring** — tidak tahu apakah koneksi WebSocket/RTDB
  sedang connected atau tidak.

### 3.2 Target

```
RealTimeSocket (WebSocket persistent connection)
├── OkHttp WebSocket wrapper
├── Connect ke Firebase RTDB (atau WebSocket gateway sendiri)
├── Auto-reconnect dengan exponential backoff
│   base=1s, max=30s, jitter=20%
├── Heartbeat ping/pong setiap 30 detik
├── Event: onOrderReceived, onConnected, onDisconnected, onReconnected
└── Fallback ke FCM jika WebSocket gagal

QueuePriority (enum)
├── ORDER_ACTION(0) — accept, reject, cancel (diproses duluan)
├── LOCATION_UPDATE(1) — location buffer flush
└── DIAGNOSTICS(2) — metrics & health data

CrashReporter (multi-layer)
├── Firebase Crashlytics (primary — existing)
├── Sentry / Bugsnag (secondary — optional)
├── Local crash log (File — fallback)
│   └── crash_{timestamp}.log di filesDir/crashes/
└── Upload saat koneksi pulih
```

### 3.3 File Baru

#### `background/RealTimeSocket.kt`

```kotlin
package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlin.math.pow
import kotlin.random.Random

/**
 * RealTimeSocket — persistent WebSocket connection untuk real-time updates.
 *
 * Arsitektur:
 * - Primary: OkHttp WebSocket ke server gateway
 * - Fallback: FCM (via MessagingService)
 * - Auto-reconnect dengan exponential backoff
 * - Heartbeat ping/pong 30 detik
 *
 * Events:
 * - onOrderReceived(orderId) — order baru masuk
 * - onStateChanged(newState) — state driver berubah dari server
 * - onLocationAck(timestamp) — server confirm terima lokasi
 */
class RealTimeSocket(
    private val context: Context,
    private val uid: String
) {
    enum class ConnectionState {
        DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING
    }

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState

    private var retryCount = 0
    private var reconnectJob: Job? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // Callbacks
    var onOrderReceived: ((orderId: String) -> Unit)? = null
    var onConnected: (() -> Unit)? = null
    var onDisconnected: (() -> Unit)? = null
    var onReconnected: (() -> Unit)? = null

    companion object {
        private const val TAG = "RealTimeSocket"
        private const val BASE_RETRY_MS = 1000L
        private const val MAX_RETRY_MS = 30_000L

        // Singleton per uid
        private val instances = mutableMapOf<String, RealTimeSocket>()

        @Synchronized
        fun getInstance(context: Context, uid: String): RealTimeSocket {
            return instances.getOrPut(uid) { RealTimeSocket(context, uid) }
        }

        @Synchronized
        fun removeInstance(uid: String) {
            instances.remove(uid)?.disconnect()
        }
    }

    /**
     * Connect ke server. Jika sudah connect, ignore.
     */
    fun connect() {
        if (_connectionState.value == ConnectionState.CONNECTED ||
            _connectionState.value == ConnectionState.CONNECTING) return

        _connectionState.value = ConnectionState.CONNECTING
        Log.i(TAG, "Connecting for uid=$uid")

        // Implementasi: OkHttp WebSocket
        // connectWebSocket()
        // Fallback: Firebase RTDB streaming
        startRtdbListener()
    }

    /**
     * Disconnect secara manual.
     */
    fun disconnect() {
        reconnectJob?.cancel()
        _connectionState.value = ConnectionState.DISCONNECTED
        retryCount = 0
        stopRtdbListener()
    }

    /**
     * Send location update ke server.
     */
    fun sendLocation(lat: Double, lng: Double) {
        if (_connectionState.value != ConnectionState.CONNECTED) return
        // WebSocket.send(json)
    }

    /**
     * Auto-reconnect dengan exponential backoff.
     */
    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            val delayMs = calculateBackoff()
            Log.w(TAG, "Reconnecting in ${delayMs}ms (attempt ${retryCount + 1})")
            _connectionState.value = ConnectionState.RECONNECTING
            delay(delayMs)
            retryCount++
            connect()
        }
    }

    private fun calculateBackoff(): Long {
        val base = BASE_RETRY_MS * (2.0).pow(retryCount).toLong()
        val jitter = (Random.nextDouble() * 0.2 - 0.1) * base
        return (base + jitter).toLong().coerceIn(BASE_RETRY_MS, MAX_RETRY_MS)
    }

    private fun startRtdbListener() {
        // Firebase RTDB ChildEventListener
        // Sama seperti RealtimeOrderListener yang sudah ada
        Log.i(TAG, "RTDB listener started")
        _connectionState.value = ConnectionState.CONNECTED
        onConnected?.invoke()
        retryCount = 0
    }

    private fun stopRtdbListener() {
        // Cleanup listener
    }

    fun shutdown() {
        disconnect()
        scope.cancel()
    }
}
```

#### `background/QueuePriority.kt`

```kotlin
package com.arodriverkotlin.background

/**
 * Priority untuk queue processing.
 *
 * ORDER_ACTION harus diproses duluan karena terkait langsung dengan
 * acceptance/rejection order yang memiliki batas waktu (timeout).
 * LOCATION bisa ditunda karena buffered.
 * DIAGNOSTICS adalah non-kritis.
 */
enum class QueuePriority(val value: Int) {
    ORDER_ACTION(0),     // Accept, reject, cancel — critical, ada timeout
    LOCATION_UPDATE(1),  // Location buffer — bisa ditunda
    DIAGNOSTICS(2)       // Health metrics — non-kritis
}
```

#### `background/CrashReporter.kt`

```kotlin
package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics
import java.io.File
import java.io.FileWriter
import java.text.SimpleDateFormat
import java.util.*

/**
 * CrashReporter — multi-layer crash reporting system.
 *
 * Layer:
 * 1. Firebase Crashlytics (primary — online)
 * 2. Local file log (fallback — offline)
 * 3. Upload local logs saat koneksi pulih
 */
object CrashReporter {

    private const val TAG = "CrashReporter"
    private const val CRASH_DIR = "crashes"

    private lateinit var crashDir: File
    private var initialized = false

    fun init(context: Context) {
        crashDir = File(context.filesDir, CRASH_DIR)
        if (!crashDir.exists()) crashDir.mkdirs()
        initialized = true

        // Upload pending crash logs
        uploadPendingCrashes(context)
    }

    /**
     * Record exception ke semua layer.
     */
    fun recordException(context: Context, throwable: Throwable, metadata: Map<String, String>? = null) {
        if (!initialized) return

        // Layer 1: Firebase Crashlytics
        try {
            metadata?.forEach { (key, value) ->
                FirebaseCrashlytics.getInstance().setCustomKey(key, value)
            }
            FirebaseCrashlytics.getInstance().recordException(throwable)
        } catch (_: Exception) {}

        // Layer 2: Local file log
        try {
            writeLocalCrashLog(throwable, metadata)
        } catch (_: Exception) {}
    }

    /**
     * Log custom event ke file lokal.
     */
    fun logEvent(context: Context, event: String, data: Map<String, Any>? = null) {
        if (!initialized) return

        try {
            val timestamp = SimpleDateFormat("yyyy-MM-dd_HH:mm:ss", Locale.US)
                .format(Date())
            val logFile = File(crashDir, "events.log")
            val writer = FileWriter(logFile, true)
            writer.append("[$timestamp] $event")
            data?.forEach { (k, v) -> writer.append(" | $k=$v") }
            writer.append("\n")
            writer.close()
        } catch (_: Exception) {}
    }

    // ── Private ────────────────────────────────────────────────

    private fun writeLocalCrashLog(throwable: Throwable, metadata: Map<String, String>?) {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val file = File(crashDir, "crash_$timestamp.log")
        val writer = FileWriter(file)
        writer.append("Timestamp: $timestamp\n")
        writer.append("Exception: ${throwable.javaClass.name}: ${throwable.message}\n")
        metadata?.forEach { (k, v) -> writer.append("$k: $v\n") }
        writer.append("Stacktrace:\n")
        throwable.stackTrace.forEach { writer.append("\tat $it\n") }
        writer.close()
    }

    private fun uploadPendingCrashes(context: Context) {
        val files = crashDir.listFiles { f -> f.name.startsWith("crash_") && f.name.endsWith(".log") }
            ?: return
        // Di upload saat session terhubung
        FirebaseCrashlytics.getInstance().apply {
            files.forEach { file ->
                setCustomKey("local_crash_file", file.name)
                recordException(RuntimeException("Local crash: ${file.readText().take(500)}"))
            }
        }
        // Hapus setelah upload
        files.forEach { it.delete() }
    }
}
```

#### `background/HeartbeatManager.kt`

```kotlin
package com.arodriverkotlin.background

import android.content.Context
import android.util.Log
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ServerValue
import kotlinx.coroutines.*

/**
 * HeartbeatManager — periodic heartbeat ke server untuk menjaga
 * koneksi tetap alive dan memberi tahu server bahwa driver masih aktif.
 *
 * Interval: 60 detik (configurable via Remote Config)
 * Mechanism: Update RTDB drivers/{uid}/lastActive = ServerValue.TIMESTAMP
 */
class HeartbeatManager(
    private val context: Context,
    private val uid: String
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null

    companion object {
        private const val TAG = "HeartbeatManager"
        private const val DEFAULT_INTERVAL_MS = 60_000L
    }

    fun start(intervalMs: Long = DEFAULT_INTERVAL_MS) {
        stop()
        job = scope.launch {
            while (isActive) {
                try {
                    sendHeartbeat()
                } catch (e: Exception) {
                    Log.w(TAG, "Heartbeat failed", e)
                }
                delay(intervalMs)
            }
        }
        Log.i(TAG, "Heartbeat started (interval=${intervalMs}ms)")
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    private suspend fun sendHeartbeat() {
        FirebaseDatabase.getInstance()
            .getReference("drivers/$uid")
            .child("lastActive")
            .setValue(ServerValue.TIMESTAMP)
            .await()
    }

    fun shutdown() {
        stop()
        scope.cancel()
    }
}
```

### 3.4 File Dimodifikasi

#### `background/OfflineQueueProcessor.kt`

**Perubahan:** Tambah prioritas queue, ORDER_ACTION diproses duluan.

```kotlin
class OfflineQueueProcessor(context: Context, uid: String) {

    // ── Method baru: prosesQueue with priority ────────────────

    suspend fun processQueue() {
        SyncCoordinator.syncMutex.withLock {
            Log.i(TAG, "Starting queue processing for $uid")
            
            // Priority 0: Order actions dulu
            syncOrderActions()
            
            // Priority 1: Baru locations
            syncLocations()
            
            // Priority 2: Terakhir diagnostics
            cleanupStaleEntries()
            
            Log.i(TAG, "Queue processing completed for $uid")
        }
    }

    /**
     * Sync order actions — diproses duluan karena ada timeout.
     */
    private suspend fun syncOrderActions() {
        val actions = actionDao.getUnsyncedActionsByPriority(uid, QueuePriority.ORDER_ACTION.value)
        // retry logic sama
    }

    /**
     * Sync locations — bisa ditunda.
     */
    private suspend fun syncLocations() {
        // existing syncLocations logic
    }
}
```

#### `background/BackgroundDiagnostics.kt`

**Perubahan:** Integrasi dengan CrashReporter. Record WebSocket connection events.

```kotlin
class BackgroundDiagnostics(context: Context, uid: String) {

    // ── Record method baru ───────────────────────────────────
    
    fun recordWebSocketState(state: RealTimeSocket.ConnectionState) {
        when (state) {
            RealTimeSocket.ConnectionState.RECONNECTING -> connectionDrops++
            RealTimeSocket.ConnectionState.CONNECTED -> if (connectionDrops > 0) reconnections++
            else -> {}
        }
    }

    fun recordOrderReceived() {
        fcmReceived++  // atau orderReceived via WS
    }

    // ── Upload enhanced ──────────────────────────────────────
    
    private suspend fun uploadDiagnostics() {
        val data = mapOf(
            "uid" to uid,
            "serviceUptimeMs" to uptime,
            "locationFixes" to locationFixes,
            "locationUploads" to locationUploads,
            "locationUploadFailures" to locationUploadFailures,
            "orderActionsQueued" to queuedActions,
            "orderActionsFailed" to failedActions,
            "connectionDrops" to connectionDrops,
            "reconnections" to reconnections,
            "lastKnownState" to TripService.isInTrip.toString(),
            "appVersion" to getAppVersion(),
            "androidVersion" to android.os.Build.VERSION.RELEASE,
            "deviceModel" to android.os.Build.MODEL,
            "timestamp" to FieldValue.serverTimestamp(),
        )
        // Upload ke Firestore collection diagnostics
    }
}
```

---

## 4. Location Service — LocationKit Abstraction

### 4.1 Masalah Saat Ini

- Terikat ke **Google FusedLocationProvider** — tidak jalan di device tanpa Google Play Services
  (Huawei, Amazon Fire, beberapa device China)
- **Tidak ada** GPS quality monitoring — tidak tahu apakah sinyal GPS lemah
- **Tidak ada** mock GPS detection — driver bisa spoof lokasi
- Adaptive interval hanya berdasarkan speed — tidak ada filter accuracy atau distance

### 4.2 Target

```
LocationEngine (interface)
├── requestUpdates(config: LocationConfig, callback: LocationCallback)
├── removeUpdates()
├── suspend fun getLastLocation(): LocationData?
└── val isGooglePlayServicesAvailable: Boolean

GoogleLocationEngine (primary — GMS)
├── FusedLocationProviderClient
├── Priority mapping: HIGH_ACCURACY, BALANCED, LOW_POWER
└── Fallback jika GMS tidak available

AndroidLocationEngine (fallback — non-GMS)
├── LocationManager (GPS_PROVIDER + NETWORK_PROVIDER)
├── Provider switching jika GPS mati
└── Pas untuk device Huawei / China

LocationQualityMonitor
├── avgAccuracy: Float — running average akurasi 10 fix terakhir
├── isWeakGps: Boolean — true jika accuracy > threshold (50m)
├── isMockGps: Boolean — deteksi mock location
├── gpsSignalStatus: enum { NONE, WEAK, GOOD, EXCELLENT }
└── Rekomendasi: turunkan priority jika sinyal lemah

AdaptiveLocationStrategy
├── Input: speed, accuracy, battery level, trip state
├── Output: intervalMs, priority
├── Trip mode: HIGH_ACCURACY, 2-5s interval
├── Idle mode: BALANCED, 30s interval
└── Battery saver: LOW_POWER, 60s interval (jika battery < 20%)

LocationKit (facade)
├── Factory — pilih engine sesuai device
├── Config update runtime
├── Quality monitoring
└── Facade untuk seluruh location system
```

### 4.3 File Baru

#### `location/LocationEngine.kt`

```kotlin
package com.arodriverkotlin.location

/**
 * LocationEngine — interface abstrak untuk location provider.
 *
 * Implementasi:
 * - GoogleLocationEngine (FusedLocationProvider — GMS)
 * - AndroidLocationEngine (LocationManager — non-GMS)
 */
interface LocationEngine {

    /**
     * Start location updates.
     */
    fun requestUpdates(config: LocationConfig, callback: LocationCallback)

    /**
     * Stop location updates.
     */
    fun removeUpdates()

    /**
     * Get last known location (suspend — bisa dari cache).
     */
    suspend fun getLastLocation(): LocationData?

    /**
     * Apakah Google Play Services tersedia.
     */
    val isGooglePlayServicesAvailable: Boolean
}

data class LocationData(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float? = null,
    val speed: Float? = null,
    val bearing: Float? = null,
    val altitude: Double? = null,
    val provider: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

interface LocationCallback {
    fun onLocationResult(result: LocationResult)
    fun onProviderEnabled(provider: String)
    fun onProviderDisabled(provider: String)
}

data class LocationResult(
    val locations: List<LocationData>,
    val lastLocation: LocationData? get() = locations.lastOrNull()
)
```

#### `location/LocationConfig.kt`

```kotlin
package com.arodriverkotlin.location

/**
 * LocationConfig — konfigurasi untuk LocationEngine.
 */
data class LocationConfig(
    val priority: LocationPriority,
    val intervalMs: Long = 5000L,
    val minIntervalMs: Long = 2000L,
    val smallestDisplacementM: Float = 0f,  // 0 = no filter
    val maxWaitTimeMs: Long = intervalMs * 2
)

enum class LocationPriority {
    HIGH_ACCURACY,   // GPS + Network + WiFi — paling akurat, boros baterai
    BALANCED,        // GPS + Network — balance
    LOW_POWER        // Network only — hemat baterai
}
```

#### `location/GoogleLocationEngine.kt`

```kotlin
package com.arodriverkotlin.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * GoogleLocationEngine — implementasi LocationEngine menggunakan
 * Google FusedLocationProviderClient.
 *
 * Primary engine untuk device dengan Google Play Services.
 * Memberikan akurasi terbaik dan hemat baterai.
 */
class GoogleLocationEngine(private val context: Context) : LocationEngine {

    private val fused: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    private var gmsCallback: com.google.android.gms.location.LocationCallback? = null

    override val isGooglePlayServicesAvailable: Boolean
        get() = GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS

    override fun requestUpdates(config: LocationConfig, callback: LocationCallback) {
        if (!hasPermission()) return

        val request = mapToGmsRequest(config)
        val gmsCallback = createGmsCallback(callback)
        this.gmsCallback = gmsCallback

        fused.requestLocationUpdates(request, gmsCallback, Looper.getMainLooper())
    }

    override fun removeUpdates() {
        gmsCallback?.let { fused.removeLocationUpdates(it) }
        gmsCallback = null
    }

    override suspend fun getLastLocation(): LocationData? = suspendCancellableCoroutine { cont ->
        if (!hasPermission()) {
            cont.resume(null)
            return@suspendCancellableCoroutine
        }
        fused.getCurrentLocation(
            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            CancellationTokenSource().token
        ).addOnSuccessListener { loc ->
            cont.resume(loc?.toLocationData())
        }.addOnFailureListener {
            cont.resume(null)
        }
    }

    // ── Private ───────────────────────────────────────────────

    private fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun mapToGmsRequest(config: LocationConfig): LocationRequest {
        val priority = when (config.priority) {
            LocationPriority.HIGH_ACCURACY -> Priority.PRIORITY_HIGH_ACCURACY
            LocationPriority.BALANCED -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
            LocationPriority.LOW_POWER -> Priority.PRIORITY_LOW_POWER
        }
        return LocationRequest.Builder(priority, config.intervalMs)
            .setMinUpdateIntervalMillis(config.minIntervalMs)
            .setSmallestDisplacement(config.smallestDisplacementM)
            .setMaxUpdateDelayMillis(config.maxWaitTimeMs)
            .build()
    }

    private fun createGmsCallback(callback: LocationCallback): com.google.android.gms.location.LocationCallback {
        return object : com.google.android.gms.location.LocationCallback() {
            override fun onLocationResult(result: com.google.android.gms.location.LocationResult) {
                val locations = result.locations?.map { it.toLocationData() } ?: emptyList()
                callback.onLocationResult(LocationResult(locations))
            }
            override fun onProviderEnabled(provider: String) {
                callback.onProviderEnabled(provider)
            }
            override fun onProviderDisabled(provider: String) {
                callback.onProviderDisabled(provider)
            }
        }
    }

    private fun Location.toLocationData() = LocationData(
        latitude = latitude,
        longitude = longitude,
        accuracy = accuracy,
        speed = speed,
        bearing = bearing,
        altitude = altitude,
        provider = provider,
        timestamp = time
    )
}
```

#### `location/AndroidLocationEngine.kt`

```kotlin
package com.arodriverkotlin.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * AndroidLocationEngine — implementasi LocationEngine menggunakan
 * Android native LocationManager.
 *
 * Fallback engine untuk device tanpa Google Play Services (Huawei, Amazon Fire).
 * Kurang akurat dan lebih boros baterai dibanding GoogleLocationEngine.
 */
class AndroidLocationEngine(private val context: Context) : LocationEngine {

    private val locationManager: LocationManager =
        context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    private var activeListener: LocationListener? = null

    override val isGooglePlayServicesAvailable: Boolean = false

    override fun requestUpdates(config: LocationConfig, callback: LocationCallback) {
        if (!hasPermission()) return

        val provider = selectBestProvider()

        val listener = createListener(callback)
        activeListener = listener

        try {
            locationManager.requestLocationUpdates(
                provider,
                config.intervalMs,
                config.smallestDisplacementM,
                listener
            )
        } catch (_: IllegalArgumentException) {
            // Provider not available — try fallback
            val fallback = if (provider == LocationManager.GPS_PROVIDER)
                LocationManager.NETWORK_PROVIDER
            else LocationManager.GPS_PROVIDER
            try {
                locationManager.requestLocationUpdates(
                    fallback,
                    config.intervalMs,
                    config.smallestDisplacementM,
                    listener
                )
            } catch (_: Exception) {}
        }
    }

    override fun removeUpdates() {
        activeListener?.let { locationManager.removeUpdates(it) }
        activeListener = null
    }

    override suspend fun getLastLocation(): LocationData? = suspendCancellableCoroutine { cont ->
        if (!hasPermission()) {
            cont.resume(null)
            return@suspendCancellableCoroutine
        }
        val providers = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        )
        for (provider in providers) {
            try {
                val loc = locationManager.getLastKnownLocation(provider)
                if (loc != null) {
                    cont.resume(loc.toLocationData())
                    return@suspendCancellableCoroutine
                }
            } catch (_: Exception) {}
        }
        cont.resume(null)
    }

    // ── Private ───────────────────────────────────────────────

    private fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Pilih provider terbaik yang tersedia.
     */
    private fun selectBestProvider(): String {
        return if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            LocationManager.GPS_PROVIDER
        } else if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
            LocationManager.NETWORK_PROVIDER
        } else {
            LocationManager.PASSIVE_PROVIDER
        }
    }

    private fun createListener(callback: LocationCallback): LocationListener {
        return object : LocationListener {
            override fun onLocationChanged(location: Location) {
                callback.onLocationResult(
                    LocationResult(listOf(location.toLocationData()))
                )
            }
            override fun onProviderEnabled(provider: String) {
                callback.onProviderEnabled(provider)
            }
            override fun onProviderDisabled(provider: String) {
                callback.onProviderDisabled(provider)
            }
            @Deprecated("Deprecated in API 29")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        }
    }

    private fun Location.toLocationData() = LocationData(
        latitude = latitude,
        longitude = longitude,
        accuracy = accuracy,
        speed = speed,
        bearing = bearing,
        altitude = altitude,
        provider = provider,
        timestamp = time
    )
}
```

#### `location/LocationQualityMonitor.kt`

```kotlin
package com.arodriverkotlin.location

import android.location.Location
import android.os.Build
import android.provider.Settings
import android.content.Context

/**
 * LocationQualityMonitor — memonitor kualitas sinyal GPS.
 *
 * Fungsionalitas:
 * 1. Running average akurasi (10 fix terakhir)
 * 2. Deteksi weak GPS signal
 * 3. Deteksi mock location (spoofing)
 * 4. GPS signal status (NONE/WEAK/GOOD/EXCELLENT)
 */
class LocationQualityMonitor(private val context: Context) {

    enum class GpsSignalStatus {
        NONE,       // Tidak ada sinyal
        WEAK,       // Akurasi > 50m
        GOOD,       // Akurasi 10-50m
        EXCELLENT   // Akurasi < 10m
    }

    companion object {
        private const val ACCURACY_SAMPLE_SIZE = 10
        private const val WEAK_ACCURACY_THRESHOLD = 50f  // meter
        private const val GOOD_ACCURACY_THRESHOLD = 10f   // meter
    }

    // Sliding window akurasi
    private val accuracySamples = mutableListOf<Float>()

    @Volatile var avgAccuracy: Float = 0f
        private set
    @Volatile var isWeakGps: Boolean = false
        private set
    @Volatile var gpsSignalStatus: GpsSignalStatus = GpsSignalStatus.NONE
        private set

    /**
     * Panggil setiap kali ada location update.
     */
    fun onLocationUpdate(location: LocationData) {
        val accuracy = location.accuracy ?: return

        // Update sliding window
        synchronized(accuracySamples) {
            accuracySamples.add(accuracy)
            if (accuracySamples.size > ACCURACY_SAMPLE_SIZE) {
                accuracySamples.removeFirst()
            }
            avgAccuracy = accuracySamples.average().toFloat()
        }

        // Update status
        isWeakGps = avgAccuracy > WEAK_ACCURACY_THRESHOLD
        gpsSignalStatus = when {
            avgAccuracy <= GOOD_ACCURACY_THRESHOLD -> GpsSignalStatus.EXCELLENT
            avgAccuracy <= WEAK_ACCURACY_THRESHOLD -> GpsSignalStatus.GOOD
            else -> GpsSignalStatus.WEAK
        }
    }

    /**
     * Deteksi mock location.
     * Bekerja dengan:
     * 1. Settings.GLOBAL.putInt(ALLOW_MOCK_LOCATION) — API 23+
     * 2. Location.isFromMockProvider() — API 18+
     * 3. Provider name check
     */
    fun isMockLocationEnabled(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.Secure.getInt(
                context.contentResolver,
                Settings.Secure.ALLOW_MOCK_LOCATION, 0
            ) != 0
        }
        return false
    }

    /**
     * Cek apakah location result berasal dari mock provider.
     */
    fun isMockLocation(location: LocationData): Boolean {
        return isMockLocationEnabled()
    }
}
```

#### `location/LocationKit.kt`

```kotlin
package com.arodriverkotlin.location

import android.content.Context
import android.util.Log

/**
 * LocationKit — facade untuk seluruh location system.
 *
 * Factory pattern — memilih engine yang sesuai berdasarkan ketersediaan
 * Google Play Services. Device dengan GMS → GoogleLocationEngine.
 * Device tanpa GMS (Huawei, dll) → AndroidLocationEngine.
 *
 * Fungsi:
 * - startTracking / stopTracking
 * - getLastLocation
 * - updateConfig runtime
 * - GPS quality monitoring
 * - Mock location detection
 */
class LocationKit(context: Context) {

    val engine: LocationEngine
    val qualityMonitor: LocationQualityMonitor

    private var activeCallback: LocationCallback? = null
    private var currentConfig: LocationConfig? = null

    companion object {
        private const val TAG = "LocationKit"
    }

    init {
        qualityMonitor = LocationQualityMonitor(context)
        engine = if (GoogleLocationEngine(context).isGooglePlayServicesAvailable) {
            Log.i(TAG, "Selected engine: GoogleLocationEngine (GMS)")
            GoogleLocationEngine(context)
        } else {
            Log.i(TAG, "Selected engine: AndroidLocationEngine (non-GMS)")
            AndroidLocationEngine(context)
        }
    }

    /**
     * Start location tracking dengan konfigurasi tertentu.
     */
    fun startTracking(config: LocationConfig, onResult: (LocationData) -> Unit) {
        currentConfig = config

        val callback = object : LocationCallback {
            override fun onLocationResult(result: LocationResult) {
                result.locations.forEach { loc ->
                    // Feed ke quality monitor
                    qualityMonitor.onLocationUpdate(loc)
                    onResult(loc)
                }
            }
            override fun onProviderEnabled(provider: String) {
                Log.i(TAG, "Provider enabled: $provider")
            }
            override fun onProviderDisabled(provider: String) {
                Log.w(TAG, "Provider disabled: $provider")
            }
        }
        activeCallback = callback
        engine.requestUpdates(config, callback)
    }

    /**
     * Stop semua location updates.
     */
    fun stopTracking() {
        engine.removeUpdates()
        activeCallback = null
        currentConfig = null
    }

    /**
     * Update konfigurasi runtime tanpa restart.
     */
    fun updateConfig(intervalMs: Long? = null, minIntervalMs: Long? = null, priority: LocationPriority? = null) {
        val oldConfig = currentConfig ?: return
        val newConfig = oldConfig.copy(
            intervalMs = intervalMs ?: oldConfig.intervalMs,
            minIntervalMs = minIntervalMs ?: oldConfig.minIntervalMs,
            priority = priority ?: oldConfig.priority
        )
        // Restart dengan config baru
        val onResult: (LocationData) -> Unit = { /* dummy — akan di-replace */ }
        // Seharusnya menyimpan callback asli
        stopTracking()
        currentConfig = newConfig
    }

    /**
     * Get last known location.
     */
    suspend fun getLastLocation(): LocationData? {
        return engine.getLastLocation()
    }

    /**
     * Apakah mock location diaktifkan di system settings.
     */
    fun isMockLocationEnabled(): Boolean = qualityMonitor.isMockLocationEnabled()

    /**
     * Cek apakah GPS provider enabled.
     */
    fun isGpsEnabled(): Boolean {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as android.location.LocationManager
        return lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)
    }
}
```

### 4.4 File Dimodifikasi

#### `service/LocationService.kt`

**Perubahan:** Delegasi ke LocationKit. Tetap sebagai object sederhana untuk backward compat.

```kotlin
object LocationService {
    fun hasPermission(app: Application): Boolean {
        return ContextCompat.checkSelfPermission(
            app, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    suspend fun getLastKnownLocation(context: Context): LocationData? {
        val kit = LocationKit(context)
        return kit.getLastLocation()
    }

    fun observeLocation(context: Context): Flow<LocationData> = callbackFlow {
        val kit = LocationKit(context)
        kit.startTracking(
            config = LocationConfig(
                priority = LocationPriority.HIGH_ACCURACY,
                intervalMs = 5000L,
                minIntervalMs = 2000L
            ),
            onResult = { trySend(it) }
        )
        awaitClose { kit.stopTracking() }
    }
}
```

#### `util/LocationUtils.kt`

**Perubahan:** Tambah helper functions untuk GPS quality.

```kotlin
object LocationUtils {
    fun calculateDistance(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val results = FloatArray(1)
        Location.distanceBetween(lat1, lng1, lat2, lng2, results)
        return results[0].toDouble()
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
```

---

## 5. Notification Service — NotificationEngine + InApp + DeepLink

### 5.1 Masalah Saat Ini

- **Hanya push notification** — saat app di foreground, notif tetap masuk ke system tray.
  Pengguna tidak melihat notif karena sedang menggunakan app.
- **1 channel** untuk semua notif — tidak bisa bedakan prioritas order vs promo vs system.
- **Deep link** tidak ada — klik notif selalu ke `MainActivity`, tidak bisa langsung ke
  screen yang sesuai (order detail, chat, wallet).
- **Tidak ada sound preferences** per user.

### 5.2 Target

```
NotificationEngine (facade — singleton)
├── handle(notif: NotificationModel)
│   ├── if foreground → InAppNotificationManager.show()
│   └── if background → PushNotificationProvider.show()
├── onNotificationClicked(intent) → DeepLinkRegistry.navigate()

NotificationChannels (register semua channel)
├── aro_drive_orders      → HIGH (incoming orders)
├── aro_drive_chat        → HIGH (messages)
├── aro_drive_promo       → DEFAULT (promotions)
├── aro_drive_system      → LOW (system updates)
├── aro_drive_safety      → HIGH (emergency)
└── aro_drive_foreground  → LOW (background service)

NotificationModel (data class)
├── id: String
├── type: NotificationType (ORDER, CHAT, PROMO, SYSTEM, SAFETY)
├── title, body: String
├── deepLink: String? (contoh: "order/abc123", "wallet")
├── payload: Map<String, String> (data tambahan)
├── priority: Int
└── soundEnabled: Boolean

InAppNotificationManager
├── StateFlow<NotificationModel?>
├── Configurable duration (default 5 detik)
├── Dismiss action
└── Click action → deep link

DeepLinkRegistry
├── Route → Screen mapping
├── order/{id} → OrdersScreen(orderId)
├── wallet → WalletScreen
├── profile → ProfileScreen
└── chat/{id} → ChatScreen(id)

SoundPreferences
├── Data class: soundEnabled, vibrationEnabled, selectedSoundUri
├── Persist di SharedPreferences / Firestore
└── Per-user config
```

### 5.3 File Baru

#### `notification/NotificationChannels.kt`

```kotlin
package com.arodriverkotlin.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.arodriverkotlin.R

/**
 * NotificationChannels — register semua notification channel.
 *
 * Channel List:
 * - orders     → HIGH, sound+vibrate, incoming orders
 * - chat       → HIGH, sound+vibrate, messages
 * - promo      → DEFAULT, no sound, promotions
 * - system     → LOW, no sound, system updates
 * - safety     → HIGH, sound+vibrate, emergency
 * - foreground → LOW, silent, background service
 */
object NotificationChannels {

    const val ORDERS = "aro_drive_orders"
    const val CHAT = "aro_drive_chat"
    const val PROMO = "aro_drive_promo"
    const val SYSTEM = "aro_drive_system"
    const val SAFETY = "aro_drive_safety"
    const val FOREGROUND = "aro_drive_foreground_service"

    fun registerAll(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val nm = context.getSystemService(NotificationManager::class.java)

        nm.createNotificationChannel(
            NotificationChannel(
                ORDERS, "Pesanan Masuk", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifikasi pesanan baru"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 150, 300, 150, 300)
                setSound(customSoundUri(context), notificationAudioAttributes())
                enableLights(true)
            }
        )

        nm.createNotificationChannel(
            NotificationChannel(
                CHAT, "Pesan", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Pesan dari pelanggan"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 200, 100, 200)
                setSound(Settings.System.DEFAULT_NOTIFICATION_URI, notificationAudioAttributes())
                enableLights(true)
            }
        )

        nm.createNotificationChannel(
            NotificationChannel(
                PROMO, "Promo", NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Promo dan informasi"
                setSound(null, null)  // silent
                enableVibration(false)
            }
        )

        nm.createNotificationChannel(
            NotificationChannel(
                SYSTEM, "Sistem", NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Pembaruan sistem"
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
            }
        )

        nm.createNotificationChannel(
            NotificationChannel(
                SAFETY, "Keamanan", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Peringatan keamanan dan darurat"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                setSound(Settings.System.DEFAULT_NOTIFICATION_URI, notificationAudioAttributes())
                enableLights(true)
            }
        )

        nm.createNotificationChannel(
            NotificationChannel(
                FOREGROUND, "ARO DRIVE", NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Layanan latar belakang"
                setShowBadge(false)
                setSound(null, null)
            }
        )
    }

    /** Migrasi channel jika ada perubahan nama/ID */
    fun migrateIfNeeded(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.deleteNotificationChannel("aro_drive_incoming_v7")
        nm.deleteNotificationChannel("aro_drive_incoming_v6")
    }

    private fun customSoundUri(context: Context): Uri =
        Uri.parse("android.resource://${context.packageName}/raw/notifdriver")

    private fun notificationAudioAttributes(): AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
}
```

#### `notification/NotificationModel.kt`

```kotlin
package com.arodriverkotlin.notification

/**
 * NotificationModel — representasi internal notifikasi.
 *
 * Digunakan oleh NotificationEngine untuk dispatch ke provider yang sesuai
 * (in-app vs push). Juga digunakan deep link system.
 */
enum class NotificationType {
    ORDER, CHAT, PROMO, SYSTEM, SAFETY
}

data class NotificationModel(
    val id: String,
    val type: NotificationType,
    val title: String,
    val body: String,
    val deepLink: String? = null,         // "order/abc123" → navigate langsung
    val payload: Map<String, String> = emptyMap(),  // Data tambahan
    val priority: Int = NotificationCompat.PRIORITY_HIGH,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true
)
```

#### `notification/NotificationEngine.kt`

```kotlin
package com.arodriverkotlin.notification

import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * NotificationEngine — facade untuk seluruh sistem notifikasi.
 *
 * Flow:
 * 1. handle(notif) dipanggil dari MessagingService atau RealTimeSocket
 * 2. Cek apakah app di foreground
 * 3. Jika foreground → InAppNotificationManager.show()
 * 4. Jika background → PushNotificationProvider.show()
 * 5. Saat notif diklik → onNotificationClicked(intent) → DeepLinkRegistry.navigate()
 */
object NotificationEngine {

    private const val TAG = "NotificationEngine"

    @Volatile var isAppInForeground: Boolean = false
        set(value) {
            field = value
            Log.d(TAG, "Foreground state: $value")
        }

    private var pushProvider: PushNotificationProvider? = null
    private var inAppManager: InAppNotificationManager? = null

    fun init(context: Context) {
        pushProvider = PushNotificationProvider(context)
        InAppNotificationManager  // lazy init via companion
    }

    /**
     * Entry point untuk semua notifikasi.
     * Dipanggil oleh MessagingService, RealTimeSocket, atau komponen lain.
     */
    fun handle(context: Context, notif: NotificationModel) {
        Log.d(TAG, "Handling notification: type=${notif.type} id=${notif.id}")

        if (isAppInForeground) {
            // Tampilkan in-app (bottom sheet / banner)
            inAppManager?.show(notif)
        } else {
            // Tampilkan push notification
            pushProvider?.show(notif)
        }
    }

    /**
     * Dipanggil saat notifikasi diklik.
     * Parse intent dan arahkan ke screen yang sesuai.
     */
    fun onNotificationClicked(context: Context, intent: Intent) {
        val deepLink = intent.getStringExtra("deepLink") ?: return
        Log.i(TAG, "Navigating to: $deepLink")
        DeepLinkRegistry.navigate(context, deepLink)
    }

    /**
     * In-app notification manager — singleton.
     */
    object InAppNotificationManager {
        private val _currentNotification = kotlinx.coroutines.flow.MutableStateFlow<NotificationModel?>(null)
        val currentNotification: kotlinx.coroutines.flow.StateFlow<NotificationModel?> = _currentNotification

        private var dismissJob: kotlinx.coroutines.Job? = null

        fun show(notif: NotificationModel) {
            _currentNotification.value = notif
            // Auto-dismiss setelah 5 detik
            dismissJob?.cancel()
            dismissJob = kotlinx.coroutines.CoroutineScope(
                kotlinx.coroutines.Dispatchers.Main
            ).launch {
                kotlinx.coroutines.delay(5000)
                dismiss()
            }
        }

        fun dismiss() {
            _currentNotification.value = null
            dismissJob?.cancel()
        }
    }

    /**
     * Push notification provider — menampilkan notif ke system tray.
     */
    class PushNotificationProvider(private val context: Context) {

        fun show(notif: NotificationModel) {
            val channelId = when (notif.type) {
                NotificationType.ORDER -> NotificationChannels.ORDERS
                NotificationType.CHAT -> NotificationChannels.CHAT
                NotificationType.PROMO -> NotificationChannels.PROMO
                NotificationType.SYSTEM -> NotificationChannels.SYSTEM
                NotificationType.SAFETY -> NotificationChannels.SAFETY
            }

            val intent = context.packageManager.getLaunchIntentForPackage(
                context.packageName
            )?.apply {
                putExtra("deepLink", notif.deepLink)
                notif.payload.forEach { (k, v) -> putExtra(k, v) }
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }

            val pendingIntent = android.app.PendingIntent.getActivity(
                context,
                notif.id.hashCode(),
                intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or
                    android.app.PendingIntent.FLAG_IMMUTABLE
            )

            val builder = androidx.core.app.NotificationCompat.Builder(context, channelId)
                .setSmallIcon(com.arodriverkotlin.R.drawable.ic_notification)
                .setContentTitle(notif.title)
                .setContentText(notif.body)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(notif.priority)
                .setCategory(android.app.Notification.CATEGORY_CALL)

            if (notif.deepLink != null) {
                builder.setFullScreenIntent(pendingIntent, true)
            }

            context.getSystemService(android.app.NotificationManager::class.java)
                .notify(notif.id.hashCode(), builder.build())
        }
    }
}
```

#### `notification/DeepLinkRegistry.kt`

```kotlin
package com.arodriverkotlin.notification

import android.content.Context
import android.content.Intent
import com.arodriverkotlin.MainActivity

/**
 * DeepLinkRegistry — mapping deep link → screen.
 *
 * Format deep link: "screen/{param}"
 * Contoh:
 *   "order/abc123"  → MainActivity dengan extra screen=order, orderId=abc123
 *   "wallet"         → MainActivity dengan extra screen=wallet
 *   "profile"        → MainActivity dengan extra screen=profile
 *
 * Semua deep link diarahkan ke MainActivity yang kemudian meneruskan
 * ke composable screen yang sesuai via Navigation.
 */
object DeepLinkRegistry {

    private val TAG = "DeepLinkRegistry"

    /**
     * Parse deep link dan mulai Activity dengan extra yang sesuai.
     */
    fun navigate(context: Context, deepLink: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_NEW_TASK
        }

        val parts = deepLink.split("/", limit = 2)
        when (parts.getOrNull(0)) {
            "order" -> {
                intent.putExtra("navigate_to", "order_detail")
                intent.putExtra("orderId", parts.getOrNull(1) ?: "")
            }
            "chat" -> {
                intent.putExtra("navigate_to", "chat")
                intent.putExtra("chatId", parts.getOrNull(1) ?: "")
            }
            "wallet" -> {
                intent.putExtra("navigate_to", "wallet")
            }
            "profile" -> {
                intent.putExtra("navigate_to", "profile")
            }
            "history" -> {
                intent.putExtra("navigate_to", "history")
            }
            else -> {
                // Default: home
                intent.putExtra("navigate_to", "home")
            }
        }

        context.startActivity(intent)
    }
}
```

#### `ui/components/InAppNotificationBanner.kt`

```kotlin
package com.arodriverkotlin.ui.components

import androidx.compose.animation.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arodriverkotlin.notification.NotificationEngine
import com.arodriverkotlin.notification.NotificationModel
import com.arodriverkotlin.ui.theme.AroGreen

/**
 * InAppNotificationBanner — banner yang muncul di bagian atas layar
 * saat ada notifikasi dan app sedang di foreground.
 *
 * Collect dari NotificationEngine.InAppNotificationManager.currentNotification
 * dan tampilkan sebagai animated banner.
 */
@Composable
fun InAppNotificationBanner() {
    val notif by NotificationEngine.InAppNotificationManager
        .currentNotification
        .collectAsState()
    val context = LocalContext.current

    AnimatedVisibility(
        visible = notif != null,
        enter = slideInVertically(initialOffsetY = { -it }) + fadeIn(),
        exit = slideOutVertically(targetOffsetY = { -it }) + fadeOut()
    ) {
        notif?.let { n ->
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        n.deepLink?.let {
                            NotificationEngine.onNotificationClicked(context, 
                                android.content.Intent().apply {
                                    putExtra("deepLink", it)
                                }
                            )
                        }
                        NotificationEngine.InAppNotificationManager.dismiss()
                    }
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                color = AroGreen.copy(alpha = 0.95f),
                shadowElevation = 8.dp,
                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = n.title,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Text(
                            text = n.body,
                            color = Color.White.copy(alpha = 0.8f),
                            fontSize = 12.sp
                        )
                    }
                    TextButton(onClick = { 
                        NotificationEngine.InAppNotificationManager.dismiss()
                    }) {
                        Text("Tutup", color = Color.White)
                    }
                }
            }
        }
    }
}
```

### 5.4 File Dimodifikasi

#### `AroDriverApplication.kt`

**Perubahan:** Register semua notification channels di `onCreate()`.

```kotlin
class AroDriverApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // ...
        NotificationChannels.registerAll(this)
        NotificationChannels.migrateIfNeeded(this)
        NotificationEngine.init(this)
        
        // Process lifecycle untuk detect foreground/background
        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            // Update NotificationEngine.isAppInForeground
        })
    }
}
```

#### `service/IncomingOrderNotifier.kt`

**Perubahan:** Delegasi ke NotificationEngine. Gunakan channel ORDERS.

```kotlin
object IncomingOrderNotifier {
    // Hapus createChannel() — sudah di handle NotificationChannels
    
    fun show(context: Context, orderId: String, title: String, body: String, uid: String? = null) {
        NotificationEngine.handle(context, NotificationModel(
            id = orderId,
            type = NotificationType.ORDER,
            title = title,
            body = body,
            deepLink = "order/$orderId",
            payload = mapOf("orderId" to orderId, "uid" to uid.orEmpty()),
            priority = NotificationCompat.PRIORITY_HIGH
        ))
    }
}
```

#### `MainActivity.kt`

**Perubahan:** Handle deep link intent dari notifikasi.

```kotlin
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Handle deep link dari notification click
        handleDeepLink(intent)
        
        setContent {
            AroDriverTheme {
                Box(Modifier.fillMaxSize()) {
                    AroDriverApp()
                    
                    // In-app notification banner di atas layar
                    InAppNotificationBanner()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        intent?.getStringExtra("navigate_to")?.let { screen ->
            // Update ViewModel state untuk navigate ke screen yang sesuai
            Log.i("DeepLink", "Navigating to: $screen")
        }
    }
}
```

#### `ui/screens/HomeScreen.kt` / `navigation/DriverShell.kt`

**Perubahan:** Observasi in-app notification state.

```kotlin
fun DriverShell(vm: DriverViewModel, state: UiState, onLogout: () -> Unit) {
    Scaffold(
        bottomBar = { BottomNavigationBar(selectedTab, onTabSelected) }
    ) { padding ->
        Box(Modifier.padding(padding)) {
            // Content
            when (selectedTab) {
                0 -> HomeScreen(vm, state)
                1 -> OrdersScreen(vm, state)
                2 -> WalletScreen(vm, state)
                3 -> ProfileScreen(vm, state, onLogout)
            }
            
            // In-app notification overlay
            InAppNotificationBanner()
        }
    }
}
```

---

## 6. Order System — Multi-Service Type + Generic State Machine

### 6.1 Masalah Saat Ini

- Hanya 1 service type: `"jek"` (hardcoded di `OrderService.completeOrder()`)
- `TripStateMachine` states hardcoded untuk delivery (PICKUP → DROPOFF)
- Tidak ada perbedaan flow untuk food (tunggu masak), express (multi-drop), transport (antar orang)
- Order card UI hanya 1 template — tidak bisa bedain food vs express vs transport

### 6.2 Target

```
ServiceType (sealed class)
├── Transport — antar penumpang
│   └── States: OFFERED → ACCEPTED → ARRIVING → ON_BOARD → EN_ROUTE → DROPPED_OFF → COMPLETED
├── Food — antar makanan
│   └── States: OFFERED → ACCEPTED → ARRIVING → WAITING_FOOD → PICKED_UP → EN_ROUTE → DELIVERED → COMPLETED
├── Express — antar paket (multi-drop)
│   └── States: OFFERED → ACCEPTED → AT_WAREHOUSE → PICKED_UP → EN_ROUTE → DELIVERED → COMPLETED
├── Send — kurir instan
│   └── States: OFFERED → ACCEPTED → AT_PICKUP → PICKED_UP → EN_ROUTE → DELIVERED → COMPLETED
└── Shop — belanja + antar
    └── States: OFFERED → ACCEPTED → AT_MERCHANT → SHOPPING → PICKED_UP → EN_ROUTE → DELIVERED → COMPLETED

OrderStateMachine<S : Enum<S>> (generic)
├── Accept tipe state generic
├── Valid transitions map (hanya state yang valid bisa di-transition)
├── Persist ke Room DB
├── Sync ke Firestore / RTDB
└── Callback onStateChanged per service type

OrderDispatcher
├── Factory — buat state machine sesuai ServiceType
├── Route method calls ke handler yang sesuai
└── Extension point — tambah service type baru tanpa ubah existing code
```

### 6.3 File Baru

#### `models/ServiceType.kt`

```kotlin
package com.arodriverkotlin.models

/**
 * ServiceType — sealed class untuk tipe layanan.
 *
 * Setiap tipe memiliki:
 * - key: String untuk serialisasi (Firestore)
 * - displayName: String untuk UI
 * - validTransitions: Map state → list(state) untuk state machine
 *
 * Menambah tipe baru cukup buat object baru di sini.
 */
sealed class ServiceType(val key: String, val displayName: String) {

    object Transport : ServiceType("transport", "Transport") {
        override val validTransitions: Map<String, List<String>> = mapOf(
            "OFFERED" to listOf("ACCEPTED", "EXPIRED"),
            "ACCEPTED" to listOf("ARRIVING", "CANCELLED"),
            "ARRIVING" to listOf("ON_BOARD", "CANCELLED"),
            "ON_BOARD" to listOf("EN_ROUTE"),
            "EN_ROUTE" to listOf("DROPPED_OFF", "CANCELLED"),
            "DROPPED_OFF" to listOf("COMPLETED"),
            "COMPLETED" to emptyList(),
            "CANCELLED" to emptyList(),
            "EXPIRED" to emptyList(),
        )
    }

    object Food : ServiceType("food", "Food") {
        override val validTransitions: Map<String, List<String>> = mapOf(
            "OFFERED" to listOf("ACCEPTED", "EXPIRED"),
            "ACCEPTED" to listOf("ARRIVING", "CANCELLED"),
            "ARRIVING" to listOf("WAITING_FOOD", "PICKED_UP", "CANCELLED"),
            "WAITING_FOOD" to listOf("PICKED_UP", "CANCELLED"),
            "PICKED_UP" to listOf("EN_ROUTE"),
            "EN_ROUTE" to listOf("DELIVERED", "CANCELLED"),
            "DELIVERED" to listOf("COMPLETED"),
            "COMPLETED" to emptyList(),
            "CANCELLED" to emptyList(),
            "EXPIRED" to emptyList(),
        )
    }

    object Express : ServiceType("express", "Express") {
        override val validTransitions: Map<String, List<String>> = mapOf(
            "OFFERED" to listOf("ACCEPTED", "EXPIRED"),
            "ACCEPTED" to listOf("AT_WAREHOUSE", "CANCELLED"),
            "AT_WAREHOUSE" to listOf("PICKED_UP", "CANCELLED"),
            "PICKED_UP" to listOf("EN_ROUTE"),
            "EN_ROUTE" to listOf("DELIVERED", "CANCELLED"),
            "DELIVERED" to listOf("COMPLETED"),
            "COMPLETED" to emptyList(),
            "CANCELLED" to emptyList(),
            "EXPIRED" to emptyList(),
        )
    }

    object Send : ServiceType("send", "Send") {
        override val validTransitions: Map<String, List<String>> = mapOf(
            "OFFERED" to listOf("ACCEPTED", "EXPIRED"),
            "ACCEPTED" to listOf("AT_PICKUP", "CANCELLED"),
            "AT_PICKUP" to listOf("PICKED_UP", "CANCELLED"),
            "PICKED_UP" to listOf("EN_ROUTE"),
            "EN_ROUTE" to listOf("DELIVERED", "CANCELLED"),
            "DELIVERED" to listOf("COMPLETED"),
            "COMPLETED" to emptyList(),
            "CANCELLED" to emptyList(),
            "EXPIRED" to emptyList(),
        )
    }

    object Shop : ServiceType("shop", "Shop & Deliver") {
        override val validTransitions: Map<String, List<String>> = mapOf(
            "OFFERED" to listOf("ACCEPTED", "EXPIRED"),
            "ACCEPTED" to listOf("AT_MERCHANT", "CANCELLED"),
            "AT_MERCHANT" to listOf("SHOPPING", "CANCELLED"),
            "SHOPPING" to listOf("PICKED_UP", "CANCELLED"),
            "PICKED_UP" to listOf("EN_ROUTE"),
            "EN_ROUTE" to listOf("DELIVERED", "CANCELLED"),
            "DELIVERED" to listOf("COMPLETED"),
            "COMPLETED" to emptyList(),
            "CANCELLED" to emptyList(),
            "EXPIRED" to emptyList(),
        )
    }

    /** Valid transitions untuk state machine — masing-masing subclass override */
    abstract val validTransitions: Map<String, List<String>>

    companion object {
        fun fromString(s: String): ServiceType = when (s) {
            "transport" -> Transport
            "food" -> Food
            "express" -> Express
            "send" -> Send
            "shop" -> Shop
            else -> Transport  // default
        }

        val allTypes: List<ServiceType> = listOf(Transport, Food, Express, Send, Shop)
    }
}
```

#### `order/OrderStateMachine.kt`

```kotlin
package com.arodriverkotlin.order

import android.util.Log
import com.arodriverkotlin.database.AppDatabase
import com.arodriverkotlin.database.entity.TripState
import com.arodriverkotlin.models.ServiceType
import kotlinx.coroutines.*

/**
 * OrderStateMachine — generic state machine untuk order lifecycle.
 *
 * Generic parameter S adalah tipe state (Enum).
 * Valid transitions diambil dari ServiceType.validTransitions.
 *
 * Flow:
 * 1. transitionTo(newState) validasi dari validTransitions
 * 2. Jika valid, update state
 * 3. Persist ke Room DB
 * 4. Sync ke Firestore + RTDB
 * 5. Callback onStateChanged
 */
class OrderStateMachine<S : Enum<S>>(
    private val serviceType: ServiceType,
    private val uid: String,
    private val orderId: String,
    private val stateClass: Class<S>,
    private val onStateChanged: ((newState: S, hasActiveTrip: Boolean) -> Unit)? = null
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val db = AppDatabase.getInstance(
        // Context via parameter atau singleton
        // com.arodriverkotlin.AroDriverApplication.instance
    )

    @Volatile var currentState: S = initialTransitions()
        private set
    @Volatile var currentOrderId: String? = orderId
        private set

    companion object {
        private const val TAG = "OrderStateMachine"
    }

    /**
     * Validasi dan lakukan transisi state.
     */
    suspend fun transitionTo(newState: S): Boolean {
        val newStateName = newState.name
        val currentStateName = currentState.name

        // Validasi transisi
        val allowed = serviceType.validTransitions[currentStateName] ?: emptyList()
        if (newStateName !in allowed) {
            Log.w(TAG, "Invalid transition: $currentStateName → $newStateName for ${serviceType.key}")
            return false
        }

        currentState = newState
        Log.i(TAG, "Transition: $currentStateName → $newStateName")

        // Persist lokal
        persistState()

        // Sync ke server
        syncState()

        // Callback
        val hasActiveTrip = newStateName !in listOf("COMPLETED", "CANCELLED", "EXPIRED")
        onStateChanged?.invoke(newState, hasActiveTrip)

        return true
    }

    /**
     * Cancel order — bisa dari state manapun yang memiliki transisi "CANCELLED".
     */
    suspend fun cancel(): Boolean {
        @Suppress("UNCHECKED_CAST")
        return try {
            val cancelledState = stateClass.enumConstants?.find {
                it.name == "CANCELLED"
            } as? S ?: return false
            transitionTo(cancelledState)
        } catch (e: Exception) {
            Log.w(TAG, "Cancel failed", e)
            false
        }
    }

    // ── Private ───────────────────────────────────────────────

    private fun initialTransitions(): S {
        return stateClass.enumConstants?.find { it.name == "OFFERED" }
            ?: stateClass.enumConstants?.first()
            ?: throw IllegalStateException("No enum constants for ${stateClass.simpleName}")
    }

    private suspend fun persistState() {
        try {
            val tripStateDao = db.tripStateDao()
            val currentVersion = tripStateDao.getState(uid)?.version ?: 0
            val state = TripState(
                uid = uid,
                state = currentState.name,
                orderId = orderId,
                updatedAt = System.currentTimeMillis(),
                version = currentVersion + 1
            )
            tripStateDao.upsert(state)
        } catch (e: Exception) {
            Log.w(TAG, "Persist failed", e)
        }
    }

    private suspend fun syncState() {
        try {
            com.arodriverkotlin.service.DriverService.updateTripState(
                uid, mutableMapOf(
                    "state" to currentState.name,
                    "orderId" to orderId,
                    "serviceType" to serviceType.key,
                    "updatedAt" to System.currentTimeMillis()
                )
            )
        } catch (e: Exception) {
            Log.w(TAG, "Sync failed", e)
        }
    }

    fun shutdown() {
        scope.cancel()
    }
}
```

#### `order/OrderDispatcher.kt`

```kotlin
package com.arodriverkotlin.order

import android.util.Log
import com.arodriverkotlin.models.DriverOrder
import com.arodriverkotlin.models.DriverProfile
import com.arodriverkotlin.models.ServiceType
import com.arodriverkotlin.service.OrderService

/**
 * OrderDispatcher — mendistribusikan method call order ke handler
 * yang sesuai dengan ServiceType.
 *
 * Factory pattern:
 * - createStateMachine(serviceType) → OrderStateMachine yang sesuai
 * - accept/reject/complete → delegasi ke ServiceType-specific handler
 *
 * Extension point: tambah ServiceType baru tanpa mengubah kode existing.
 * Cukup tambah object baru di ServiceType dan handler di sini.
 */
object OrderDispatcher {

    private const val TAG = "OrderDispatcher"

    /**
     * Buat state machine sesuai ServiceType.
     */
    fun createStateMachine(
        serviceType: ServiceType,
        uid: String,
        orderId: String,
        onStateChanged: ((state: Enum<*>, hasActiveTrip: Boolean) -> Unit)? = null
    ): OrderStateMachine<*> {
        val stateClass = when (serviceType) {
            is ServiceType.Transport -> TransportState::class.java
            is ServiceType.Food -> FoodState::class.java
            is ServiceType.Express -> ExpressState::class.java
            is ServiceType.Send -> SendState::class.java
            is ServiceType.Shop -> ShopState::class.java
        }

        @Suppress("UNCHECKED_CAST")
        return OrderStateMachine(
            serviceType = serviceType,
            uid = uid,
            orderId = orderId,
            stateClass = stateClass as Class<Enum<*>>,
            onStateChanged = onStateChanged as? ((Enum<*>, Boolean) -> Unit)
        )
    }

    // ── Handler Delegation ───────────────────────────────────

    suspend fun acceptOrder(order: DriverOrder, uid: String, profile: DriverProfile) {
        val serviceType = ServiceType.fromString(order.serviceType)
        when (serviceType) {
            is ServiceType.Transport -> OrderService.acceptOrder(order.id, uid, profile)
            is ServiceType.Food -> handleFoodAccept(order, uid, profile)
            is ServiceType.Express -> handleExpressAccept(order, uid, profile)
            is ServiceType.Send -> handleSendAccept(order, uid, profile)
            is ServiceType.Shop -> handleShopAccept(order, uid, profile)
        }
    }

    suspend fun completeOrder(
        orderId: String, uid: String, profile: DriverProfile,
        deliveryFee: Long, appServiceFee: Long, subsidizedFee: Long,
        serviceType: String, serviceFee: Long
    ) {
        val type = ServiceType.fromString(serviceType)
        // ServiceFee calculation bisa berbeda per type
        val finalServiceFee = when (type) {
            is ServiceType.Food -> serviceFee + calculateFoodExtraFee(orderId)
            is ServiceType.Shop -> serviceFee + calculateShoppingFee(orderId)
            else -> serviceFee
        }
        OrderService.completeOrder(
            orderId, uid, profile,
            deliveryFee, appServiceFee, subsidizedFee, serviceType, finalServiceFee
        )
    }

    private suspend fun handleFoodAccept(order: DriverOrder, uid: String, profile: DriverProfile) {
        // Food-specific logic: ping merchant, estimated wait time
        OrderService.acceptOrder(order.id, uid, profile)
    }

    private suspend fun handleExpressAccept(order: DriverOrder, uid: String, profile: DriverProfile) {
        // Express-specific logic: warehouse assignment
        OrderService.acceptOrder(order.id, uid, profile)
    }

    private suspend fun handleSendAccept(order: DriverOrder, uid: String, profile: DriverProfile) {
        OrderService.acceptOrder(order.id, uid, profile)
    }

    private suspend fun handleShopAccept(order: DriverOrder, uid: String, profile: DriverProfile) {
        // Shop-specific logic: initial shopping cost
        OrderService.acceptOrder(order.id, uid, profile)
    }

    private suspend fun calculateFoodExtraFee(orderId: String): Long {
        return 0  // TODO: implement food extra fee logic
    }

    private suspend fun calculateShoppingFee(orderId: String): Long {
        return 0  // TODO: implement shopping fee logic
    }
}
```

#### `order/TransportState.kt` (dan state untuk service type lain)

```kotlin
package com.arodriverkotlin.order

/**
 * State enum untuk masing-masing ServiceType.
 * Digunakan sebagai generic parameter OrderStateMachine.
 */

// ── Transport ────────────────────────────────────────────
enum class TransportState {
    OFFERED, ACCEPTED, ARRIVING, ON_BOARD, EN_ROUTE,
    DROPPED_OFF, COMPLETED, CANCELLED, EXPIRED
}

// ── Food ─────────────────────────────────────────────────
enum class FoodState {
    OFFERED, ACCEPTED, ARRIVING, WAITING_FOOD, PICKED_UP,
    EN_ROUTE, DELIVERED, COMPLETED, CANCELLED, EXPIRED
}

// ── Express ──────────────────────────────────────────────
enum class ExpressState {
    OFFERED, ACCEPTED, AT_WAREHOUSE, PICKED_UP, EN_ROUTE,
    DELIVERED, COMPLETED, CANCELLED, EXPIRED
}

// ── Send ─────────────────────────────────────────────────
enum class SendState {
    OFFERED, ACCEPTED, AT_PICKUP, PICKED_UP, EN_ROUTE,
    DELIVERED, COMPLETED, CANCELLED, EXPIRED
}

// ── Shop ─────────────────────────────────────────────────
enum class ShopState {
    OFFERED, ACCEPTED, AT_MERCHANT, SHOPPING, PICKED_UP,
    EN_ROUTE, DELIVERED, COMPLETED, CANCELLED, EXPIRED
}
```

#### `order/handler/TransportHandler.kt`

```kotlin
package com.arodriverkotlin.order.handler

import com.arodriverkotlin.models.DriverOrder
import com.arodriverkotlin.models.DriverProfile
import com.arodriverkotlin.order.TransportState
import com.arodriverkotlin.service.DriverService
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

/**
 * TransportHandler — flow spesifik untuk Transport (antar penumpang).
 */

class TransportHandler {

    suspend fun onPassengerBoarded(orderId: String) {
        // Update order status ke "en_route"
        FirebaseFirestore.getInstance().collection("orders")
            .document(orderId)
            .update("status", "en_route", "pickedUpAt", com.google.firebase.firestore.FieldValue.serverTimestamp())
            .await()
    }

    suspend fun onTripStarted(orderId: String, driverUid: String) {
        // Notify server bahwa perjalanan dimulai
        DriverService.updateTripState(driverUid, mutableMapOf(
            "state" to TransportState.EN_ROUTE.name,
            "orderId" to orderId,
            "updatedAt" to System.currentTimeMillis()
        ))
    }

    suspend fun onTripCompleted(orderId: String, driverUid: String, profile: DriverProfile) {
        // Finalize perjalanan
        // Hitung ongkos, platform fee, dll
    }
}
```

#### `ui/components/OrderCardProvider.kt`

```kotlin
package com.arodriverkotlin.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.arodriverkotlin.models.DriverOrder
import com.arodriverkotlin.models.ServiceType

/**
 * OrderCardProvider — render card yang sesuai dengan ServiceType.
 *
 * Setiap ServiceType punya tampilan card yang berbeda:
 * - Transport: tampilkan pickup → dropoff, jarak, durasi
 * - Food: tampilkan merchant, items, estimasi waktu
 * - Express: tampilkan weight, multi-drop points
 * - Send: tampilkan sender → receiver
 * - Shop: tampilkan shopping list, merchant
 */
@Composable
fun OrderCardProvider(
    order: DriverOrder,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    modifier: Modifier = Modifier
) {
    val serviceType = ServiceType.fromString(order.serviceType)

    when (serviceType) {
        is ServiceType.Transport -> TransportOrderCard(order, onAccept, onReject, modifier)
        is ServiceType.Food -> FoodOrderCard(order, onAccept, onReject, modifier)
        is ServiceType.Express -> ExpressOrderCard(order, onAccept, onReject, modifier)
        is ServiceType.Send -> SendOrderCard(order, onAccept, onReject, modifier)
        is ServiceType.Shop -> ShopOrderCard(order, onAccept, onReject, modifier)
    }
}

@Composable
fun TransportOrderCard(order: DriverOrder, onAccept: () -> Unit, onReject: () -> Unit, modifier: Modifier = Modifier) {
    // Card: pickup address → destination address, estimated fare, distance
    OrderCard(
        order = order,
        title = "${order.pickupAddress} → ${order.destinationAddress}",
        subtitle = "Rp ${order.deliveryFee} · ${order.pickupDistance} km",
        onAccept = onAccept,
        onReject = onReject,
        modifier = modifier
    )
}

@Composable
fun FoodOrderCard(order: DriverOrder, onAccept: () -> Unit, onReject: () -> Unit, modifier: Modifier = Modifier) {
    // Card: merchant name, items list, estimated wait time
    OrderCard(
        order = order,
        title = order.merchantName.ifEmpty { order.pickupAddress },
        subtitle = order.items.joinToString(", ") { it.name },
        onAccept = onAccept,
        onReject = onReject,
        modifier = modifier
    )
}

@Composable
fun ExpressOrderCard(order: DriverOrder, onAccept: () -> Unit, onReject: () -> Unit, modifier: Modifier = Modifier) {
    // Card: warehouse → multiple dropoff points
    OrderCard(
        order = order,
        title = "Express: ${order.pickupAddress}",
        subtitle = "${order.pickups.size} titik pengantaran",
        onAccept = onAccept,
        onReject = onReject,
        modifier = modifier
    )
}

@Composable
fun SendOrderCard(order: DriverOrder, onAccept: () -> Unit, onReject: () -> Unit, modifier: Modifier = Modifier) {
    OrderCard(
        order = order,
        title = "Send: ${order.pickupAddress} → ${order.destinationAddress}",
        subtitle = order.sender?.name?.let { "Dari: $it" } ?: "",
        onAccept = onAccept,
        onReject = onReject,
        modifier = modifier
    )
}

@Composable
fun ShopOrderCard(order: DriverOrder, onAccept: () -> Unit, onReject: () -> Unit, modifier: Modifier = Modifier) {
    OrderCard(
        order = order,
        title = "Belanja di ${order.merchantName}",
        subtitle = "${order.items.size} item · Rp ${order.shoppingCost}",
        onAccept = onAccept,
        onReject = onReject,
        modifier = modifier
    )
}
```

### 6.4 File Dimodifikasi

#### `models/DriverOrder.kt`

**Perubahan:** Tambah field `serviceType` sebagai String (biar gampang deserialisasi dari Firebase).
Gunakan `ServiceType.fromString()` saat akses.

```kotlin
data class DriverOrder(
    val id: String,
    val status: String,
    val serviceType: String = "transport",  // ← TAMBAH: default ke transport
    val total: Long,
    val deliveryFee: Long,
    val shoppingCost: Long = 0,
    val actualShoppingCost: Long = 0,
    val subtotal: Long = 0,
    val platformFee: Long = 0,
    val serviceFee: Long = 0,
    val appServiceFee: Long = 0,
    val pickupFee: Long = 0,
    val pickupDistance: Double = 0.0,
    val subsidizedFee: Long = 0,
    val customerName: String,
    val customerPhone: String = "",
    val customer: CustomerInfo = CustomerInfo(),
    val sender: SenderInfo? = null,
    val receiver: ReceiverInfo? = null,
    val pickupAddress: String,
    val destinationAddress: String,
    val merchantName: String = "",  // ← UNTUK FOOD/SHOP
    val offeredTo: String?,
    val expiresAt: Timestamp?,
    val pickupsDone: Long,
    val pickupCount: Int,
    val pickups: List<PickupPoint> = emptyList(),
    val items: List<OrderItem> = emptyList(),
    val itemsRaw: List<String> = emptyList(),
    val note: String = "",
    val pickupLat: Double? = null,
    val pickupLng: Double? = null,
    val dropLat: Double? = null,
    val dropLng: Double? = null,
    val paymentMethod: String = "TUNAI",
    val voucherUsed: Boolean = false,
    val balanceBefore: Long = 0,
    val balanceAfter: Long = 0,
    val completedAt: Timestamp? = null,
    val acceptedAt: Timestamp? = null,
) {
    /** Type-safe accessor */
    val serviceTypeEnum: ServiceType get() = ServiceType.fromString(serviceType)
}

/** Extension function untuk Firestore DocumentSnapshot → DriverOrder */
fun com.google.firebase.firestore.DocumentSnapshot.toOrder(): DriverOrder {
    return DriverOrder(
        id = id,
        status = getString("status") ?: "searching",
        serviceType = getString("serviceType") ?: "transport",  // ← BACA dari Firestore
        total = getLong("total") ?: 0,
        // ... sisanya sama
    )
}
```

#### `database/entity/TripState.kt`

**Perubahan:** Tambah field `serviceType`.

```kotlin
@Entity(tableName = "trip_states")
data class TripState(
    @PrimaryKey val uid: String,
    val state: String,
    val orderId: String? = null,
    val serviceType: String = "transport",  // ← TAMBAH
    val pickupLat: Double? = null,
    val pickupLng: Double? = null,
    val dropoffLat: Double? = null,
    val dropoffLng: Double? = null,
    val updatedAt: Long = System.currentTimeMillis(),
    val version: Int = 0
)
```

#### `service/OrderService.kt`

**Perubahan:** Delegasi multi-service ke OrderDispatcher. Gunakan `ServiceType` dari order.

```kotlin
object OrderService {

    suspend fun acceptOrder(orderId: String, uid: String, profile: DriverProfile) {
        // Baca order dulu untuk dapat serviceType
        val orderSnap = db.collection("orders").document(orderId).get().await()
        val serviceTypeKey = orderSnap.getString("serviceType") ?: "transport"
        val order = orderSnap.toOrder()
        
        // Delegasi ke dispatcher
        OrderDispatcher.acceptOrder(order, uid, profile)
    }

    suspend fun completeOrder(
        orderId: String, uid: String, profile: DriverProfile,
        deliveryFee: Long, appServiceFee: Long = 0,
        subsidizedFee: Long = 0, serviceType: String = "transport",
        serviceFee: Long = 0
    ) {
        // Delegasi ke dispatcher — hitung fee bisa berbeda per type
        OrderDispatcher.completeOrder(
            orderId, uid, profile,
            deliveryFee, appServiceFee, subsidizedFee,
            serviceType, serviceFee
        )
    }

    // Method lain tetap sama...
}
```

#### `service/DriverService.kt` (minor)

**Perubahan:** Sertakan `serviceType` di trip state update.

```kotlin
suspend fun updateTripState(uid: String, state: MutableMap<String, Any>) {
    // Pastikan state selalu include service type jika ada
    if (!state.containsKey("serviceType")) {
        state["serviceType"] = "transport"
    }
    rtdb.child("drivers/$uid/tripState").updateChildren(state).await()
}
```

#### `ui/components/OrderCard.kt` (existing — minor)

**Perubahan:** Gunakan `OrderCardProvider` di tempat kartu order ditampilkan.

```kotlin
// SEBELUM:
// OrderCard(order, onAccept, onReject)

// SESUDAH:
OrderCardProvider(order, onAccept, onReject)
```

#### `ui/screens/OrdersScreen.kt`

**Perubahan:** Tambah filter / tab per service type.

```kotlin
@Composable
fun OrdersScreen(vm: DriverViewModel, state: UiState) {
    var selectedType by remember { mutableStateOf<String?>(null) }
    
    Column {
        // Tab filter
        ScrollableTabRow(selectedTabIndex = types.indexOf(selectedType)) {
            types.forEach { type ->
                Tab(
                    selected = selectedType == type,
                    onClick = { selectedType = type },
                    text = { Text(type?.let { ServiceType.fromString(it).displayName } ?: "Semua") }
                )
            }
        }
        
        // Order list — filter by type
        val filteredOrders = state.recentOrders.filter {
            selectedType == null || it.serviceType == selectedType
        }
        
        LazyColumn {
            items(filteredOrders) { order ->
                OrderCardProvider(order, vm::acceptOrder, vm::rejectOrder)
            }
        }
    }
}
```

---

## 7. Dependencies — Build Config

### `app/build.gradle` — Tambahan

```gradle
dependencies {
    // Existing...
    implementation 'androidx.work:work-runtime-ktx:2.9.1'         // ✅ sudah ada
    
    // Location — tidak perlu tambahan, semua native
    // implementation 'com.google.android.gms:play-services-location:21.3.0' // ✅ sudah ada
    
    // WebSocket untuk persistent connection (Phase 3)
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    
    // Process lifecycle untuk detect foreground/background
    implementation 'androidx.lifecycle:lifecycle-process:2.8.7'
    
    // Crash reporting — opsional (Phase 3)
    // implementation 'io.sentry:sentry-android:7.14.0'
    
    // Notification — semua native AndroidX, tidak perlu tambahan
    
    // Order — semua native, tidak perlu tambahan
}
```

### `gradle.properties` — Tidak ada perubahan

---

## 8. AndroidManifest — Changes

### `app/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Existing permissions — tambah FOREGROUND_SERVICE_REMOTE_MESSAGING -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />

    <application
        android:name=".AroDriverApplication"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:theme="@style/Theme.AroDriver"
        android:usesCleartextTraffic="true">

        <meta-data
            android:name="com.google.android.geo.API_KEY"
            android:value="@string/maps_api_key" />

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <!-- Deep link intent filter -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="arodriver" android:host="order" />
                <data android:scheme="arodriver" android:host="wallet" />
                <data android:scheme="arodriver" android:host="profile" />
            </intent-filter>
        </activity>

        <!-- ── Receivers ──────────────────────────────────── -->

        <receiver
            android:name=".receiver.BootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>

        <receiver
            android:name=".background.GeofenceBroadcastReceiver"
            android:enabled="true"
            android:exported="false" />

        <receiver
            android:name=".background.OrderTimeoutReceiver"
            android:enabled="true"
            android:exported="false" />

        <receiver
            android:name=".receiver.WatchdogReceiver"
            android:enabled="true"
            android:exported="false" />

        <receiver
            android:name=".service.NotificationActionReceiver"
            android:enabled="true"
            android:exported="false" />

        <receiver
            android:name=".service.NotificationEscalationReceiver"
            android:enabled="true"
            android:exported="false" />

        <!-- ── Services ───────────────────────────────────── -->

        <!-- MessagingService (FCM) — tetap sebagai fallback -->
        <service
            android:name=".service.MessagingService"
            android:exported="false"
            android:process=":background">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <!-- SessionService — foreground, berjalan selama driver online -->
        <service
            android:name=".service.SessionService"
            android:exported="false"
            android:process=":background"
            android:foregroundServiceType="location" />

        <!-- TripService — foreground, berjalan hanya saat ada order aktif -->
        <service
            android:name=".service.TripService"
            android:exported="false"
            android:process=":background"
            android:foregroundServiceType="location|dataSync" />

        <!-- DebugOverlayService — tetap ada -->
        <service
            android:name=".background.DebugOverlayService"
            android:exported="false"
            android:enabled="true" />

    </application>
</manifest>
```

### Perubahan Signifikan di Manifest

| Item | Before | After |
|---|---|---|
| `ForegroundService` | Ada (single) | **Hapus** — diganti SessionService + TripService |
| `SessionService` | — | **Baru** — foregroundType `location` |
| `TripService` | — | **Baru** — foregroundType `location\|dataSync` |
| `Deep link intent-filter` | — | **Baru** — scheme `arodriver` untuk order/wallet/profile |

---

## 9. Prioritas & Timeline

```
Phase 1 — Foundation (Week 1-2)
├── LocationKit (LocationEngine interface + Google + Android impl)
├── SessionService + TripService split
├── ServiceCoordinator
└── Update BootReceiver, WatchdogWorker, MessagingService

Phase 2 — Notification (Week 2-3)
├── NotificationChannels (multi-channel)
├── NotificationEngine + InAppNotificationManager
├── DeepLinkRegistry
├── InAppNotificationBanner (Composable)
└── Update MainActivity & DriverShell

Phase 3 — Background (Week 3-4)
├── RealTimeSocket (WebSocket + RTDB streaming)
├── HeartbeatManager
├── CrashReporter (multi-layer)
├── QueuePriority in OfflineQueueProcessor
└── Enhanced BackgroundDiagnostics

Phase 4 — Order System (Week 4-6)
├── ServiceType sealed class
├── OrderStateMachine generic
├── OrderDispatcher + handlers
├── State enums per service type
├── OrderCardProvider
└── Update OrderService, DriverOrder, TripState
```

### Estimasi Total: 4-6 minggu

| Phase | Waktu | File Baru | File Modify |
|---|---|---|---|
| Phase 1 | 1-2 minggu | 7 | 6 |
| Phase 2 | 1 minggu | 6 | 5 |
| Phase 3 | 1 minggu | 5 | 4 |
| Phase 4 | 1-2 minggu | 10 | 6 |
| **Total** | **4-6 minggu** | **~28** | **~21** |

---

## 10. File Map

### File Baru

```
app/src/main/java/com/arodriverkotlin/
├── location/
│   ├── LocationEngine.kt              // Interface
│   ├── LocationConfig.kt              // Config data class
│   ├── GoogleLocationEngine.kt        // GMS implementation
│   ├── AndroidLocationEngine.kt       // Non-GMS implementation
│   ├── LocationQualityMonitor.kt      // GPS quality + mock detection
│   └── LocationKit.kt                 // Facade / Factory
├── notification/
│   ├── NotificationChannels.kt        // Multi-channel registration
│   ├── NotificationModel.kt           // Data class + type enum
│   ├── NotificationEngine.kt          // Facade + InAppManager + PushProvider
│   ├── DeepLinkRegistry.kt            // Deep link routing
│   └── SoundPreferences.kt            // User sound config (FUTURE)
├── order/
│   ├── OrderStateMachine.kt           // Generic state machine
│   ├── OrderDispatcher.kt             // Service type dispatcher
│   ├── TransportState.kt              // Transport enum states
│   ├── FoodState.kt                   // Food enum states
│   ├── ExpressState.kt                // Express enum states
│   ├── SendState.kt                   // Send enum states
│   ├── ShopState.kt                   // Shop enum states
│   └── handler/
│       ├── TransportHandler.kt
│       ├── FoodHandler.kt
│       ├── ExpressHandler.kt
│       ├── SendHandler.kt
│       └── ShopHandler.kt
├── background/
│   ├── RealTimeSocket.kt              // WebSocket persistent connection
│   ├── CrashReporter.kt               // Multi-layer crash reporting
│   ├── HeartbeatManager.kt            // Periodic heartbeat
│   └── QueuePriority.kt               // Queue priority enum
├── service/
│   ├── SessionService.kt              // NEW: foreground session service
│   ├── TripService.kt                 // NEW: foreground trip service
│   └── ServiceCoordinator.kt          // NEW: lifecycle coordinator
└── ui/components/
    └── InAppNotificationBanner.kt     // NEW: in-app notification composable
    └── OrderCardProvider.kt           // NEW: multi-service card provider
```

### File Dimodifikasi

```
app/src/main/java/com/arodriverkotlin/
├── AroDriverApplication.kt            // + NotificationChannels.registerAll()
├── MainActivity.kt                    // + Deep link handling + InAppNotifBanner
├── service/
│   ├── ForegroundService.kt           // HAPUS — diganti SessionService + TripService
│   ├── LocationService.kt             // Delegasi ke LocationKit
│   ├── MessagingService.kt            // ServiceCoordinator.startSession()
│   ├── IncomingOrderNotifier.kt       // Delegasi ke NotificationEngine
│   ├── OrderService.kt               // OrderDispatcher delegasi
│   └── DriverService.kt              // + serviceType di trip state
├── background/
│   ├── OfflineQueueProcessor.kt       // + priority queue
│   ├── BackgroundDiagnostics.kt       // + WebSocket metrics
│   ├── WatchdogWorker.kt             // Monitor SessionService + TripService
│   └── BootReceiver.kt              // Start SessionService
├── models/
│   ├── ServiceType.kt                // NEW sealed class
│   └── DriverOrder.kt               // + serviceType field
├── database/entity/
│   └── TripState.kt                  // + serviceType field
├── util/
│   └── LocationUtils.kt             // + mock detection, GPS check
├── ui/
│   ├── components/OrderCard.kt       // → OrderCardProvider
│   ├── screens/OrdersScreen.kt      // + Tab filter by type
│   └── navigation/DriverShell.kt    // + InAppNotificationBanner
└── viewmodel/
    └── DriverViewModel.kt          // ServiceCoordinator calls

app/src/main/AndroidManifest.xml        // + SessionService, TripService, deep link
app/build.gradle                        // + okhttp, lifecycle-process
```

---

> **Catatan Implementasi:**
>
> 1. **Mulai dari Phase 1** — LocationKit + SessionService/TripService adalah fondasi.
>    Semua phase lain bergantung pada ini.
>
> 2. **Backward compatibility** — Simpan `ForegroundService.kt` selama transisi
>    (rename jadi `LegacyForegroundService.kt`) sampai semua komponen migrasi.
>
> 3. **Testing** — Setiap phase harus diuji secara independen:
>    - Phase 1: Location tracking jalan, service start/stop, online/offline
>    - Phase 2: Notifikasi in-app muncul saat foreground, deep link navigation
>    - Phase 3: WebSocket reconnect, crash log tersimpan
>    - Phase 4: Order food/express/send flow jalan masing-masing
>
> 4. **Remote Config** — Semua parameter interval, threshold, timeout sebaiknya
>    configurable via Firebase Remote Config (sudah ada di `ConfigService.kt`,
>    tinggal tambah key baru).
>
> ---
>
> ## 11. Backend / Firebase Functions — Changes
>
> ### 11.1 ServiceType Key Alignment
>
> **Masalah:** Plan Android menggunakan key `"transport"`, `"food"`, `"express"`, `"send"`, `"shop"`.
> Namun backend existing menggunakan key berbeda:
>
> | Plan | Backend WA Templates | Backend Pricing Lookup | Android App Existing |
> |---|---|---|---|
> | `transport` | `jek`, `car` | `jek` (default) | `jek`, `ride`, `ojek` |
> | `food` | `food` | `food` | `food`, `makanan` |
> | `express` | — | — | — |
> | `send` | `send` | `send` | `send`, `kirim` |
> | `shop` | `shop` | `shop` | `shop`, `belanja` |
>
> **Perubahan Backend:**
>
> ```js
> // functions/index.js — tambah mapping layer
> const SERVICE_TYPE_ALIAS = {
>   transport: ['jek', 'car', 'ride', 'ojek'],
>   food: ['makanan'],
>   send: ['kirim'],
>   shop: ['belanja'],
> };
>
> function normalizeServiceType(raw) {
>   for (const [canonical, aliases] of Object.entries(SERVICE_TYPE_ALIAS)) {
>     if (canonical === raw || aliases.includes(raw)) return canonical;
>   }
>   return raw; // express, atau type baru langsung pass-through
> }
> ```
>
> **File dimodifikasi:**
> - `functions/index.js` — tambah `normalizeServiceType()`, panggil di `onOrderCreated`, `onOrderUpdate`, `dispatchOrder()`, `rejectOffer`
> - `functions/templates.js` — rename key `jek` → `transport`, `car` → dihapus (merge ke transport)
>
> ### 11.2 WA Template Updates
>
> **`functions/templates.js` — Perubahan:**
>
> ```js
> module.exports = {
>   transport: {
>     name: "ARO TRANSPORT",
>     accepted: (customerName, shortId) => `...`,
>     arriving: (customerName, shortId) => `...`,
>     picked_up: (customerName, shortId) => `...`,
>     completed: (customerName, shortId, data) => `...`
>   },
>   food: { /* existing — ubah name jadi "ARO FOOD" */ },
>   express: {
>     name: "ARO EXPRESS",
>     accepted: (customerName, shortId) => `Halo Kak ${customerName}! 📦\n\nPaket *ARO EXPRESS* kamu (#${shortId}) segera dijemput driver. Mohon siapkan paketnya ya! 🚀`,
>     arriving: (customerName, shortId) => `Kak ${customerName}, Driver *ARO EXPRESS* sudah sampai di lokasi pengirim! 📍📦`,
>     picked_up: (customerName, shortId) => `Paket Kakak (#${shortId}) sudah dibawa driver *ARO EXPRESS* menuju tujuan. 🛵📦`,
>     completed: (customerName, shortId, data) => `Paket (#${shortId}) berhasil diantar! ✅📦`
>   },
>   send: { /* existing — name jadi "ARO SEND" */ },
>   shop: { /* existing — name jadi "ARO SHOP" */ },
> };
> ```
>
> **File dimodifikasi:**
> - `functions/templates.js`
> - `functions/index.js` — update referensi `templates[name]` menjadi `templates[normalizedType]`
>
> ### 11.3 Order Lifecycle per ServiceType
>
> #### `onOrderCreated` — Update
>
> ```js
> exports.onOrderCreated = onDocumentCreated("orders/{orderId}", async (event) => {
>   const order = event.data.data();
>   const serviceType = normalizeServiceType(order.serviceType || "transport");
>
>   switch (serviceType) {
>     case "transport":
>       // Tidak perlu merchant notification
>       break;
>     case "food":
>     case "shop":
>       // Notify merchant via FCM + WA (existing logic)
>       break;
>     case "express":
>     case "send":
>       // Notify sender via WA
>       break;
>   }
>
>   // Init dispatch — sama untuk semua type (radius mungkin berbeda)
>   await dispatchOrder(orderId, order, serviceType);
> });
> ```
>
> #### `onOrderUpdate` — Update State Handling
>
> Tambah handler untuk state baru per service type:
>
> | ServiceType | States Unik | Backend Action |
> |---|---|---|
> | `transport` | `ON_BOARD`, `DROPPED_OFF` | Update driver status, hitung fare |
> | `food` | `WAITING_FOOD` | Start waiting time timer, notif merchant |
> | `express` | `AT_WAREHOUSE` | Validasi warehouse location |
> | `send` | `AT_PICKUP` | Notif sender bahwa driver sudah sampai |
> | `shop` | `AT_MERCHANT`, `SHOPPING` | Kirim daftar belanja ke driver, notif merchant |
>
> **File dimodifikasi:**
> - `functions/index.js` — `onOrderCreated`, `onOrderUpdate`
>
> ### 11.4 Pricing / Commission per ServiceType
>
> **Firestore Schema — `settings/pricing/{serviceType}`:**
>
> ```js
> // Dokumen pricing untuk setiap service type
> {
>   transport: {
>     commissionRate: 0.15,        // 15%
>     pickupFreeRadiusKm: 3,
>     pickupRatePerKm: 2000,
>     maxPickupFee: 15000,
>     baseFare: 7000,
>     pricePerKm: 3500,
>   },
>   food: {
>     commissionRate: 0.20,        // 20%
>     // ... sisanya sama
>   },
>   express: {
>     commissionRate: 0.10,
>     baseFare: 10000,
>     pricePerKg: 2000,
>   },
>   send: {
>     commissionRate: 0.10,
>     // sama seperti express
>   },
>   shop: {
>     commissionRate: 0.15,
>   }
> }
> ```
>
> **Logic di `onOrderUpdate` saat complete:**
>
> ```js
> // Hitung fee berdasarkan serviceType
> const pricing = await getPricing(serviceType);
> let platformFee = Math.round(total * pricing.commissionRate);
>
> if (serviceType === "food") {
>   platformFee += calculateFoodExtraFee(orderId);
> } else if (serviceType === "shop") {
>   platformFee += calculateShoppingFee(orderId);
> }
> ```
>
> **File dimodifikasi:**
> - `functions/index.js` — `onOrderUpdate` completion logic, helper `getPricing()`
>
> ### 11.5 Dispatch System Updates
>
> **Radius & Timeout per ServiceType:**
>
> ```js
> const DISPATCH_CONFIG = {
>   transport: { initRadiusKm: 3, maxRadiusKm: 15, offerTimeoutMs: 60000 },
>   food:     { initRadiusKm: 2, maxRadiusKm: 8,  offerTimeoutMs: 45000 },
>   express:  { initRadiusKm: 4, maxRadiusKm: 20, offerTimeoutMs: 60000 },
>   send:     { initRadiusKm: 3, maxRadiusKm: 15, offerTimeoutMs: 60000 },
>   shop:     { initRadiusKm: 2, maxRadiusKm: 8,  offerTimeoutMs: 60000 },
> };
> ```
>
> **Driver Selection Priority:**
> - Transport: jarak terdekat → idle tertua → rating tertinggi
> - Food: rating tertinggi → jarak terdekat (keutamaan driver berpengalaman)
> - Express/Send: jarak terdekat (kecepatan > rating)
> - Shop: rating tertinggi → jarak terdekat
>
> **File dimodifikasi:**
> - `functions/index.js` — `dispatchOrder()`, `expansionTrigger()`
>
> ### 11.6 FCM Payload Changes
>
> **Tambahan field di setiap FCM payload:**
>
> ```js
> function buildFcmPayload(uid, type, data) {
>   const channelMap = {
>     "NEW_ORDER": "aro_drive_orders",
>     "CHAT_MESSAGE": "aro_drive_chat",
>     "PROMO": "aro_drive_promo",
>     "SYSTEM": "aro_drive_system",
>     "SAFETY": "aro_drive_safety",
>   };
>
>   return {
>     notification: { title, body },
>     data: {
>       ...data,
>       type,
>       channelId: channelMap[type] || "aro_drive_system",
>       deepLink: data.deepLink || "",
>       soundEnabled: String(data.soundEnabled ?? true),
>       vibrationEnabled: String(data.vibrationEnabled ?? true),
>     },
>     android: { priority: "high", notification: { channelId: channelMap[type] || "aro_drive_system" } }
>   };
> }
> ```
>
> **File dimodifikasi:**
> - `functions/index.js` — `sendNotification()`, `sendNotificationToMerchant()`
>
> ### 11.7 Notification Preferences
>
> **Firestore Schema — `drivers/{uid}/notificationPrefs`:**
>
> ```js
> {
>   soundEnabled: true,
>   vibrationEnabled: true,
>   selectedSoundUri: "default",    // atau custom sound
>   quietHoursStart: null,          // "22:00"
>   quietHoursEnd: null,            // "06:00"
>   channelOverrides: {
>     promo: { soundEnabled: false },
>     system: { soundEnabled: false }
>   },
>   updatedAt: Timestamp
> }
> ```
>
> **Driver bisa update via:**
> - `DriverViewModel` → Firestore langsung (existing pattern)
> - Optional: HTTP function `PATCH /notificationPrefs`
>
> **FCM dispatch saat kirim notif:**
>
> ```js
> const prefs = await getDoc(doc(db, "drivers", uid, "notificationPrefs", "default"));
> if (prefs.exists() && prefs.data().quietHours) {
>   // skip or queue jika dalam quiet hours
> }
> ```
>
> **File baru:**
> - Tidak perlu — update via Firestore langsung dari app
>
> ### 11.8 Session & Heartbeat — Backend Updates
>
> #### `syncDriverOnlineStatus` — Update
>
> Saat ini hanya sinkron `isOnline`, `status`, `lastActive` dari RTDB → Firestore.
> **Perubahan:** Tambah sinkron field baru:
>
> ```js
> // Tambah di syncDriverOnlineStatus
> const tripState = event.data.child('tripState').val();
> if (tripState) {
>   const { orderId, state, serviceType } = tripState;
>   syncToFirestore(driverId, { tripState: { orderId, state, serviceType, updatedAt: Date.now() } });
> }
> ```
>
> #### `autoOfflineLongOnlineDrivers` — Update
>
> Saat ini cek `lastActive` > 2 jam. **Perubahan:**
>
> ```js
> // Jika ada tripState aktif (sedang order), jangan auto-offline
> if (driver.tripState && driver.tripState.orderId) {
>   // Driver sedang dalam order — skip auto-offline
>   continue;
> }
> ```
>
> **File dimodifikasi:**
> - `functions/index.js` — `syncDriverOnlineStatus`, `autoOfflineLongOnlineDrivers`
>
> ### 11.9 State Machine Backend Validation
>
> **Validasi state transition di `onOrderUpdate`:**
>
> ```js
> const VALID_TRANSITIONS = {
>   transport: {
>     OFFERED: ['ACCEPTED', 'EXPIRED'],
>     ACCEPTED: ['ARRIVING', 'CANCELLED'],
>     ARRIVING: ['ON_BOARD', 'CANCELLED'],
>     ON_BOARD: ['EN_ROUTE'],
>     EN_ROUTE: ['DROPPED_OFF', 'CANCELLED'],
>     DROPPED_OFF: ['COMPLETED'],
>     COMPLETED: [],
>     CANCELLED: [],
>     EXPIRED: [],
>   },
>   food: {
>     OFFERED: ['ACCEPTED', 'EXPIRED'],
>     ACCEPTED: ['ARRIVING', 'CANCELLED'],
>     ARRIVING: ['WAITING_FOOD', 'PICKED_UP', 'CANCELLED'],
>     WAITING_FOOD: ['PICKED_UP', 'CANCELLED'],
>     PICKED_UP: ['EN_ROUTE'],
>     EN_ROUTE: ['DELIVERED', 'CANCELLED'],
>     DELIVERED: ['COMPLETED'],
>     COMPLETED: [],
>     CANCELLED: [],
>     EXPIRED: [],
>   },
>   express: { /* ... */ },
>   send: { /* ... */ },
>   shop: { /* ... */ },
> };
> ```
>
> ```js
> // onOrderUpdate — validasi transition
> exports.onOrderUpdate = onDocumentUpdated("orders/{orderId}", async (event) => {
>   const before = event.data.before.data();
>   const after = event.data.after.data();
>   const serviceType = normalizeServiceType(after.serviceType || "transport");
>
>   // Validasi state transition
>   if (after.status && after.status !== before.status) {
>     const validNext = VALID_TRANSITIONS[serviceType]?.[before.status] || [];
>     if (!validNext.includes(after.status)) {
>       console.warn(`Invalid transition: ${before.status} → ${after.status} for ${serviceType}`);
>       // Revert atau reject
>       await event.data.after.ref.update({ status: before.status });
>       return;
>     }
>   }
>
>   // ... existing logic
> });
> ```
>
> **File dimodifikasi:**
> - `functions/index.js` — `onOrderUpdate`, tambah `VALID_TRANSITIONS` map
>
> ### 11.10 CrashReporter HTTP Endpoint
>
> **File baru: `functions/index.js` — tambah:**
>
> ```js
> exports.receiveCrashLog = onRequest(
>   { cors: true, secrets: ["CRASH_REPORT_KEY"] },
>   async (req, res) => {
>     if (req.method !== "POST") {
>       res.status(405).send("Method Not Allowed");
>       return;
>     }
>
>     const { uid, crashData, timestamp, appVersion, deviceInfo } = req.body;
>
>     if (!uid || !crashData) {
>       res.status(400).send("Missing required fields");
>       return;
>     }
>
>     // Simpan ke Firestore collection diagnostics
>     await db.collection("diagnostics").add({
>       type: "crash",
>       uid,
>       crashData: crashData.substring(0, 2000),  // batasi ukuran
>       timestamp: timestamp || FieldValue.serverTimestamp(),
>       appVersion,
>       deviceInfo,
>       source: "crash_reporter",
>     });
>
>     res.status(200).json({ success: true });
>   }
> );
> ```
>
> **File baru:**
> - `functions/index.js` — tambah `receiveCrashLog`
>
> ### 11.11 Firestore Schema Changes
>
> **1. Collection `orders` — field baru:**
>
> | Field | Type | Default | Notes |
> |---|---|---|---|
> | `serviceType` | string | `"transport"` | Sudah ada, pastikan terisi |
> | `dispatch.serviceTypeConfig` | map | — | Radius & timeout override per order |
>
> **2. New Collection `diagnostics`:**
>
> ```
> diagnostics/{docId}
> ├── type: "crash" | "location" | "network" | "performance"
> ├── uid: string
> ├── data: string (max 2000 chars)
> ├── deviceInfo: map { androidVersion, deviceModel, appVersion }
> ├── timestamp: Timestamp
> └── source: "crash_reporter" | "background_diagnostics"
> ```
>
> **3. Update `drivers/{uid}` — subcollection `notificationPrefs/default`:**
>
> ```
> drivers/{uid}/notificationPrefs/default
> ├── soundEnabled: boolean
> ├── vibrationEnabled: boolean
> ├── selectedSoundUri: string
> ├── quietHoursStart: string | null
> ├── quietHoursEnd: string | null
> ├── channelOverrides: map
> └── updatedAt: Timestamp
> ```
>
> **4. Collection `settings/pricing/{serviceType}` — dokumen pricing:**
>
> | Field | Type | Notes |
> |---|---|---|
> | `commissionRate` | number | 0.0 - 1.0 |
> | `pickupFreeRadiusKm` | number | Radius gratis jemput |
> | `pickupRatePerKm` | number | Biaya per km setelah free radius |
> | `maxPickupFee` | number | Maksimal biaya jemput |
> | `baseFare` | number | Tarif dasar |
> | `pricePerKm` / `pricePerKg` | number | Tarif per km atau per kg |
>
> ### 11.12 RTDB Schema Changes
>
> **Path `drivers/{uid}/tripState` — field tambahan:**
>
> ```js
> {
>   // Existing
>   state: "ACCEPTED",
>   orderId: "abc123",
>
>   // NEW
>   serviceType: "food",         // ← tambah
>   pickupLat: -8.098,           // ← tambah (migrasi dari TripState entity)
>   pickupLng: 112.164,
>   dropoffLat: -8.100,
>   dropoffLng: 112.170,
>   version: 5,                  // ← tambah (conflict resolution)
> }
> ```
>
> ### 11.13 Firestore Indexes
>
> **Tambah di `firestore.indexes.json`:**
>
> ```json
> {
>   "collectionGroup": "orders",
>   "queryScope": "COLLECTION",
>   "fields": [
>     { "fieldPath": "serviceType", "order": "ASCENDING" },
>     { "fieldPath": "status", "order": "ASCENDING" },
>     { "fieldPath": "createdAt", "order": "DESCENDING" }
>   ]
> },
> {
>   "collectionGroup": "diagnostics",
>   "queryScope": "COLLECTION",
>   "fields": [
>     { "fieldPath": "uid", "order": "ASCENDING" },
>     { "fieldPath": "timestamp", "order": "DESCENDING" }
>   ]
> }
> ```
>
> ### 11.14 Security Rules Updates
>
> **`firestore.rules` — tambah:**
>
> ```js
> match /diagnostics/{docId} {
>   allow read: if request.auth != null;
>   allow create: if request.auth != null;
>   // Tidak perlu update/delete — admin only via console
> }
>
> match /drivers/{driverId}/notificationPrefs/{prefId} {
>   allow read, write: if request.auth != null && request.auth.uid == driverId;
> }
> ```
>
> **`database.rules` — tidak ada perubahan signifikan** (path `drivers/{uid}/tripState` sudah tercakup oleh aturan existing).
>
> ### 11.15 Admin Functions — Updates
>
> **`rejectOffer` — update untuk serviceType-aware:**
>
> ```js
> exports.rejectOffer = onRequest({ cors: true }, async (req, res) => {
>   const { orderId, driverId } = req.body;
>   const order = await getDoc(doc(db, "orders", orderId));
>   const serviceType = normalizeServiceType(order.data()?.serviceType || "transport");
>
>   // Gunakan DISPATCH_CONFIG[serviceType] untuk next offer
>   const config = DISPATCH_CONFIG[serviceType];
>   // ... existing rotation logic
> });
> ```
>
> **File dimodifikasi:**
> - `functions/index.js` — `rejectOffer`
>
> ---
>
> ### 11.16 Backend — File Map
>
> **File Baru:**
> - Tidak ada file baru — semua perubahan di `functions/index.js` dan `functions/templates.js`
>
> **File Dimodifikasi:**
>
> ```
> functions/
> ├── index.js                  // ~15 perubahan: dispatch, order lifecycle, FCM, session, pricing, crash endpoint, WA routing
> └── templates.js              // Rename jek→transport, tambah express, hapus car
> ```
>
> **Firebase Config:**
> ```
> firestore.indexes.json        // + composite index serviceType+status+createdAt, diagnostics index
> firestore.rules               // + diagnostics, notificationPrefs rules
> ```
>
> ### 11.17 Prioritas & Timeline — Backend
>
> | Phase | Backend Changes | Waktu |
> |---|---|---|
> | **Phase 1 (Foundation)** | Session & Heartbeat updates (`syncDriverOnlineStatus`, `autoOfflineLongOnlineDrivers`) | 1 hari |
> | **Phase 2 (Notification)** | FCM payload changes, notif prefs schema, rules update | 1-2 hari |
> | | **Harus selesai SEBELUM Phase 2 Android** | |
> | **Phase 3 (Background)** | CrashReporter endpoint (`receiveCrashLog`), diagnostics schema | 1 hari |
> | **Phase 4 (Order System)** | ServiceType alignment, WA templates, order lifecycle, pricing, dispatch, state machine validation, indexes | 3-5 hari |
> | | **Harus selesai SEBELUM Phase 4 Android** | |
>
> **Estimasi Total Backend: 1 minggu** (dikerjakan paralel dengan Android, tapi Phase 2 & 4 backend harus mendahului Android).
