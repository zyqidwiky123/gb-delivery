# IMPLEMENTASI LENGKAP — ARO DRIVE DRIVER

## Prasyarat

### 1. Tambahkan dependensi di `app/build.gradle`

```groovy
dependencies {
    // ... existing ...

    implementation 'com.google.firebase:firebase-config'
    implementation 'com.google.firebase:firebase-crashlytics'
    implementation 'com.google.firebase:firebase-analytics'
    implementation 'com.google.firebase:firebase-performance'
    implementation 'androidx.work:work-runtime-ktx:2.9.1'
}
```

### 2. Plugin Crashlytics

**Root `build.gradle`**:
```groovy
plugins {
    // ...
    id 'com.google.firebase.crashlytics' version '2.9.9' apply false
}
```

**`app/build.gradle`**:
```groovy
plugins {
    // ...
    id 'com.google.firebase.crashlytics'
}
```

---

## FASE 1 — Security & Configuration (`ConfigService.kt`)

### 1.1 Buat `service/ConfigService.kt`

**Lokasi:** `app/src/main/java/com/arodriverkotlin/service/ConfigService.kt`

**Isi:**
- Singleton object `ConfigService`
- `private val remoteConfig = FirebaseRemoteConfig.getInstance()`
- `init`:
  ```kotlin
  val configSettings = FirebaseRemoteConfigSettings.Builder()
      .setMinimumFetchIntervalInSeconds(300)
      .build()
  remoteConfig.setConfigSettingsAsync(configSettings)
  remoteConfig.setDefaultsAsync(R.xml.remote_config_defaults)
  ```
- Buat `res/xml/remote_config_defaults.xml`:
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <defaultsMap>
      <entry>
          <key>maps_api_key</key>
          <value></value>
      </entry>
      <entry>
          <key>accept_timeout_seconds</key>
          <value>20</value>
      </entry>
      <entry>
          <key>geofence_radius_meters</key>
          <value>100</value>
      </entry>
  </defaultsMap>
  ```
- `suspend fun fetchAndActivate()`: `remoteConfig.fetchAndActivate().await()`
- Getter methods: `getMapsApiKey()`, `getAcceptTimeoutMs()`, `getGeofenceRadiusMeters()`, `getLocationIntervalActiveMs()`, `getLocationIntervalIdleMs()`, `getLocationIntervalOfflineMs()`, `getString(key)`, `getLong(key)`

### 1.2 Update `AroDriverApplication.kt`

```kotlin
class AroDriverApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        CoroutineScope(Dispatchers.IO).launch {
            ConfigService.fetchAndActivate()
        }
    }
}
```

### 1.3 Update `AndroidManifest.xml` — Hapus baris 23-25

```xml
<!-- HAPUS 3 baris ini -->
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="AIzaSyDHfsq6wdr5_iQdKfDjIer2TVdQyQPLAJE" />
```

### 1.4 Update `HomeScreen.kt` baris 128-129

**Before:**
```kotlin
val ai = ctx.packageManager.getApplicationInfo(ctx.packageName, PackageManager.GET_META_DATA)
val apiKey = ai.metaData.getString("com.google.android.geo.API_KEY") ?: ""
```

**After:**
```kotlin
val apiKey = ConfigService.getMapsApiKey()
```

### 1.5 Update `ForegroundService.kt` — ConfigService wiring

- Import `ConfigService`
- `startListeningForOrders()` baris 296: ganti `45` dengan `ConfigService.getAcceptTimeoutMs()`:
  ```kotlin
  orderTimeoutManager?.startAcceptanceTimeout(orderId, ConfigService.getAcceptTimeoutMs())
  ```
- `updateLocationIntervalForTripState()`: ganti semua interval hardcoded dengan ConfigService
- `onStartCommand()` — pass `ConfigService` ke `GeofenceManager`

### 1.6 Update `GeofenceManager.kt`

- Constructor: tambah `private val configService: ConfigService`
- `addPickupGeofence()` / `addDropoffGeofence()`: radius = `configService.getGeofenceRadiusMeters().toFloat()`
- Update instantiation di `ForegroundService`:
  ```kotlin
  geofenceManager = GeofenceManager(this, uid, ConfigService)
  ```

### 1.7 Update `OrderTimeoutManager.kt`

- Constructor: tambah `acceptTimeoutMs: Long` parameter
- `startAcceptanceTimeout()`: gunakan parameter, bukan hardcoded 45s
- Hapus `companion object { ACCEPTANCE_TIMEOUT_MS = 45000L }`

### 1.8 Add Mutex guard di `TripStateMachine.kt`

```kotlin
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

private val mutex = Mutex()

// Setiap method transition:
suspend fun transitionToOffered(...) = mutex.withLock {
    // existing body
}

