# ARO DRIVE — Plan Migrasi Sementara ke Stack Gratis (Tetap Firestore + RTDB, Ganti Maps / Vision)

> Status: **FASE 0–3 SELESAI** (18 Okt 2026) — Fase 4–5 pending.
> Catatan implementasi ada di §0 di bawah. Rencana awal tetap ditampilkan sebagai referensi.

## 0. Status Implementasi (18 Okt 2026)

| Fase                                | Status     | Bukti / Catatan                                                                                                                                                                          |
| ----------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fase 0 — Feature flag + fondasi OSM | ✅ SELESAI | `VITE_MAP_PROVIDER="osm"` di `.env.example` root + kedua app; `packages/shared/src/mapProvider.ts` (TypeScript, bukan `.js`) berisi tiles OSM/CARTO, Photon/Nominatim, OSRM              |
| Fase 1 — Unblock Spark              | ✅ SELESAI | Commit `92affe2` — jalur berbayar (Vision/Places) di-guard; cleanup file sampah; rules & auth guard diperbaiki                                                                           |
| Fase 2 — Web: Leaflet/OSM           | ✅ SELESAI | `leaflet` + `react-leaflet` v5 di kedua app; LocationPicker/Tracking/OrderMap pakai Leaflet; terverifikasi runtime (peta render, tile CARTO, 0 error) — commit `654d4f8` + fix `f2ee4be` |
| Fase 3 — Driver Kotlin: osmdroid    | ✅ SELESAI | `osmdroid-android:6.1.20` di `aro-driver-kotlin/app/build.gradle`; MapScreen via `AndroidView`; rute OSRM — commit `2740c74`, `3e15af5`                                                  |
| Fase 4 — Dispatch tanpa Functions   | ⏳ PENDING | `packages/shared/src/dispatchClient.js` + `orderStates.js` belum dibuat; dispatch masih di Cloud Functions (`onOrderCreated`) → order tidak ter-dispatch sampai Functions di-deploy      |
| Fase 5 — Verifikasi & rollback      | ⏳ PENDING | Sebagian: build + runtime web sudah diverifikasi; uji kuota Spark & checklist rilis final belum                                                                                          |

> Blocker lain yang ditemukan saat verifikasi (18 Okt): root `package.json` sempat punya dependency `@firebase/app` versi salah → 2 instance Firebase → app blank (`Component auth has not been registered yet`). Sudah diperbaiki di commit `f2ee4be` (+ pengaman `resolve.dedupe` `a674a16`).

---

> Keputusan pemilik (16 Okt 2026):
>
> - Tetap pakai Firestore + RTDB (Spark gratis), ganti service lain yang butuh billing.
> - Budget: harus 100% gratis dulu (tanpa VPS berbayar).
> - Scope: semua termasuk driver app (Customer PWA + Admin + Driver Kotlin).
> - Setuju ganti Google Maps → OpenStreetMap stack sementara.
>
> Project Firebase: `gb-delivery-41bf6` (`.firebaserc`), Firestore `asia-southeast1`, Functions `asia-southeast2` (`functions/index.js:3-8`).

---

## 1. Analisa: ketergantungan Google saat ini

### 1.1 Yang TETAP dipakai (Spark gratis, tanpa billing GCP)

