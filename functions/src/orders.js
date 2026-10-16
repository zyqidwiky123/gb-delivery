const admin = require('firebase-admin');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const OrderRepository = require('./repositories/orderRepo');
const DriverRepository = require('./repositories/driverRepo');
const MerchantRepository = require('./repositories/merchantRepo');
const { DISPATCH_CONFIG } = require('./config/constants');
const { normalizeServiceType } = require('./utils');
const { dispatchOrder } = require('./dispatch');
const { analyzeChange, rollback } = require('./handlers/stateMachineHandler');
const surchargeHandler = require('./handlers/surchargeHandler');
const logger = require('./utils/logger');
const ratingHandler = require('./handlers/ratingHandler');
const loyaltyHandler = require('./handlers/loyaltyHandler');
const { notificationHandler, handleDispatchRejection } = require('./handlers/notificationHandler');

const orderRepo = new OrderRepository();
const driverRepo = new DriverRepository();
const merchantRepo = new MerchantRepository();

const RADIUS_EXPANSION_INTERVAL_MS = 60 * 1000;

exports.onOrderCreated = onDocumentCreated(
  { document: 'orders/{orderId}', region: 'asia-southeast1' },
  async (event) => {
    const orderData = event.data.data();
    const orderId = event.params.orderId;
    let { merchantId, serviceType, total, pickupLocation, pickupAddress, items } = orderData;
    serviceType = normalizeServiceType(serviceType || 'transport');
    if (!pickupLocation) {
      pickupLocation = orderData.pickup;
    }

    if (Array.isArray(pickupLocation) && pickupLocation.length >= 2) {
      pickupLocation = { lat: Number(pickupLocation[0]), lng: Number(pickupLocation[1]) };
    }

    if (!merchantId && Array.isArray(items) && items.length > 0) {
      merchantId = items[0].merchantId;
    }

    if (merchantId && (serviceType === 'food' || serviceType === 'shop')) {
      await sendMerchantOrderNotification(merchantId, orderId, serviceType, total, items);
    }

    if (serviceType === 'express' || serviceType === 'send') {
      await sendSenderOrderConfirmation(orderData, orderId, serviceType);
    }

    await sendManualCustomerNotification(orderData, orderId, serviceType, total);

    if (orderData.dispatch?.assignedTo) {
      await handleTargetedDispatch(orderData, orderId, serviceType, pickupLocation);
      return;
    }

    if (pickupLocation && pickupLocation.lat) {
      await handleNormalDispatch(orderData, orderId, serviceType, pickupLocation);
    }

    return null;
  }
);

async function sendMerchantOrderNotification(merchantId, orderId, serviceType, total, items) {
  const waTemplates = require('./templates');

  const merchant = await merchantRepo.getById(merchantId);
  if (!merchant) return;

  if (merchant.fcmToken) {
    try {
      await admin.messaging().send({
        token: merchant.fcmToken,
        notification: {
          title: 'Pesanan Masuk!',
          body: `Ada pesanan baru #${orderId.slice(-6).toUpperCase()} senilai Rp ${total?.toLocaleString()}. Cek di Dashboard sekarang!`,
        },
        data: { type: 'NEW_ORDER' },
      });
    } catch (e) {
      logger.error('Error sending FCM to merchant', { error: e?.message, merchantId });
    }
  }

  if (merchant.phone) {
    let itemsText = '';
    if (serviceType === 'food' && Array.isArray(items)) {
      itemsText = items.map((item) => `- ${item.desc || item.name} (${item.qty}x)`).join('\n');
    } else if (typeof items === 'string') {
      itemsText = items;
    }
    if (waTemplates.system && typeof waTemplates.system.newOrder === 'function') {
      const merchantMsg = waTemplates.system.newOrder(
        orderId,
        serviceType,
        total,
        merchant.name || 'Merchant',
        itemsText
      );
      const { sendWAFonnte } = require('./notifications');
      await sendWAFonnte(merchant.phone, merchantMsg);
    }
  }
}

async function sendSenderOrderConfirmation(orderData, orderId, serviceType) {
  const waNumber = orderData.customer?.wa;
  if (!waNumber) return;

  try {
    const waTemplates = require('./templates');
    const shortId = orderId.slice(-5).toUpperCase();
    const customerName = orderData.customer?.name || 'Kak';
    const msg = waTemplates[serviceType]?.accepted
      ? waTemplates[serviceType].accepted(customerName, shortId)
      : `Halo ${customerName}, pesanan ${serviceType} (#${shortId}) sedang diproses.`;
    const { sendWAFonnte } = require('./notifications');
    await sendWAFonnte(waNumber, msg);
  } catch (e) {
    logger.error('Error sending WA to sender', { error: e?.message, orderId });
  }
}

async function sendManualCustomerNotification(orderData, orderId, serviceType, total) {
  if (!orderData.customer?.isManual || !orderData.customer?.wa) return;

  try {
    const waTemplates = require('./templates');
    if (waTemplates.system && typeof waTemplates.system.manualOrderCustomer === 'function') {
      const customerMsg = waTemplates.system.manualOrderCustomer(
        orderData.customer.name,
        orderId,
        serviceType,
        total,
        orderData.pickupAddress,
        orderData.dropoffAddress
      );
      const { sendWAFonnte } = require('./notifications');
      await sendWAFonnte(orderData.customer.wa, customerMsg);
    }
  } catch (waError) {
    logger.error('Error sending WA notifications', { error: waError?.message, orderId });
  }
}