suspend fun transitionToAccepted() = mutex.withLock { ... }
suspend fun transitionToArriving() = mutex.withLock { ... }
suspend fun transitionToAtPickup() = mutex.withLock { ... }
suspend fun transitionToPickedUp() = mutex.withLock { ... }
suspend fun transitionToEnRoute() = mutex.withLock { ... }
suspend fun transitionToAtDropoff() = mutex.withLock { ... }
suspend fun transitionToCompleted() = mutex.withLock { ... }
suspend fun transitionToCancelled() = mutex.withLock { ... }
```

### 1.9 Version-based conflict resolution

**`TripState.kt`**: Pastikan ada `version: Int = 0`

**`TripStateMachine.kt`**:
```kotlin
private suspend fun awaitUpdateState() {
    val currentVersion = tripStateDao.getState(uid)?.version ?: 0
    val state = TripState(
        // ... existing fields
        version = currentVersion + 1
    )
    tripStateDao.upsert(state)
    syncToRtdb(state)
}
```

**`loadPersistedState()`**: Server = source of truth:
```kotlin
suspend fun loadPersistedState() {
    val localState = tripStateDao.getState(uid)
    var rtdbState: TripState? = null
    try {
        val snap = rtdbRef.child("drivers/$uid/tripState").get().await()
        if (snap.exists()) {
            rtdbState = TripState(
                uid = uid,
                state = snap.child("state").getValue(String::class.java) ?: STATE_IDLE,
                orderId = snap.child("orderId").getValue(String::class.java),
                pickupLat = snap.child("pickupLat").getValue(Double::class.java),
                pickupLng = snap.child("pickupLng").getValue(Double::class.java),
                dropoffLat = snap.child("dropoffLat").getValue(Double::class.java),
                dropoffLng = snap.child("dropoffLng").getValue(Double::class.java),
                updatedAt = snap.child("updatedAt").getValue(Long::class.java) ?: 0L,
                version = snap.child("version").getValue(Int::class.java) ?: 0
            )
        }
    } catch (_: Exception) {}

    val stateToUse = when {
        rtdbState != null && localState != null && rtdbState.version > localState.version -> rtdbState
        rtdbState != null && localState == null -> rtdbState
        localState != null -> localState
        else -> return
    }
    applyState(stateToUse)
}

private fun applyState(state: TripState) {
    currentState = state.state
    currentOrderId = state.orderId
    pickupLat = state.pickupLat
    pickupLng = state.pickupLng
    dropoffLat = state.dropoffLat
    dropoffLng = state.dropoffLng
    if (currentState != STATE_IDLE && currentOrderId != null) {
        tripStateDao.upsert(state)
    }
}
```

---

## FASE 2 — Verification & Geofence Override

### 2.1 Buat `service/VerificationService.kt`

**Lokasi:** `app/src/main/java/com/arodriverkotlin/service/VerificationService.kt`

```kotlin
package com.arodriverkotlin.service

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import kotlinx.coroutines.tasks.await

object VerificationService {
    private const val PIN_LENGTH = 4
    private const val PIN_EXPIRY_MINUTES = 5L
    private val firestore = FirebaseFirestore.getInstance()

    suspend fun generateAndSendPin(orderId: String, phoneNumber: String): String {
        val pin = (1000..9999).random().toString()
        val expiry = System.currentTimeMillis() + PIN_EXPIRY_MINUTES * 60 * 1000
        firestore.collection("orders").document(orderId)
            .update(mapOf(
                "verificationPin" to pin,
                "pinExpiry" to expiry,
                "pinUpdatedAt" to FieldValue.serverTimestamp()
            )).await()
        // TODO: Kirim PIN via FCM atau SMS
        return pin
    }

    suspend fun verifyPin(orderId: String, inputPin: String): Boolean {
        val snap = firestore.collection("orders").document(orderId).get().await()
        if (!snap.exists()) return false
        val storedPin = snap.getString("verificationPin") ?: return false
        val expiry = snap.getLong("pinExpiry") ?: return false
        if (System.currentTimeMillis() > expiry) return false
        if (inputPin != storedPin) return false
        firestore.collection("orders").document(orderId)
            .update("verificationPin", FieldValue.delete(), "pinExpiry", FieldValue.delete())
            .await()
        return true
    }
}
```

### 2.2 Nonaktifkan auto-complete di `TripStateMachine.kt`

**`handleGeofenceTransition()`** — ganti bagian dropoff entry (baris 159-163):

```kotlin
geofenceId.startsWith("dropoff_") && transitionType == GEOFENCE_TRANSITION_ENTER -> {
    if (currentState == STATE_EN_ROUTE || currentState == STATE_PICKED_UP) {
        transitionToAtDropoff()
        // Hanya notifikasi, TIDAK auto-complete
        Log.i(TAG, "Arrived at dropoff for $orderId — manual confirmation required")
    }
}
```

**`triggerAutoComplete()`** — HAPUS method dan semua referensi. Atau comment out isinya.

### 2.3 Buat `VerificationScreen.kt`

**Lokasi:** `app/src/main/java/com/arodriverkotlin/ui/screens/VerificationScreen.kt`

```kotlin
package com.arodriverkotlin.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.arodriverkotlin.service.VerificationService
import kotlinx.coroutines.launch

