# ARO DRIVE — Rencana Perbaikan Sebelum Dijual

**Target:** Source code siap dilepas ke pembeli (clean, aman, profesional)

**Timeline estimasi:** 17-29 hari (bisa dikerjakan paralel)

---

## 🔴 FASE 1 — CRITICAL SECURITY (3-5 hari)

### Task 1.1: Rotate Google Maps API Key yang Bocor

**Masalah:** API Key `AIzaSyAMdIaOkJQ8t_rokwEDkBWTJjjw9tmYzUk` ada di commit history dan file `.env` di disk.

**Workflow:**

```
1. Buka Google Cloud Console → APIs & Services → Credentials
2. Buat API key BARU untuk Google Maps
3. Batasi key baru:
   - API restriction: Maps SDK, Places API, Directions API
   - Application restriction: HTTP referrer atau IP
4. Hapus key lama dari Credentials (revoke)
5. Update semua file .env:
   - .env (root)
   - aro-drive-vite/.env
   - aro-admin-vite/.env
   - aro-admin-vite/.env.production
6. Update semua file .env.example dengan placeholder "YOUR_API_KEY"
7. Hapus key dari git history pakai BFG:
   java -jar bfg.jar --delete-files "gmaps api.txt" .
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
```

**Files affected:**
- `.env` (root + aro-drive-vite + aro-admin-vite + aro-admin-vite/.env.production)
- `.env.example` (root + aro-drive-vite + aro-admin-vite)
- `scratch/merchants_api.json` — hapus dari repo & history
- `gmaps api.txt` — hapus dari git history

---

### Task 1.2: Hapus Folder Grab Driver APK dari Repo

**Masalah:** `aro-driver-kotlin/grab-driver/` — 309MB, 10.688 file, berisi APK pesaing (Grab Driver)

**Workflow:**

```
1. Hapus dari working tree:
   git rm -rf aro-driver-kotlin/grab-driver/

2. Hapus dari git history (BFG):
   java -jar bfg.jar --delete-folders grab-driver .
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive

3. Update .gitignore — tambah:
   aro-driver-kotlin/grab-driver/
   *.apk
   *.aab
   *.zip
   output.log
```

**Juga hapus file besar lain yang tidak perlu:**
- `aro-driver-kotlin.zip` (2.3MB)
- `scratch/merchants_api.json` (1.8MB)
- `output.log`
- `notif driver.mp3`
- `brosur_aro_drive.png`

---

### Task 1.3: Tambah Auth Guard ke Semua Admin Endpoint

**Masalah:** 4 endpoint HTTP di `functions/index.js` bisa dipanggil SIAPAPUN tanpa autentikasi:
- `syncMerchantPopularityFromMaps`
- `fetchMerchantPhotoFromMaps`
- `processAllExistingMerchants`
- `migrateImagesToWebP`

**Workflow:**

```
1. Di functions/index.js, tambahkan di awal setiap fungsi:

   const authResult = await verifyAdminRequest(req);
   if (!authResult.success) {
       res.status(401).json({ error: authResult.error });
       return;
   }

2. Fungsi verifyAdminRequest SUDAH ADA di kode — tinggal dipakai
3. Test:
   - firebase deploy --only functions
   - Coba panggil endpoint TANPA header auth → harus 401
   - Coba panggil endpoint DENGAN token admin → harus sukses
```

---

### Task 1.4: Perbaiki Storage Security Rules

**Masalah:** `storage.rules` — `allow write: if request.auth != null;` — SEMUA user bisa nulis ke mana aja.

**Workflow:**

```
1. Edit storage.rules menjadi path-scoped:

   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {

       // Merchant photos — hanya admin
       match /merchants/{merchantId}/{allPaths=**} {
         allow read: if true;
         allow write: if isAdmin();
       }

       // Driver photos — hanya driver ybs
       match /drivers/{driverId}/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth.uid == driverId || isAdmin();
       }

       // QRIS images — hanya driver ybs
       match /qris/{driverId}/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth.uid == driverId || isAdmin();
       }

       // Menu photos — hanya admin
       match /merchant_menus/{allPaths=**} {
         allow read: if true;
         allow write: if isAdmin();
       }

       // Fallback — tidak ada akses
       match /{allPaths=**} {
         allow read, write: if false;
       }
     }
   }

2. Pastikan helper function isAdmin() ada di firestore.rules (atau duplicate)
3. Deploy: firebase deploy --only storage
4. Test: coba upload dari user biasa → harus ditolak
```

