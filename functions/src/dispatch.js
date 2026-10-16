const admin = require('firebase-admin');
const OrderRepository = require('./repositories/orderRepo');
const DriverRepository = require('./repositories/driverRepo');
const NotificationService = require('./services/notificationService');
const {
  DISPATCH_CONFIG,
  DISPATCH_REGION_CONFIG,
  DRIVER_OFFER_TIMEOUT_MS,
} = require('./config/constants');
const {
  calculateDistance,
  isDriverOverDailyLimit,
  isDriverLocationFresh,
  normalizeServiceType,
} = require('./utils');
const logger = require('./utils/logger');

const orderRepo = new OrderRepository();
const driverRepo = new DriverRepository();
const notificationService = new NotificationService();

function getDispatchRegionConfig(regionType) {
  return DISPATCH_REGION_CONFIG[regionType] || DISPATCH_REGION_CONFIG.kota;
}

async function getOnlineDrivers() {
  return driverRepo.getOnlineDrivers();
}

async function dispatchOrder(orderId, orderData, dispatchState) {
  let pickupLocation = orderData.pickup || orderData.pickupLocation;
  if (Array.isArray(pickupLocation) && pickupLocation.length >= 2) {
    pickupLocation = { lat: Number(pickupLocation[0]), lng: Number(pickupLocation[1]) };
  }

  const serviceType = normalizeServiceType(orderData.serviceType || 'transport');
  const dispatchCfg = DISPATCH_CONFIG[serviceType] || DISPATCH_CONFIG.transport;
  const { currentRadius, notifiedDrivers } = dispatchState;
  const rejectedDrivers = dispatchState.rejectedDrivers || [];

  logger.info('Processing dispatch', {
    orderId,
    currentRadius,
    iteration: dispatchState.iteration,
    rejectedCount: rejectedDrivers.length,
  });

  const drivers = await driverRepo.getOnlineDrivers();
  let candidates = [];

  drivers.forEach((driver) => {
    const driverId = driver.id;

    if (rejectedDrivers.includes(driverId)) return;
    if (notifiedDrivers.includes(driverId)) return;
    if (isDriverOverDailyLimit(driver)) {
      logger.debug('Skipping driver — over daily online limit', { driverId, orderId });
      return;
    }
    if ((driver.balance || 0) < 0) {
      logger.debug('Skipping driver — negative balance', { driverId, orderId });
      return;
    }
    if (!isDriverLocationFresh(driver)) {
      logger.debug('Skipping driver — stale or missing location', { driverId, orderId });
      return;
    }

    if (driver.location && driver.location.lat && driver.location.lng) {
      const distance = calculateDistance(
        pickupLocation.lat,
        pickupLocation.lng,
        driver.location.lat,
        driver.location.lng
      );

      if (distance <= currentRadius) {
        candidates.push({
          id: driverId,
          distance: distance,
          lastJobAt: driver.lastJobAt ? driver.lastJobAt.toMillis() : 0,
          rating: driver.rating || 5.0,
          fcmToken: driver.fcmToken,
        });
      }
    }
  });

  if (candidates.length === 0) {
    logger.info('No drivers found in radius', { orderId, currentRadius });
    return false;
  }

  candidates.sort((a, b) => {
    switch (serviceType) {
      case 'food':
      case 'shop':
        if (a.rating !== b.rating) return b.rating - a.rating;
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.lastJobAt - b.lastJobAt;
      case 'express':
      case 'send':
        if (a.distance !== b.distance) return a.distance - b.distance;
        if (a.lastJobAt !== b.lastJobAt) return a.lastJobAt - b.lastJobAt;
        return b.rating - a.rating;
      default:
        if (a.distance !== b.distance) return a.distance - b.distance;
        if (a.lastJobAt !== b.lastJobAt) return a.lastJobAt - b.lastJobAt;
        return b.rating - a.rating;
    }
  });

  const selectedDriver = candidates[0];
  logger.info('Offering order to driver', {
    orderId,
    driverId: selectedDriver.id,
    distance: selectedDriver.distance.toFixed(1),
  });

  await orderRepo.update(orderId, {
    'dispatch.offeredTo': selectedDriver.id,
    'dispatch.offerExpiresAt': admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + DRIVER_OFFER_TIMEOUT_MS)
    ),
    'dispatch.notifiedDrivers': [...notifiedDrivers, selectedDriver.id],
    'dispatch.lastAttemptAt': admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    await driverRepo.setIncomingOrder(selectedDriver.id, orderId);
  } catch (rtdbErr) {
    logger.warn('RTDB write failed for driver', {
      driverId: selectedDriver.id,
      error: rtdbErr.message,
      orderId,
    });
  }

  if (selectedDriver.fcmToken) {
    try {
      const admin = require('firebase-admin');
      const message = {
        token: selectedDriver.fcmToken,
        data: {
          type: 'NEW_ORDER',
          orderId: String(orderId),
        },
        android: {
          priority: 'high',
        },
      };
      await admin.messaging().send(message);
    } catch (fcmErr) {
      logger.warn('FCM failed for driver', {
        driverId: selectedDriver.id,
        error: fcmErr.message,
        orderId,
      });
    }
  }

  logger.info('Order offered to driver', {
    orderId,
    driverId: selectedDriver.id,
    timeoutSeconds: DRIVER_OFFER_TIMEOUT_MS / 1000,
  });
  return true;
}

async function setNoDriverStatus(orderId, orderData) {
  logger.info('Exhausted — no driver found, setting no_driver status', { orderId });

  try {
    await orderRepo.update(orderId, {
      status: 'no_driver',
      'dispatch.status': 'failed',
      noDriverAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.error('Failed to update no_driver status', { orderId, error: err?.message });
    return;
  }

  const customerId = orderData.customerId;
  if (customerId) {
    await notificationService.sendToUser(customerId, {
      title: 'Driver Tidak Tersedia',
      body: `Maaf, semua driver sedang sibuk di area kamu untuk order #${orderId.slice(-5).toUpperCase()}. Pesanan dibatalkan otomatis.`,
    });
  }

  const waNumber = orderData.customer?.wa;
  if (waNumber) {
    try {
      const customerName = orderData.customer?.name || 'Kak';
      const shortId = orderId.slice(-5).toUpperCase();
      const msg = `Halo ${customerName} \n\nMaaf, kami tidak dapat menemukan driver yang tersedia untuk pesanan ARO-${shortId} kamu saat ini.\n\nSemua driver mitra sedang sibuk atau belum ada driver di area kamu.\n\nPesanan otomatis dibatalkan. Silakan coba lagi beberapa saat nanti. Terima kasih sudah menggunakan ARO DRIVE!`;
      await notificationService.sendWA(waNumber, msg);
    } catch (e) {
      logger.warn('NoDriver WA notify failed', { error: e.message, orderId });
    }
  }
}

async function getOnlineAvailableDriversCount() {
  return driverRepo.getOnlineAvailableDriversCount();
}

module.exports = {
  DISPATCH_CONFIG,
  DRIVER_OFFER_TIMEOUT_MS,
  getDispatchRegionConfig,
  getOnlineDrivers,
  dispatchOrder,
  setNoDriverStatus,
  getOnlineAvailableDriversCount,
};