@Composable
fun VerificationScreen(
    orderId: String,
    onVerified: () -> Unit,
    onCancel: () -> Unit,
    onCompleteWithoutPin: () -> Unit
) {
    var pin by remember { mutableStateOf("") }
    var isVerifying by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Masukkan PIN Verifikasi", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Text("Masukkan PIN 4 digit dari penumpang", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = pin,
            onValueChange = { if (it.length <= 4) { pin = it; errorMessage = null } },
            label = { Text("PIN") },
            singleLine = true,
            modifier = Modifier.width(200.dp)
        )

        if (errorMessage != null) {
            Text(errorMessage!!, color = MaterialTheme.colorScheme.error)
        }

        Spacer(Modifier.height(16.dp))

        Button(
            onClick = {
                if (pin.length != 4) {
                    errorMessage = "PIN harus 4 digit"
                    return@Button
                }
                isVerifying = true
                scope.launch {
                    val valid = VerificationService.verifyPin(orderId, pin)
                    isVerifying = false
                    if (valid) onVerified()
                    else errorMessage = "PIN salah atau sudah expired"
                }
            },
            enabled = !isVerifying
        ) {
            if (isVerifying) CircularProgressIndicator(modifier = Modifier.size(16.dp))
            else Text("Verifikasi")
        }

        Spacer(Modifier.height(8.dp))

        TextButton(onClick = onCompleteWithoutPin) {
            Text("Selesaikan Tanpa PIN")
        }

        TextButton(onClick = onCancel) {
            Text("Batal")
        }
    }
}
```

### 2.4 Integrasi VerificationScreen di `HomeScreen.kt`

- Tambah state `showVerificationDialog: Boolean` dan `orderToVerify: String?`
- Saat user tap "Selesai" untuk suatu order → set `showVerificationDialog = true`
- Tampilkan `AlertDialog` dengan `VerificationScreen` di dalamnya
- `onVerified` → panggil `completeOrder()` seperti biasa
- `onCompleteWithoutPin` → langsung `completeOrder()` (logged)
- `onCancel` → tutup dialog

### 2.5 Update timeout ke 20 detik

Di `OrderTimeoutManager.kt`:
```kotlin
// Hapus companion object ACCEPTANCE_TIMEOUT_MS
// Terima parameter dari ConfigService
fun startAcceptanceTimeout(orderId: String, timeoutMs: Long = 20_000L) { ... }
```

---

## FASE 3 — Realtime Communication

### 3.1 Buat `service/RealtimeOrderListener.kt`

**Lokasi:** `app/src/main/java/com/arodriverkotlin/service/RealtimeOrderListener.kt`

```kotlin
package com.arodriverkotlin.service

import android.util.Log
import com.google.firebase.database.ChildEventListener
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase

