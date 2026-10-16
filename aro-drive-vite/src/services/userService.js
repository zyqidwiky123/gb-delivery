import { doc, runTransaction, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@aro/shared/firebase';

export async function addPoints(userId, amount) {
  const ref = doc(db, 'users', userId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data()?.loyaltyPoints || 0;
    tx.update(ref, { loyaltyPoints: current + amount });
  });
}

export async function updateUser(userId, data) {
  return updateDoc(doc(db, 'users', userId), data);
}

export async function deleteUser(userId) {
  return deleteDoc(doc(db, 'users', userId));
}

export async function updateUserVouchers(userId, vouchers) {
  return updateDoc(doc(db, 'users', userId), { vouchers });
}

export async function updateUserSavedAddresses(userId, addresses) {
  return updateDoc(doc(db, 'users', userId), { savedAddresses: addresses });
}

export async function getUser(userId) {
  const { getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}
