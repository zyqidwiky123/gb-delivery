const { setGlobalOptions } = require('firebase-functions/v2');

setGlobalOptions({
  region: 'asia-southeast2',
  memory: '512MiB',
  timeoutSeconds: 120,
  maxInstances: 10
});

const admin = require("firebase-admin");
admin.initializeApp({
  databaseURL: "https://gb-delivery-41bf6-default-rtdb.asia-southeast1.firebasedatabase.app",
});

require('./src/utils');
const { onOrderCreated, onOrderUpdate } = require('./src/orders');
const { autoOfflineLongOnlineDrivers, resetDailyOnlineTime, syncDriverOnlineStatus } = require('./src/drivers');
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

exports.onOrderCreated = onOrderCreated;
exports.onOrderUpdate = onOrderUpdate;
exports.autoOfflineLongOnlineDrivers = autoOfflineLongOnlineDrivers;
exports.resetDailyOnlineTime = resetDailyOnlineTime;
exports.syncDriverOnlineStatus = syncDriverOnlineStatus;
exports.receiveCrashLog = receiveCrashLog;
exports.deleteUserAccount = deleteUserAccount;
exports.deleteMerchant = deleteMerchant;
exports.syncMerchantPopularityFromMaps = syncMerchantPopularityFromMaps;
exports.fetchMerchantPhotoFromMaps = fetchMerchantPhotoFromMaps;
exports.processAllExistingMerchants = processAllExistingMerchants;
exports.expansionTrigger = expansionTrigger;
exports.rejectOffer = rejectOffer;
exports.onImageUploaded = onImageUploaded;
exports.migrateImagesToWebP = migrateImagesToWebP;