class RealtimeOrderListener(
    private val uid: String,
    private val onOrderReceived: (orderId: String) -> Unit
) {
    private val rtdbRef = FirebaseDatabase.getInstance().reference
        .child("drivers").child(uid).child("incoming")
    private var listener: ChildEventListener? = null

    fun startListening() {
        stopListening()
        listener = object : ChildEventListener {
            override fun onChildAdded(snapshot: DataSnapshot, previousChildName: String?) {
                val orderId = snapshot.key ?: return
                Log.i("RTDB_LISTENER", "Order received: $orderId")
                onOrderReceived(orderId)
                snapshot.ref.removeValue()
            }
            override fun onChildChanged(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onChildRemoved(snapshot: DataSnapshot) {}
            override fun onChildMoved(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onCancelled(error: DatabaseError) {
                Log.w("RTDB_LISTENER", "Listener cancelled: ${error.message}")
            }
        }
        rtdbRef.addChildEventListener(listener!!)
    }

    fun stopListening() {
        listener?.let { rtdbRef.removeEventListener(it) }
        listener = null
    }
}
```

### 3.2 Update `ForegroundService.kt` — RTDB primary listener

```kotlin
// Properti baru
private var realtimeOrderListener: RealtimeOrderListener? = null
private var firestoreOrderFallback: ListenerRegistration? = null

// Replace startListeningForOrders()
private fun startListeningForOrders(uid: String) {
    // RTDB primary
    realtimeOrderListener = RealtimeOrderListener(uid) { orderId ->
        IncomingOrderNotifier.show(
            context = this@ForegroundService,
            orderId = orderId,
            title = getString(R.string.incoming_order_title),
            body = getString(R.string.incoming_order_body)
        )
        orderTimeoutManager?.startAcceptanceTimeout(orderId)
    }
    realtimeOrderListener?.startListening()

    // Firestore fallback
    startFirestoreOrderFallback(uid)
}

private fun startFirestoreOrderFallback(uid: String) {
    firestoreOrderFallback = FirebaseFirestore.getInstance().collection("orders")
        .whereEqualTo("status", "searching")
        .whereEqualTo("dispatch.offeredTo", uid)
        .addSnapshotListener { snap, error ->
            if (error != null) return@addSnapshotListener
            snap?.documentChanges
                ?.filter { it.type == DocumentChange.Type.ADDED }
                ?.forEach { change ->
                    val orderId = change.document.id
                    // Dedup: skip if already processed by RTDB
                    IncomingOrderNotifier.show(
                        context = this@ForegroundService,
                        orderId = orderId,
                        title = getString(R.string.incoming_order_title),
                        body = getString(R.string.incoming_order_body)
                    )
                    orderTimeoutManager?.startAcceptanceTimeout(orderId)
                }
        }
}
```

### 3.3 Update `ForegroundService.onDestroy()`

```kotlin
realtimeOrderListener?.stopListening()
firestoreOrderFallback?.remove()
```

### 3.4 Add `acknowledgeOrder()` di `TripStateMachine.kt`

```kotlin
private suspend fun acknowledgeOrder(orderId: String) {
    try {
        FirebaseDatabase.getInstance().reference
            .child("drivers/$uid/incoming/$orderId")
            .removeValue()
            .await()
    } catch (_: Exception) {}
}
```

Panggil `acknowledgeOrder(orderId!!)` di akhir `transitionToAccepted()` dan `transitionToCancelled()`.

### 3.5 Update location push frequency

Di `ForegroundService.updateLocationIntervalForTripState()`:

```kotlin
fun updateLocationIntervalForTripState(hasActiveTrip: Boolean) {
    val config = ConfigService
    if (hasActiveTrip) {
        currentLocationIntervalMs = config.getLocationIntervalActiveMs()  // 3000L
        currentMinUpdateIntervalMs = currentLocationIntervalMs / 2
        currentPriority = Priority.PRIORITY_HIGH_ACCURACY
    } else if (driverUid != null) {
        currentLocationIntervalMs = config.getLocationIntervalIdleMs()    // 15000L
        currentMinUpdateIntervalMs = currentLocationIntervalMs / 2
        currentPriority = Priority.PRIORITY_BALANCED_POWER_ACCURACY
    } else {
        currentLocationIntervalMs = config.getLocationIntervalOfflineMs() // 30000L
        currentMinUpdateIntervalMs = currentLocationIntervalMs
        currentPriority = Priority.PRIORITY_LOW_POWER
    }
    fusedLocationClient.removeLocationUpdates(locationCallback)
    startLocationUpdates()
}
```

---

## FASE 4 — Power Optimization

### 4.1 Speed-based adaptive location di `ForegroundService.kt`

```kotlin
@Volatile var latestSpeed: Float? = null

// Di onLocationResult():
latestSpeed = loc.speed  // m/s

// Update updateLocationIntervalForTripState():
fun updateLocationIntervalForTripState(hasActiveTrip: Boolean) {
    if (hasActiveTrip) {
        val speed = (latestSpeed ?: 0f) * 3.6f  // m/s → km/h
        currentLocationIntervalMs = when {
            speed > 40f -> 5000L
            speed > 20f -> 3000L
            else -> 2000L
        }
        currentMinUpdateIntervalMs = currentLocationIntervalMs / 2
        currentPriority = Priority.PRIORITY_HIGH_ACCURACY
    } else if (driverUid != null) {
        currentLocationIntervalMs = ConfigService.getLocationIntervalIdleMs()
        currentMinUpdateIntervalMs = currentLocationIntervalMs / 2
        currentPriority = Priority.PRIORITY_BALANCED_POWER_ACCURACY
    } else {
        currentLocationIntervalMs = ConfigService.getLocationIntervalOfflineMs()
        currentMinUpdateIntervalMs = currentLocationIntervalMs
        currentPriority = Priority.PRIORITY_LOW_POWER
    }
    fusedLocationClient.removeLocationUpdates(locationCallback)
    startLocationUpdates()
}
```

### 4.2 Buat `background/SmartWakeLock.kt`

**Lokasi:** `app/src/main/java/com/arodriverkotlin/background/SmartWakeLock.kt`

```kotlin
package com.arodriverkotlin.background

import android.content.Context
import android.os.PowerManager

class SmartWakeLock(private val context: Context) {
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private var orderWakeLock: PowerManager.WakeLock? = null
    private var fcmWakeLock: PowerManager.WakeLock? = null

    fun acquireForOrder() {
        releaseOrder()
        orderWakeLock = powerManager.newWakeLock(
            PowerManager.SCREEN_DIM_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "ARO:OrderWakeLock"
        ).apply { acquire(10 * 60 * 1000L) } // max 10 menit
    }

    fun acquireForFcm() {
        releaseFcm()
        fcmWakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "ARO:FcmWakeLock"
        ).apply { acquire(10_000L) } // 10 detik
    }

    fun releaseAll() {
        releaseOrder()
        releaseFcm()
    }

    private fun releaseOrder() {
        orderWakeLock?.let {
            if (it.isHeld) it.release()
            orderWakeLock = null
        }
    }

    private fun releaseFcm() {
        fcmWakeLock?.let {
            if (it.isHeld) it.release()
            fcmWakeLock = null
        }
    }
}
```

### 4.3 Wiring di `ForegroundService.kt`

```kotlin
private var smartWakeLock: SmartWakeLock? = null

// di onStartCommand():
smartWakeLock = SmartWakeLock(this)

// di onTripStateChanged callback:
onTripStateChanged = { hasActiveTrip ->
    if (hasActiveTrip) smartWakeLock?.acquireForOrder()
    else smartWakeLock?.releaseAll()
    updateLocationIntervalForTripState(hasActiveTrip)
}

// di onDestroy():
smartWakeLock?.releaseAll()
```

### 4.4 Wiring di `MessagingService.kt`

```kotlin
// Di onMessageReceived():
smartWakeLock?.acquireForFcm() // perlu akses ke SmartWakeLock — atau via companion object
```

---

## FASE 5 — Offline Queue & Reliability

### 5.1 Infinite retry di `OfflineQueueProcessor.kt`

```kotlin
// HAPUS:
private const val MAX_RETRIES = 10

// TAMBAH:
private const val MAX_BACKOFF_MS = 120_000L

private suspend fun backoffDelay(retryCount: Int): Long {
    val delay = (1000L * 2.0.pow(retryCount.coerceAtMost(7))).toLong()
    return delay.coerceAtMost(MAX_BACKOFF_MS)
}

// Di processQueue() loop, hapus pengecekan maxRetries:
while (true) {
    // ... process action ...
    if (success) {
        pendingActionDao.delete(action)
        break
    } else {
        pendingActionDao.updateRetryCount(action.id, action.retryCount + 1)
        delay(backoffDelay(action.retryCount))
    }
}
```

### 5.2 Server reconciliation (sudah di Fase 1.9)

### 5.3 State transition buffer di `BackgroundDiagnostics.kt`

```kotlin
// Tambah buffer transisi
private val transitionBuffer = mutableListOf<Map<String, Any?>>()
private const val MAX_BUFFER_SIZE = 50

fun recordTransition(fromState: String, toState: String, orderId: String?) {
    val entry = mapOf(
        "from" to fromState,
        "to" to toState,
        "orderId" to orderId,
        "timestamp" to ServerValue.TIMESTAMP
    )
    synchronized(transitionBuffer) {
        transitionBuffer.add(entry)
        if (transitionBuffer.size > MAX_BUFFER_SIZE) {
            transitionBuffer.removeFirst()
        }
    }
}

suspend fun uploadTransitions(uid: String) {
    val batch = synchronized(transitionBuffer) {
        val copy = transitionBuffer.toList()
        transitionBuffer.clear()
        copy
    }
    if (batch.isEmpty()) return
    for (entry in batch) {
        firestore.collection("drivers").document(uid)
            .collection("diagnostics").add(entry).await()
    }
}
```

### 5.4 Crash upload di `AroDriverApplication.kt`

(Detail di Fase 8.9)

### 5.5 Pastikan `PendingAction.kt` punya `retryCount`

```kotlin
@Entity(tableName = "pending_actions")
data class PendingAction(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val uid: String,
    val action: String,
    val orderId: String,
    val payload: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val retryCount: Int = 0  // Pastikan field ini ada
)
```

### 5.6 Schedule BackgroundSyncWorker di `DriverViewModel.kt`

```kotlin
private fun scheduleSyncWorker() {
    val request = OneTimeWorkRequestBuilder<BackgroundSyncWorker>()
        .setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
        )
        .setBackoffCriteria(
            BackoffPolicy.EXPONENTIAL,
            WorkRequest.MIN_BACKOFF_MILLIS,
            TimeUnit.MILLISECONDS
        )
        .build()
    WorkManager.getInstance(getApplication()).enqueue(request)
}
```

Panggil `scheduleSyncWorker()` di dalam `enqueuePendingAction()`.

---

## FASE 6 — Payment & Wallet

**DEFERRED** — akan dikerjakan di sprint berikutnya.

---

## FASE 7 — Ratings, Scores & Analytics

### 7.1 Buat `service/DriverAnalyticsService.kt`

**Lokasi:** `app/src/main/java/com/arodriverkotlin/service/DriverAnalyticsService.kt`

```kotlin
package com.arodriverkotlin.service

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

