# FASE 1 — Backend Service Layer — 2026-07-25

## Task 1.1: Repository Pattern

**New files:**

- `functions/src/config/constants.js` — centralized constants (DISPATCH_CONFIG, REGION_CONFIG, timer values)
- `functions/src/repositories/orderRepo.js` — CRUD Firestore orders
- `functions/src/repositories/driverRepo.js` — Firestore + RTDB driver access, `getOnlineDrivers()`, `setStatus()`, `adjustBalance()`
- `functions/src/repositories/merchantRepo.js` — CRUD Firestore merchants
- `functions/src/repositories/userRepo.js` — CRUD Firestore users + `addPoints()`

**Files updated:**

- `functions/src/dispatch.js` — inline `getOnlineDrivers()` → `driverRepo.getOnlineDrivers()`, constants → `config/constants.js`
- `functions/src/orders.js` — import repos for use in `onOrderCreated`
- `functions/src/admin.js` — import repos (orderRepo, userRepo, driverRepo)

---

## Task 1.2: Service Layer

**New files:**

- `functions/src/services/orderService.js` — `acceptOrder()`, `completeOrder()`, `validateTransition()`
- `functions/src/services/driverService.js` — `getOnlineDrivers()`, `isEligibleForDispatch()`, `adjustBalance()`
- `functions/src/services/merchantService.js` — `getMerchant()`, `getGoogleApiKey()`
- `functions/src/services/notificationService.js` — `sendToUser()`, `sendWA()`, `sendToMerchant()`
- `functions/src/services/pricingService.js` — `getPricing()`, `calculatePickupFee()`, `calculateFinalFee()`
- `functions/src/validators/orderValidator.js` — `validateTransition()`, `validateOrderId()`, `sanitizeString()`

**Pattern:**

```
services/ → business logic, constructor DI untuk repos
validators/ → validasi state machine + input
```

---

## Task 1.3: Split onOrderUpdate → Handlers

**Before:** `onOrderUpdate` — 1 function, 469 baris, 6+ tanggung jawab

**After:**

```
orders.js               → orchestrator (~60 lines)
handlers/
├── stateMachineHandler.js  → analyzeChange() + rollback()
├── surchargeHandler.js     → pickup fee calculation
├── ratingHandler.js        → driver rating update
├── loyaltyHandler.js       → loyalty points
└── notificationHandler.js  → FCM + WA + dispatch rejection
```

**Flow:**

```js
analyzeChange(event)  → cek validitas + perubahan
if (!validTransition) → rollback()
if (dispatchRejected) → handleDispatchRejection()
if (!statusChanged)   → return

Promise.allSettled([
  surchargeHandler,
  ratingHandler,
  loyaltyHandler,
  notificationHandler,
])
```

---

## Struktur Baru

```
functions/src/
├── config/
│   └── constants.js
├── repositories/
│   ├── orderRepo.js
│   ├── driverRepo.js
│   ├── merchantRepo.js
│   └── userRepo.js
├── services/
│   ├── orderService.js
│   ├── driverService.js
│   ├── merchantService.js
│   ├── notificationService.js
│   └── pricingService.js
├── validators/
│   └── orderValidator.js
├── handlers/
│   ├── stateMachineHandler.js
│   ├── surchargeHandler.js
│   ├── ratingHandler.js
│   ├── loyaltyHandler.js
│   └── notificationHandler.js
├── admin.js          ← HTTP endpoints (gradually migrating to services)
├── orders.js         ← triggers → handlers
├── dispatch.js       ← dispatch → repos
├── drivers.js        ← schedules → repos
├── notifications.js  ← legacy (wrapped by notificationService)
├── pricing.js        ← legacy (wrapped by pricingService)
├── merchants.js      ← legacy
├── utils.js
└── validation.js
```

## Ringkasan

| Item         | Files                                |
| ------------ | ------------------------------------ |
| Files baru   | 16                                   |
| Files diubah | 3 (dispatch.js, orders.js, admin.js) |
| LOC changes  | +157 / -412                          |

## Catatan

1. **Backward compatible** — semua exports lama tetap ada, file baru tidak mengubah behaviour
2. **notificationService.js + pricingService.js** adalah service wrappers — file asli (`notifications.js`, `pricing.js`) masih ada untuk backward compat
3. **admin.js** belum full refactor ke services — endpoint admin masih panggil Firestore langsung (akan di-refactor di fase berikutnya jika perlu)
4. **`onOrderUpdate` (469 baris → ~60 baris)** — risiko regression paling tinggi. Butuh integration test / manual QA untuk state machine, surcharge, rating, loyalty, notification