---

### Task 1.5: Perbaiki RTDB Security Rules

**Masalah:** `database.rules.json` — semua driver locations bisa dibaca oleh SEMUA user yang login.

**Workflow:**

```
1. Edit database.rules.json:

   {
     "rules": {
       "drivers": {
         ".read": "auth != null && (
           root.child('users').child(auth.uid).child('role').val() === 'admin'
         )",
         "$driverId": {
           ".write": "auth.uid === $driverId ||
             root.child('users').child(auth.uid).child('role').val() === 'admin'",
           ".read": "auth.uid === $driverId ||
             root.child('users').child(auth.uid).child('role').val() === 'admin'"
         }
       }
     }
   }

2. Deploy: firebase deploy --only database
3. Test: login sebagai customer biasa → coba baca /drivers → harus ditolak
```

---

### Task 1.6: Hapus Hardcoded Admin Email

**Masalah:** `aro-admin-vite/src/pages/Login.jsx` baris 34, 51 — `email === 'zyqidwiky@gmail.com'` hardcoded.

**Workflow:**

```
1. Edit Login.jsx:
   - Hapus pengecekan email hardcoded
   - Ganti dengan role lookup dari Firestore:
     users/{uid}/role === 'admin'
   - Atau baca dari collection admins/{uid}

2. Pastikan firestore.rules mengizinkan user membaca rolenya sendiri

3. Test: login dengan email lain yang punya role admin → harus bisa
```

---

## 🟡 FASE 2 — CODE QUALITY (7-14 hari)

### Task 2.1: Split Backend index.js

**Masalah:** `functions/index.js` = 2.254 baris dalam 1 file. (Nilai: 3/10)

**Workflow:**

```
1. Buat struktur folder:

   functions/
   ├── src/
   │   ├── dispatch.js        → dispatch logic (200 baris)
   │   ├── orders.js          → order lifecycle (400 baris)
   │   ├── drivers.js         → driver management (250 baris)
   │   ├── merchants.js       → photo sync, Vision API (350 baris)
   │   ├── notifications.js   → Fonnte, FCM (200 baris)
   │   ├── pricing.js         → fee calculation (150 baris)
   │   ├── admin.js           → admin endpoints (100 baris)
   │   ├── validation.js      → input validation (100 baris)
   │   └── utils.js           → helpers (100 baris)
   └── index.js               → cuma import & export (50 baris)

2. Pindah fungsi satu per satu:
   - Potong fungsi dari index.js
   - Paste ke file src/ yang sesuai
   - Export fungsi
   - Import di index.js

3. Perhatikan lazy imports:
   - axios, sharp, @google-cloud/vision di-require inline
   - Pindah tetap lazy tapi di module masing-masing

4. Test: deploy & uji setiap fungsi
```

---

### Task 2.2: Split Admin Dashboard (3.333 baris)

**Masalah:** `aro-admin-vite/src/pages/Dashboard.jsx` = 3.333 baris. (Nilai: 2/10)

**Workflow:**

```
1. Buat halaman terpisah:

   pages/
   ├── DashboardOverview.jsx     → Ringkasan + stats
   ├── DriverManagement.jsx      → CRUD driver
   ├── MerchantManagement.jsx    → CRUD merchant
   ├── UserManagement.jsx        → CRUD user
   ├── OrderManagement.jsx       → Lihat & filter order
   ├── PromotionManagement.jsx   → Banner, promo, voucher
   ├── PricingSettings.jsx       → Tarif & fee
   └── TransactionHistory.jsx    → Topup & transaksi

2. Setup React Router di App.jsx:

   /admin/dashboard
   /admin/drivers
   /admin/merchants
   /admin/users
   /admin/orders
   /admin/promotions
   /admin/pricing
   /admin/transactions

3. Pindah state & logic ke store/dashboardStore.js (Zustand)
4. Pindah Firebase CRUD ke service/dashboardService.js
5. Test semua fitur setelah split
```

---

### Task 2.3: Hapus Duplicate Code

**Masalah:** ~2.800 baris kode duplikat antar app. (Nilai: 3/10)

**Daftar duplikasi:**

