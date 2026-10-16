# Production Readiness Plan — ARO DRIVE

**Target:** Arsitektur siap production — secure, scalable, maintainable, observable.
**Estimasi:** ~9-11 minggu (bisa diparalelkan)
**Penulis:** Auto-generated dari codebase analysis

---

## 🔴 FASE 0 — Security Patching (10 hari)

### Task 0.1: Hapus Keystore Credentials dari Disk

**Masalah:** `aro-driver-kotlin/keystore.properties` berisi password signing Android plaintext di disk. `aro_partner.jks` (2.7KB) juga ada di disk.

**Files affected:**

- `aro-driver-kotlin/keystore.properties` — berisi `storePassword`, `keyPassword`, `keyAlias`, `storeFile`
- `aro-driver-kotlin/aro_partner.jks` — signing key

**Workflow:**

1. Hapus `keystore.properties` dari disk (sudah di .gitignore)
2. Hapus `aro_partner.jks` dari disk (sudah di .gitignore)
3. Simpan base64-encoded keystore + password di GitHub Secrets:
   - `KEYSTORE_BASE64`
   - `KEYSTORE_PASSWORD`
   - `KEY_PASSWORD`
   - `KEY_ALIAS`
4. CI sudah inject otomatis via `build-release.yml`
5. Update docs/SETUP.md — kasih instruksi reproduce keystore untuk developer baru

---

### Task 0.2: Hapus Vercel OIDC Token dari Disk

**Masalah:** `aro-drive-vite/.env.local` mengandung `VERCEL_OIDC_TOKEN` — JWT valid.

**Workflow:**

1. Hapus file dari disk
2. Rotasi token di Vercel dashboard
3. Tambah `*.local` ke root `.gitignore` jika belum
4. Kasih instruksi di docs developer bahwa `.env.local` tidak boleh ada secret

---

### Task 0.3: Fix Firestore Security Rules — Settings Collection

**Masalah:** `settings/{doc}` world-readable. `settings/configs` berisi Fonnte token + Google API key.

**Files affected:**

- `firestore.rules`

**Rules yang baru:**

```
match /settings/configs/{doc} {
  allow read, write: if isAdmin();
}
match /settings/{doc} {
  allow read: if true;
  allow write: if isAdmin();
}
```

**Workflow:**

1. Split settings jadi 2:
   - `settings/public` — pricing, platform rate, banners (public read)
   - `settings/configs` — API keys, tokens (admin only read)
2. Update rules
3. Migrasi data: pindahkan `fonnte.token`, `googleMapsApiKey` dari `settings/platform` ke `settings/configs`
4. Update kode yang baca settings:
   - `functions/src/notifications.js:44` — baca Fonnte token dari `settings/configs`
   - `functions/src/merchants.js` — baca Google API key dari `settings/configs`
   - `functions/src/admin.js` — baca Google API key dari `settings/configs`

---

### Task 0.4: Environment-Based Infrastructure Config

**Masalah:** `databaseURL` hardcoded di `functions/index.js:12`, bucket name hardcoded di `admin.js:451`.

**Files affected:**

- `functions/index.js`
- `functions/src/admin.js`
- `.env.yaml` (Firebase Functions env)

**Target:**

```js
// functions/index.js
admin.initializeApp({
  databaseURL:
    process.env.DATABASE_URL ||
    'https://gb-delivery-41bf6-default-rtdb.asia-southeast1.firebasedatabase.app',
});
```

**Workflow:**

1. Pindah ke environment variables
2. Set env via Firebase CLI: `firebase functions:config:set app.database_url="..." app.storage_bucket="..."`
3. Atau pakai `.env.yaml` untuk local development
4. Update `admin.js:451` — baca bucket dari `admin.storage().bucket()` (default sudah pakai project default)

---

### Task 0.5: Auth Guard untuk Semua Endpoint

**Masalah:** `receiveCrashLog` tanpa auth, `rejectOffer` tidak verifikasi caller identity.

**Files affected:**

- `functions/src/admin.js`

**Workflow:**

1. `receiveCrashLog` (line 44): tambah auth guard minimal → verify ID token, simpan `uid` dari token (bukan dari body)
2. `rejectOffer` (line 376): setelah validasi `dispatch.offeredTo === driverId`, tambah verifikasi bahwa `driverId` = uid dari ID token caller
3. Standardisasi error response: semua endpoint return format `{ success: false, error: "message" }`

