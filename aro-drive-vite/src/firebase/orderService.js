import { db } from './config';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from 'firebase/firestore';

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


// 2. Rate an Order
export const rateOrder = async (orderId, rating, review) => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
      rating: Number(rating),
      review: review || "",
      ratedAt: serverTimestamp()
    });
    console.log(`Order ${orderId} rated: ${rating}`);
  } catch (e) {
    console.error("Error rating order: ", e);
    throw e;
  }
};
// 8. Cancel an Order
export const cancelOrder = async (orderId, reason, cancelledBy = 'user') => {
  try {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) return;
    
    const orderData = orderSnap.data();
    
    await updateDoc(orderRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      cancelReason: reason || "Dibatalkan oleh " + cancelledBy,
      cancelledBy: cancelledBy
    });
    
    // If order was accepted, release the driver
    if (orderData.driverId) {
      const driverRef = doc(db, "drivers", orderData.driverId);
      await updateDoc(driverRef, {
        status: "online",
        isOnline: true,
        onlineAt: serverTimestamp(),
        statusChangedAt: serverTimestamp(),
        offlineAt: null,
        lastActive: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

    }
    
    console.log(`Order ${orderId} cancelled by ${cancelledBy}. Reason: ${reason}`);
  } catch (e) {
    console.error("Error cancelling order: ", e);
    throw e;
  }
};

// 9. Update Payment Method
export const updateOrderPaymentMethod = async (orderId, method) => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
      paymentMethod: method,
      paymentMethodUpdatedAt: serverTimestamp()
    });
    console.log(`Order ${orderId} payment method updated to: ${method}`);
  } catch (e) {
    console.error("Error updating payment method: ", e);
    throw e;
  }
};