| File | Baris | App |
|:-----|:-----:|:----|
| mapConfig.js | 243 × 2 | User + Admin |
| LocationPickerModal.jsx | 255 × 2 | User + Admin |
| firebase/config.js | 24 × 2 | User + Admin |
| AdminOrderCreate.jsx | ~790 × 2 | User + Admin |
| calculateFee() | ~40 × 2 | adminStore + orderStore |
| haversine() + helpers | ~40 × 2 | AdminOrderCreate × 2 |

**Workflow:**

```
1. Buat shared package:

   packages/shared/
   ├── package.json
   ├── mapConfig.js
   ├── LocationPickerModal.jsx
   ├── firebase.js
   ├── pricing.js
   └── utils.js

2. package.json shared:

   {
     "name": "@aro/shared",
     "version": "1.0.0",
     "private": true,
     "main": "*.js"
   }

3. Di aro-drive-vite/package.json & aro-admin-vite/package.json:

   "dependencies": {
     "@aro/shared": "file:../packages/shared"
   }

4. Hapus file duplicate dari kedua app
5. Ganti import dari @aro/shared
6. npm install di kedua app
7. Test: pastikan semua fitur masih jalan
```

---

### Task 2.4: Bersihin Repo dari File Sampah

**Masalah:** Banyak file development/script berceceran.

**Workflow:**

```
1. Hapus file tidak berguna:

   git rm -r functions/scratch/          # 8 file one-off script
   git rm -r scratch/                    # 8 file dev + JSON data dump
   git rm batch_scan.js                  # root level script
   git rm scratch-test-orders.js         # root level script
   git rm output.log                     # log file
   git rm "notif driver.mp3"             # file audio
   git rm brosur_aro_drive.png           # file brosur
   git rm aro-driver-kotlin.zip          # zip file

   Untuk Python scripts di pages/:
   git rm aro-drive-vite/src/pages/*.py
   git rm aro-drive-vite/src/pages/*.txt
   git rm aro-drive-vite/src/pages/*.json

2. Pindah script yang berguna ke folder scripts/ (jika perlu)
3. Update .gitignore
```

---

### Task 2.5: Tambah Input Validation ke HTTP Endpoints

**Masalah:** Endpoint tidak validasi input dengan benar.

**Workflow:**

```
1. Buat functions/src/validation.js:

   function validateEmail(email) { ... }
   function validateFirebaseUid(uid) { ... }
   function validateOrderId(id) { ... }
   function sanitizeString(str, maxLen) { ... }

2. Terapkan ke endpoint yang rawan:
   - deleteUserAccount → validasi uid
   - deleteMerchant → validasi merchantId
   - rejectOffer → validasi orderId + driverId
   - fetchMerchantPhoto → validasi merchantId

3. Tambah body size limit (express raw body limit)
```

---

## 🟢 FASE 3 — PROFESSIONAL TOUCH (5-7 hari)

### Task 3.1: Tambah License File

**Masalah:** Root repo tidak punya LICENSE. Hanya aro-admin-vite/LICENSE yang ada (MIT, copyright "gb-admin").

**Workflow:**

```
1. Buat LICENSE di root repo:
   - Pilih: MIT (untuk open source / source code sale)
   - Atau: Proprietary / All Rights Reserved (untuk commercial sale)
   - Ganti copyright jadi nama Anda atau perusahaan Anda

2. Update package.json semua subproject:
   "license": "MIT",
   "private": true

3. Hapus aro-admin-vite/LICENSE yang lama (copyright salah)
```

---

### Task 3.2: Setup Minimal Testing

**Masalah:** Nol test di seluruh project. (Nilai: 0/10)

**Workflow:**

```
1. Backend (Jest):

   npm install --save-dev jest
   Buat:
   - tests/pricing.test.js      → calculateFee, calculateAppFee
   - tests/dispatch.test.js     → haversine, validasi state
   - tests/validation.test.js   → input validation

2. Frontend (Vitest — sudah include di Vite):

   Buat:
   - aro-drive-vite/src/store/__tests__/orderStore.test.js
   - aro-drive-vite/src/utils/__tests__/mapConfig.test.js

3. Integrasi CI/CD:
   - package.json tambah: "test": "vitest run" / "jest"
   - deploy.yml tambah step: npm test
```

---

### Task 3.3: CI/CD Cleanup

