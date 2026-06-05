import { db } from './config';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, doc, getDoc, runTransaction } from 'firebase/firestore';

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

// Listen for orders exclusively offered to this driver
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

// 3. Driver Accepts Order (with Transaction to prevent race conditions)
export const acceptOrder = async (orderId, driverId, driverProfile = {}) => {
  try {
    const orderRef = doc(db, "orders", orderId);
    const driverRef = doc(db, "drivers", driverId);

    await runTransaction(db, async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Order tidak ditemukan");

      const data = orderSnap.data();

      // Guard: Only the offered driver can accept
      if (data.status !== "searching") {
        throw new Error("Order sudah diambil driver lain.");
      }
      if (data.dispatch?.offeredTo !== driverId) {
        throw new Error("Order ini bukan untuk Anda.");
      }

      // Atomically update order
      transaction.update(orderRef, {
        status: "accepted",
        driverId: driverId,
        driverName: driverProfile.name || 'Driver',
        driverPhone: driverProfile.whatsapp || driverProfile.phone || '',
        driverPhoto: driverProfile.photoUrl || '',
        acceptedAt: serverTimestamp(),
        pickupsDone: 0,
        "dispatch.status": "accepted",
      });

      // Also update driver status to busy
      transaction.update(driverRef, { status: "busy" });
    });
  } catch (e) {
    console.error("Error accepting order: ", e);
    throw e;
  }
};

// Driver actively rejects an offered order (calls backend to rotate)
export const rejectOrder = async (orderId, driverId) => {
  const functionsBaseUrl = import.meta.env.VITE_FUNCTIONS_URL
    || 'https://asia-southeast2-gb-delivery-41bf6.cloudfunctions.net';

  const response = await fetch(`${functionsBaseUrl}/rejectOffer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, driverId })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Gagal menolak pesanan');
  }
  return response.json();
};

// 3.5 Driver Picks Up Order
export const pickupOrder = async (orderId, actualShoppingCost = null) => {
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

    // Persiapkan data update
    let updateData = { pickupsDone: nextDone };

    if (actualShoppingCost !== null) {
      const currentShoppingCost = Number(data.actualShoppingCost) || 0;
      const newTotalShoppingCost = currentShoppingCost + Number(actualShoppingCost);
      updateData.actualShoppingCost = newTotalShoppingCost;
      
      const deliveryFee = Number(data.deliveryFee) || 0;
      const pickupFee = Number(data.pickupFee) || 0;
      updateData.total = newTotalShoppingCost + deliveryFee + pickupFee;
    }

    if (nextDone < totalPickups) {
      // Still have more stops to visit
      await updateDoc(orderRef, updateData);
      return { status: 'intermediate', done: nextDone, total: totalPickups };
    } else {
      // All stops picked up or single pickup
      updateData.status = "picked_up";
      updateData.pickedUpAt = serverTimestamp();
      
      await updateDoc(orderRef, updateData);
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
    // Fallback: Ambil rate dari settings/pricing atau 10%.
    let platformFee = 0;
    if (orderData.serviceFee && Number(orderData.serviceFee) > 0) {
      platformFee = Number(orderData.serviceFee);
    } else {
      try {
        const pricingSnap = await getDoc(doc(db, 'settings', 'pricing'));
        let rate = 0.1; // Default 10%
        if (pricingSnap.exists()) {
          const pricingData = pricingSnap.data();
          const type = orderData.serviceType || 'jek';
          const p = pricingData[type] || pricingData['jek'];
          if (p && p.commission !== undefined) {
            rate = Number(p.commission) / 100;
          }
        }
        const appFee = Number(orderData.appServiceFee || 0);
        const deliveryTotal = (orderData.deliveryFee !== undefined) ? Number(orderData.deliveryFee) : (Number(total) || 0);
        const commissionBase = Math.max(0, deliveryTotal - appFee);
        platformFee = Math.round(commissionBase * rate) + appFee;
      } catch (err) {
        console.warn("Gagal ambil rate pricing, fallback ke 10%:", err);
        const appFee = Number(orderData.appServiceFee || 0);
        const deliveryTotal = (orderData.deliveryFee !== undefined) ? Number(orderData.deliveryFee) : (Number(total) || 0);
        const commissionBase = Math.max(0, deliveryTotal - appFee);
        platformFee = Math.round(commissionBase * 0.1) + appFee;
      }
    }

    // 2. Kurangi saldo driver & release ke online
    const driverRef = doc(db, "drivers", driverId);
    const driverSnap = await getDoc(driverRef);
    const currentBalance = driverSnap.exists() ? (driverSnap.data().balance || 0) : 0;
    const subsidizedFee = Number(orderData.subsidizedFee) || 0;
    const newBalance = currentBalance - platformFee + subsidizedFee;

    // 3. Update order status + simpan platformFee & saldo snapshot
    await updateDoc(orderRef, {
      status: "completed",
      total: Number(total) || 0,
      platformFee: platformFee,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      completedAt: serverTimestamp()
    });

    await updateDoc(driverRef, { 
      status: "online",
      isOnline: true,
      onlineAt: serverTimestamp(),
      statusChangedAt: serverTimestamp(),
      offlineAt: null,
      balance: newBalance,
      lastJobAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log(`[Wallet] Order ${orderId} completed. Fee: Rp ${platformFee.toLocaleString()}, Balance: Rp ${currentBalance.toLocaleString()} → Rp ${newBalance.toLocaleString()}`);

    return { platformFee, newBalance };
  } catch (e) {
    console.error("Error completing order: ", e);
    throw e;
  }
};