---

### Task 0.6: CORS Hardening

**Masalah:** Semua HTTP endpoint pakai `cors: true` (allow all origins). `cors.json` juga allow `*`.

**Files affected:**

- `functions/src/admin.js` (semua endpoint — `cors: true` di `onRequest`)
- `cors.json`

**Workflow:**

1. Ganti `cors: true` → `cors: ['https://aro-drive-admin.web.app', 'https://aro-drive-user.web.app', 'http://localhost:5173', 'http://localhost:5174']`
2. Update `cors.json` → `"origin": ["https://aro-drive-user.web.app", "https://aro-drive-admin.web.app"]`

---

## 🏛️ FASE 1 — Backend Architecture Refactor (3 minggu)

### Task 1.1: Event-Driven Notification System

**Masalah:** WA & FCM blocking di dalam `onOrderUpdate`. Gagal → silent `console.warn`, tidak ada retry.

**Target Architecture:**

```
onOrderUpdate (Firestore trigger)
    │
    ├── stateMachineHandler → validasi + rollback jika invalid
    ├── surchargeHandler → hitung pickup fee
    │
    └── write ke Firestore: notifications/{autoId}
        {
          type: "WA" | "FCM",
          target: "customer" | "driver" | "merchant",
          recipientId: "...",
          payload: {...},
          status: "pending",
          retryCount: 0,
          createdAt: serverTimestamp(),
          maxRetries: 3
        }
            │
            └── scheduled function "processNotifications" (every 30s)
                ├── query "pending" notifications
                ├── attempt send
                ├── success → status: "sent"
                └── fail → retryCount++, nextRetryAt: now + exponentialBackoff(retryCount)
                    └── retryCount >= maxRetries → status: "dead"
```

**Files baru:**

- `functions/src/services/notificationQueue.js`
- `functions/src/services/notificationProcessor.js` (scheduled function)

**Files diubah:**

- `functions/src/orders.js` — hapus semua logika WA/FCM langsung, ganti dengan enqueue ke notification queue
- `functions/src/notifications.js` — tetap sebagai core sender, dipanggil oleh processor
- `functions/index.js` — export fungsi baru

**Keuntungan:**

- Retry otomatis dengan exponential backoff
- Monitoring via Firestore query (`WHERE status = "dead"`)
- Tidak blocking order flow
- Audit trail (semua notifikasi tercatat)

---

### Task 1.2: Service Layer Backend

**Masalah:** Firebase Admin SDK langsung dipanggil di semua fungsi. Tidak ada abstraction, testing susah.

**Target structure:**

```
functions/src/
├── services/
│   ├── orderService.js       # Order CRUD + state machine logic
│   ├── driverService.js      # Driver CRUD + online status management
│   ├── merchantService.js    # Merchant CRUD + Vision AI pipeline
│   ├── notificationService.js # FCM + WA (pure send, no queue logic)
│   └── pricingService.js     # Fee calculation (pure function)
├── repositories/
│   ├── orderRepo.js          # Firestore access → orderCollection.doc(id).get()
│   ├── driverRepo.js         # Firestore + RTDB access
│   └── merchantRepo.js       # Firestore access
├── validators/
│   └── orderValidator.js     # State machine + input validation
├── config/
│   ├── firebase.js           # admin.initializeApp({...})
│   └── secrets.js            # Secret manager wrapper
├── index.js                  # Entry point
├── admin.js                  # HTTP endpoints → panggil service
├── orders.js                 # Firestore triggers → panggil service
├── dispatch.js               # Dispatch logic → panggil service
└── drivers.js                # Scheduled functions → panggil service
```

**Contoh pattern:**

```js
// repositories/orderRepo.js
class OrderRepository {
  async getById(orderId) {
    const doc = await admin.firestore().collection('orders').doc(orderId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }
  async update(orderId, data) {
    return admin.firestore().collection('orders').doc(orderId).update(data);
  }
}

// services/orderService.js
class OrderService {
  constructor(orderRepo, driverRepo, notificationQueue) {
    this.orderRepo = orderRepo;
    this.driverRepo = driverRepo;
    this.notificationQueue = notificationQueue;
  }
  async acceptOrder(orderId, driverId) {
    await this.orderRepo.update(orderId, { status: 'accepted', driverId });
    await this.notificationQueue.enqueue({ type: 'FCM', ... });
  }
}
```

