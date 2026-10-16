import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@aro/shared/firebase';

export async function updateFcmToken(userId, token) {
  return updateDoc(doc(db, 'users', userId), { fcmToken: token });
}

export async function removeFcmToken(userId) {
  return updateDoc(doc(db, 'users', userId), { fcmToken: null });
}
