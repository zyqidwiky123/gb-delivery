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
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.arodriverkotlin.MainActivity
import com.arodriverkotlin.background.BackgroundDiagnostics
import com.arodriverkotlin.background.GeofenceEventHandler
import com.arodriverkotlin.background.GeofenceManager
import com.arodriverkotlin.background.OfflineQueueProcessor
import com.arodriverkotlin.background.OrderTimeoutManager
import com.arodriverkotlin.background.TripStateMachine
import com.arodriverkotlin.background.SmartWakeLock
import com.arodriverkotlin.database.AppDatabase
import com.arodriverkotlin.database.entity.PendingLocation
import com.arodriverkotlin.util.LocationUtils
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class ForegroundService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback

    @Volatile private var lastUploadedLat = 0.0
    @Volatile private var lastUploadedLng = 0.0
    @Volatile private var lastUploadTime = 0L
    @Volatile private var latestSpeed: Float? = null
    private var smoothedSpeed = 0f
    private val speedSmoothingFactor = 0.3f

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var realtimeOrderListener: RealtimeOrderListener? = null
    private var firestoreOrderFallback: ListenerRegistration? = null
    private var offlineQueueProcessor: OfflineQueueProcessor? = null
    private var tripStateMachine: TripStateMachine? = null
    private var geofenceManager: GeofenceManager? = null
    private var orderTimeoutManager: OrderTimeoutManager? = null
    private var diagnostics: BackgroundDiagnostics? = null
    private var smartWakeLock: SmartWakeLock? = null

    private var driverUid: String? = null

    private val locationBuffer = mutableListOf<PendingLocation>()
    private val BUFFER_FLUSH_INTERVAL_MS = ConfigService.getBufferFlushIntervalMs()
    private val BUFFER_MAX_SIZE = ConfigService.getBufferMaxSize()

    // Adaptive location intervals
    private var currentLocationIntervalMs = 5000L
    private var currentMinUpdateIntervalMs = 2000L
    private var currentPriority = Priority.PRIORITY_BALANCED_POWER_ACCURACY

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                try {
                    val loc = result.lastLocation ?: return
                    val uid = driverUid ?: return

                    latestLat = loc.latitude
                    latestLng = loc.longitude
                    latestSpeed = loc.speed
                    smoothedSpeed = smoothedSpeed * (1f - speedSmoothingFactor) + (loc.speed ?: 0f) * speedSmoothingFactor

                    val now = System.currentTimeMillis()
                    val distance = if (lastUploadTime > 0L) {
                        LocationUtils.calculateDistance(lastUploadedLat, lastUploadedLng, loc.latitude, loc.longitude)
                    } else Double.MAX_VALUE

                    val timeSinceLastUpload = now - lastUploadTime
                    val hasActiveOrder = currentOrderId != null

                    val shouldUpload =
                        distance >= ConfigService.getMovementThresholdM() ||
                        (!hasActiveOrder && timeSinceLastUpload >= ConfigService.getIdleHeartbeatMs())

                    bufferLocation(uid, loc.latitude, loc.longitude, currentOrderId)

                    if (shouldUpload) {
                        lastUploadedLat = loc.latitude
                        lastUploadedLng = loc.longitude
                        lastUploadTime = now
                        flushLocationBuffer(uid)
                    }
                } catch (e: SecurityException) {
                    Log.w(TAG, "Location permission revoked during callback", e)
                    locationPermissionRevoked = true
                }
            }
        }

        serviceScope.launch {
            while (isActive) {
                delay(BUFFER_FLUSH_INTERVAL_MS)
                if (driverUid != null && locationBuffer.isNotEmpty()) {
                    flushLocationBuffer(driverUid!!)
                }
            }
        }
    }

    private fun bufferLocation(uid: String, lat: Double, lng: Double, orderId: String?) {
        val location = PendingLocation(
            uid = uid,
            lat = lat,
            lng = lng,
            timestamp = System.currentTimeMillis(),
            orderId = orderId
        )

        synchronized(locationBuffer) {
            locationBuffer.add(location)
            if (locationBuffer.size > BUFFER_MAX_SIZE) {
                locationBuffer.removeFirst()
            }
        }
    }

    private fun flushLocationBuffer(uid: String) {
        val toFlush = synchronized(locationBuffer) {
            val copy = locationBuffer.toList()
            locationBuffer.clear()
            copy
        }

        if (toFlush.isEmpty()) return

        val db = AppDatabase.getInstance(this)
        val locationDao = db.locationDao()
        serviceScope.launch {
            locationDao.insertAll(toFlush)
        }
    }



    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)