**File diubah:** Semua file di `functions/src/` — refactor inline Firebase calls ke repository pattern.

**Testing benefit:** Repository bisa di-mock dengan mudah di Jest.

---

### Task 1.3: CQRS — Read Models untuk Orders

**Masalah:** Satu dokumen `orders/{id}` dibaca oleh customer, driver, admin, guest → semua field termasuk internal pricing & dispatch history bisa bocor.

**Target:**

```
orders/{id} (write model — full data)
    ↓ (Firestore onDocumentWritten trigger)
orders_public/{id} (read model — customer-facing)
  { status, driverId, driverName, driverPhone, driverPhoto,
    pickupLocation, dropoffLocation, estimatedArrival, total,
    items, createdAt }
orders_driver/{id} (read model — driver-facing)
  { status, customerName, customerPhone, pickupLocation,
    dropoffLocation, items, total, deliveryFee, commission }
```

**Files baru:**

- `functions/src/cqrs/syncPublicOrder.js` (trigger)
- `functions/src/cqrs/syncDriverOrder.js` (trigger)

**Alternatif lebih ringan:** BFF layer yang filtering field response, tanpa dokumen terpisah. Recommended untuk fase pertama.

---

### Task 1.4: Pisahkan onOrderUpdate (469 → ~5 handler)

**Target:**

```js
// orders.js
exports.onOrderUpdate = onDocumentUpdated(... , async (event) => {
  const { validTransition, dispatchRejected, statusChanged } = analyzeChange(event);

  if (!validTransition) return rollback(event);
  if (dispatchRejected) await handleRejection(event);
  if (!statusChanged) return;

  await Promise.allSettled([
    handlePickupSurcharge(event),
    handleRatingUpdate(event),
    handleLoyaltyPoints(event),
    enqueueNotifications(event),
  ]);
});
```

Masing-masing handler di file terpisah:

- `functions/src/handlers/surchargeHandler.js`
- `functions/src/handlers/ratingHandler.js`
- `functions/src/handlers/loyaltyHandler.js`
- `functions/src/handlers/notificationEnqueuer.js`

---

## 🎨 FASE 2 — Frontend Architecture (2 minggu)

### Task 2.1: TypeScript Migrasi — Shared Package Dulu

**Target:** `packages/shared/` pindah ke TypeScript dulu sebagai pilot.

```
packages/shared/
├── package.json        # "main": "dist/index.js", "types": "dist/index.d.ts"
├── tsconfig.json
├── src/
│   ├── mapConfig.ts
│   ├── LocationPickerModal.tsx
│   ├── firebase.ts
│   ├── pricing.ts
│   ├── utils.ts
│   └── index.ts
└── dist/
```

**File diubah:**

- `packages/shared/package.json` — tambah build script, types field
- `packages/shared/tsconfig.json` — baru
- Semua `.js` file di `packages/shared/` → `.ts`/`.tsx`

---

### Task 2.2: Pisahkan God Store (adminStore.js)

**Sekarang:** `adminStore.js` = pricing + UI labels + promo + categories + WhatsApp config + Firebase listeners.

**Target:**

```
stores/
├── adminStore.js        → admin auth + session (50 lines)
├── pricingStore.js      → pricing data + onSnapshot listener (60 lines)
├── uiStore.js           → UI labels + theme (50 lines)
├── promoStore.js        → banners + vouchers (40 lines)
├── cartStore.js         → cart CRUD (50 lines)
└── locationStore.js     → pickup/dropoff per service (80 lines)
```

---

### Task 2.3: Extract Firebase CRUD dari Store ke Service Layer

**Pattern yang benar:**

