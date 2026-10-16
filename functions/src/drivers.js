const admin = require('firebase-admin');
const rtdb = admin.database();
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onValueWritten } = require('firebase-functions/v2/database');
const { getTimestampMillis, isDriverInactive, isDriverOverDailyLimit } = require('./utils');
const { getOnlineDrivers } = require('./dispatch');
const logger = require('./utils/logger');

exports.autoOfflineLongOnlineDrivers = onSchedule('every 3 minutes', async () => {
  const now = Date.now();

  const busyDrivers = await admin
    .firestore()
    .collection('drivers')
    .where('status', '==', 'busy')
    .get();
  const stuckBusy = [];
  for (const doc of busyDrivers.docs) {
    const driver = doc.data();
    const updatedAt =
      getTimestampMillis(driver.updatedAt) || getTimestampMillis(driver.statusChangedAt) || 0;
    if (updatedAt > 0 && now - updatedAt > 30 * 60 * 1000) {
      const activeOrders = await admin
        .firestore()
        .collection('orders')
        .where('driverId', '==', doc.id)
        .where('status', 'in', ['accepted', 'arriving', 'picked_up'])
        .limit(1)
        .get();
      if (activeOrders.empty) {
        stuckBusy.push(doc.ref);
      }
    } else if (updatedAt === 0) {
      stuckBusy.push(doc.ref);
    }
  }
  if (stuckBusy.length > 0) {
    const busyBatch = admin.firestore().batch();
    stuckBusy.forEach((ref) => {
      busyBatch.update(ref, {
        status: 'online',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await busyBatch.commit();
    logger.info('Reset stuck busy drivers to online', { count: stuckBusy.length });
  }

  const rtdbSnap = await rtdb.ref('drivers').once('value');
  const onlineRtdbDrivers = [];
  rtdbSnap.forEach((child) => {
    const data = child.val();
    if (data && data.isOnline) {
      onlineRtdbDrivers.push({ id: child.key, ...data });
    }
  });

  if (onlineRtdbDrivers.length === 0) {
    if (stuckBusy.length === 0) logger.info('No online drivers found in RTDB');
    return null;
  }

  const driverRefs = {};
  const fsSnap = await admin.firestore().collection('drivers').get();
  fsSnap.forEach((doc) => {
    if (rtdbSnap.hasChild(doc.id)) {
      driverRefs[doc.id] = { ref: doc.ref, data: doc.data() };
    }
  });

  const inactiveDrivers = [];
  const overLimitDrivers = [];

  onlineRtdbDrivers.forEach((driver) => {
    const fsData = driverRefs[driver.id]?.data || {};
    const merged = {
      ...fsData,
      isOnline: true,
      status: driver.status,
      lastActive: driver.lastActive,
      todayOnlineMs: driver.todayOnlineMs || 0,
      onlineSessionStartAt: driver.onlineSessionStartAt,
      onlineAt: driver.onlineAt,
    };

    const tripState = driver.tripState || merged.tripState;
    if (tripState && tripState.orderId) {
      return;
    }

    if (isDriverInactive(merged, now)) {
      inactiveDrivers.push({ id: driver.id, driver: merged, ref: driverRefs[driver.id]?.ref });
      return;
    }

    if (isDriverOverDailyLimit(merged, now)) {
      overLimitDrivers.push({ id: driver.id, driver: merged, ref: driverRefs[driver.id]?.ref });
      return;
    }
  });

  const batchSize = 400;

  if (inactiveDrivers.length > 0) {
    for (let i = 0; i < inactiveDrivers.length; i += batchSize) {
      const batch = admin.firestore().batch();
      const chunk = inactiveDrivers.slice(i, i + batchSize);
      const rtdbUpdates = [];
      chunk.forEach(({ id, driver, ref }) => {
        const onlineSince =
          getTimestampMillis(driver.onlineSessionStartAt) || getTimestampMillis(driver.onlineAt);
        const todayMs = (driver.todayOnlineMs || 0) + (onlineSince ? now - onlineSince : 0);
        const baseFields = {
          status: 'offline',
          isOnline: false,
          offlineAt: admin.firestore.FieldValue.serverTimestamp(),
          autoOfflineAt: admin.firestore.FieldValue.serverTimestamp(),
          statusChangedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (onlineSince) baseFields.todayOnlineMs = todayMs;
        if (ref) batch.update(ref, baseFields);
        rtdbUpdates.push(
          rtdb.ref(`drivers/${id}`).update({
            isOnline: false,
            status: 'offline',
            statusChangedAt: admin.database.ServerValue.TIMESTAMP,
            lastActive: admin.database.ServerValue.TIMESTAMP,
            offlineAt: admin.database.ServerValue.TIMESTAMP,
            autoOfflineAt: admin.database.ServerValue.TIMESTAMP,
            onlineSessionStartAt: null,
            onlineAt: null,
            ...(onlineSince ? { todayOnlineMs: todayMs } : {}),
          })
        );
      });
      if (chunk.some((c) => c.ref)) await batch.commit();
      await Promise.all(rtdbUpdates);
    }
    logger.info('Set inactive drivers offline', { count: inactiveDrivers.length });
  }

  if (overLimitDrivers.length > 0) {
    for (let i = 0; i < overLimitDrivers.length; i += batchSize) {
      const batch = admin.firestore().batch();
      const chunk = overLimitDrivers.slice(i, i + batchSize);
      const rtdbUpdates = [];
      chunk.forEach(({ id, driver, ref }) => {
        const onlineSince =
          getTimestampMillis(driver.onlineSessionStartAt) || getTimestampMillis(driver.onlineAt);
        const todayMs = (driver.todayOnlineMs || 0) + (onlineSince ? now - onlineSince : 0);
        const baseFields = {
          status: 'offline',
          isOnline: false,
          offlineAt: admin.firestore.FieldValue.serverTimestamp(),
          autoOfflineAt: admin.firestore.FieldValue.serverTimestamp(),
          statusChangedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (onlineSince) baseFields.todayOnlineMs = todayMs;
        if (ref) batch.update(ref, baseFields);
        rtdbUpdates.push(
          rtdb.ref(`drivers/${id}`).update({
            isOnline: false,
            status: 'offline',
            statusChangedAt: admin.database.ServerValue.TIMESTAMP,
            lastActive: admin.database.ServerValue.TIMESTAMP,
            offlineAt: admin.database.ServerValue.TIMESTAMP,
            autoOfflineAt: admin.database.ServerValue.TIMESTAMP,
            onlineSessionStartAt: null,
            onlineAt: null,
            ...(onlineSince ? { todayOnlineMs: todayMs } : {}),
          })
        );
      });
      if (chunk.some((c) => c.ref)) await batch.commit();
      await Promise.all(rtdbUpdates);
    }
    logger.info('Set over-limit drivers offline', { count: overLimitDrivers.length });
  }

  if (inactiveDrivers.length === 0 && overLimitDrivers.length === 0) {
    if (stuckBusy.length === 0) logger.info('No inactive or over-limit drivers found');
  }
  return null;
});

exports.resetDailyOnlineTime = onSchedule('every day 00:00', async () => {
  const now = Date.now();

  const rtdbSnap = await rtdb.ref('drivers').once('value');
  const rtdbUpdates = [];
  rtdbSnap.forEach((child) => {
    rtdbUpdates.push(
      rtdb.ref(`drivers/${child.key}`).update({
        todayOnlineMs: 0,
        todayOnlineResetAt: admin.database.ServerValue.TIMESTAMP,
      })
    );
  });
  await Promise.all(rtdbUpdates);

  const driversSnapshot = await admin.firestore().collection('drivers').select().get();

  if (driversSnapshot.empty) {
    logger.info('Daily reset: RTDB only (no Firestore drivers)', { rtdbCount: rtdbUpdates.length });
    return;
  }

  const batchSize = 400;
  const refs = driversSnapshot.docs.map((doc) => doc.ref);
  for (let i = 0; i < refs.length; i += batchSize) {
    const batch = admin.firestore().batch();
    const chunk = refs.slice(i, i + batchSize);
    chunk.forEach((ref) => {
      batch.update(ref, {
        todayOnlineMs: 0,
        todayOnlineResetAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  logger.info('Daily reset completed', {
    firestoreCount: refs.length,
    rtdbCount: rtdbUpdates.length,
  });
  return null;
});

exports.syncDriverOnlineStatus = onValueWritten(
  { ref: '/drivers/{driverId}', region: 'asia-southeast1' },
  async (event) => {
    const { driverId } = event.params;
    const after = event.data.after.val();

    if (!after) {
      logger.info('Driver deleted from RTDB, skipping sync', { driverId });
      return;
    }

    const isOnline = after.isOnline ?? false;
    const status = after.status || 'offline';

    try {
      await admin
        .firestore()
        .collection('drivers')
        .doc(driverId)
        .set(
          {
            isOnline,
            status,
            lastRTDBUpdate: after.lastActive ? new Date(after.lastActive).toISOString() : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      logger.debug('Driver synced to Firestore', { driverId, isOnline, status });
    } catch (e) {
      logger.error('Error syncing driver to Firestore', { driverId, error: e?.message });
    }
  }
);
