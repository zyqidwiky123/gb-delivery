import { db } from './config';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';

// Utility to recursively sanitize data for Firestore (remove undefined, NaN, and handle primitives)
export const sanitizeOrderData = (data) => {
  if (data === null) return null;
  if (data === undefined) return undefined; // Will be stripped by parent object loop
  
  // Handle Firestore field values (sentinels like serverTimestamp)
  if (data && typeof data === 'object' && data.constructor?.name === 'FieldValue') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(v => sanitizeOrderData(v)).filter(v => v !== undefined);
  }

  if (typeof data === 'object') {
    const sanitized = {};
    Object.keys(data).forEach(key => {
      const value = sanitizeOrderData(data[key]);
      if (value !== undefined) {
        sanitized[key] = value;
      }
    });
    return sanitized;
  }

  if (typeof data === 'number' && isNaN(data)) return 0;
  
  return data;
};

// 1. Create a New Order (Customer)
export const createOrder = async (orderData) => {
  try {
    // We expect orderData to be fully sanitized and ready for Firestore
    const docRef = await addDoc(collection(db, "orders"), orderData);
    return docRef.id;
  } catch (e) {
    console.error("Error adding order: ", e);
    throw e;
  }
};


// 2. Listen for Incoming Orders (Driver)
export const listenForAvailableOrders = (callback) => {
  const q = query(collection(db, "orders"), where("status", "==", "searching"));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  });
};

// 3. Driver Accepts Order
export const acceptOrder = async (orderId, driverId) => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
      status: "accepted",
      driverId: driverId,
      acceptedAt: serverTimestamp()
    });
    
    // Also update driver status in 'drivers' collection
    const driverRef = doc(db, "drivers", driverId);
    await updateDoc(driverRef, { status: "busy" });
    
  } catch (e) {
    console.error("Error accepting order: ", e);
  }
};


// 4. Driver Completes Order
export const completeOrder = async (orderId, driverId, totalAmount) => {
  try {
    const orderRef = doc(db, "orders", orderId);
    // 1 Point per 10k
    const earnedPoints = Math.floor(totalAmount / 10000);
    const adminFee = totalAmount * 0.1; // 10% fee as per plan
    
    await updateDoc(orderRef, {
      status: "completed",
      completedAt: serverTimestamp(),
      earnedPoints: earnedPoints,
      adminFee: adminFee
    });
    
    // Release Driver back to online
    const driverRef = doc(db, "drivers", driverId);
    await updateDoc(driverRef, { 
      status: "online",
      lastJobAt: serverTimestamp(),
      // Pembayaran tunai ke driver. Tidak ada pemotongan saldo digital.
    });
    
    console.log(`Order ${orderId} completed. Points earned: ${earnedPoints}. Fee: ${adminFee}`);
  } catch (e) {
    console.error("Error completing order: ", e);
  }
};

// 5. Update Driver Status/Location
export const updateDriverStatus = async (driverId, data) => {
  try {
    const driverRef = doc(db, "drivers", driverId);
    await updateDoc(driverRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.error("Error updating driver: ", e);
  }
};

// 6. Get Driver Data
export const getDriverData = async (driverId) => {
  try {
    const driverRef = doc(db, "drivers", driverId);
    const snap = await getDoc(driverRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (e) {
    console.error("Error getting driver data: ", e);
    return null;
  }
};

