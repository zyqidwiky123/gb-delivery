# FASE 2 — Frontend Architecture

**Target:** Maintainable, testable frontend — tanpa over-engineering
**Status:** ✅ Selesai

---

## Task 2.1: TypeScript — Shared Package

**Files baru:**

- `packages/shared/src/firebase.ts` — Firebase config type-safe
- `packages/shared/src/mapConfig.ts` — map constants + types
- `packages/shared/src/pricing.ts` — calculateFee, haversine
- `packages/shared/src/utils.ts` — utility functions
- `packages/shared/src/LocationPickerModal.tsx` — modal component
- `packages/shared/src/index.ts` — barrel export
- `packages/shared/src/global.d.ts` — declare module for `@react-google-maps/api`
- `packages/shared/tsconfig.json` — `strict=false`, `noEmit=true`, `vite/client` types

**Verifikasi:** `tsc --noEmit` — zero errors

---

## Task 2.2: Pisahkan God Store (adminStore.js)

**Masalah:** `adminStore.js` = pricing + UI labels + promo + WhatsApp + listeners + cart.

**Target:**

```
aro-drive-vite/src/store/
├── adminStore.js        → re-export wrapper (backward compat)
├── pricingStore.js      → pricing + onSnapshot
├── uiStore.js           → UI labels + theme + onSnapshot
├── promoStore.js        → banners + vouchers + platform settings + onSnapshot
├── cartStore.js         → cart CRUD + pricing
└── locationStore.js     → pickup/dropoff per service
```

**Pattern:** Setiap store panggil `onSnapshot` sendiri di `init` action.

`adminStore.js` sekarang re-export semua hook dari store baru + `initSettings()` yang panggil ketiga `init` secara paralel.

---

## Task 2.3: Service Layer Frontend

**Files baru:**

```
aro-drive-vite/src/services/
├── userService.js         # addPoints, updateUser, deleteUser, etc.
├── orderService.js        # createOrder, cancelOrder, rateOrder,
│                          # updateOrderPaymentMethod, getOrder, getUserOrders
├── merchantService.js     # fetchMerchants, getMerchant, getMerchantMenu
└── notificationService.js # updateFcmToken, removeFcmToken
```

**Update:**

- `orderService.js` diperkaya dengan signatures lengkap (`cancelReason`, `cancelledBy`, `serverTimestamp`)
- Tambah `updateOrderPaymentMethod` untuk Tracking.jsx
- Semua function pure Firebase CRUD — store tetap handle local state

---

## Task 2.4: Split Tracking.jsx (1067 lines → 334 lines)

**Masalah:** `Tracking.jsx` = 1067 baris, campur real-time data fetching + Google Maps + modals + bottom sheet + driver info.

**Target:**

```
aro-drive-vite/src/hooks/
└── useOrderTracking.js    # real-time order + driver location + directions (144 lines)

aro-drive-vite/src/components/tracking/
├── OrderMap.jsx           # Google Map + markers + directions + recenter (114 lines)
├── OrderStatusCard.jsx    # bottom sheet: ETA + DriverInfoCard + payment detail (268 lines)
├── DriverInfoCard.jsx     # driver photo, name, plate, WA contact (49 lines)
├── CancelOrderModal.jsx   # cancel reasons + confirm (59 lines)
└── RatingModal.jsx        # star rating + review + submit + success (84 lines)

aro-drive-vite/src/pages/Tracking.jsx → orchestrator (334 lines)
```

**Perubahan pada `useOrderTracking`:** Mengelola semua `onSnapshot` (order + driver profile), directions service, auto-pan map.

**Perubahan pada Map:** Ekstrak `MapView` memoized → `OrderMap.jsx`. Tambah recenter button, user marker, marker icons dari shared `mapConfig`.

**Service update:** `services/orderService.js` ditambah `cancelOrder` dengan reason + cancelBy, dan `updateOrderPaymentMethod` — sebelumnya hanya ada di `firebase/orderService.js` (old path).

### Ringkasan LOC

| File                   | Sebelum  | Sesudah  |
| ---------------------- | -------- | -------- |
| `Tracking.jsx`         | 1067     | 334      |
| `useOrderTracking.js`  | —        | 144      |
| `OrderMap.jsx`         | —        | 114      |
| `OrderStatusCard.jsx`  | —        | 268      |
| `DriverInfoCard.jsx`   | —        | 49       |
| `CancelOrderModal.jsx` | —        | 59       |
| `RatingModal.jsx`      | —        | 84       |
| **Total**              | **1067** | **1052** |

---

## Catatan

1. **Backward compat:** `adminStore.js` tetap re-export semua hook dari store baru — tidak ada impor yang rusak.
2. **Belum migrasi ke shared Firebase:** `aro-drive-vite/src/firebase/config.js` masih ada — akan ditangani di **FASE 4 (Cleanup)**.
3. **MapView → OrderMap:** Props disederhanakan — tidak perlu `createMarkerIcon` atau `defaultMapOptions` dari parent.
4. **Dokumentasi perubahan disimpan di:** `docs/changes/FASE-2-frontend.md`