| Layanan                                         | Bukti pemakaian                                                                                                                                                                                                                                                                                       | Catatan                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Firebase Auth (Email/Password + Google Sign-In) | `packages/shared/src/firebase.ts:1-22` (`getAuth`, `GoogleAuthProvider`), `aro-drive-vite/src/pages/Login.jsx:22`, `Register.jsx:22`, `aro-admin-vite/src/pages/Login.jsx:22`, `aro-driver-kotlin/.../AuthService.kt:11`                                                                              | Jalan di Spark. Jangan diganti.                                                                                  |
| Firestore                                       | `aro-drive-vite/src/services/*`, `hooks/useOrderTracking.js:31,63`, `aro-admin-vite/src/pages/Dashboard.jsx:36-58`, `functions/src/orders.js:153`, `dispatch.js:102-106`, Kotlin ~20 file (`DriverService`, `OrderService`, dsb.)                                                                     | Collections: `users, drivers, orders, merchants, settings, banners, admins, topup_requests, diagnostics`. Tetap. |
| Realtime Database                               | `functions/index.js:12` (`databaseURL ...asia-southeast1`), `functions/src/drivers.js:44,118-162`, `repositories/driverRepo.js:10`, `database.rules.json:1-14` (`/drivers/$driverId/.../location, status, incoming`), Kotlin `DriverService.kt:15`, `OrderDispatcher.kt:20`, `HeartbeatManager.kt:43` | Jalur dispatch + tracking realtime. Tetap.                                                                       |
| Storage                                         | `packages/shared/src/firebase.ts:20`, admin `Merchant/BannerManagement.jsx` (`merchants/`, `banners/`), `functions/src/admin.js:487,504` (`makePublic()`), `storage.rules`, `cors.json`                                                                                                               | Spark 5GB. Tetap.                                                                                                |
| Hosting (3 sites)                               | `firebase.json:37-146` (`gb-delivery-41bf6→aro-landing-page`, `aro-drive-user→aro-drive-vite/dist`, `aro-drive-admin→aro-admin-vite/dist`)                                                                                                                                                            | Spark 10GB. Tetap.                                                                                               |
| FCM client-side                                 | `aro-drive-vite/src/firebase/messagingService.js:9-45`, `public/firebase-messaging-sw.js` (masih placeholder!), Kotlin `MessagingService.kt`, `MainActivity.kt:75`                                                                                                                                    | Gratis. Tetap, tapi perlu perbaiki `VAPID key` (lihat 1.3).                                                      |
| Play Services Location (on-device)              | `aro-driver-kotlin/.../location/GoogleLocationEngine.kt:21-82` (`FusedLocationProviderClient`), fallback `AndroidLocationEngine.kt` (`LocationManager/GPS`)                                                                                                                                           | Gratis, tidak butuh billing. Tetap.                                                                              |
| Haversine lokal (bukan Google)                  | `packages/shared/src/pricing.ts`, `utils.ts`, `mapConfig.ts:66-77` (`calculateDistance`), `functions/src/utils.js`                                                                                                                                                                                    | Ongkir dihitung lokal. Ini kabar baik: routing Google hanya visual.                                              |

### 1.2 Yang MATI / harus diganti karena billing bermasalah

