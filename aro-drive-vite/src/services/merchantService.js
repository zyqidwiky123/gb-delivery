import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@aro/shared/firebase';

export async function fetchMerchants() {
  const snap = await getDocs(collection(db, 'merchants'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getMerchant(merchantId) {
  const snap = await getDoc(doc(db, 'merchants', merchantId));
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function getMerchantMenu(merchantId) {
  const snap = await getDocs(collection(db, 'merchants', merchantId, 'menu'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