**Masalah:** 5 workflow file (3 bikin APK duplikat), referensi app yang tidak ada.

**Workflow:**

```
1. Hapus duplicate workflow:
   - Hapus aro-driver-kotlin/.github/workflows/build.yml
   - Hapus .github/workflows/release.yml (digabung ke build-release.yml)
   - Hapus .github/workflows/build.yml (digabung ke build-release.yml)

   Sisakan:
   - deploy.yml → deploy ke Firebase (push ke main)
   - build-release.yml → build APK (tag v*)

2. Hapus step build app yang tidak ada dari deploy.yml:
   - Hapus "Build & Deploy ARO Driver" (aro-drive-driver-vite)
   - Hapus "Build & Deploy ARO Mitra" (aro-drive-mitra-vite)

3. Atau update firebase.json:
   - Hapus hosting entry untuk aro-drive-driver
   - Hapus hosting entry untuk aro-drive-mitra
   - (Atau biarkan dengan catatan "coming soon")

4. Tambah lint & test stage
```

---

### Task 3.4: Rapihin folder untuk Mitra & Driver Web Apps

**Masalah:** `firebase.json` referensi `aro-drive-mitra-vite` dan `aro-drive-driver-vite` tapi foldernya tidak ada.

**Opsi A — Hapus dari firebase.json:**

```
Hapus 2 hosting entry dari firebase.json
Simpan kode hosting yang ada: landing, user, admin
```

**Opsi B — Buat starter:**

```
Buat folder kosong dengan index.html "Coming Soon"
aroudrive-mitra-vite/dist/index.html
aro-drive-driver-vite/dist/index.html
```

---

### Task 3.5: Hapus Inline require() untuk Library Berat

**Masalah:** `require('axios')`, `require('sharp')`, `require('@google-cloud/vision')` di-inline di dalam function body — dipanggil berulang.

**Workflow:**

```
1. Di tiap module yang butuh library berat, pakai lazy pattern:

   let _sharp;
   function getSharp() {
     if (!_sharp) _sharp = require('sharp');
     return _sharp;
   }

2. Atau pindah ke top-level require (lebih simpel, startup dikit lebih lambat)
3. Test: deploy & uji fungsi yang pakai library tersebut
```

---

## 📘 FASE 4 — DOKUMENTASI & PACKAGING (2-3 hari)

### Task 4.1: Setup Guide

**Buat file docs/SETUP.md dengan konten:**

```
# Setup Guide — ARO DRIVE

## Prasyarat
- Node.js 22+
- Java 17+ (untuk Android)
- Firebase CLI (`npm install -g firebase-tools`)
- gcloud CLI
- Android Studio (untuk build APK)

## Langkah Cepat
1. Buat Firebase project baru
2. Enable: Authentication, Firestore, Realtime Database, Storage, Functions
3. Enable billing (wajib untuk Cloud Functions)
4. Setup Google Maps API
5. Clone repo: `git clone <repo-url>`
6. Copy .env.example → .env di setiap subproject
7. Isi env variables
8. `npm install` di root, functions/, aro-drive-vite/, aro-admin-vite/
9. `firebase use --add` → pilih project baru
10. `firebase deploy`
11. `node aro-drive-vite/scripts/seedSystem.js`
12. Setup Android signing key
13. `cd aro-driver-kotlin && ./gradlew assembleRelease`
```

---

### Task 4.2: Update README.md

**Yang perlu diupdate dari README.md saat ini:**

- Hapus referensi ke file/folder yang dihapus
- Update section "Project Structure"
- Ganti contributor/owner info
- Tambah section "What's Included"
- Tambah screenshot
- Tambah section "Known Limitations"
- Update env variable table

---

### Task 4.3: Git History Cleanup

**Pakai BFG Repo-Cleaner:**