| Layanan                                               | Bukti pemakaian                                                                                                                                                                                                                                                                                                                                            | Dampak                                                                                                                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maps JavaScript API                                   | `packages/shared/src/mapConfig.ts:1-3` (`VITE_GOOGLE_MAPS_API_KEY`, `libraries=['places']`), `LocationPickerModal.tsx:22-25` (`useJsApiLoader`), `aro-drive-vite/src/pages/Tracking.jsx:44`, `LocationPicker.jsx:90-98`, `AroRide.jsx:49`                                                                                                                  | Peta web tidak load.                                                                                                                                                        |
| Places API (Autocomplete, Details, TextSearch, Photo) | `LocationPickerModal.tsx:54-104` (`AutocompleteService`, `getPlacePredictions`, `PlacesService.getDetails`), `AroRide.jsx:3` (`Autocomplete`), `functions/src/merchants.js:159-216` (`textsearch/json`, `details/json`, `place/photo`), `src/admin.js:193-278`, `scripts/fetch-food.js:21,72`, `fetch_shops.js:15`, `auto_onboard_popular_merchants.js:11` | Search alamat + foto merchant mati.                                                                                                                                         |
| Geocoding API                                         | `LocationPickerModal.tsx:54,132,153` (`new google.maps.Geocoder().geocode`)                                                                                                                                                                                                                                                                                | Reverse-geocode (klik peta → alamat) mati.                                                                                                                                  |
| Directions API (JS + REST)                            | `hooks/useOrderTracking.js:88-122` (`DirectionsService.route`), `components/tracking/OrderMap.jsx:99` (`DirectionsRenderer`), `aro-driver-kotlin/.../service/DirectionsService.kt:19-33` (`maps.googleapis.com/.../directions/json` + `PolyUtil.decode`)                                                                                                   | Rute driver tidak tergambar.                                                                                                                                                |
| Maps SDK Android / Maps Compose                       | `aro-driver-kotlin/.../map/MapScreen.kt:50-64` (`GoogleMap`, `Marker`, `Polyline`, `LatLngBounds`), `app/build.gradle:82-106` (`play-services-maps:19.0.0`, `maps-compose:6.4.1`), `AndroidManifest.xml:24-25` (`com.google.android.geo.API_KEY`)                                                                                                          | Peta driver tidak load. `values/strings.xml:3` masih `YOUR_GOOGLE_MAPS_API_KEY_HERE`, Remote Config `maps_api_key` default kosong.                                          |
| Cloud Vision API                                      | `functions/package.json:18` (`@google-cloud/vision`), `functions/src/merchants.js:24-29` (`labelDetection` + `documentTextDetection`), `processMerchantPhotoLogic`                                                                                                                                                                                         | Verifikasi foto driver/menu otomatis + `processAllExistingMerchants` mati.                                                                                                  |
| Cloud Functions deploy + Scheduler                    | `functions/index.js` (`onOrderCreated`, `onOrderUpdate`, `autoOfflineLongOnlineDrivers every 3m`, `dailyReset`, `onImageUploaded`, `receiveCrashLog`, dsb.), `docs/SETUP.md:21` (“Aktifkan billing wajib untuk Cloud Functions — Blaze”)                                                                                                                   | **Gagal deploy di Spark.** FCM `send()` via Admin SDK (`orders.js:71,178`, `dispatch.js:128`, `notifications.js:36,104`) ikut mati karena pengirimnya tinggal di Functions. |

### 1.3 Temuan tambahan (bukan billing, tapi blocker)

1. `VITE_FIREBASE_VAPID_KEY` dipakai `messagingService.js:22` tapi **tidak ada di `.env`/`.env.example` manapun** → FCM web gagal walau Spark.
2. `aro-drive-vite/public/firebase-messaging-sw.js:1-27` masih placeholder `REPLACE_WITH_YOUR_*` → perlu inject saat build.
3. Tombol NAVIGASI driver (`MapScreen.kt:253`) hardcode `https://www.google.com/maps/dir/?api=1...` → harus jadi `geo:` intent agar gratis.

---

## 2. Stack alternatif gratis yang dipilih

> Semua di bawah ini free-tier / open-source, tanpa kartu kredit GCP.

