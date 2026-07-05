# Implementation Plan: Core Reliability & Performance

## ARO DRIVE — Gap Analysis & Action Plan vs Grab Driver Standard

---

## Phase 1: Crash & ANR Fixes (Critical)

### 1.1 Fix ANR di `OrderTimeoutReceiver`

**File:** `app/src/main/java/com/arodriverkotlin/background/OrderTimeoutReceiver.kt`

- Panggil `goAsync()` di `onReceive()`
- Gunakan `PendingResult` untuk signal completion setelah coroutine selesai
- Cancel scope di `onReceive()` untuk mencegah orphaned coroutine

### 1.2 Fix Geofence Static Handler Leak

**Files:** `service/ForegroundService.kt` + `background/GeofenceBroadcastReceiver.kt`

- Clear handler di `onDestroy()`:
  ```kotlin
  override fun onDestroy() {
      GeofenceEventHandler.setHandler(null)
      // ...
  }
  ```
- Guard handler invocation agar null-safe di `GeofenceEventHandler.handleTransition()`

### 1.3 Fix Race Condition Room Sync (3-way)

**Files:** `service/ForegroundService.kt`, `background/OfflineQueueProcessor.kt`, `background/BackgroundSyncWorker.kt`

- Introduce shared `Mutex` untuk prevent concurrent read/write Room
- `OfflineQueueProcessor` + `BackgroundSyncWorker` harus `withLock` sebelum akses Room
- Alternatif: single source of truth — hanya `OfflineQueueProcessor` yang berhak hapus dari Room; `BackgroundSyncWorker` hanya trigger `processQueue()` lewat shared flag

### 1.4 Infinite Retry Loop — Cap Maximum Attempts

**File:** `background/OfflineQueueProcessor.kt`

- Tambah `MAX_RETRY_ATTEMPTS = 50` (atau dari Remote Config)
- Setelah exceeded, pindahkan ke dead letter log + hapus dari pending queue
- Kirim diagnostic event ke Crashlytics untuk monitoring

---

## Phase 2: Android 14+ Compliance (Critical)

### 2.1 Full-Screen Intent Permission

**Files:** `AndroidManifest.xml`, `ui/screens/PermissionsScreen.kt`

- Di `PermissionsScreen`, setelah notifikasi grant, request `USE_FULL_SCREEN_INTENT` untuk API 34+
- Untuk API 34+, intent ke `Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT` dengan URI package
- Tambah explainer text: "Aktifkan layar penuh untuk notifikasi pesanan"

### 2.2 ForegroundService Type Declaration

**File:** `AndroidManifest.xml`

- Pastikan `<service android:foregroundServiceType="location|dataSync" ...>` sudah benar
- Di `startForeground()` untuk API 34+, pastikan dipanggil dalam 5 detik setelah `startForegroundService()`

### 2.3 `SCHEDULE_EXACT_ALARM` Permission

**Files:** `AndroidManifest.xml`, `background/OrderTimeoutManager.kt`

- Untuk API 31+: cek `canScheduleExactAlarms()` sebelum panggil `setExactAndAllowWhileIdle()`
- Handle `SecurityException` di try/catch
- Kalau tidak punya permission, fallback ke `setAndAllowWhileIdle()` (inexact) + WorkManager

---

## Phase 3: Notification Overhaul (High)

### 3.1 Notification Actions (Terima/Tolak)

**File:** `service/IncomingOrderNotifier.kt`

- Tambah `addAction()` dengan `PendingIntent` ke `BroadcastReceiver` atau langsung ke `ForegroundService`
- Intent action: `ACTION_ACCEPT_ORDER` / `ACTION_REJECT_ORDER`
- Handler di `ForegroundService.onStartCommand()` atau `BroadcastReceiver` terpisah
- Gunakan `FLAG_IMMUTABLE`

### 3.2 Notification Grouping

**File:** `service/IncomingOrderNotifier.kt`

- Panggil `setGroup(GROUP_KEY_ORDERS)` + `setGroupAlertBehavior(GROUP_ALERT_SUMMARY)`
- Group summary notification untuk multiple orders

### 3.3 Replace Generic Notification Icon

- Tambah custom notification icon di `res/drawable/ic_notification.xml` (adaptive icon)
- Ganti `android.R.drawable.ic_dialog_info` jadi `R.drawable.ic_notification`
- Berlaku untuk incoming order notification dan foreground service notification

### 3.4 Notification Priority Escalation

- Jika order tidak direspon dalam 30 detik, update existing notification dengan urgency lebih tinggi
- Re-post notification dengan vibra pattern lebih agresif + repeat sound
- Gunakan `notificationId = orderId.hashCode()` untuk update, bukan create baru

---

## Phase 4: Battery & Performance (High)

### 4.1 Wake Lock — Ganti ke PARTIAL_WAKE_LOCK

**File:** `background/SmartWakeLock.kt`

- Ganti `SCREEN_DIM_WAKE_LOCK | ACQUIRE_CAUSES_WAKEUP` ke `PARTIAL_WAKE_LOCK` untuk daily use
- Hanya gunakan `SCREEN_DIM_WAKE_LOCK` sesaat (5-10 detik) saat incoming order, bukan selama trip
- `SmartWakeLock.acquireForFcm()` — ganti dead code menjadi dipanggil dari `MessagingService`

### 4.2 Adaptive Location — Speed Smoothing

**File:** `service/ForegroundService.kt`