val uid = intent?.getStringExtra(EXTRA_UID) ?: storedDriverUid()
        if (uid != null) {
            driverUid = uid
            persistDriverUid(uid)
            locationPermissionRevoked = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
            startLocationUpdates()
            fetchAndUploadLastLocation(uid)
            orderTimeoutManager = OrderTimeoutManager(this, uid, ConfigService.getAcceptTimeoutMs())
            startListeningForOrders(uid)
            geofenceManager = GeofenceManager(this, uid, ConfigService)
            com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance().setCustomKey("last_state", "starting")
            tripStateMachine = TripStateMachine(
                context = this,
                uid = uid,
                orderTimeoutManager = orderTimeoutManager,
                geofenceManager = geofenceManager,
                onTripStateChanged = { hasActiveTrip ->
                    com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance()
                        .setCustomKey("last_state", tripStateMachine?.getCurrentState() ?: "none")
                    if (hasActiveTrip) smartWakeLock?.acquireForActiveTrip()
                    else smartWakeLock?.releaseAll()
                    updateLocationIntervalForTripState(hasActiveTrip)
                }
            ).apply {
                serviceScope.launch { loadPersistedState() }
                updateLocationIntervalForTripState(getCurrentOrderId() != null)
            }
            GeofenceEventHandler.setHandler { ctx, geofenceId, transitionType ->
                tripStateMachine?.handleGeofenceTransition(geofenceId, transitionType)
            }
            diagnostics = BackgroundDiagnostics(this, uid).apply { start() }
            smartWakeLock = SmartWakeLock(this)
            offlineQueueProcessor = OfflineQueueProcessor(this, uid).apply {
                onStart()
            }
        } else {
            Log.w(TAG, "Service dimulai tanpa UID driver; service dihentikan")
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        when (level) {
            ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN -> {
                val uid = driverUid
                if (uid != null) {
                    flushLocationBuffer(uid)
                }
                synchronized(locationBuffer) {
                    if (locationBuffer.size > 20) {
                        locationBuffer.clear()
                    }
                }
            }
            ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW,
            ComponentCallbacks2.TRIM_MEMORY_BACKGROUND -> {
                Log.d(TAG, "TRIM_MEMORY_RUNNING_LOW/BACKGROUND - pausing passive listeners")
            }
            ComponentCallbacks2.TRIM_MEMORY_COMPLETE -> {
                Log.w(TAG, "TRIM_MEMORY_COMPLETE - process near death")
            }
        }
    }

    override fun onDestroy() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        realtimeOrderListener?.stopListening()
        firestoreOrderFallback?.remove()
        GeofenceEventHandler.setHandler(null)
        geofenceManager?.shutdown()
        tripStateMachine?.shutdown()
        orderTimeoutManager?.shutdown()
        offlineQueueProcessor?.onStop()
        smartWakeLock?.releaseAll()
        serviceScope.cancel()
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(currentPriority, currentLocationIntervalMs)
            .setMinUpdateIntervalMillis(currentMinUpdateIntervalMs)
            .build()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            locationPermissionRevoked = false
            try {
                fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
            } catch (e: Exception) {
                Log.w(TAG, "Gagal request location updates", e)
            }
        } else {
            locationPermissionRevoked = true
        }
    }

    private fun fetchAndUploadLastLocation(uid: String) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return
        try {
            fusedLocationClient.getCurrentLocation(currentPriority, CancellationTokenSource().token)
                .addOnSuccessListener { loc ->
                    if (loc != null) {
                        latestLat = loc.latitude
                        latestLng = loc.longitude
                        latestSpeed = loc.speed
                        serviceScope.launch {
                            DriverService.updateLocation(uid, loc.latitude, loc.longitude)
                        }
                    }
                }
        } catch (e: Exception) {
            Log.w(TAG, "Gagal fetch last location", e)
        }
    }

    fun updateLocationIntervalForTripState(hasActiveTrip: Boolean) {
        if (hasActiveTrip) {
            val speed = smoothedSpeed * 3.6f
            currentLocationIntervalMs = when {
                speed > 40f -> 5000L
                speed > 20f -> 3000L
                else -> 2000L
            }
            currentMinUpdateIntervalMs = currentLocationIntervalMs / 2
            currentPriority = Priority.PRIORITY_HIGH_ACCURACY
        } else if (driverUid != null) {
            currentLocationIntervalMs = ConfigService.getLocationIntervalIdleMs()
            currentMinUpdateIntervalMs = ConfigService.getLocationMinIntervalIdleMs()
            currentPriority = Priority.PRIORITY_BALANCED_POWER_ACCURACY
        } else {
            currentLocationIntervalMs = ConfigService.getLocationIntervalOfflineMs()
            currentMinUpdateIntervalMs = ConfigService.getLocationIntervalOfflineMs()
            currentPriority = Priority.PRIORITY_LOW_POWER
        }

        fusedLocationClient.removeLocationUpdates(locationCallback)
        startLocationUpdates()
    }

    private fun startListeningForOrders(uid: String) {
        if (realtimeOrderListener != null) return
        realtimeOrderListener = RealtimeOrderListener(uid) { orderId ->
            smartWakeLock?.acquireForIncomingOrder()
            IncomingOrderNotifier.show(
                context = this@ForegroundService,
                orderId = orderId,
                title = getString(com.arodriverkotlin.R.string.incoming_order_title),
                body = getString(com.arodriverkotlin.R.string.incoming_order_body),
                uid = uid,
            )
            orderTimeoutManager?.startAcceptanceTimeout(orderId, ConfigService.getAcceptTimeoutMs())
        }
        realtimeOrderListener?.startListening()
        startFirestoreOrderFallback(uid)
    }

    private fun startFirestoreOrderFallback(uid: String) {
        firestoreOrderFallback?.remove()
        firestoreOrderFallback = FirebaseFirestore.getInstance().collection("orders")
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
                        val orderId = change.document.id
                        smartWakeLock?.acquireForIncomingOrder()
                        IncomingOrderNotifier.show(
                            context = this@ForegroundService,
                            orderId = orderId,
                            title = getString(com.arodriverkotlin.R.string.incoming_order_title),
                            body = getString(com.arodriverkotlin.R.string.incoming_order_body),
                            uid = uid,
                        )
                        orderTimeoutManager?.startAcceptanceTimeout(orderId, ConfigService.getAcceptTimeoutMs())
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
            .setSmallIcon(com.arodriverkotlin.R.drawable.ic_notification)
            .setContentTitle("ARO DRIVE")
            .setContentText("Menjalankan layanan latar belakang...")
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setSilent(true)
            .build()
    }

    companion object {
        @Volatile
    var currentOrderId: String? = null
    @Volatile
    var locationPermissionRevoked = false
        @Volatile var latestLat: Double? = null
        @Volatile var latestLng: Double? = null

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
            com.arodriverkotlin.background.WatchdogWorker.schedule(ctx)
        }

        fun stop(ctx: Context) {
            ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(STORED_DRIVER_UID)
                .apply()
            com.arodriverkotlin.background.WatchdogWorker.cancel(ctx)
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