| Kebutuhan                          | Google saat ini                        | Alternatif gratis                                                                                                                                                                                                                       | Keterangan                                                                                                                                                                                     |
| ---------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tampil peta (web)                  | Maps JS API (`@react-google-maps/api`) | **Leaflet 1.9 + react-leaflet 4**, tiles **OSM standard** + **CARTO dark_matter** (cocok dark theme)                                                                                                                                    | Tanpa key. Wajib atribusi `© OpenStreetMap contributors © CARTO`.                                                                                                                              |
| Search alamat / autocomplete (web) | Places Autocomplete                    | **Photon** (`api.photon.komoot.io`, tanpa key) primer + **Nominatim** fallback, filter `countrycodes=id` + `bbox=111.0,-8.8,114.6,-6.7`                                                                                                 | Patuhi policy Nominatim: max 1 req/s, `User-Agent: ARO-DRIVE`, debounce 300-400ms, cache `localStorage` + Firestore `settings/geocode_cache`.                                                  |
| Klik peta → alamat (reverse)       | Geocoding API                          | **Nominatim reverse** (`?lat=&lon=`)                                                                                                                                                                                                    | Sama, cache.                                                                                                                                                                                   |
| Gambar rute (web)                  | Directions JS + `DirectionsRenderer`   | **OSRM public** (`router.project-osrm.org/route/v1/driving/...?overview=full&geometries=geojson`) + **fallback garis lurus haversine**                                                                                                  | Untuk skala Blitar aman. Reuse throttle yang sudah ada (`useOrderTracking.js:102-104`, update jika geser >40m). Opsional next: OpenRouteService free 2000 req/hari (butuh key gratis non-GCP). |
| Peta driver (Android)              | Maps Compose / SDK                     | **osmdroid 6.1.20** (`MapView`, tiles MAPNIK, tanpa key)                                                                                                                                                                                | Alternatif: MapLibre Native (lebih modern, refactor lebih besar). osmdroid dipilih agar minim rewrite.                                                                                         |
| Routing driver (Android)           | Directions REST + `PolyUtil.decode`    | **OSRM REST yang sama**, `PolyUtil.decode` tetap bisa dipakai                                                                                                                                                                           | Format polyline OSRM kompatibel.                                                                                                                                                               |
| Navigasi eksternal (driver)        | `google.com/maps/dir` intent           | **`geo:lat,lng?q=lat,lng` intent** (buka app map apapun) + fallback Google jika terinstall                                                                                                                                              | Gratis, tanpa key.                                                                                                                                                                             |
| Lokasi driver                      | FusedLocation (tetap)                  | **Tetap**                                                                                                                                                                                                                               | Tidak diganti.                                                                                                                                                                                 |
| Verifikasi foto AI                 | Cloud Vision                           | **Dimatikan sementara → review manual admin** (upload ke `profile_pics/{userId}` / `merchants/`, approve di dashboard). Opsi next gratis: Tesseract.js client-side.                                                                     | Hapus dari runtime path, jangan hapus kode (flag saja).                                                                                                                                        |
| Foto merchant / rating Places      | Places Photo/Details sync              | **Dimatikan sementara → upload manual + Storage**. Script `fetch-food.js`, `fetch_shops.js`, `auto_onboard*`, `populate-*` ditandai DISABLED.                                                                                           | Jangan hapus script, tandai saja.                                                                                                                                                              |
| Dispatch + scheduler + push server | Cloud Functions (mati)                 | **Dispatch client-side via RTDB** (pindah logic `dispatch.js` radius 3→5→10→15→20km ke `packages/shared`), **scheduler → tombol manual admin + Heartbeat driver**, **push → andalkan RTDB `/incoming` listener + WA Fonnte (opsional)** | FCM Admin-SDK send nonaktif sampai ada server gratis (next: Supabase Edge Function / Cloudflare Worker free untuk FCM HTTP v1).                                                                |
| Hosting / DB / Auth / Storage      | Firebase (tetap)                       | **Tetap Firebase Spark**                                                                                                                                                                                                                | Deploy hanya `firestore,storage,database,hosting` dulu; Functions **sengaja tidak di-deploy**.                                                                                                 |

**Yang tidak diganti:** Auth, Firestore, RTDB, Storage, Hosting, FCM client, FusedLocation, haversine pricing, state machine order.

---

## 3. Rencana eksekusi per fase

### FASE 0 — Feature flag + fondasi OSM (estimasi 0.5 hari) — ✅ SELESAI

**Tujuan:** Google dan OSM bisa hidup berdampingan, default `osm`.

- [ ] Tambah `VITE_MAP_PROVIDER=osm` di `aro-drive-vite/.env`, `aro-admin-vite/.env`, root `.env.example` (contoh: `VITE_MAP_PROVIDER=osm # osm | google`).
- [ ] Buat `packages/shared/src/mapProvider.js`:
  - `getMapProvider()` baca `import.meta.env.VITE_MAP_PROVIDER`.
  - `OSM_TILES = { standard: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' }`.
  - `nominatimSearch(query)`, `nominatimReverse(lat,lng)`, `photonSearch(query)`, `osrmRoute(from,to)` — semua `fetch` + `User-Agent` + error fallback.
  - Reuse `BLITAR_CENTER`, `JATIM_BOUNDS`, `calculateDistance`, `isInsideBounds` dari `mapConfig.ts`.
