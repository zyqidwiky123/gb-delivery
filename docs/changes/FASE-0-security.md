# FASE 0 — Security — 2026-07-25

## Task 0.1: Hapus Keystore dari Disk

**Files dihapus:**

- `aro-driver-kotlin/keystore.properties` — password signing (storePassword, keyPassword, keyAlias)
- `aro-driver-kotlin/aro_partner.jks` — signing key

**Backup:** `/tmp/opencode/keystore.properties.bak`, `/tmp/opencode/aro_partner.jks.bak`

**Catatan:** CI (`build-release.yml`) sudah inject otomatis dari GitHub Secrets (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD`, `KEY_ALIAS`). `.gitignore` sudah ignore `**/keystore.properties`.

---

## Task 0.2: Hapus Vercel OIDC Token

**Files dihapus:**

- `aro-drive-vite/.env.local` — berisi `VERCEL_OIDC_TOKEN` (JWT valid)

**Backup:** `/tmp/opencode/.env.local.bak`

**Catatan:** `aro-drive-vite/.gitignore` sudah punya `*.local` dan `.env*.local`. Root `.gitignore` juga sudah punya `.env.local`.

---

## Task 0.3: Firestore Rules — Settings Collection

**Files diubah:**

- `firestore.rules` — split `settings/{doc}` menjadi `settings/public/{doc}` + `settings/configs/{doc}`

**Perubahan:**

```diff
- match /settings/{doc} {
-   allow read: if true;
-   allow write: if isAdmin();
- }

+ match /settings/public/{doc} {
+   allow read: if true;
+   allow write: if isAdmin();
+ }
+ match /settings/configs/{doc} {
+   allow read, write: if isAdmin();
+ }
```

**Catatan:** Kode functions (`notifications.js:46`, `merchants.js:153`, `admin.js`) sudah referensi `settings/configs` — tidak perlu update.

---

## Task 0.4: Environment-Based Config

**Files diubah:**

- `functions/index.js:13` — `databaseURL` dari hardcode → `process.env.DATABASE_URL || fallback`
- `functions/src/admin.js` — bucket name `onImageUploaded` dari hardcode → `process.env.STORAGE_BUCKET || fallback`

---

## Task 0.5: Auth Guard Endpoint

**Files diubah:**

- `functions/src/admin.js`

**Perubahan:**

- Helper baru: `extractIdToken(req)` — extract Bearer token
- Helper baru: `verifyAuthenticatedRequest(req)` — verify ID token tanpa admin check
- `receiveCrashLog` — **sebelumnya:** tanpa auth, ambil `uid` dari body. **Sekarang:** verify ID token, pakai `uid` dari token, ignore dari body. Error format: `{ success: false, error }`
- `rejectOffer` — **sebelumnya:** tidak verifikasi caller. **Sekarang:** verify ID token, validasi `driverId === uid` dari token

---

## Task 0.6: CORS Hardening

**Files diubah:**

- `functions/src/admin.js` — 8 endpoint: `cors: true` → `cors: ALLOWED_ORIGINS`
- `cors.json` — `"origin": ["*"]` → `["https://aro-drive-user.web.app", "https://aro-drive-admin.web.app"]`

**Allowed origins:**

```
https://aro-drive-admin.web.app
https://aro-drive-user.web.app
http://localhost:5173
http://localhost:5174
```

---

## Ringkasan

| Item          | Files                                                                      |
| ------------- | -------------------------------------------------------------------------- |
| Files dihapus | 3 (keystore.properties, aro_partner.jks, .env.local)                       |
| Files diubah  | 4 (firestore.rules, functions/index.js, functions/src/admin.js, cors.json) |
| Files baru    | 0                                                                          |
| Backup di     | `/tmp/opencode/`                                                           |

---

## ⚠️ Manual — Belum Dilakukan

- [ ] **Rotasi Vercel OIDC token** di dashboard Vercel (token JWT sudah bocor ke disk)
- [ ] **Set `DATABASE_URL`** di Firebase functions: `firebase functions:config:set app.database_url="https://..."` (fallback sudah ada, optional)
- [ ] **Set `STORAGE_BUCKET`** di Firebase functions (fallback sudah ada, optional)
- [ ] **Migrasi data Firestore** — pindahkan `fonnte.token`, `googleMapsApiKey` dari `settings` → `settings/configs` (kode & rules sudah siap, data belum dipindah)