object DriverAnalyticsService {
    private val firestore = FirebaseFirestore.getInstance()

    suspend fun logEvent(uid: String, eventName: String, params: Map<String, Any> = emptyMap()) {
        try {
            firestore.collection("drivers").document(uid)
                .collection("analytics")
                .add(mapOf(
                    "eventName" to eventName,
                    "params" to params,
                    "createdAt" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                )).await()
        } catch (_: Exception) {}
    }
}
```

### 7.2 Buat `service/RatingService.kt`

**Lokasi:** `app/src/main/java/com/arodriverkotlin/service/RatingService.kt`

```kotlin
package com.arodriverkotlin.service

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

data class Rating(
    val userId: String = "",
    val userName: String = "",
    val rating: Float = 0f,
    val comment: String = "",
    val createdAt: Long = 0L
) {
    constructor() : this("", "", 0f, "", 0L)
}

object RatingService {
    private val firestore = FirebaseFirestore.getInstance()

    suspend fun getAverageRating(uid: String): Float {
        val snap = firestore.collection("drivers").document(uid).get().await()
        return snap.getDouble("rating")?.toFloat() ?: 0f
    }

    suspend fun getRatingCount(uid: String): Int {
        val snap = firestore.collection("drivers").document(uid).get().await()
        return snap.getLong("ratingCount")?.toInt() ?: 0
    }

    suspend fun getLatestRatings(uid: String, limit: Int = 10): List<Rating> {
        val ratings = firestore.collection("drivers").document(uid)
            .collection("ratings")
            .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .limit(limit)
            .get().await()
        return ratings.map { doc ->
            Rating(
                userId = doc.getString("userId") ?: "",
                userName = doc.getString("userName") ?: "",
                rating = doc.getDouble("rating")?.toFloat() ?: 0f,
                comment = doc.getString("comment") ?: "",
                createdAt = doc.getTimestamp("createdAt")?.toDate()?.time ?: 0L
            )
        }
    }
}
```

### 7.3 Buat `ui/screens/RatingScreen.kt`

**Lokasi:** `app/src/main/java/com/arodriverkotlin/ui/screens/RatingScreen.kt`

```kotlin
package com.arodriverkotlin.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.arodriverkotlin.service.Rating
import com.arodriverkotlin.service.RatingService
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RatingScreen(uid: String) {
    var average by remember { mutableFloatStateOf(0f) }
    var count by remember { mutableIntStateOf(0) }
    var ratings by remember { mutableStateOf<List<Rating>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(uid) {
        average = RatingService.getAverageRating(uid)
        count = RatingService.getRatingCount(uid)
        ratings = RatingService.getLatestRatings(uid)
        isLoading = false
    }

    if (isLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp)) {
        item {
            Text("Rating Saya", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("%.1f".format(average), style = MaterialTheme.typography.displayMedium)
                Spacer(Modifier.width(8.dp))
                repeat(5) { i ->
                    Icon(
                        Icons.Default.Star,
                        contentDescription = null,
                        tint = if (i < average.toInt()) MaterialTheme.colorScheme.primary
                               else MaterialTheme.colorScheme.outline
                    )
                }
            }
            Text("$count ulasan", style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(16.dp))
            Divider()
        }
        items(ratings) { rating ->
            RatingItem(rating)
        }
    }
}

