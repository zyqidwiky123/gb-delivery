/**
 * billing.js — FASE 1: kill-switch terpusat untuk fitur berbayar GCP.
 *
 * Konteks: akun Google Cloud bermasalah dengan billing, jadi semua pemakaian
 * berbayar (Maps Platform, Cloud Vision, deploy Cloud Functions v2 / scheduler /
 * storage trigger) harus NONAKTIF sementara. Backend tetap jalan di Spark gratis
 * (Firestore, RTDB, Auth, Storage, Hosting) + logika dispatch client-side.
 *
 * Cara pakai:
 * - Default (tanpa env): SEMUA fitur berbayar MATI. Aman untuk emulator Spark.
 * - Nyalakan lagi saat billing pulih:
 *     ENABLE_BILLING_FEATURES=1  -> export scheduler + storage trigger + endpoint
 *                                    Places/Vision di index.js
 *     DISABLE_VISION=0            -> izinkan Cloud Vision di merchants.js
 *     DISABLE_PLACES_SYNC=0       -> izinkan Places API di admin.js
 */
'use strict';

function isBillingEnabled() {
  return process.env.ENABLE_BILLING_FEATURES === '1';
}

function isVisionDisabled() {
  return process.env.DISABLE_VISION !== '0';
}

function isPlacesSyncDisabled() {
  return process.env.DISABLE_PLACES_SYNC !== '0';
}

function disabledError(feature) {
  return (
    `${feature} nonaktif sementara (Fase 1: mode gratis, tanpa billing GCP). ` +
    'Aktifkan lagi saat billing pulih via ENABLE_BILLING_FEATURES=1.'
  );
}

function logSkipped(exportsList) {
  console.log(`[billing] FASE-1 mode gratis: export dinonaktifkan -> ${exportsList.join(', ')}`);
}

module.exports = {
  isBillingEnabled,
  isVisionDisabled,
  isPlacesSyncDisabled,
  disabledError,
  logSkipped,
};