- [ ] Tambah `VITE_FIREBASE_VAPID_KEY` ke semua `.env.example` + isi di `.env` lokal (ambil dari Firebase Console → Cloud Messaging → Web Push certificate).
- [ ] Perbaiki `aro-drive-vite/public/firebase-messaging-sw.js` agar di-inject saat build (ganti placeholder dengan `importScripts` + config dari env build script).

**Acceptance:** `npm run dev` kedua app jalan, `getMapProvider()==='osm'`, tidak ada error `google is not defined`.

### FASE 1 — Unblock Spark: matikan jalur berbayar (estimasi 0.5–1 hari) — ✅ SELESAI

**Tujuan:** `firebase deploy --only firestore,storage,database,hosting` lolos di Spark.

- [ ] `functions/index.js`: comment-out export sementara:
  - `checkDriverPhoto` (`onObjectFinalized`), `processAllExistingMerchants`, `syncMerchantPopularityFromMaps`, `fetchMerchantPhotoFromMaps`.
  - Pertahankan `onOrderCreated/onOrderUpdate/autoOffline*/dailyReset` tapi **jangan deploy** — uji via `functions/npm run serve` (emulator) saja.
- [ ] `functions/src/merchants.js:4-8,22-29`: tambah guard di `scorePhotoForMenu` + `processMerchantPhotoLogic`:
  ```js
  if (process.env.DISABLE_VISION === '1') return { success: false, disabled: true };
  ```
- [ ] `functions/src/admin.js:193-278`: guard yang sama untuk path Places (`syncMerchantPopularityFromMaps`, `fetchMerchantPhotoFromMaps`, `processAllExistingMerchants`).
- [ ] Tandai DISABLED (comment header, jangan hapus file): `aro-drive-vite/scripts/fetch-food.js`, `fetch_shops.js`, `auto_onboard_popular_merchants.js`, `populate-merchant-images.js`, `fill-menu-photos.js`, `massive-populate.js`, `smart-populate-menu.js`.
- [ ] Ganti alur foto merchant/menu/driver ke **upload manual + review admin** (`MerchantManagement.jsx`, `DriverManagement.jsx` sudah punya `ref,uploadBytes,getDownloadURL`).

**Acceptance:** deploy rules+hosting sukses tanpa Blaze; tidak ada import Vision/Places yang terpanggil saat `DISABLE_VISION=1`.

### FASE 2 — Web: Google Maps → Leaflet/OSM (estimasi 2–3 hari, prioritas utama) — ✅ SELESAI

**Tujuan:** Customer PWA + Admin bisa pilih lokasi, search alamat, lihat tracking tanpa Google.

- [ ] Install: `aro-drive-vite` + `aro-admin-vite` tambah `leaflet`, `react-leaflet` (jangan hapus `@react-google-maps/api` dulu untuk rollback).
- [ ] `packages/shared/src/mapConfig.ts`:
  - Pertahankan konstanta bounds/zoom.
  - Ubah `createMarkerIcon(type)` agar tidak pakai `window.google.maps.Size/Point` — return `{url,w,h}` netral; konversi ke `L.icon({iconUrl, iconSize})` di caller Leaflet, dan ke format Google di branch `google`.
- [ ] Rewrite `packages/shared/src/LocationPickerModal.tsx`:
  - `useJsApiLoader/GoogleMap/MarkerF` → `MapContainer/TileLayer/Marker/useMapEvents`.
  - `AutocompleteService.getPlacePredictions` (+`sessionToken`) → `photonSearch` (primer) + `nominatimSearch` (fallback), debounce 300ms (kode sekarang `LocationPickerModal.tsx:87` sudah 300ms — pertahankan).
  - `PlacesService.getDetails` → langsung pakai `lat/lon` hasil search (tidak perlu Details call).
  - `Geocoder.geocode({location})` (`:132,153`) → `nominatimReverse`.
