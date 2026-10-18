# ARO DRIVE — Sat Set Blitar!

**ARO DRIVE** adalah platform _on-demand delivery_ dan _ride-hailing_ lokal untuk kota **Blitar, Jawa Timur** — solusi transportasi, pesan-antar makanan, kirim paket, dan belanja pribadi yang cepat dan terpercaya.

> Nama awal proyek ini adalah **GB Delivery**, kemudian di-rebrand menjadi **ARO DRIVE**. Beberapa referensi internal masih menggunakan nama lama.

---

## Daftar Isi

- [What's Included](#whats-included)
- [Layanan](#layanan)
- [Fitur Unggulan](#fitur-unggulan)
- [Arsitektur](#arsitektur)
- [Tech Stack](#tech-stack)
- [Struktur Proyek](#struktur-proyek)
- [Prasyarat](#prasyarat)
- [Instalasi & Konfigurasi](#instalasi--konfigurasi)
- [Menjalankan Lokal](#menjalankan-lokal)
- [Build](#build)
- [Deploy ke Firebase](#deploy-ke-firebase)
- [Firebase Setup](#firebase-setup)
- [Alur Data](#alur-data)
- [CI/CD](#cicd)
- [Scripts](#scripts)
- [Variabel Lingkungan](#variabel-lingkungan)
- [Known Limitations](#known-limitations)
- [Kontribusi](#kontribusi)

---

## What's Included

| Komponen                                                                  | Teknologi                 | Lokasi                   |
| ------------------------------------------------------------------------- | ------------------------- | ------------------------ |
| **Customer PWA** — Food, Ride, Send, Shop                                 | React 19 + Vite 6         | `aro-drive-vite/`        |
| **Admin Dashboard** — Manajemen driver, merchant, order, promo, pricing   | React 19 + Vite 6         | `aro-admin-vite/`        |
| **Driver Android App** — Real-time tracking, offline queue, multi-service | Kotlin + Jetpack Compose  | `aro-driver-kotlin/`     |
| **Firebase Backend** — 9 Cloud Functions modular                          | Node.js 22                | `functions/src/`         |
| **Shared Package** — Kode bersama (map, pricing, LocationPicker)          | JavaScript                | `packages/shared/`       |
| **CI/CD** — GitHub Actions auto-deploy + build APK                        | Firebase CLI + Gradle     | `.github/workflows/`     |
| **PWA Support** — Installable, offline-capable, push notifications        | vite-plugin-pwa + Workbox | Terintegrasi di tiap app |

---

## Layanan

| Layanan                | Nama Aplikasi           | Deskripsi                                               |
| ---------------------- | ----------------------- | ------------------------------------------------------- |
| **ARO FOOD**           | Customer PWA            | Pesan makanan dari berbagai merchant/restoran di Blitar |
| **ARO RIDE** (ARO JEK) | Customer PWA            | Panggil ojek motor untuk antar jemput                   |
| **ARO SEND**           | Customer PWA            | Kirim paket/dokumen dengan kurir                        |
| **ARO SHOP** (ARO TIP) | Customer PWA            | _Personal shopping_ / jastip — belikan barang dari toko |
| **Admin Dashboard**    | Admin PWA               | Monitoring pesanan, manajemen driver, pengaturan sistem |
| **Driver App**         | Android Native (Kotlin) | Terima & kelola pesanan, navigasi, tracking real-time   |

---

## Fitur Unggulan

- **Multi-layanan dalam satu platform** — Food, Ride, Send, Shop
- **Guest Mode** — Pesan tanpa login (dengan batasan tertentu)
- **Member & Loyalty Points** — Poin loyalitas & voucher gratis ongkir
- **Real-time Order Tracking** — Lacak posisi driver di peta
- **PWA (Progressive Web App)** — Bisa di-install di HP, offline-capable
- **Dark/Light Theme** — Tampilan bisa disesuaikan
- **Multi Payment** — COD & QRIS
- **WhatsApp Notifications** — Notifikasi otomatis via WA gateway (Fonnte)
- **Offline Queue** — Driver app tetap bisa beroperasi saat koneksi terputus
- **Google Vision AI** — Verifikasi foto driver & menu otomatis
- **Smart Dispatch** — Radius-based driver matching (3km → 5km → 10km → 20km)
- **State Machine** — Validasi transisi status order per service type

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FIREBASE BACKEND                                │
│                                                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────┐  ┌──────────────┐│
│  │  Firestore   │  │  Realtime DB  │  │ Functions  │  │   Storage    ││
│  │ (orders,     │  │ (drivers,     │  │ (dispatch, │  │ (images,     ││
│  │  users,      │  │  presence,    │  │  notifikasi,│  │  QRIS,      ││
│  │  merchants,  │  │  incoming)    │  │  pricing)  │  │  profile)   ││
│  │  settings)   │  │               │  │            │  │              ││
│  └──────────────┘  └───────────────┘  └────────────┘  └──────────────┘│
│         ▲                  ▲                 ▲                          │
│         │                  │                 │                          │
└─────────┼──────────────────┼─────────────────┼──────────────────────────┘
          │                  │                 │
    ┌─────┴──────┐    ┌──────┴───────┐   ┌────┴────────┐
    │  CUSTOMER  │    │    ADMIN     │   │   DRIVER    │
    │  PWA       │    │   DASHBOARD  │   │  KOTLIN APP │
    │  (React)   │    │   (React)    │   │  (Android)  │
    │            │    │              │   │             │
    │ aro-drive- │    │ aro-admin-   │   │ aro-driver- │
    │ vite/      │    │ vite/        │   │ kotlin/     │
    └────────────┘    └──────────────┘   └─────────────┘

FIREBASE HOSTING SITES:
  gb-delivery-41bf6  → Landing page          (aro-landing-page/)
  aro-drive-user     → Customer PWA          (aro-drive-vite/dist/)
  aro-drive-admin    → Admin Dashboard       (aro-admin-vite/dist/)
```

---

## Tech Stack

### Customer PWA (`aro-drive-vite`)

| Layer            | Teknologi                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Framework        | React 19                                                                                               |
| Build Tool       | Vite 6                                                                                                 |
| Bahasa           | JavaScript (JSX)                                                                                       |
| Styling          | Tailwind CSS 3.4                                                                                       |
| State Management | Zustand 5 (persist middleware)                                                                         |
| Routing          | React Router DOM v7                                                                                    |
| Animation        | Framer Motion 12                                                                                       |
| Maps             | Leaflet 1.9 + react-leaflet 5 (OSM/CARTO — default, gratis); @react-google-maps/api v2 (mode rollback) |
| Icons            | Lucide React 0.468, Material Symbols                                                                   |
| HTTP             | Axios 1.15                                                                                             |
| Fuzzy Search     | Fuse.js 7                                                                                              |
| UI Component     | Vaul (Drawer/Sheet) 1.1                                                                                |
| PWA              | vite-plugin-pwa 0.21 + Workbox                                                                         |
| Fonts            | Inter, Plus Jakarta Sans, Outfit                                                                       |

### Admin Dashboard (`aro-admin-vite`)

| Layer            | Teknologi                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Framework        | React 19                                                                                               |
| Build Tool       | Vite 6                                                                                                 |
| Styling          | Tailwind CSS 3.4                                                                                       |
| State Management | Zustand 5                                                                                              |
| Routing          | React Router DOM v7                                                                                    |
| Maps             | Leaflet 1.9 + react-leaflet 5 (OSM/CARTO — default, gratis); @react-google-maps/api v2 (mode rollback) |
| Icons            | Lucide React 0.468                                                                                     |

### Driver Android App (`aro-driver-kotlin`)

| Layer           | Teknologi                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Bahasa          | Kotlin 2.0.21                                                                                            |
| UI              | Jetpack Compose (BOM 2024.10)                                                                            |
| Build System    | Gradle 8.7.3                                                                                             |
| Target SDK      | 35 (Android 14+)                                                                                         |
| Min SDK         | 24 (Android 7.0)                                                                                         |
| Architecture    | MVVM (ViewModel + Compose)                                                                               |
| Image Loading   | Coil Compose 2.7                                                                                         |
| HTTP            | OkHttp 4.12                                                                                              |
| Local DB        | Room 2.6.1                                                                                               |
| Background Work | WorkManager 2.9.1                                                                                        |
| Location        | Google Play Services Location 21.3                                                                       |
| Maps            | osmdroid 6.1.20 (OSM — default, gratis) + Maps Utils (polyline); Google Maps Compose 6.4 (mode rollback) |
| Firebase        | Auth, Firestore, Storage, Messaging, RTDB, Config, Crashlytics, Analytics                                |

### Firebase Cloud Functions (`functions`)

| Layer            | Teknologi                      |
| ---------------- | ------------------------------ |
| Runtime          | Node.js 22                     |
| Framework        | Firebase Functions v7 (v2 API) |
| Admin SDK        | firebase-admin 13.8            |
| HTTP             | Axios 1.7                      |
| Image Processing | Sharp 0.34                     |
| AI/ML            | @google-cloud/vision 4.0       |

### Backend & Infrastructure

| Komponen          | Teknologi                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database Utama    | Firebase Firestore                                                                                                                                                                 |
| Real-time Data    | Firebase Realtime Database (presence driver, dispatch)                                                                                                                             |
| Auth              | Firebase Authentication (Google Sign-In + Email/Password)                                                                                                                          |
| Storage           | Firebase Storage (gambar, QRIS, foto profil)                                                                                                                                       |
| Push Notification | Firebase Cloud Messaging (FCM)                                                                                                                                                     |
| Hosting           | Firebase Hosting (3 sites)                                                                                                                                                         |
| WhatsApp Gateway  | Fonnte API                                                                                                                                                                         |
| Maps              | OSM stack gratis: Leaflet/react-leaflet (web) + osmdroid (Android) + Photon/Nominatim (search) + OSRM (rute); Google Maps API hanya untuk rollback (billing GCP mati per Okt 2026) |

---

## Struktur Proyek

```
ARO-DRIVE/
│
├── .env.example                   # Template env root
├── .firebaserc                    # Default project Firebase
├── firebase.json                  # Konfigurasi Firebase utama
├── database.rules.json            # Security rules Realtime DB
├── firestore.rules                # Security rules Firestore
├── firestore.indexes.json         # Composite indexes Firestore
├── storage.rules                  # Security rules Storage
├── cors.json                      # CORS config GCS
├── package.json                   # Monorepo root
├── LICENSE                        # MIT License
│
├── aro-drive-vite/                # CUSTOMER PWA
│   ├── src/
│   │   ├── App.jsx                # Routing utama
│   │   ├── main.jsx               # Entry point + SW registration
│   │   ├── index.css              # Global styles + CSS variables (dark/light)
│   │   ├── pages/                 # Halaman aplikasi
│   │   ├── components/            # Komponen reusable
│   │   ├── store/                 # Zustand stores
│   │   │   └── __tests__/         # Store unit tests
│   │   ├── firebase/              # Firebase config, messaging, order service
│   │   ├── hooks/                 # Custom hooks (useCurrentLocation)
│   │   ├── utils/                 # Utilities (image, map, time)
│   │   │   └── __tests__/         # Util unit tests
│   │   └── workers/               # Web Worker (search)
│   ├── public/
│   ├── scripts/                   # Data seeding & maintenance scripts
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── aro-admin-vite/                # ADMIN DASHBOARD
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/                 # 11 halaman dashboard terpisah
│   │   ├── components/
│   │   ├── store/
│   │   │   └── __tests__/         # Store unit tests
│   │   └── firebase/
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── aro-driver-kotlin/             # DRIVER ANDROID APP
│   ├── app/
│   │   ├── build.gradle
│   │   ├── google-services.json   # Firebase Android config
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       └── java/com/arodriverkotlin/
│   │           ├── MainActivity.kt
│   │           ├── background/    # Geofence, OfflineQueue, Heartbeat, Workers
│   │           ├── database/      # Room DB (entities, DAOs)
│   │           ├── location/      # LocationEngine (Google + Android)
│   │           ├── map/           # Google Maps composables
│   │           ├── models/        # Data models
│   │           ├── navigation/    # Compose Navigation
│   │           ├── notification/  # Notification Engine
│   │           ├── order/         # OrderDispatcher, StateMachine
│   │           ├── service/       # ForegroundService, Session, Trip
│   │           ├── ui/            # UI Screens (Compose)
│   │           └── viewmodel/     # ViewModels
│   ├── build.gradle
│   ├── settings.gradle
│   ├── gradle.properties
│   └── keystore.properties        # Signing credentials
│
├── functions/                     # FIREBASE CLOUD FUNCTIONS
│   ├── index.js                   # Entry point — cuma import & export
│   ├── src/
│   │   ├── admin.js               # Admin endpoints (verify, sync, migrate)
│   │   ├── dispatch.js            # Dispatch logic + region config
│   │   ├── drivers.js             # Driver management + auto-offline
│   │   ├── merchants.js           # Photo sync, Google Vision API
│   │   ├── notifications.js       # Fonnte WA + FCM push
│   │   ├── orders.js              # Order lifecycle + state machine
│   │   ├── pricing.js             # Fee calculation
│   │   ├── utils.js               # Helpers (haversine, dll)
│   │   └── validation.js          # Input validation
│   ├── tests/                     # Jest unit tests
│   └── templates.js               # Template WhatsApp
│
├── packages/shared/               # SHARED PACKAGE (@aro/shared)
│   ├── package.json
│   ├── mapConfig.js               # Google Maps konfigurasi
│   ├── LocationPickerModal.jsx    # Picker lokasi reusable
│   ├── firebase.js                # Firebase init config
│   ├── pricing.js                 # Fee calculation helpers
│   └── utils.js                   # Utility functions
│
├── aro-landing-page/              # LANDING PAGE
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   ├── sw.js                      # Service Worker
│   └── assets/                    # Logo, images
│
├── docs/                          # DOKUMENTASI
│   ├── PLAN.md                    # Rencana kerja & progress
│   ├── SETUP.md                   # Panduan setup lengkap
│   └── workflows/                 # Workflow detail tiap task
│
└── images/                        # Placeholder gambar
```

---

## Prasyarat

Sebelum memulai, pastikan Anda telah menginstal:

- **Node.js** >= 22
- **npm** >= 9
- **Java JDK** 17 (untuk build Android)
- **Firebase CLI** (`npm install -g firebase-tools`)
- **gcloud CLI** — opsional, untuk Google Cloud Vision API
- **Android Studio** + Android SDK (untuk driver app)
- **Google Maps API Key** — **opsional** (hanya untuk mode rollback `VITE_MAP_PROVIDER=google`; default sekarang OSM tanpa key):
  - Maps JavaScript API
  - Places API
  - Directions API
  - Geocoding API

---

## Instalasi & Konfigurasi

Panduan setup lengkap ada di [`docs/SETUP.md`](docs/SETUP.md). Ringkasan:

```bash
# 1. Clone repo
git clone <repo-url>
cd aro-drive

# 2. Copy & isi environment variables
cp .env.example .env
cp aro-drive-vite/.env.example aro-drive-vite/.env
cp aro-admin-vite/.env.example aro-admin-vite/.env

# 3. Install dependencies
npm install
npm install --prefix functions
npm install --prefix aro-drive-vite
npm install --prefix aro-admin-vite

# 4. Pilih project Firebase & deploy
firebase use --add
firebase deploy

# 5. Seed data admin
node aro-drive-vite/scripts/seedSystem.js
```

---

## Menjalankan Lokal

```bash
# Customer PWA (port 5173)
cd aro-drive-vite && npm run dev

# Admin Dashboard (port 5174)
cd aro-admin-vite && npm run dev

# Firebase Functions Emulator
cd functions && npm run serve

# Driver Android App (via Android Studio atau CLI)
cd aro-driver-kotlin && ./gradlew installDebug
```

---

## Build

```bash
# Customer PWA → dist/
cd aro-drive-vite && npm run build

# Admin Dashboard → dist/
cd aro-admin-vite && npm run build

# Android Release APK
cd aro-driver-kotlin && ./gradlew assembleRelease

# Preview build lokal
cd aro-drive-vite && npm run preview
```

**Testing:**

```bash
# Backend functions (Jest)
cd functions && npm test

# Customer PWA (Vitest)
cd aro-drive-vite && npm test

# Admin Dashboard (Vitest)
cd aro-admin-vite && npm test
```

---

## Deploy ke Firebase

```bash
# Deploy semua
firebase deploy

# Per komponen
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage
firebase deploy --only database

# Spesifik target hosting
firebase deploy --only hosting:aro-drive-user
firebase deploy --only hosting:aro-drive-admin
```

### Target Firebase Hosting

| Target              | Site                        | Source                 | Deskripsi       |
| ------------------- | --------------------------- | ---------------------- | --------------- |
| `gb-delivery-41bf6` | `gb-delivery-41bf6.web.app` | `aro-landing-page/`    | Landing page    |
| `app`               | `aro-drive-user.web.app`    | `aro-drive-vite/dist/` | Customer PWA    |
| `admin`             | `aro-drive-admin.web.app`   | `aro-admin-vite/dist/` | Admin Dashboard |

---

## Firebase Setup

### Firestore Collections

| Collection       | Deskripsi                                 |
| ---------------- | ----------------------------------------- |
| `users`          | Data pengguna (customer)                  |
| `drivers`        | Profil driver                             |
| `orders`         | Semua pesanan                             |
| `merchants`      | Data merchant/restoran/toko               |
| `settings`       | Konfigurasi platform (harga, komisi, dll) |
| `banners`        | Promo banner                              |
| `admins`         | Admin credentials                         |
| `topup_requests` | Request top-up driver                     |
| `diagnostics`    | Log diagnosa driver                       |

### Realtime Database

Struktur untuk real-time communication:

```
/drivers/{uid}
  /location       → { lat, lng, timestamp, speed, bearing }
  /status         → "online" | "offline" | "busy"
  /incoming       → { orderId, ... } (order dispatch)
  /online_time    → track durasi online harian
```

### Firebase Storage

| Path                                | Kegunaan      |
| ----------------------------------- | ------------- |
| `qris/{userId}`                     | QRIS images   |
| `profile_pictures/{userId}`         | Foto profil   |
| `merchant_photos/{merchantId}`      | Foto merchant |
| `menu_photos/{merchantId}/{itemId}` | Foto menu     |

### Cloud Functions

| Function             | Trigger                             | Deskripsi                                                   |
| -------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `onOrderCreated`     | Firestore `orders.onCreate`         | Dispatch driver, kirim notifikasi                           |
| `onOrderUpdate`      | Firestore `orders.onUpdate`         | Validasi state machine, update rating, poin                 |
| `autoOfflineDrivers` | Scheduled (every 3 min)             | Auto-offline driver yang inactivity > 5 menit atau > 12 jam |
| `dailyReset`         | Scheduled (midnight)                | Reset daily online time driver                              |
| `checkDriverPhoto`   | Storage `profile_pictures.onCreate` | Verifikasi foto driver via Google Vision AI                 |

---

## Alur Data

### Order → Dispatch → Tracking

```
1. CUSTOMER PWA
   ├─ Pilih layanan (Food/Ride/Send/Shop)
   ├─ Pilih merchant/tujuan
   ├─ Checkout → write ke Firestore orders/{orderId}
   └─ Status: "waiting_driver"

2. CLOUD FUNCTION (onOrderCreated)
   ├─ Baca data order & settings
   ├─ Cari driver online via RTDB /drivers/
   ├─ Hitung jarak (Haversine) — radius: 3km → 5km → 10km → 15km → 20km
   ├─ Kirim order via RTDB /drivers/{uid}/incoming
   └─ Kirim FCM notification ke driver terpilih

3. DRIVER APP
   ├─ Listen RTDB /incoming
   ├─ Tampilkan notifikasi + detail order
   ├─ Accept → update Firestore orders/{orderId}.driverId
   └─ Navigasi ke lokasi pickup

4. CLOUD FUNCTION (onOrderUpdate)
   ├─ Validasi state transition
   ├─ Antar Jemput → Ubah status order
   └─ Kirim FCM + WA notifikasi (ke customer & merchant)

5. REAL-TIME TRACKING
   ├─ Driver app → write location ke RTDB /drivers/{uid}/location
   ├─ Customer PWA → read location via RTDB
   └─ Marker driver update di peta (setiap 2-5 detik)

6. SELESAI
   ├─ Driver complete order
   ├─ Hitung biaya akhir + komisi
   ├─ Update rating driver
   ├─ Beri loyalty points ke customer
   └─ Kirim receipt via WhatsApp
```

### State Machine per Service Type

Setiap tipe layanan memiliki state machine yang valid:

| State              | Transport | Food | Express | Send | Shop |
| ------------------ | --------- | ---- | ------- | ---- | ---- |
| `waiting_driver`   | ✅        | ✅   | ✅      | ✅   | ✅   |
| `driver_assigned`  | ✅        | ✅   | ✅      | ✅   | ✅   |
| `driver_arrived`   | ✅        | —    | —       | —    | —    |
| `picking_up`       | —         | ✅   | ✅      | ✅   | ✅   |
| `pickup_completed` | —         | —    | ✅      | ✅   | —    |
| `ordering`         | —         | —    | —       | —    | ✅   |
| `delivering`       | ✅        | ✅   | ✅      | ✅   | ✅   |
| `completed`        | ✅        | ✅   | ✅      | ✅   | ✅   |
| `cancelled`        | ✅        | ✅   | ✅      | ✅   | ✅   |

---

## CI/CD

### Deploy ke Firebase

**Workflow:** `.github/workflows/deploy.yml`

**Trigger:** Push ke branch `main`

**Steps:**

1. Install dependencies monorepo
2. Build User App + Admin App
3. Run tests (functions + user + admin)
4. Setup Java 17 + Android SDK
5. Build Kotlin APK (debug)
6. Deploy Cloud Functions + Hosting ke Firebase

**Secrets yang dibutuhkan:** Firebase API keys, Google Maps API key, Firebase Token

### Build APK Release

**Workflow:** `.github/workflows/build-release.yml`

**Trigger:** Push tag `v*`

**Steps:**

1. Setup Java 17 + Gradle
2. Decode keystore dari secrets
3. Build APK release
4. Buat GitHub Release dengan changelog

**Secrets yang dibutuhkan:**

- `KEYSTORE_BASE64` — Keystore file dalam base64
- `KEYSTORE_PASSWORD` — Password keystore
- `KEY_PASSWORD` — Password key
- `KEY_ALIAS` — Key alias

---

## Scripts

### Data Seeding & Maintenance (`aro-drive-vite/scripts/`)

| Script                              | Fungsi                           |
| ----------------------------------- | -------------------------------- |
| `seedSystem.js`                     | Seeder konfigurasi sistem        |
| `seed-banners.js`                   | Seeder promo banner              |
| `fetch-food.js`                     | Fetch data merchant makanan      |
| `fetch_shops.js`                    | Fetch data merchant toko         |
| `populate-merchant-images.js`       | Isi foto merchant                |
| `fill-menu-photos.js`               | Isi foto menu                    |
| `update-food-photos.js`             | Update foto makanan              |
| `update-keywords.js`                | Update keywords pencarian        |
| `update-search-names.js`            | Update nama pencarian            |
| `massive-populate.js`               | Populasi data massal             |
| `smart-populate-menu.js`            | Populasi menu pintar             |
| `auto_onboard_popular_merchants.js` | Auto-onboarding merchant populer |
| `check-storage-files.js`            | Audit file di Storage            |
| `apply-updates-admin.js`            | Update dari admin                |

---

## Variabel Lingkungan

### Root `.env`

| Variable                   | Deskripsi                                      |
| -------------------------- | ---------------------------------------------- |
| `VITE_MAP_PROVIDER`        | `osm` (default, gratis) \| `google` (rollback) |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API Key (hanya mode `google`)      |

### `aro-drive-vite/.env`

| Variable                            | Deskripsi                                      |
| ----------------------------------- | ---------------------------------------------- |
| `VITE_FIREBASE_API_KEY`             | Firebase Web API Key                           |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Firebase Auth Domain                           |
| `VITE_FIREBASE_DATABASE_URL`        | Firebase Realtime Database URL                 |
| `VITE_FIREBASE_PROJECT_ID`          | Firebase Project ID                            |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Firebase Storage Bucket                        |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM Sender ID                                  |
| `VITE_FIREBASE_APP_ID`              | Firebase App ID                                |
| `VITE_FIREBASE_MEASUREMENT_ID`      | Firebase Measurement ID (opsional)             |
| `VITE_MAP_PROVIDER`                 | `osm` (default, gratis) \| `google` (rollback) |
| `VITE_GOOGLE_MAPS_API_KEY`          | Google Maps API Key (hanya mode `google`)      |

### `aro-admin-vite/.env`

| Variable                            | Deskripsi                                      |
| ----------------------------------- | ---------------------------------------------- |
| `VITE_FIREBASE_API_KEY`             | Firebase Web API Key                           |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Firebase Auth Domain                           |
| `VITE_FIREBASE_DATABASE_URL`        | Firebase Realtime Database URL                 |
| `VITE_FIREBASE_PROJECT_ID`          | Firebase Project ID                            |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Firebase Storage Bucket                        |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM Sender ID                                  |
| `VITE_FIREBASE_APP_ID`              | Firebase App ID                                |
| `VITE_FIREBASE_MEASUREMENT_ID`      | Firebase Measurement ID (opsional)             |
| `VITE_USER_APP_URL`                 | URL Customer App (untuk link dari admin)       |
| `VITE_MAP_PROVIDER`                 | `osm` (default, gratis) \| `google` (rollback) |
| `VITE_GOOGLE_MAPS_API_KEY`          | Google Maps API Key (hanya mode `google`)      |

---

## Known Limitations

- **iOS app** — Belum tersedia (hanya Android native untuk driver)
- **Payment gateway** — Belum terintegrasi payment gateway otomatis (hanya COD & QRIS manual)
- **Multi-language** — Hanya Bahasa Indonesia
- **Driver web app** — Belum dibangun (hanya ada Android native)
- **Mitra portal** — Belum dibangun (merchant mengelola via admin dashboard)
- **Offline mode (PWA)** — Terbatas pada halaman yang sudah di-cache
- **Mode gratis (Spark)** — Billing GCP mati sementara: Cloud Functions tidak di-deploy → dispatch order otomatis & FCM push server belum jalan (rencana Fase 4 di `docs/ALTERNATIF_GRATIS_PLAN.md`); verifikasi foto via Vision/Places dinonaktifkan (upload manual). Peta sudah 100% OSM/Leaflet (tanpa billing).

---

## Kontribusi

1. Fork repository ini
2. Buat branch fitur (`git checkout -b feat/fitur-keren`)
3. Commit perubahan (`git commit -m 'feat: tambah fitur keren'`)
4. Push ke branch (`git push origin feat/fitur-keren`)
5. Buat Pull Request

### Convention Commit

Gunakan [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — Fitur baru
- `fix:` — Perbaikan bug
- `refactor:` — Refaktor kode
- `style:` — Perubahan styling (CSS, UI)
- `docs:` — Dokumentasi
- `chore:` — Tugas maintenance
- `perf:` — Optimasi performa

---

© 2026 ARO DRIVE. All rights reserved.