```js
// services/userService.js
import { doc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';

export async function addPoints(userId, amount) {
  const ref = doc(db, 'users', userId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data()?.loyaltyPoints || 0;
    tx.update(ref, { loyaltyPoints: current + amount });
  });
}

// stores/userStore.js
import { addPoints as addPointsService } from '../services/userService';

export const useUserStore = create((set, get) => ({
  loyaltyPoints: 0,
  addPoints: async (amount) => {
    const { user } = get();
    await addPointsService(user.id, amount);
    set((s) => ({ loyaltyPoints: s.loyaltyPoints + amount }));
  },
}));
```

---

### Task 2.4: Split Tracking.jsx (1067 lines)

**Target:** 1 orchestrator + 5 komponen terpisah

```
pages/Tracking.jsx (orchestrator — ~150 lines)
  ├── components/tracking/OrderMap.jsx (Google Map + markers + directions)
  ├── components/tracking/OrderStatusCard.jsx (status timeline)
  ├── components/tracking/CancelOrderModal.jsx (cancel flow)
  ├── components/tracking/RatingModal.jsx (rating + review)
  └── components/tracking/DriverInfoCard.jsx (driver details)

hooks/useOrderTracking.js (real-time order + driver location — extract dari Tracking.jsx)
```

---

### Task 2.5: PWA Offline Strategy

**Target:**

```
Service Worker (workbox):
  - NetworkFirst: GET orders/{id}, GET users/{id}
  - StaleWhileRevalidate: GET merchants/, GET menu/
  - CacheFirst: static assets (fonts, images, CSS)
  - Background Sync: POST order (queue if offline)

IndexedDB (via idb library):
  - Offline order queue
  - Cached merchant list
  - Cached user profile
```

**File diubah:**

- `aro-drive-vite/vite.config.js` — tambah runtime caching rules di `vite-plugin-pwa`
- Baru: `aro-drive-vite/src/sw/backgroundSync.js`

---

## 🧪 FASE 3 — Testing & Quality (2 minggu)

### Task 3.1: Unit Test Coverage

| Area                 | File                                 | Target Coverage | Estimasi |
| -------------------- | ------------------------------------ | --------------- | -------- |
| State Machine        | `functions/src/validation.js`        | 100%            | 1 hari   |
| Pricing              | `functions/src/pricing.js`           | 100%            | 0.5 hari |
| Dispatch             | `functions/src/dispatch.js`          | 80%+            | 2 hari   |
| Notifications        | `functions/src/notifications.js`     | 70%+            | 1 hari   |
| Admin endpoints      | `functions/src/admin.js`             | 60%+            | 3 hari   |
| Order handlers       | `functions/src/handlers/*.js`        | 80%+            | 2 hari   |
| Frontend stores      | `aro-drive-vite/src/store/*.test.js` | 90%+            | 2 hari   |
| Frontend services    | services baru                        | 80%+            | 1 hari   |
| Android ViewModel    | ViewModel test                       | 70%+            | 2 hari   |
| Android StateMachine | `OrderStateMachine.kt`               | 90%+            | 1 hari   |

**Total:** ~14 hari (bisa paralel)

---

### Task 3.2: Integration Test Firebase Rules

Pakai `@firebase/rules-unit-testing`:

```js
// tests/firestore-rules.test.js
describe('Firestore rules', () => {
  it('blocks customer from reading settings/configs', async () => {
    const db = getFirestore({ projectId: 'test', auth: { uid: 'customer1' } });
    await expect(getDoc(doc(db, 'settings', 'configs'))).toDeny();
  });
  it('allows admin to read settings/configs', async () => {
    const db = getFirestore({ projectId: 'test', auth: { uid: 'admin1' } });
    await admin.firestore().doc('users/admin1').set({ role: 'admin' });
    await expect(getDoc(doc(db, 'settings', 'configs'))).toAllow();
  });
});
```

---

### Task 3.3: Linting & Tooling

```bash
npm install --save-dev eslint prettier husky lint-staged
```

**Config:**

- `.eslintrc.cjs` — extends `eslint:recommended`, `plugin:react/recommended`
- `.prettierrc` — `{ "singleQuote": true, "trailingComma": "all" }`
- `.husky/pre-commit` — `npx lint-staged`
- `.lintstagedrc` — `*.js,*.jsx` → `eslint --fix && prettier --write`
- `npm audit` di CI
- Dependabot config: `.github/dependabot.yml`

---

## ☁️ FASE 4 — Infrastructure & Observability (2 minggu)

