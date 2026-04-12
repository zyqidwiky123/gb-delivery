import { db } from './config';
import { 
  collection, addDoc, serverTimestamp, doc, onSnapshot 
} from 'firebase/firestore';

export const requestTopup = async (driverId, driverName, amount, method) => {
  try {
    const docRef = await addDoc(collection(db, "topup_requests"), {
      driverId,
      driverName,
      amount: Number(amount),
      method,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error requesting topup:", error);
    throw error;
  }
};

export const observeDriverBalance = (driverId, callback) => {
  return onSnapshot(doc(db, "drivers", driverId), (doc) => {
    if (doc.exists()) {
      callback(doc.data().balance || 0);
    }
  });
};