@Composable
private fun RatingItem(rating: Rating) {
    Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(Modifier.padding(12.dp)) {
            Text(rating.userName, style = MaterialTheme.typography.titleSmall)
            Row {
                repeat(5) { i ->
                    Icon(
                        Icons.Default.Star,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = if (i < rating.rating.toInt()) MaterialTheme.colorScheme.primary
                               else MaterialTheme.colorScheme.outline
                    )
                }
            }
            if (rating.comment.isNotBlank()) {
                Text(rating.comment, style = MaterialTheme.typography.bodySmall)
            }
            Text(
                java.text.SimpleDateFormat("dd/MM/yy HH:mm", java.util.Locale.getDefault())
                    .format(java.util.Date(rating.createdAt)),
                style = MaterialTheme.typography.labelSmall
            )
        }
    }
}
```

### 7.4 Buat `service/DriverScoreService.kt`

**Lokasi:** `app/src/main/java/com/arodriverkotlin/service/DriverScoreService.kt`

```kotlin
package com.arodriverkotlin.service

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

data class DriverScore(
    val acceptanceRate: Float = 0f,
    val completionRate: Float = 0f,
    val cancellationRate: Float = 0f,
    val averageRating: Float = 0f,
    val totalTrips: Int = 0
)

object DriverScoreService {
    private val firestore = FirebaseFirestore.getInstance()

    suspend fun getScore(uid: String): DriverScore {
        val snap = firestore.collection("drivers").document(uid).get().await()
        return DriverScore(
            acceptanceRate = snap.getDouble("acceptanceRate")?.toFloat() ?: 0f,
            completionRate = snap.getDouble("completionRate")?.toFloat() ?: 0f,
            cancellationRate = snap.getDouble("cancellationRate")?.toFloat() ?: 0f,
            averageRating = snap.getDouble("rating")?.toFloat() ?: 0f,
            totalTrips = snap.getLong("totalTrips")?.toInt() ?: 0
        )
    }

    suspend fun getCancellationPenalty(uid: String): Long {
        val snap = firestore.collection("drivers").document(uid).get().await()
        return snap.getLong("cancellationPenalty") ?: 5000L
    }
}
```

### 7.5 Update `OrderService.cancelOrder()` — cancellation penalty

```kotlin
suspend fun cancelOrder(orderId: String, uid: String, profile: DriverProfile, reason: String) {
    // ... existing logic ...

    // Tambah penalty
    try {
        val score = DriverScoreService.getScore(uid)
        if (score.totalTrips > 10 && score.cancellationRate > 0.2f) {
            val penalty = DriverScoreService.getCancellationPenalty(uid)
            firestore.collection("drivers").document(uid)
                .update("balance", FieldValue.increment(-penalty)).await()
            firestore.collection("drivers").document(uid)
                .collection("penalties").add(mapOf(
                    "amount" to penalty,
                    "reason" to "cancellation_rate_exceeded",
                    "orderId" to orderId,
                    "createdAt" to FieldValue.serverTimestamp()
                )).await()
        }
    } catch (_: Exception) {}
}
```

### 7.6 Update `DriverProfile.kt`

```kotlin
data class DriverProfile(
    val uid: String = "",
    val photoUrl: String = "",
    val name: String = "",
    val phone: String = "",
    val vehicle: String = "",
    val balance: Long = 0,
    val isOnline: Boolean = false,
    val status: String = "offline",
    val registrationDate: Long = 0,
    val totalTrips: Int = 0,
    val rating: Float = 0f,
    val ratingCount: Int = 0,
    val score: DriverScore? = null,
)

data class DriverScore(
    val acceptanceRate: Float = 0f,
    val completionRate: Float = 0f,
    val cancellationRate: Float = 0f,
    val averageRating: Float = 0f,
    val totalTrips: Int = 0,
)
```

---

## FASE 8 — Platform Engineering

### 8.1 Buat `receiver/WatchdogReceiver.kt`

**Lokasi:** `app/src/main/java/com/arodriverkotlin/receiver/WatchdogReceiver.kt`

```kotlin
package com.arodriverkotlin.receiver

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import com.arodriverkotlin.service.ForegroundService

class WatchdogReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val prefs = context.getSharedPreferences("foreground_service", Context.MODE_PRIVATE)
        val uid = prefs.getString("driver_uid", null)
        if (uid != null) {
            // Cek apakah service masih hidup dengan mencoba cek SharedPreferences
            // Jika service mati, restart
            ForegroundService.start(context, uid)
            Log.i("WATCHDOG", "Health check: service restarted for $uid")
        }
    }

    companion object {
        fun schedule(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, WatchdogReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context, 0, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            alarmManager.setRepeating(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + 300_000,  // 5 menit pertama
                300_000,  // setiap 5 menit
                pendingIntent
            )
        }
    }
}
```

### 8.2 Update `AndroidManifest.xml`

Tambahkan receiver:
```xml
<receiver
    android:name=".receiver.WatchdogReceiver"
    android:enabled="true"
    android:exported="false" />
