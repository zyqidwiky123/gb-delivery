const admin = require('firebase-admin');

class MerchantRepository {
  get collection() {
    return admin.firestore().collection('merchants');
  }

  async getById(merchantId) {
    const snap = await this.collection.doc(merchantId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async update(merchantId, data) {
    return this.collection.doc(merchantId).update(data);
  }

  async getAll() {
    const snap = await this.collection.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async getAllPaginated(limitCount, offset) {
    let query = this.collection.orderBy('__name__').limit(limitCount);
    if (offset) query = query.offset(offset);
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

module.exports = MerchantRepository;
