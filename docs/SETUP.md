# Setup Guide — ARO DRIVE

## Prasyarat

- **Node.js 22+** (dengan npm)
- **Java 17+** (untuk build Android)
- **Firebase CLI** — `npm install -g firebase-tools`
- **gcloud CLI** — [Download](https://cloud.google.com/sdk/docs/install)
- **Android Studio** (untuk build APK Android)

## 1. Buat Firebase Project

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Buat project baru (nama terserah)
3. **Enable produk berikut:**
   - Authentication (Email/Password + Google)
   - Cloud Firestore (lokasi: `asia-southeast1`)
   - Realtime Database (lokasi: `asia-southeast1`)
   - Cloud Storage
   - Cloud Functions
4. **Aktifkan billing** (wajib untuk Cloud Functions — cukup Blaze plan)
5. Register web app di Firebase Console:
   - Project Settings → General → Your apps → Add app → Web
   - Copy konfigurasi Firebase (apiKey, authDomain, dll)

### 1.1 Deploy Security Rules

```bash
firebase use --add   # pilih project yang baru dibuat
firebase deploy --only firestore,storage,database
```

Ini akan deploy rules dari:
- `firestore.rules`
- `storage.rules`
- `database.rules.json`

## 2. Setup Google Maps API

1. Buka [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Buat **API Key baru**
3. **Restrict API key:**
   - API restriction: `Maps JavaScript API`, `Places API`, `Directions API`
   - Application restriction: HTTP referrer (misal `*.web.app/*`, `localhost:*`)
4. Copy API key tersebut

## 3. Clone & Environment

```bash
git clone <repo-url>
cd aro-drive
```

Copy `.env.example` ke `.env` di setiap subproject:

```bash
cp .env.example .env
cp aro-drive-vite/.env.example aro-drive-vite/.env
cp aro-admin-vite/.env.example aro-admin-vite/.env
```

### Environment Variables

**Root `.env`:**

| Variable | Deskripsi |
|----------|-----------|
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API Key |

**`aro-drive-vite/.env` (User App):**

| Variable | Deskripsi |
|----------|-----------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `project.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | RTDB URL |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `VITE_FIREBASE_APP_ID` | App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Measurement ID (opsional) |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API Key |

**`aro-admin-vite/.env` (Admin Dashboard):**

| Variable | Deskripsi |
|----------|-----------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `project.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | RTDB URL |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `VITE_FIREBASE_APP_ID` | App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Measurement ID (opsional) |
| `VITE_USER_APP_URL` | URL user app (contoh: `http://localhost:5173`) |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API Key |

## 4. Install Dependencies

```bash
npm install                                     # root (monorepo)
npm install --prefix functions                  # Cloud Functions
npm install --prefix aro-drive-vite             # User App
npm install --prefix aro-admin-vite             # Admin Dashboard
```

## 5. Deploy ke Firebase

```bash
# Pilih project Firebase
firebase use --add

# Deploy semuanya
firebase deploy

# Atau per komponen:
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore,storage,database
```

## 6. Seed Data

Jalankan script seed untuk membuat user admin awal:

```bash
node aro-drive-vite/scripts/seedSystem.js
```

## 7. Build Android APK

### 7.1 Setup Signing Key

Buat keystore untuk signing APK:

```bash
keytool -genkey -v -keystore aro_partner.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias your_alias -storetype JKS
```

Buat file `aro-driver-kotlin/keystore.properties`:

```properties
storePassword=your_store_password
keyPassword=your_key_password
keyAlias=your_alias
storeFile=../aro_partner.jks
```

### 7.2 Build

```bash
cd aro-driver-kotlin
./gradlew assembleRelease
# atau untuk debug:
./gradlew assembleDebug
```

APK akan ada di:
- Release: `app/build/outputs/apk/release/app-release.apk`
- Debug: `app/build/outputs/apk/debug/app-debug.apk`

## 8. Development

### User App (aro-drive-vite)

```bash
cd aro-drive-vite
npm run dev        # http://localhost:5173
npm run build      # build production
npm test           # jalankan vitest
```

### Admin Dashboard (aro-admin-vite)

```bash
cd aro-admin-vite
npm run dev        # http://localhost:5174
npm run build
npm test
```

### Cloud Functions (Emulator)

```bash
cd functions
npm run serve      # Firebase Emulators
npm test           # jalankan jest
```

## 9. CI/CD

Proyek sudah punya GitHub Actions workflows:

- **`.github/workflows/deploy.yml`** — deploy otomatis ke Firebase setiap push ke `main`
- **`.github/workflows/build-release.yml`** — build APK release + GitHub Release saat tag `v*`

## Struktur Proyek

```
aro-drive/
├── aro-drive-vite/           # User App (React 19 + Vite)
│   └── src/
│       ├── pages/           # Halaman aplikasi
│       ├── store/           # Zustand stores
│       └── utils/           # Utility functions
├── aro-admin-vite/           # Admin Dashboard (React 19 + Vite)
│   └── src/
│       ├── pages/           # Halaman dashboard
│       └── store/           # Zustand stores
├── aro-driver-kotlin/        # Android Driver App (Kotlin)
├── aro-landing-page/         # Landing page statis
├── functions/                # Firebase Cloud Functions
│   ├── src/                 # Modular source
│   │   ├── admin.js         # Admin endpoints
│   │   ├── dispatch.js      # Dispatch logic
│   │   ├── drivers.js       # Driver management
│   │   ├── merchants.js     # Photo sync, Vision API
│   │   ├── notifications.js # Fonnte, FCM
│   │   ├── orders.js        # Order lifecycle
│   │   ├── pricing.js       # Fee calculation
│   │   ├── utils.js         # Helpers
│   │   └── validation.js    # Input validation
│   └── tests/               # Jest test files
├── packages/shared/          # Shared package (@aro/shared)
├── docs/                     # Dokumentasi
│   ├── PLAN.md              # Rencana kerja
│   └── SETUP.md             # (file ini)
└── firebase.json             # Firebase config
```

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `firebase deploy` gagal | Pastikan billing sudah aktif & `firebase use --add` sudah benar |
| Maps tidak muncul | Cek API key restriction & pastikan `Maps JavaScript API` enabled |
| Functions timeout | Naikkan timeout di `functions/src/index.js` atau upgrade billing tier |
| Android build error | Update SDK di `build.gradle`, pastikan Java 17+ terinstall |
| Google Sign-in error | Tambahkan domain authorized redirect URI di Firebase Console |
| `@aro/shared` not found | Jalankan `npm install` dari root (monorepo workspace) |
