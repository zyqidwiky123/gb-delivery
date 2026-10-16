const { setGlobalOptions } = require('firebase-functions/v2');

setGlobalOptions({
  region: 'asia-southeast2',
  memory: '512MiB',
  timeoutSeconds: 120,
  maxInstances: 10,
});

const admin = require('firebase-admin');
admin.initializeApp({
  databaseURL:
    process.env.DATABASE_URL ||
    'https://gb-delivery-41bf6-default-rtdb.asia-southeast1.firebasedatabase.app',
});

const { isBillingEnabled, logSkipped } = require('./src/billing');

require('./src/utils');
const { onOrderCreated, onOrderUpdate } = require('./src/orders');
const {
  autoOfflineLongOnlineDrivers,
  resetDailyOnlineTime,
  syncDriverOnlineStatus,
} = require('./src/drivers');
const {
  receiveCrashLog,
  deleteUserAccount,
  deleteMerchant,
  syncMerchantPopularityFromMaps,
  fetchMerchantPhotoFromMaps,
  processAllExistingMerchants,
  expansionTrigger,
  rejectOffer,
  onImageUploaded,
  migrateImagesToWebP,
} = require('./src/admin');

// ---------------------------------------------------------------------------
// Selalu aktif: tanpa paid API (aman di Spark gratis maupun emulator)
// ---------------------------------------------------------------------------
exports.onOrderCreated = onOrderCreated;
exports.onOrderUpdate = onOrderUpdate;
exports.syncDriverOnlineStatus = syncDriverOnlineStatus;
exports.receiveCrashLog = receiveCrashLog;
exports.deleteUserAccount = deleteUserAccount;
exports.deleteMerchant = deleteMerchant;
exports.rejectOffer = rejectOffer;
exports.migrateImagesToWebP = migrateImagesToWebP;

// ---------------------------------------------------------------------------
// FASE 1 — hanya aktif jika ENABLE_BILLING_FEATURES=1 (butuh Blaze + Maps/Vision)
// - Scheduler: autoOfflineLongOnlineDrivers, resetDailyOnlineTime, expansionTrigger
//   (pengganti sementara: tombol manual di Admin Dashboard + Heartbeat driver)
// - Storage trigger: onImageUploaded (Eventarc butuh billing)
// - Places/Vision: syncMerchantPopularityFromMaps, fetchMerchantPhotoFromMaps,
//   processAllExistingMerchants (pengganti: upload manual via Admin Dashboard)
// ---------------------------------------------------------------------------
if (isBillingEnabled()) {
  exports.autoOfflineLongOnlineDrivers = autoOfflineLongOnlineDrivers;
  exports.resetDailyOnlineTime = resetDailyOnlineTime;
  exports.expansionTrigger = expansionTrigger;
  exports.onImageUploaded = onImageUploaded;
  exports.syncMerchantPopularityFromMaps = syncMerchantPopularityFromMaps;
  exports.fetchMerchantPhotoFromMaps = fetchMerchantPhotoFromMaps;
  exports.processAllExistingMerchants = processAllExistingMerchants;
} else {
  logSkipped([
    'autoOfflineLongOnlineDrivers',
    'resetDailyOnlineTime',
    'expansionTrigger',
    'onImageUploaded',
    'syncMerchantPopularityFromMaps',
    'fetchMerchantPhotoFromMaps',
    'processAllExistingMerchants',
  ]);
}