async function handleTargetedDispatch(orderData, orderId, serviceType, pickupLocation) {
  const targetDriverId = orderData.dispatch.assignedTo;
  logger.info('Targeted dispatch: admin-assigned to driver', { orderId, targetDriverId });

  const dispatchCfg = DISPATCH_CONFIG[serviceType] || DISPATCH_CONFIG.transport;
  if (!pickupLocation || !pickupLocation.lat) {
    logger.warn('No pickup location for order, cannot dispatch', { orderId });
    return;
  }

  const dispatchInit = {
    status: 'targeted',
    assignedTo: targetDriverId,
    offeredTo: targetDriverId,
    offerExpiresAt: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + dispatchCfg.offerTimeoutMs)
    ),
    serviceType,
    currentRadius: dispatchCfg.initRadiusKm,
    iteration: 1,
    notifiedDrivers: [targetDriverId],
    rejectedDrivers: [],
    lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    startedSearchingAt: admin.firestore.FieldValue.serverTimestamp(),
    nextExpansionAt: new Date(Date.now() + 60000),
    assignedAt: orderData.dispatch.assignedAt || admin.firestore.FieldValue.serverTimestamp(),
  };

  await orderRepo.update(orderId, { dispatch: dispatchInit });

  try {
    await driverRepo.setIncomingOrder(targetDriverId, orderId);
  } catch (rtdbErr) {
    logger.warn('Targeted dispatch RTDB write failed', {
      driverId: targetDriverId,
      error: rtdbErr.message,
      orderId,
    });
  }

  try {
    const driver = await driverRepo.getById(targetDriverId);
    if (driver?.fcmToken) {
      await admin.messaging().send({
        token: driver.fcmToken,
        data: { type: 'NEW_ORDER', orderId: String(orderId) },
        android: { priority: 'high' },
      });
      logger.info('Targeted dispatch FCM sent to driver', { driverId: targetDriverId, orderId });
    }
  } catch (fcmErr) {
    logger.error('Targeted dispatch FCM failed', {
      driverId: targetDriverId,
      error: fcmErr.message,
      orderId,
    });
  }
}

async function handleNormalDispatch(orderData, orderId, serviceType, pickupLocation) {
  const dispatchCfg = DISPATCH_CONFIG[serviceType] || DISPATCH_CONFIG.transport;

  const dispatchInit = {
    status: 'searching',
    serviceType,
    currentRadius: dispatchCfg.initRadiusKm,
    iteration: 1,
    notifiedDrivers: [],
    lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    startedSearchingAt: admin.firestore.FieldValue.serverTimestamp(),
    nextExpansionAt: new Date(Date.now() + RADIUS_EXPANSION_INTERVAL_MS),
  };

  await orderRepo.update(orderId, { dispatch: dispatchInit });

  const driverFound = await dispatchOrder(orderId, orderData, dispatchInit);

  if (!driverFound) {
    logger.info('No driver in initial radius, will retry with expansion', {
      orderId,
      initialRadius: dispatchInit.currentRadius,
    });
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    try {
      const refreshed = await orderRepo.getById(orderId);
      if (!refreshed) return;
      const refreshedDispatch = refreshed.dispatch;
      if (
        !refreshedDispatch ||
        refreshedDispatch.status !== 'searching' ||
        refreshed.status !== 'searching'
      )
        return;
      if (refreshedDispatch.offeredTo) {
        logger.info('Order already has active offer, skipping retry', {
          orderId,
          offeredTo: refreshedDispatch.offeredTo,
        });
        return;
      }
      const { getDispatchRegionConfig } = require('./dispatch');
      const regionConfig = getDispatchRegionConfig(refreshedDispatch.regionType);
      const newRadius = Math.min(
        regionConfig.maxRadius,
        (refreshedDispatch.currentRadius || dispatchInit.currentRadius) +
          regionConfig.radiusIncrement
      );
      const retryDispatch = {
        ...refreshedDispatch,
        currentRadius: newRadius,
        iteration: (refreshedDispatch.iteration || 1) + 1,
      };
      logger.info('Accelerated retry for dispatch', {
        orderId,
        newRadius,
        iteration: retryDispatch.iteration,
      });
      const retryFound = await dispatchOrder(orderId, refreshed, retryDispatch);
      if (retryFound) {
        logger.info('Driver found on accelerated retry', { orderId });
      } else {
        logger.info('Accelerated retry failed, will rely on expansionTrigger', { orderId });
      }
    } catch (retryErr) {
      logger.error('Error in accelerated retry', { orderId, error: retryErr?.message });
    }
  }
}

exports.onOrderUpdate = onDocumentUpdated(
  { document: 'orders/{orderId}', region: 'asia-southeast1' },
  async (event) => {
    const { validTransition, dispatchRejected, statusChanged, newValue, previousValue, orderId } =
      analyzeChange(event);

    if (!validTransition && statusChanged) {
      await rollback(event, previousValue);
      return null;
    }

    if (dispatchRejected) {
      await handleDispatchRejection(event, newValue, previousValue, orderId);
      if (!statusChanged) return null;
    }

    if (!statusChanged) return null;

    await Promise.allSettled([
      surchargeHandler(event),
      ratingHandler(event),
      loyaltyHandler(event),
      notificationHandler(event),
    ]);

    return null;
  }
);