### Task 4.1: CI/CD Pipeline Upgrade

**Sekarang:**

```
push → build → test (after build) → deploy production
```

**Target:**

```
push main → build → test (before build)
    ↓
deploy ke staging project (firebase use staging)
    ↓
manual approval (GitHub Environments)
    ↓
deploy ke production
    ↓
send Slack/Telegram notification
```

**Files diubah:**

- `.github/workflows/deploy.yml`

**Key changes:**

1. Test step SEBELUM build (fail fast)
2. Tambah environment: `staging`, `production`
3. Firebase project ID dari GitHub Environments variable
4. Tambah `firebase emulators:exec --only functions,firestore 'npm test'` di staging
5. Tambah Slack/Discord notification step

---

### Task 4.2: Monitoring & Logging

**Logging — replace console.log:**

```js
// utils/logger.js
function log(level, message, data = {}) {
  const entry = {
    severity: level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };
  console.log(JSON.stringify(entry));
}
```

**Alerting:**

| Metric                        | Alert threshold | Action                      |
| ----------------------------- | --------------- | --------------------------- |
| Function failure rate > 5%    | Critical        | Email + Slack               |
| Notification dead queue > 10  | Warning         | Email                       |
| Dispatch no-driver rate > 30% | Warning         | Investigate driver coverage |
| RTDB location age > 15 min    | Warning         | Driver app issue            |
| Function latency > 10s        | Warning         | Cold start atau bug         |

**Tools:**

- Firebase Crashlytics — sudah terintegrasi di Android
- Firebase Performance — tambah custom trace di function kritis
- Cloud Monitoring — dashboard + alert policy
- Sentry (opsional) — untuk error tracking frontend + backend

---

### Task 4.3: Firestore Backup

```bash
firebase deploy --only functions:backupFirestore
```

Atau pakai **Firebase Extensions**: `Export Collections to BigQuery` untuk analytics + backup.

---

### Task 4.4: Dependency Cleanup

**Masalah:** `firebase-admin` di frontend `aro-drive-vite/package.json`.

```bash
npm uninstall --prefix aro-drive-vite firebase-admin
```

**Cek dependency lain:**

- `framer-motion` ^12.38.0 — validasi compatibility dengan React 19
- `vitest` — pastikan version stabil (current stable is 3.x)
- `--legacy-peer-deps` — fix root cause, jangan suppress

---

## 📦 FASE 5 — Monorepo & Shared Package Cleanup (1 minggu)

### Task 5.1: Fix Workspace

```json
// package.json
{
  "workspaces": ["aro-drive-vite", "aro-admin-vite", "functions", "packages/shared"]
}
```

Hapus `"aro-drive-driver-vite"` (folder tidak ada).

---

### Task 5.2: Shared Package Proper Entry

```js
// packages/shared/index.js
export * from './mapConfig.js';
export { default as LocationPickerModal } from './LocationPickerModal.jsx';
export { calculateFee, calculateDistance } from './pricing.js';
export { haversine, deepClean, safeNum } from './utils.js';
```

```json
// packages/shared/package.json
{
  "main": "index.js",
  "exports": {
    ".": "./index.js"
  }
}
```

---

### Task 5.3: Dedup Pricing Logic

**Sekarang:** `calculateFee()` di 3 tempat (orderStore, adminStore, pricing.test).

**Target:** Semua import dari `@aro/shared/pricing.js` atau `functions/src/pricing.js` untuk backend.

---

### Task 5.4: Dedup Firebase Config

**Sekarang:** `config.js` di aro-drive-vite, aro-admin-vite, packages/shared — 3 file hampir identik.

**Target:** Semua import dari `@aro/shared/firebase`. Hapus duplicate files.

---

### Task 5.5: Cleanup Test / Scratch Files

**Files untuk dihapus:**

- `aro-drive-vite/src/pages/testTimestamp.js`
- `functions/createtestorder.js`
- `functions/test-drivers.js`
- `functions/delete_menu_photos.js`
- `functions/scratch/` (jika masih ada)
- `aro-drive-vite/src/pages/*.py`, `*.txt`, `*.json` (jika masih ada)

---

## 📘 FASE 6 — Documentation (1 minggu)