- [ ] `aro-drive-vite/src/pages/LocationPicker.jsx`, `AroRide.jsx:3,49,109-110`, `Tracking.jsx:3,44`: ganti `useJsApiLoader/Autocomplete/LatLngBounds` → picker OSM + branch `VITE_MAP_PROVIDER`.
- [ ] `aro-drive-vite/src/hooks/useOrderTracking.js:82-124`: ganti `new window.google.maps.DirectionsService().route({origin,destination,travelMode})` → `osrmRoute(driverPos, destination)`; simpan sebagai `routeCoords: [{lat,lng}...]` (bukan `DirectionsResult`) agar tidak tergantung tipe Google. Pertahankan throttle `dist>40m / >5m` dan `panTo` logic (`:126-139`).
- [ ] `aro-drive-vite/src/components/tracking/OrderMap.jsx:98-111`: ganti `DirectionsRenderer` → Leaflet `Polyline` (`color '#cafd00'`, `weight 5`); `GoogleMap/MarkerF` → `MapContainer/Marker`; `defaultMapOptions` → opsi Leaflet (`zoomControl:false`, `minZoom:12`, `maxBounds: Jatim`).
- [ ] `aro-drive-vite/src/utils/imageUtils.js:30-31`: hapus branch `maps.googleapis.com/.../place/photo`, arahkan ke thumbnail Storage.
- [ ] Cache: hasil Nominatim/Photon disimpan `localStorage` (key `aro_geocode_<hash>`, TTL 7 hari) + opsional Firestore `settings/geocode_cache`.

**Acceptance:**

- Pilih pickup/dropoff via search + klik/geser peta → alamat muncul (Nominatim), tanpa `window.google`.
- Tracking order: marker driver bergerak via RTDB, polyline OSRM tergambar; jika OSRM gagal → garis lurus haversine tetap muncul (tidak blank).
- Tidak ada request ke `maps.googleapis.com` di Network tab saat `VITE_MAP_PROVIDER=osm`.

### FASE 3 — Driver Kotlin: Maps Compose → osmdroid + OSRM (estimasi 2–3 hari) — ✅ SELESAI

**Tujuan:** Driver app bisa lihat peta + rute + kirim lokasi tanpa Maps API key.

- [ ] `aro-driver-kotlin/app/build.gradle`: tambah `org.osmdroid:osmdroid-android:6.1.20`; pertahankan `play-services-location:21.3.0`, `maps-utils` (untuk `PolyUtil.decode`); `play-services-maps` / `maps-compose` dibiarkan dulu (hapus setelah stabil).
- [ ] Rewrite `aro-driver-kotlin/.../map/MapScreen.kt:148-205`:
  - `GoogleMap/Marker/Polyline/MapProperties/MapUiSettings (compose)` → `AndroidView(factory={ MapView })` + `TileSourceFactory.MAPNIK` + `Marker` + `Polyline` osmdroid.
  - Bounds kamera Jatim sama: `(-8.8,111.0)-(-6.7,114.6)`; zoom awal `15f`, follow `16f`; threshold anti-jitter 15m (`MapScreen.kt:97-100`) dipertahankan.
  - `createPickupMarkerIcon()` (`:274-308`, Bitmap murni) dipakai ulang tanpa perubahan.
