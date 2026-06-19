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
export const listenForAvailableOrders = (driverId, callback) => {
  const q = query(
    collection(db, "orders"),
    where("status", "==", "searching"),
    where("dispatch.offeredTo", "==", driverId)
  );
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
      isOnline: true,
      onlineAt: serverTimestamp(),
      statusChangedAt: serverTimestamp(),
      offlineAt: null,
      lastJobAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
    const nextData = {
      ...data,
      lastActive: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (nextData.status === "online") {
      nextData.isOnline = true;
      nextData.onlineAt = serverTimestamp();
      nextData.onlineSessionStartAt = serverTimestamp();
      nextData.statusChangedAt = serverTimestamp();
      nextData.offlineAt = null;
    } else if (nextData.status === "offline") {
      nextData.isOnline = false;
      nextData.offlineAt = serverTimestamp();
      nextData.statusChangedAt = serverTimestamp();
      // Akumulasi todayOnlineMs saat offline
      const snap = await getDoc(driverRef);
      if (snap.exists()) {
        const d = snap.data();
        const sessionStart = d.onlineSessionStartAt?.toMillis?.() || d.onlineAt?.toMillis?.() || 0;
        if (sessionStart > 0) {
          const elapsed = Date.now() - sessionStart;
          nextData.todayOnlineMs = (d.todayOnlineMs || 0) + elapsed;
        }
      }
      nextData.onlineSessionStartAt = null;
    }

    await updateDoc(driverRef, { ...nextData });
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

// 7. Rate an Order
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