```

### 8.3 Update `BootReceiver.kt`

Di `onReceive()`:
```kotlin
WatchdogReceiver.schedule(context)
```

### 8.4 Buat `service/PermissionMonitor.kt`

**Lokasi:** `app/src/main/java/com/arodriverkotlin/service/PermissionMonitor.kt`

```kotlin
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
```

### 8.5 Wiring PermissionMonitor di `ForegroundService.kt`

```kotlin
private var permissionMonitor: PermissionMonitor? = null

// di onStartCommand():
permissionMonitor = PermissionMonitor(this) { permission ->
    Log.w(TAG, "Permission lost: $permission")
    if (permission == Manifest.permission.ACCESS_FINE_LOCATION) {
        // Turunkan priority
        currentPriority = Priority.PRIORITY_LOW_POWER
        fusedLocationClient.removeLocationUpdates(locationCallback)
        startLocationUpdates()
    }
}
```

### 8.6 Setup Crashlytics

**`build.gradle`**: sudah ditambahkan (plugin + dependency)

**`AroDriverApplication.kt`**:
```kotlin
FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(true)
```

**`ForegroundService.kt`** — di `onLocationResult` dan method kritis:
```kotlin
FirebaseCrashlytics.getInstance().setCustomKey("last_state", tripStateMachine?.getCurrentState() ?: "none")
```

### 8.7 Firebase Performance

Plugin di root `build.gradle`:
```groovy
id 'com.google.firebase.firebase-perf' version '1.4.2' apply false
```

### 8.8 Extract hardcoded strings

Buat/update:
- `res/values/strings.xml` — semua string bahasa Indonesia
- `res/values-en/strings.xml` — terjemahan Inggris

**`res/values/strings.xml`**:
```xml
<resources>
    <string name="app_name">ARO DRIVE</string>
    <string name="foreground_running">Menjalankan layanan latar belakang...</string>
    <string name="incoming_order_title">ARO DRIVE</string>
    <string name="incoming_order_body">Ada pesanan baru!</string>
    <string name="order_accepted">Pesanan diterima.</string>
    <string name="order_cancelled">Pesanan dibatalkan.</string>
    <string name="order_arrived">Status tiba diperbarui.</string>
    <string name="order_pickup">Status pickup diperbarui.</string>
    <string name="order_completed">Pesanan selesai.</string>
    <string name="order_rejected">Pesanan ditolak.</string>
    <string name="pending_accept">Pesanan akan diproses saat koneksi pulih.</string>
    <string name="pending_arrive">Status tiba akan diperbarui saat koneksi pulih.</string>
    <string name="pending_pickup">Pickup akan diproses saat koneksi pulih.</string>
    <string name="pending_complete">Penyelesaian akan diproses saat koneksi pulih.</string>
    <string name="pending_cancel">Pembatalan akan diproses saat koneksi pulih.</string>
    <string name="verification_title">Masukkan PIN Verifikasi</string>
    <string name="verification_subtitle">Masukkan PIN 4 digit dari penumpang</string>
    <string name="verify_button">Verifikasi</string>
    <string name="cancel_button">Batal</string>
    <string name="complete_without_pin">Selesaikan Tanpa PIN</string>
    <string name="pin_error">PIN salah atau sudah expired</string>
    <string name="arrived_pickup">Anda telah tiba di lokasi pickup</string>
    <string name="arrived_dropoff">Anda telah tiba di lokasi tujuan</string>
    <string name="confirm_arrive">Konfirmasi Sampai</string>
    <string name="confirm_complete">Selesaikan Pesanan</string>
    <string name="rating_title">Rating Saya</string>
    <string name="rating_count">%d ulasan</string>
    <string name="permission_location_lost">Izin lokasi dicabut. Fitur navigasi terbatas.</string>
    <string name="network_error">Koneksi bermasalah. Pesanan akan diproses saat koneksi pulih.</string>
</resources>
```

**`res/values-en/strings.xml`**:
```xml
<resources>
    <string name="app_name">ARO DRIVE</string>
    <string name="foreground_running">Running background service...</string>
    <string name="incoming_order_title">ARO DRIVE</string>
    <string name="incoming_order_body">New order available!</string>
    <string name="order_accepted">Order accepted.</string>
    <string name="order_cancelled">Order cancelled.</string>
    <string name="order_arrived">Arrival status updated.</string>
    <string name="order_pickup">Pickup status updated.</string>
    <string name="order_completed">Order completed.</string>
    <string name="order_rejected">Order rejected.</string>
    <string name="pending_accept">Order will be processed when connection is restored.</string>
    <string name="pending_arrive">Arrival will be updated when connection is restored.</string>
    <string name="pending_pickup">Pickup will be processed when connection is restored.</string>
    <string name="pending_complete">Completion will be processed when connection is restored.</string>
    <string name="pending_cancel">Cancellation will be processed when connection is restored.</string>
    <string name="verification_title">Enter Verification PIN</string>
    <string name="verification_subtitle">Enter the 4-digit PIN from passenger</string>
    <string name="verify_button">Verify</string>
    <string name="cancel_button">Cancel</string>
    <string name="complete_without_pin">Complete Without PIN</string>
    <string name="pin_error">Incorrect or expired PIN</string>
    <string name="arrived_pickup">You have arrived at pickup location</string>
    <string name="arrived_dropoff">You have arrived at destination</string>
    <string name="confirm_arrive">Confirm Arrival</string>
    <string name="confirm_complete">Complete Order</string>
    <string name="rating_title">My Rating</string>
    <string name="rating_count">%d reviews</string>
    <string name="permission_location_lost">Location permission revoked. Navigation limited.</string>
    <string name="network_error">Network issue. Order will be processed when connection is restored.</string>
