const admin = require('firebase-admin');

class OrderRepository {
  get collection() {
    return admin.firestore().collection('orders');
  }

  async getById(orderId) {
    const snap = await this.collection.doc(orderId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async update(orderId, data) {
    return this.collection.doc(orderId).update(data);
  }

  async set(orderId, data) {
    return this.collection.doc(orderId).set(data, { merge: true });
  }

  async create(data) {
    return this.collection.add(data);
  }

  async queryByField(field, value, limitCount) {
    let query = this.collection.where(field, '==', value);
    if (limitCount) query = query.limit(limitCount);
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async queryByFields(filters, limitCount) {
    let query = this.collection;
    filters.forEach(({ field, op, value }) => {
      query = query.where(field, op, value);
    });
    if (limitCount) query = query.limit(limitCount);
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

module.exports = OrderRepository;