```
# Hapus file dari history
java -jar bfg.jar --delete-files "gmaps api.txt" .
java -jar bfg.jar --delete-files "*.zip" .
java -jar bfg.jar --delete-files "merchants_api.json" .
java -jar bfg.jar --delete-folders "grab-driver" .
java -jar bfg.jar --delete-folders "scratch" .

# Final cleanup
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

---

### Task 4.4: Data Room untuk Pembeli (Opsional)

**Dokumen yang dikirim terpisah ke calon pembeli (tidak di git):**

```
ARO-DRIVE-Data-Room/
├── 01-Executive-Summary.pdf
├── 02-Feature-List.pdf
├── 03-Architecture-Overview.pdf
├── 04-Source-Code-Inventory.pdf
├── 05-Deployment-Guide.pdf
├── 06-Maintenance-Cost-Estimate.pdf
├── 07-TODO-Roadmap.pdf
└── 08-Terms-of-Sale.pdf
```

---

## 📊 TIMELINE KESELURUHAN

| Fase | Hari | Tugas Utama | Paralel? |
|:----:|:----:|:------------|:--------:|
| **Fase 1** 🔴 | 3-5 | Security: API key, auth guard, rules, hapus file kritis | ✅ Bisa paralel |
| **Fase 2** 🟡 | 7-14 | Code quality: split file, hapus duplikasi, bersihin repo | ⚠️ Sebagian paralel |
| **Fase 3** 🟢 | 5-7 | Professional: test, CI/CD, license, validation | ✅ Bisa paralel |
| **Fase 4** 📘 | 2-3 | Dokumentasi: setup guide, data room, git history cleanup | ✅ Bisa paralel |
| **Total** | **~17-29** | | |

### Versi Minimal (Cuma Biar Aman + Layak Presentasi)

| # | Task | Estimasi |
|:-:|:-----|:--------:|
| 1 | Rotate API key + git history cleanup | 1 hari |
| 2 | Hapus Grab Driver folder | 0,5 hari |
| 3 | Auth guard endpoint + firebase rules | 1 hari |
| 4 | Bersihin file sampah dari repo | 0,5 hari |
| 5 | License file | 0,5 hari |
| 6 | Setup guide sederhana | 1 hari |
| | **Total minimal** | **~4-5 hari** |

Setelah itu kode **aman secara security** dan **profesional secara presentation** — siap dipamerkan ke calon pembeli.

---

## 📋 CEKLIS STATUS

Gunakan ini untuk track progress:

### Fase 1 — Critical Security ✅
- [x] 1.1 Rotate Google Maps API Key — `.env` & `.env.example` pakai placeholder; git history dibersihkan via BFG. **Manual:** rotasi key di GCP Console.
- [x] 1.2 Hapus folder Grab Driver — folder & history dibersihkan via `git rm` + BFG; `.gitignore` diperbarui
- [x] 1.3 Auth guard ke admin endpoints — `verifyAdminRequest()` dipanggil di semua 4 endpoint rawan
- [x] 1.4 Perbaiki Storage rules — path-scoped dengan `isAdmin()`, fallback deny-all
- [x] 1.5 Perbaiki RTDB rules — akses `/drivers` dibatasi hanya admin & driver ybs
- [x] 1.6 Hapus hardcoded admin email — `Login.jsx` pakai role lookup Firestore

### Fase 2 — Code Quality
- [x] 2.1 Split index.js (2254 baris → modul)
- [x] 2.2 Split Dashboard.jsx (3333 baris → 11 files terpisah)
- [x] 2.3 Hapus duplicate code (shared package)
- [x] 2.4 Bersihin file sampah
- [x] 2.5 Tambah input validation

### Fase 3 — Professional Touch
- [x] 3.1 License file — MIT, root LICENSE + semua package.json
- [x] 3.2 Minimal test coverage — 6 test file (Jest backend + Vitest frontend)
- [x] 3.3 CI/CD cleanup — 2 workflow tersisa; duplikat `aro-driver-kotlin/.github/workflows/build.yml` dihapus
- [x] 3.4 Rapihin folder mitra & driver apps — Opsi A: hosting entries dihapus dari firebase.json
- [x] 3.5 Perbaiki inline require() — axios, sharp, vision pakai lazy loading pattern

### Fase 4 — Dokumentasi & Packaging
- [x] 4.1 Setup guide — `docs/SETUP.md` lengkap dengan prasyarat, 13 langkah, env table, struktur proyek, troubleshooting
- [x] 4.2 Update README.md — hapus ref stale, update struktur/Tech Stack/CI/CD/scripts/env/copyright, tambah What's Included + Known Limitations
- [x] 4.3 Git history cleanup — BFG: `gmaps api.txt`, `*.zip`, `grab-driver/`, `scratch/` dihapus dari history (kecuali tagged releases)
- [ ] 4.4 Data room (opsional)
