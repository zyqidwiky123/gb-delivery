import { db } from './config';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, doc, getDoc } from 'firebase/firestore';

// 1. Create a New Order (Customer)
export const createOrder = async (orderData) => {
  try {
    const docRef = await addDoc(collection(db, "orders"), {
      ...orderData,
      status: "searching",
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding order: ", e);
    throw e;
  }
};

export const listenForAvailableOrders = (callback) => {
  const q = query(collection(db, "orders"), where("status", "==", "searching"));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  });
};

// Listen for Active Jobs for a specific driver (Accepted OR Picked Up)
export const listenForActiveJobs = (driverId, callback) => {
  const q = query(
    collection(db, "orders"), 
    where("driverId", "==", driverId), 
    where("status", "in", ["accepted", "picked_up"])
  );
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  });
};

// Listen for Completed Orders for Earnings
export const listenForCompletedOrders = (driverId, callback) => {
  const q = query(collection(db, "orders"), where("driverId", "==", driverId), where("status", "==", "completed"));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  });
};

// Listen for ALL orders related to a driver
export const listenForAllDriverOrders = (driverId, callback) => {
  const q = query(collection(db, "orders"), where("driverId", "==", driverId));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort locally (newest first)
    orders.sort((a, b) => {
      const timeA = a.acceptedAt?.toMillis() || a.createdAt?.toMillis() || 0;
      const timeB = b.acceptedAt?.toMillis() || b.createdAt?.toMillis() || 0;
      return timeB - timeA;
    });
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
      acceptedAt: serverTimestamp(),
      pickupsDone: 0
    });

    // Also update driver status in 'drivers' collection
    const driverRef = doc(db, "drivers", driverId);
    await updateDoc(driverRef, { status: "busy" });
  } catch (e) {
    console.error("Error accepting order: ", e);
  }
};

// 3.5 Driver Picks Up Order
export const pickupOrder = async (orderId) => {
  try {
    const orderRef = doc(db, "orders", orderId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) return;
    
    const data = snap.data();
    // Support both multi-pickup array and shopLocations
    const pickupsArr = data.pickups || data.shopLocations || [];
    const totalPickups = pickupsArr.length > 0 ? pickupsArr.length : 1;
    const currentDone = data.pickupsDone || 0;
    const nextDone = currentDone + 1;

    console.log(`[Pickup] Order ${orderId}: ${nextDone}/${totalPickups}`);

    if (nextDone < totalPickups) {
      // Still have more stops to visit
      await updateDoc(orderRef, {
        pickupsDone: nextDone
      });
      return { status: 'intermediate', done: nextDone, total: totalPickups };
    } else {
      // All stops picked up or single pickup
      await updateDoc(orderRef, {
        status: "picked_up",
        pickupsDone: totalPickups,
        pickedUpAt: serverTimestamp()
      });
      return { status: 'final', done: totalPickups, total: totalPickups };
    }
  } catch (e) {
    console.error("Error picking up order: ", e);
    throw e;
  }
};

// 4. Driver Completes Order (+ Wallet Deduction)
export const completeOrder = async (orderId, total) => {
  try {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error("Order not found");

    const orderData = orderSnap.data();
    const driverId = orderData.driverId;

    // Hitung platform fee:
    // Utamakan serviceFee dari order (dikirim customer app).
    // Fallback: 10% dari total order.
    const platformFee = orderData.serviceFee 
      ? Number(orderData.serviceFee) 
      : Math.round((Number(total) || 0) * 0.1);

    // 1. Update order status + simpan platformFee
    await updateDoc(orderRef, {
      status: "completed",
      total: Number(total) || 0,
      platformFee: platformFee,
      completedAt: serverTimestamp()
    });

    // 2. Kurangi saldo driver & release ke online
    const driverRef = doc(db, "drivers", driverId);
    const driverSnap = await getDoc(driverRef);
    const currentBalance = driverSnap.exists() ? (driverSnap.data().balance || 0) : 0;
    const newBalance = currentBalance - platformFee;

    await updateDoc(driverRef, { 
      status: "online",
      balance: newBalance,
      lastJobAt: serverTimestamp()
    });

    console.log(`[Wallet] Order ${orderId} completed. Fee: Rp ${platformFee.toLocaleString()}, Balance: Rp ${currentBalance.toLocaleString()} → Rp ${newBalance.toLocaleString()}`);

    return { platformFee, newBalance };
  } catch (e) {
    console.error("Error completing order: ", e);
    throw e;
  }
};
