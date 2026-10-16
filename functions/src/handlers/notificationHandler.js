const admin = require('firebase-admin');
const { sendNotification, sendWAFonnte, sendNotificationToMerchant } = require('../notifications');
const {
  dispatchOrder,
  setNoDriverStatus,
  getOnlineAvailableDriversCount,
  getDispatchRegionConfig,
} = require('../dispatch');
const { normalizeServiceType } = require('../utils');
const logger = require('../utils/logger');

async function notificationHandler(event) {
  const { newValue, previousValue, orderId } = event;

  await handleTypeSpecificLogging(newValue, previousValue, orderId);
  await handleWANotifications(newValue, previousValue, orderId);
  await handleFCMNotifications(newValue, previousValue, orderId);
}

async function handleTypeSpecificLogging(newValue, previousValue, orderId) {
  if (newValue.status === 'WAITING_FOOD' && previousValue.status !== 'WAITING_FOOD') {
    logger.info('Driver waiting for food preparation', { orderId });
    if (newValue.merchantId) {
      await sendNotificationToMerchant(newValue.merchantId, {
        title: 'Driver Menunggu',
        body: `Driver sudah sampai dan menunggu pesanan #${orderId.slice(-5).toUpperCase()}.`,
      });
    }
  }

  if (newValue.status === 'SHOPPING' && previousValue.status !== 'SHOPPING') {
    logger.info('Driver shopping', { orderId });
  }

  if (newValue.status === 'DROPPED_OFF' && previousValue.status !== 'DROPPED_OFF') {
    logger.info('Passenger dropped off', { orderId });
  }

  if (newValue.status === 'DELIVERED' && previousValue.status !== 'DELIVERED') {
    logger.info('Order delivered', { orderId });
  }
}

async function handleWANotifications(newValue, previousValue, orderId) {
  const notifyStatuses = ['accepted', 'arriving', 'picked_up', 'completed'];
  if (!notifyStatuses.includes(newValue.status)) return;

  if (newValue.status === previousValue.status) return;

  try {
    const userDoc = newValue.customerId
      ? await admin.firestore().collection('users').doc(newValue.customerId).get()
      : null;
    const userData = userDoc && userDoc.exists ? userDoc.data() : null;

    const waNumber = newValue.customer?.wa || userData?.whatsapp || userData?.wa;
    const customerName = newValue.customer?.name || userData?.displayName || 'Pelanggan';

    if (!waNumber) return;

    const type = newValue.serviceType || newValue.type || 'food';
    const shortId = orderId.slice(-5).toUpperCase();

    let menuText = '';
    if (type === 'food' && Array.isArray(newValue.items)) {
      menuText =
        '\n\nDetail Menu:\n' +
        newValue.items.map((item) => `- ${item.desc || item.name} (${item.qty}x)`).join('\n');
    } else if (type === 'shop' && newValue.items) {
      menuText = `\n\nDetail Barang:\n${newValue.items}`;
    }

    const waTemplates = require('../../templates');
    const normalizedType = normalizeServiceType(type);
    const serviceKey = waTemplates[normalizedType] ? normalizedType : 'transport';
    const templateFn = waTemplates[serviceKey]?.[newValue.status];

    let extraData = null;
    if (newValue.status === 'completed') {
      let itemsReceipt = menuText
        .replace('\n\nDetail Menu:\n', '')
        .replace('\n\nDetail Barang:\n', '');

      extraData = {
        customerName,
        shortId,
        timestamp: newValue.completedAt
          ? newValue.completedAt
              .toDate()
              .toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
          : null,
        merchantName: newValue.merchantName || '',
        driverName: newValue.driverName || 'Mitra ARO DRIVE',
        itemsText: itemsReceipt,
        subtotal: Number(newValue.actualShoppingCost || newValue.subtotal || 0),
        deliveryFee: Number(newValue.deliveryFee || 0),
        serviceFee: Number(newValue.serviceFee || 0),
        pickupFee: Number(newValue.pickupFee || 0),
        total: Number(newValue.total || 0),
      };
    }

    let message = '';
    if (typeof templateFn === 'function') {
      message =
        newValue.status === 'completed'
          ? templateFn(customerName, shortId, extraData)
          : templateFn(customerName, shortId, menuText);
    }
    if (message) {
      await sendWAFonnte(waNumber, message);
    }
  } catch (waError) {
    logger.error('Error preparing WA notification', { error: waError?.message, orderId });
  }
}

async function handleFCMNotifications(newValue, previousValue, orderId) {
  const customerId = newValue.customerId;

  if (newValue.status === 'accepted' && previousValue.status !== 'accepted' && customerId) {
    await sendNotification(customerId, {
      title: 'Pesanan Diterima!',
      body: `Driver telah menerima pesanan #${orderId.slice(0, 5)}. Harap tunggu penjemputan.`,
    });
  }

  if (newValue.status === 'arriving' && previousValue.status !== 'arriving' && customerId) {
    await sendNotification(customerId, {
      title: 'Driver Tiba',
      body: `Driver sudah sampai di lokasi penjemputan untuk pesanan #${orderId.slice(0, 5)}.`,
    });
  }

  if (newValue.status === 'completed' && previousValue.status !== 'completed' && customerId) {
    await sendNotification(customerId, {
      title: 'Pesanan Selesai',
      body: `Terima kasih! Pesanan #${orderId.slice(0, 5)} telah selesai.`,
    });
  }
}

async function handleDispatchRejection(event, newValue, previousValue, orderId) {
  logger.info('Order rejected by driver, rotating immediately', { orderId });

  if (newValue.dispatch?.offeredTo) {
    try {
      await admin
        .database()
        .ref(`drivers/${newValue.dispatch.offeredTo}/incoming`)
        .child(orderId)
        .remove();
    } catch (_) {
      // Best-effort cleanup: abaikan jika node incoming sudah tidak ada.
    }
  }

  const dispatch = newValue.dispatch;
  const rejectedDrivers = dispatch.rejectedDrivers || [];
  if (dispatch.offeredTo && !rejectedDrivers.includes(dispatch.offeredTo)) {
    rejectedDrivers.push(dispatch.offeredTo);
  }

  const updatedDispatch = {
    ...dispatch,
    offeredTo: null,
    offerExpiresAt: null,
    rejectedDrivers,
  };

  await admin.firestore().collection('orders').doc(orderId).update({
    'dispatch.offeredTo': admin.firestore.FieldValue.delete(),
    'dispatch.offerExpiresAt': admin.firestore.FieldValue.delete(),
    'dispatch.rejectedDrivers': rejectedDrivers,
  });

  const driverFound = await dispatchOrder(orderId, newValue, updatedDispatch);

  if (!driverFound) {
    const regionConfig = getDispatchRegionConfig(dispatch.regionType);
    const startedAt = dispatch.startedSearchingAt
      ? dispatch.startedSearchingAt.toDate()
      : newValue.createdAt?.toDate() || new Date();
    const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60000;
    const onlineDriversCount = await getOnlineAvailableDriversCount();

    if (
      dispatch.currentRadius >= regionConfig.maxRadius ||
      elapsedMinutes >= regionConfig.maxSearchMinutes ||
      onlineDriversCount === 0 ||
      rejectedDrivers.length >= onlineDriversCount
    ) {
      logger.info('Immediate exhaustion/timeout check after rejection', { orderId });
      await setNoDriverStatus(orderId, newValue);
    }
  }
}

module.exports = { notificationHandler, handleDispatchRejection };