</resources>
```

Ganti semua hardcoded string di file Kotlin dengan `getString(R.string.xxx)` atau `stringResource(R.string.xxx)`.

### 8.9 Update `AroDriverApplication.kt` final

```kotlin
package com.arodriverkotlin

import android.app.Application
import android.content.ContentValues.TAG
import android.util.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.arodriverkotlin.service.ConfigService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AroDriverApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(true)

        // Crash upload handler
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val prefs = getSharedPreferences("foreground_service", MODE_PRIVATE)
                val uid = prefs.getString("driver_uid", null)
                if (uid != null) {
                    FirebaseFirestore.getInstance()
                        .collection("drivers").document(uid)
                        .collection("diagnostics").add(mapOf(
                            "type" to "crash",
                            "timestamp" to FieldValue.serverTimestamp(),
                            "error" to throwable.message
                        ))
                }
            } catch (_: Exception) {}
            defaultHandler?.uncaughtException(thread, throwable)
        }

        // Init Remote Config
        CoroutineScope(Dispatchers.IO).launch {
            try {
                ConfigService.fetchAndActivate()
                Log.i("CONFIG", "Remote Config fetched and activated")
            } catch (e: Exception) {
                Log.w("CONFIG", "Remote Config fetch failed", e)
            }
        }
    }
}
```

---

## URUTAN IMPLEMENTASI

| Prioritas | Fase | File Baru | File Diubah | Jam |
|-----------|------|-----------|-------------|-----|
| **P1** | Fase 1 | ConfigService.kt | GeofenceManager.kt, ForegroundService.kt, TripStateMachine.kt, AndroidManifest.xml, HomeScreen.kt, OrderTimeoutManager.kt, AroDriverApplication.kt | 5 |
| **P1** | Fase 2 | VerificationService.kt, VerificationScreen.kt | TripStateMachine.kt, HomeScreen.kt, OrderTimeoutManager.kt | 4 |
| **P1** | Fase 3 | RealtimeOrderListener.kt | ForegroundService.kt, TripStateMachine.kt | 3 |
| **P2** | Fase 4 | SmartWakeLock.kt | ForegroundService.kt, MessagingService.kt | 2.5 |
| **P2** | Fase 5 | — | OfflineQueueProcessor.kt, TripStateMachine.kt, BackgroundDiagnostics.kt, DriverViewModel.kt, PendingAction.kt | 3 |
| **P3** | Fase 7 | DriverAnalyticsService.kt, RatingService.kt, RatingScreen.kt, DriverScoreService.kt | OrderService.kt, DriverProfile.kt | 4 |
| **P3** | Fase 8 | WatchdogReceiver.kt, PermissionMonitor.kt | AndroidManifest.xml, BootReceiver.kt, ForegroundService.kt, AroDriverApplication.kt, strings.xml, build.gradle | 3.5 |
| **Total** | | **10 file baru** | **~20 file diubah** | **~25 jam** |

---

## DEPENDENSI BUILD GRADLE FINAL

```groovy
dependencies {
    def composeBom = platform('androidx.compose:compose-bom:2024.10.01')
    implementation composeBom
    androidTestImplementation composeBom

    implementation 'androidx.activity:activity-compose:1.9.3'
    implementation 'androidx.fragment:fragment-ktx:1.8.5'
    implementation 'androidx.compose.material3:material3'
    implementation 'androidx.compose.material:material-icons-extended'
    implementation 'androidx.compose.ui:ui'
    implementation 'androidx.compose.ui:ui-tooling-preview'
    implementation 'androidx.lifecycle:lifecycle-runtime-compose:2.8.7'
    implementation 'androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0'

    implementation platform('com.google.firebase:firebase-bom:33.7.0')
    implementation 'com.google.firebase:firebase-auth'
    implementation 'com.google.firebase:firebase-firestore'
    implementation 'com.google.firebase:firebase-storage'
    implementation 'com.google.firebase:firebase-messaging'
    implementation 'com.google.firebase:firebase-database'
    implementation 'com.google.firebase:firebase-config'          // BARU
    implementation 'com.google.firebase:firebase-crashlytics'      // BARU
    implementation 'com.google.firebase:firebase-analytics'        // BARU
    implementation 'com.google.firebase:firebase-performance'      // BARU

    implementation 'io.coil-kt:coil-compose:2.7.0'

    implementation 'com.google.android.gms:play-services-location:21.3.0'
    implementation 'com.google.android.gms:play-services-maps:19.0.0'
    implementation 'com.google.maps.android:maps-compose:6.4.1'
    implementation 'com.google.maps.android:android-maps-utils:3.9.0'

    implementation 'androidx.work:work-runtime-ktx:2.9.1'

    debugImplementation 'androidx.compose.ui:ui-tooling'
}
```
