const admin = require('firebase-admin');

class UserRepository {
  get collection() {
    return admin.firestore().collection('users');
  }

  async getById(userId) {
    const snap = await this.collection.doc(userId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async update(userId, data) {
    return this.collection.doc(userId).update(data);
  }

  async set(userId, data) {
    return this.collection.doc(userId).set(data, { merge: true });
  }

  async addPoints(userId, points) {
    return this.collection.doc(userId).update({
      loyaltyPoints: admin.firestore.FieldValue.increment(points),
    });
  }
}

module.exports = UserRepository;
