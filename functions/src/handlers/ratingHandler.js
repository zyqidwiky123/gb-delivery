const admin = require('firebase-admin');
const logger = require('../utils/logger');

async function ratingHandler(event) {
  const { newValue, previousValue } = event;

  if (!newValue.rating || previousValue.rating) return;

  const { driverId, rating } = newValue;
  if (!driverId) return;

  try {
    const driverRef = admin.firestore().collection('drivers').doc(driverId);
    const driverDoc = await driverRef.get();
    if (driverDoc.exists) {
      const driverData = driverDoc.data();
      const oldRating = driverData.rating || 5.0;
      const totalReviews = driverData.totalReviews || 0;

      const newTotalReviews = totalReviews + 1;
      const newAverageRating = (oldRating * totalReviews + rating) / newTotalReviews;

      await driverRef.update({
        rating: parseFloat(newAverageRating.toFixed(1)),
        totalReviews: newTotalReviews,
      });
      logger.info('Rating updated', {
        driverId,
        newAverageRating: newAverageRating.toFixed(1),
        totalReviews: newTotalReviews,
      });
    }
  } catch (err) {
    logger.error('Error updating driver rating', { error: err?.message, driverId });
  }
}

module.exports = ratingHandler;
