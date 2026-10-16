import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@aro/shared/firebase';

export async function createOrder(orderData) {
  return addDoc(collection(db, 'orders'), orderData);
}

export async function cancelOrder(orderId, reason, cancelledBy = 'user') {
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) return;

  const orderData = orderSnap.data();

  await updateDoc(orderRef, {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    cancelReason: reason || 'Dibatalkan oleh ' + cancelledBy,
    cancelledBy: cancelledBy,
  });

  if (orderData.driverId) {
    const driverRef = doc(db, 'drivers', orderData.driverId);
    await updateDoc(driverRef, {
      status: 'online',
      isOnline: true,
      onlineAt: serverTimestamp(),
      statusChangedAt: serverTimestamp(),
      offlineAt: null,
      lastActive: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function rateOrder(orderId, rating, review) {
  return updateDoc(doc(db, 'orders', orderId), {
    rating: Number(rating),
    review: review || '',
    ratedAt: serverTimestamp(),
  });
}

export async function updateOrderPaymentMethod(orderId, method) {
  return updateDoc(doc(db, 'orders', orderId), {
    paymentMethod: method,
    paymentMethodUpdatedAt: serverTimestamp(),
  });
}

export async function getOrder(orderId) {
  const snap = await getDoc(doc(db, 'orders', orderId));
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function getUserOrders(userId, maxResults = 20) {
  const q = query(
    collection(db, 'orders'),
    where('customerId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