- Implement low-pass filter untuk `latestSpeed`:
  ```kotlin
  private var smoothedSpeed = 0f
  private const val SMOOTHING_FACTOR = 0.3f
  
  // di LocationCallback, setelah dapat speed:
  smoothedSpeed = smoothedSpeed * (1 - SMOOTHING_FACTOR) + (loc.speed ?: 0f) * SMOOTHING_FACTOR
  ```
- Gunakan `smoothedSpeed` untuk interval decision — cegah oscillation di threshold 20/40 km/h

### 4.3 Hapus Dead Code Location Interval

**File:** `service/ConfigService.kt`

- `location_interval_active_ms` dari Remote Config tidak terpakai (di-override speed-based logic)
- Hapus atau jadikan sebagai baseline minimum yang di-override speed smoothing

### 4.4 Watchdog — Hanya Jalan Saat Online

**Files:** `receiver/WatchdogReceiver.kt`, `receiver/BootReceiver.kt`

- Ganti AlarmManager dengan `WorkManager PeriodicWorkRequest` + `NetworkType.CONNECTED` constraint
- Cancel watchdog saat driver offline
- Jadwalkan ulang setiap kali driver online, bukan dari BootReceiver
- Hapus AlarmManager `setRepeating()` yang jalan terus walau offline

---

## Phase 5: Data Integrity (High)

### 5.1 Single Source of Truth untuk Sync

**Decision:**
- `ForegroundService.flushLocationBuffer()`: **hanya tulis ke Room**, jangan trigger upload langsung
- `OfflineQueueProcessor`: satu-satunya yang baca + upload + hapus dari Room
- `BackgroundSyncWorker`: cek pending count, kalau > 0 trigger `OfflineQueueProcessor.processQueue()`
- Shared `Mutex` untuk prevent concurrent access Room

### 5.2 `onTrimMemory` — Flush ke Room, Jangan Drop

**File:** `service/ForegroundService.kt`

- Di `onTrimMemory(TRIM_MEMORY_UI_HIDDEN)`, panggil `flushLocationBuffer()` dulu baru clear
- Kalau flush gagal, baru fallback ke drop buffer

### 5.3 TTL Cleanup untuk Stale Locations

**Files:** `database/dao/LocationDao.kt`, `background/OfflineQueueProcessor.kt`

- Panggil `deleteOldLocations(uid, now - 24h)` setiap kali `processQueue()` selesai
- Atau periodic dari ForegroundService coroutine (setiap 1 jam)

---

## Phase 6: Permissions UX (Medium)

### 6.1 Battery Optimization — Optional, Jangan Block

**File:** `ui/screens/PermissionsScreen.kt`

- Jadikan battery opt request sebagai **optional**, bukan blocking
- Kalau ditolak, tetap proceed ke HomeScreen
- Tampilkan reminder snackbar di HomeScreen dengan opsi "Ingatkan Nanti"

### 6.2 Permission Revoke Handling

**Files:** `service/ForegroundService.kt`, `viewmodel/DriverViewModel.kt`

- Di `startLocationUpdates()`, kalau permission revoked:
  - Set `locationPermissionRevoked = true` di UiState
  - Tampilkan snackbar/dialog di HomeScreen: "Izinkan lokasi di Pengaturan"
  - Stop location collection, jangan crash
  - Re-check permission di `onStartCommand()` setiap kali service restart

---

## Phase 7: Trip State Machine Race (Medium)

### 7.1 Fix `loadPersistedState()` Race

**File:** `background/TripStateMachine.kt`

- Jangan jalankan `loadPersistedState()` async di constructor
- Jalankan **sebelum** register geofence listener di ForegroundService
- Gunakan initial state sync di ForegroundService sebelum setup komponen lain

**Alternative:** state machine mulai dari `IDLE` dengan version=0. Selama loading persisted state, queue incoming geofence events. Proses queue setelah load selesai.

---

## Implementation Sequence

```
Phase 1 (Crash/ANR)       → Week 1
Phase 2 (Android 14)      → Week 1
Phase 3 (Notification)    → Week 2
Phase 4 (Battery/Perf)    → Week 2
Phase 5 (Data Integrity)  → Week 3
Phase 6 (Permissions UX)  → Week 3
Phase 7 (Trip State Race) → Week 3
Testing & Stabilization   → Week 4
```

---

## Verification Checklist (per Phase)

**Setelah implementasi setiap phase, verify:**

- [ ] App tidak crash di Android 14 (API 34) emulator
- [ ] Tidak ada ANR (monitor via `adb shell dumpsys activity processes | grep anr`)
- [ ] `goAsync()` dipanggil di semua `BroadcastReceiver` yang melakukan async work
- [ ] Permission checks sebelum semua API calls (location, geofence, alarm)
- [ ] Room tidak diakses concurrent tanpa synchronization
- [ ] ForegroundService bisa restart setelah di-kill sistem (test dengan `adb shell am force-stop`)
- [ ] Order notification muncul dengan action buttons
- [ ] Battery drain tidak signifikan (monitor via `adb shell dumpsys batterystats`)

---

## Monitoring yang Ditambahkan

- Crashlytics custom keys untuk setiap phase: `phase_1_status`, `phase_2_status`, dll.
- Log `BackgroundDiagnostics` untuk:
  - Sync retry count per location/action
  - Geofence trigger count
  - Order timeout source (AlarmManager vs WorkManager fallback)
  - Permission denied events
