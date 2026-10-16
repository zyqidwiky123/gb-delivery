const admin = require('firebase-admin');
const logger = require('../utils/logger');

async function loyaltyHandler(event) {
  const { newValue, previousValue, orderId } = event;

  if (newValue.status !== 'completed' || previousValue.status === 'completed') return;

  try {
    const settingsDoc = await admin.firestore().collection('settings').doc('platform').get();
    const pointsPerTenk = settingsDoc.exists ? settingsDoc.data().pointsPerTenk || 10000 : 10000;
    const orderTotal = newValue.total || 0;
    const earnedPoints = Math.floor(orderTotal / pointsPerTenk);

    if (earnedPoints > 0 && newValue.customerId) {
      const userRef = admin.firestore().collection('users').doc(newValue.customerId);
      await userRef.update({
        loyaltyPoints: admin.firestore.FieldValue.increment(earnedPoints),
      });
      logger.info('Loyalty points added', {
        points: earnedPoints,
        customerId: newValue.customerId,
        orderId,
      });
    }
  } catch (pointsError) {
    logger.error('Error adding loyalty points', { error: pointsError?.message, orderId });
  }
}

module.exports = loyaltyHandler;
