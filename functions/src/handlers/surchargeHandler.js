const admin = require('firebase-admin');
const PricingService = require('../services/pricingService');
const logger = require('../utils/logger');

const pricingService = new PricingService();

async function surchargeHandler(event) {
  const { newValue, previousValue, orderId } = event;

  if (newValue.status !== 'accepted' || previousValue.status === 'accepted') return;

  try {
    logger.info('Order accepted, calculating surcharge', { orderId, driverId: newValue.driverId });

    const pricing = await pricingService.getPricing(newValue.serviceType);
    const driverId = newValue.driverId;
    if (!driverId) return;

    const rtdbSnap = await admin.database().ref(`drivers/${driverId}/location`).once('value');
    const driverLoc = rtdbSnap.val();
    const pickupLoc = newValue.pickupLocation || newValue.pickup;

    logger.debug('Driver RTDB and pickup locations', { driverLoc, pickupLoc, orderId });

    const { fee, distance } = pricingService.calculatePickupFee(driverLoc, pickupLoc, pricing);
    logger.info('Pickup surcharge calculated', { orderId, distance, fee });

    const updateData = { pickupFee: fee, pickupDistance: distance };
    if (fee > 0) {
      const originalTotal = Number(newValue.total) || 0;
      updateData.total = originalTotal + fee;
      logger.info('Pickup surcharge applied', {
        orderId,
        pickupFee: fee,
        newTotal: updateData.total,
      });
    } else {
      logger.info('No surcharge applied, pickup within free radius', { orderId, distance });
    }

    await admin.firestore().collection('orders').doc(orderId).update(updateData);
  } catch (surchargeError) {
    logger.error('Error calculating or applying pickup surcharge', {
      error: surchargeError?.message,
      orderId,
    });
  }
}

module.exports = surchargeHandler;