- [ ] `service/DirectionsService.kt:19-33`: ganti URL ke `https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=polyline`; `PolyUtil.decode` tetap; on failure return `emptyList()` (UI sudah handle `routePoints.size>1`).
- [ ] `location/GoogleLocationEngine.kt`, `AndroidLocationEngine.kt`, `HeartbeatManager.kt:43`, `RealTimeSocket.kt:223`: **tidak diubah** (tetap kirim `/drivers/{uid}/location` ke RTDB).
- [ ] `MapScreen.kt:253`: ganti `https://www.google.com/maps/dir/?api=1...` → `geo:lat,lng?q=lat,lng` intent (+ fallback Google jika terinstall).
- [ ] `AndroidManifest.xml:24-25` (`com.google.android.geo.API_KEY`), `values/strings.xml:3`, `res/xml/remote_config_defaults.xml:4-5`: kosongkan `maps_api_key`, tambah `osrm_url`, `nominatim_url` di Remote Config.
- [ ] Build: `./gradlew assembleDebug`; uji tracking: lokasi driver muncul di Customer PWA (RTDB path sama).

**Acceptance:** APK debug bisa dibuka tanpa API key, peta OSM tampil di Blitar, rute OSRM tergambar, tombol NAVIGASI buka app map, lokasi tetap update ke RTDB tiap 2–5 detik.

### FASE 4 — Dispatch & notifikasi tanpa Functions (estimasi 1–2 hari) — ⏳ PENDING

**Tujuan:** Order tetap bisa dari customer → driver tanpa deploy Functions.

- [ ] Buat `packages/shared/src/dispatchClient.js` dari `functions/src/dispatch.js`: fungsi `findNearbyDrivers(allDrivers, pickup, radii=[3,5,10,15,20])` (haversine) + `writeIncoming(rtdb, driverId, orderId, payload)` ke `/drivers/{uid}/incoming/{orderId}`. Panggil dari Admin Dashboard (tombol “Cari driver”) atau Customer PWA setelah `orders/{orderId}` dibuat (`status: waiting_driver`).
- [ ] Scheduler (`autoOfflineLongOnlineDrivers`, `resetDailyOnlineTime`, `syncDriverOnlineStatus` di `functions/src/drivers.js`): **nonaktifkan**; ganti tombol manual di `DriverManagement.jsx` (“Set offline”, “Reset online time”) + andalkan `HeartbeatManager` driver.
- [ ] `onOrderUpdate` validation (state machine per service di README): pindah validasi ke client util (`packages/shared/src/orderStates.js`) agar transisi `waiting_driver → driver_assigned → ... → completed/cancelled` tetap tervalidasi walau Functions mati.
- [ ] Notifikasi: andalkan **RTDB listener `/incoming`** (driver app sudah listen) sebagai “push” utama; FCM Admin-SDK send **off sementara**; WA Fonnte (`FONNTE_TOKEN`, `templates.js`) opsional — matikan dulu jika belum ada budget Fonnte.
- [ ] Auth guard: `verifyIdToken` + cek `users/{uid}.role==admin` (`functions/src/admin.js:44-46`) dipindah ke Firestore Rules (`firestore.rules`) agar tetap aman tanpa Functions.

**Acceptance:** alur end-to-end manual: Customer checkout → `orders/waiting_driver` → Admin klik “dispatch” → driver terima di `/incoming` → accept → tracking jalan → complete → poin masuk — tanpa Functions ter-deploy.

### FASE 5 — Verifikasi, batas gratis & rollback (estimasi 0.5 hari) — ⏳ SEBAGIAN

- [ ] Test Blitar-only: search `viewbox=111.0,114.6,-6.7,-8.8&bounded=1&countrycodes=id`; pastikan hasil Blitar/Jatim relevan.
- [ ] Hormati limit: Nominatim 1 req/s (debounce sudah), OSRM jangan polling <5 detik, tiles tambah atribusi OSM/CARTO.
- [ ] Ujikuota Spark: pantau Firestore reads (tracking pakai `onSnapshot` — wajar untuk skala Blitar, tapi jangan buka listener ganda).
- [ ] Rollback: jika OSM bermasalah, set `VITE_MAP_PROVIDER=google` kembali — kode Google tidak dihapus, hanya di-branch. Target rollback <30 menit.
- [ ] Checklist rilis: `firebase deploy --only firestore,storage,database,hosting` sukses; `npm run build` kedua app sukses; APK debug terinstall; tidak ada `maps.googleapis.com` / `vision.googleapis.com` call saat mode `osm`.