### Task 6.1: Update SETUP.md

1. Tambah section "Environment Variables yang Aman"
2. Jelaskan mana yang public (VITE_FIREBASE_* bisa public) mana yang secret (Fonnte token, Google API key)
3. Tambah instruksi setup GitHub Secrets + Environments

---

### Task 6.2: Architecture Decision Records (ADR)

Buat `docs/architecture/ADR-001.md` sampai `ADR-004.md`:

- ADR-001: RTDB for driver presence vs Firestore
- ADR-002: Radius expansion dispatch algorithm
- ADR-003: Monorepo structure decision
- ADR-004: Why BFF/Event-Driven was chosen (setelah refactor)

---

### Task 6.3: API Documentation

Generate `/docs/api/` — dokumentasi HTTP Cloud Functions endpoint:

- Format: OpenAPI 3.0 (YAML)
- Endpoint untuk: deleteUserAccount, deleteMerchant, syncMerchantPopularity, fetchMerchantPhoto, processAllExistingMerchants, rejectOffer, migrateImagesToWebP, receiveCrashLog
- Tools: `swagger-jsdoc` untuk auto-generate dari JSDoc

---

## 📊 Timeline & Dependencies

```
Minggu 1-2:    FASE 0 (Security)     → blocking untuk semua fase lain
Minggu 2-5:    FASE 1 (Backend)       → parallel dengan FASE 2
Minggu 4-6:    FASE 2 (Frontend)      → parallel dengan FASE 1
Minggu 5-7:    FASE 3 (Testing)       → mulai setelah FASE 1 backend selesai
Minggu 6-8:    FASE 4 (Infrastructure) → parallel dengan FASE 3
Minggu 8-9:    FASE 5 (Cleanup)       → setelah FASE 1 & 2
Minggu 9-10:   FASE 6 (Documentation)  → final
```

```
FASE 0: ████████░░░░░░░░░░░░░░░░░░░░░░░░░
FASE 1: ░░░░░░░░██████████████████░░░░░░░░░
FASE 2: ░░░░░░░░░░░░████████████████░░░░░░░
FASE 3: ░░░░░░░░░░░░░░░░░██████████████░░░░
FASE 4: ░░░░░░░░░░░░░░░░░░░░████████████░░░
FASE 5: ░░░░░░░░░░░░░░░░░░░░░░░░░████████░░
FASE 6: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░███████
```

---

## 🔥 Prioritas Eksekusi

### Quick Wins (3-4 hari pertama)

- [ ] **0.1** — Hapus keystore dari disk, simpan di GitHub Secrets
- [ ] **0.2** — Hapus .env.local, rotasi Vercel token
- [ ] **0.3** — Fix Firestore rules settings/configs
- [ ] **0.4** — Env-based databaseURL + bucket
- [ ] **0.5** — Auth guard crash log + rejectOffer
- [ ] **0.6** — CORS hardening
- [ ] **5.5** — Hapus test files dari repo

### Medium (1-2 minggu)

- [ ] **5.1-5.4** — Monorepo + shared package cleanup
- [ ] **2.2** — Pisahkan god store
- [ ] **2.3** — Service layer frontend
- [ ] **3.1** — Test coverage core
- [ ] **4.1** — CI/CD pipeline upgrade
- [ ] **4.2** — Logging structure

### Major (2-4 minggu)

- [ ] **1.1** — Event-driven notification
- [ ] **1.2** — Service layer backend
- [ ] **1.4** — Split onOrderUpdate
- [ ] **2.1** — TypeScript shared package
- [ ] **2.4** — Split Tracking.jsx
- [ ] **2.5** — PWA offline strategy
- [ ] **3.3** — Linting & tooling
- [ ] **4.3** — Backup schedule

---

## Notes untuk Developer

1. **Commit convention:** `production/{fase}-{task}: description`
2. **Branch strategy:** `production/fase-0-security`, `production/fase-1-backend`
3. **Setiap task harus ada test** sebelum merge
4. **Security fix harus di-review** minimal 2 orang
5. **Deployment:** Fase 0 bisa deploy kapan aja. Fase 1-6 sebaiknya di staging dulu
6. **Rollback plan:** Setiap perubahan Firestore rules harus ada backup rules sebelumnya
