const admin = require('firebase-admin');
const logger = require('../utils/logger');

class DriverRepository {
  get firestoreCollection() {
    return admin.firestore().collection('drivers');
  }

  get rtdbRef() {
    return admin.database().ref('drivers');
  }

  async getOnlineDrivers() {
    const [rtdbSnap, fsSnap] = await Promise.all([
      this.rtdbRef.once('value'),
      this.firestoreCollection.get(),
    ]);

    const rtdbMap = {};
    rtdbSnap.forEach((child) => {
      const data = child.val();
      if (data && data.isOnline && data.status === 'online') {
        rtdbMap[child.key] = data;
      }
    });

    const drivers = [];
    fsSnap.forEach((doc) => {
      const rtdbData = rtdbMap[doc.id];
      if (!rtdbData) return;
      const fs = doc.data();
      drivers.push({
        id: doc.id,
        ...fs,
        isOnline: rtdbData.isOnline,
        status: rtdbData.status,
        lastActive: rtdbData.lastActive,
        todayOnlineMs: rtdbData.todayOnlineMs || 0,
        location: rtdbData.location,
        lastLocationUpdate: rtdbData.lastLocationUpdate,
        onlineAt: rtdbData.onlineAt,
        offlineAt: rtdbData.offlineAt,
        onlineSessionStartAt: rtdbData.onlineSessionStartAt,
        statusChangedAt: rtdbData.statusChangedAt,
      });
    });
    return drivers;
  }

  async getById(driverId) {
    const snap = await this.firestoreCollection.doc(driverId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async update(driverId, data) {
    return this.firestoreCollection.doc(driverId).update(data);
  }

  async setStatus(driverId, status) {
    return this.rtdbRef.child(`${driverId}/status`).set(status);
  }

  async setIncomingOrder(driverId, orderId) {
    return this.rtdbRef.child(`${driverId}/incoming`).child(orderId).set(true);
  }

  async removeIncomingOrder(driverId, orderId) {
    return this.rtdbRef.child(`${driverId}/incoming`).child(orderId).remove();
  }

  async adjustBalance(driverId, amount) {
    return this.firestoreCollection.doc(driverId).update({
      balance: admin.firestore.FieldValue.increment(amount),
    });
  }

  async getOnlineAvailableDriversCount() {
    try {
      const drivers = await this.getOnlineDrivers();
      const { isDriverOverDailyLimit } = require('../utils');
      let count = 0;
      drivers.forEach((driver) => {
        if (!isDriverOverDailyLimit(driver) && (driver.balance || 0) >= 0) {
          count += 1;
        }
      });
      return count;
    } catch (e) {
      logger.error('Error getting online drivers count', { error: e?.message });
      return 0;
    }
  }
}

module.exports = DriverRepository;