---

## 4. File yang akan disentuh (ringkas)

```
# Baru:
packages/shared/src/mapProvider.js      # OSM: tiles, nominatim, photon, osrm
packages/shared/src/dispatchClient.js   # dispatch haversine client-side
packages/shared/src/orderStates.js      # state machine client-side
docs/ALTERNATIF_GRATIS_PLAN.md          # (dokumen ini)

# Diubah (web):
packages/shared/src/mapConfig.ts
packages/shared/src/LocationPickerModal.tsx
aro-drive-vite/src/pages/Tracking.jsx, LocationPicker.jsx, AroRide.jsx
aro-drive-vite/src/hooks/useOrderTracking.js
aro-drive-vite/src/components/tracking/OrderMap.jsx
aro-drive-vite/src/utils/imageUtils.js
aro-drive-vite/.env, aro-admin-vite/.env, .env.example (+ VITE_MAP_PROVIDER, VITE_FIREBASE_VAPID_KEY)

# Diubah (functions — hanya guard/disable, tanpa hapus):
functions/index.js
functions/src/merchants.js, src/admin.js

# Ditandai DISABLED (jangan hapus):
aro-drive-vite/scripts/fetch-food.js, fetch_shops.js, auto_onboard_popular_merchants.js,
populate-merchant-images.js, fill-menu-photos.js, massive-populate.js, smart-populate-menu.js

# Diubah (kotlin):
aro-driver-kotlin/app/build.gradle
.../map/MapScreen.kt
.../service/DirectionsService.kt
.../res/values/strings.xml, res/xml/remote_config_defaults.xml, AndroidManifest.xml
```

---

## 5. Yang SENGAJA tidak diubah

- Skema Firestore/RTDB, `firestore.rules`, `database.rules.json`, `storage.rules`, `cors.json`, `firebase.json` hosting (kecuali perlu inject SW).
- Pricing haversine, state machine definisi, UI/tema, auth flow.
- Kode Google Maps/Vision/Places: di-branch via flag, tidak dihapus — agar bisa balik saat billing pulih.

---

## 6. Risiko & mitigasi

| Risiko                                      | Mitigasi                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Nominatim 429 / lambat                      | Cache + Photon fallback + debounce; search merchant populer di-seed manual ke Firestore                  |
| OSRM public down / rate-limit               | Fallback polyline garis lurus (haversine); pricing tidak terpengaruh                                     |
| Tiles CARTO/OSM fair-use                    | Untuk Blitar (traffic kecil) aman; next opsi: self-host tiles atau Stadia/MapTiler free-tier             |
| osmdroid APK + UX beda dari GMaps           | Uji di device Android 7+ (minSdk 24); pertahankan bounds/zoom/auto-follow yang sama                      |
| Spark quota (Firestore reads, RTDB koneksi) | Jangan buka listener ganda; tutup `onSnapshot` saat unmount (kode sudah begitu); pantau Usage di Console |
| Functions tetap dibutuhkan untuk FCM push   | Sementara andalkan RTDB listener; next: Worker gratis untuk FCM HTTP v1                                  |

---

## 7. Estimasi & urutan saran

- **Unblock minimal (web jalan): Fase 0 + 1 + 2 ≈ 3–4 hari.**
- **Full termasuk driver: + Fase 3 + 4 + 5 ≈ total 6–9 hari.**
- Urutan saran: Fase 0 → Fase 1 → Fase 2 (web OSM) → verifikasi → Fase 3 (Kotlin) → Fase 4 (dispatch manual) → Fase 5.

---

## 8. Langkah berikutnya (butuh persetujuan)

1. Setuju dengan flag `VITE_MAP_PROVIDER=osm` + stack di tabel §2?
2. Mulai dari **Fase 0 + Fase 1** dulu?
3. Butuh saya lanjutkan ke eksekusi Fase 0–1 setelah dokumen ini disetujui?
