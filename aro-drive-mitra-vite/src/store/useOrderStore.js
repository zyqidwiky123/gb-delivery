import { create } from 'zustand';
import { db } from '../firebase/config';
import { 
  collection, query, where, onSnapshot, orderBy, 
  doc, updateDoc, serverTimestamp, getDocs, limit, startAfter
} from 'firebase/firestore';

export const useOrderStore = create((set, get) => ({
  orders: [],
  historyOrders: [],
  historyLastDoc: null,
  historyHasMore: true,
  isLoadingHistory: false,
  unsubscribe: null,
  newOrderSound: null,
  previousPendingIds: new Set(),

  // Start real-time listener for merchant orders
  listenToOrders: (merchantUid) => {
    const prev = get().unsubscribe;
    if (prev) prev();

    const q = query(
      collection(db, "orders"),
      where("merchantId", "==", merchantUid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const currentPendingIds = get().previousPendingIds;
      const ordersData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      // Detect new pending orders (only AFTER driver accepts, i.e. not searching)
      const newPendingOrders = ordersData.filter(o => 
        !o.merchantConfirmed && 
        o.status !== 'searching' && 
        o.status !== 'completed' && 
        o.status !== 'cancelled'
      );

      const hasNewOrder = newPendingOrders.some(o => !currentPendingIds.has(o.id));

      // Play sound if there's a new pending order and it's not the initial load
      if (hasNewOrder && currentPendingIds.size > 0) {
        get().playNotificationSound();
        // Vibrate
        if ('vibrate' in navigator) {
          navigator.vibrate([300, 100, 300, 100, 300]);
        }

        // Show browser notification
        if (Notification.permission === 'granted') {
          new Notification('Pesanan Baru!', {
            body: 'Ada pesanan baru yang sudah diterima driver. Silakan siapkan pesanan.',
            icon: '/icon.png'
          });
        }
      }

      set({ 
        orders: ordersData, 
        previousPendingIds: new Set(newPendingOrders.map(o => o.id))
      });
    }, (error) => {
      console.error("Error listening to merchant orders:", error);
    });

    set({ unsubscribe: unsub });
  },

  stopListening: () => {
    const unsub = get().unsubscribe;
    if (unsub) unsub();
    set({ unsubscribe: null });
  },

  // Accept order
  acceptOrder: async (orderId) => {
    try {
      const ref = doc(db, "orders", orderId);
      await updateDoc(ref, {
        merchantConfirmed: true,
        merchantConfirmedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error accepting order:", err);
      throw err;
    }
  },

  // Reject order
  rejectOrder: async (orderId, reason = '') => {
    try {
      const ref = doc(db, "orders", orderId);
      await updateDoc(ref, {
        status: 'cancelled',
        cancelledBy: 'merchant',
        cancelReason: reason || 'Ditolak oleh merchant',
        cancelledAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error rejecting order:", err);
      throw err;
    }
  },

  // Mark order as ready for pickup
  markReady: async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        merchantReady: true,
        merchantReadyAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error marking ready:", error);
      throw error;
    }
  },

  updateManualPrice: async (orderId, newPrice) => {
    try {
      const order = get().orders.find(o => o.id === orderId);
      if (!order) throw new Error("Order not found");

      const price = Number(newPrice);
      const newTotal = (order.deliveryFee || 0) + price;
      
      const newItems = order.items?.map(item => {
        if (item.isManual) {
          return { ...item, price: price };
        }
        return item;
      }) || [];

      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        subtotal: price,
        actualShoppingCost: price,
        total: newTotal,
        items: newItems
      });
      console.log(`Updated manual price for ${orderId} to ${price}`);
    } catch (error) {
      console.error("Error updating manual price:", error);
      throw error;
    }
  },

  // Play notification sound
  playNotificationSound: () => {
    try {
      const audio = new Audio('/notif.mp3');
      audio.volume = 1.0;
      audio.play().catch(() => {});
    } catch (e) {
      console.warn("Could not play sound:", e);
    }
  },

  // --- Computed helpers ---
  getActiveOrders: () => {
    return get().orders.filter(o => 
      o.status !== 'completed' && o.status !== 'cancelled'
    );
  },

  getPendingOrders: () => {
    return get().orders.filter(o => 
      !o.merchantConfirmed && 
      o.status !== 'searching' &&
      o.status !== 'completed' && 
      o.status !== 'cancelled'
    );
  },

  getConfirmedOrders: () => {
    return get().orders.filter(o => 
      o.merchantConfirmed && 
      o.status !== 'completed' && 
      o.status !== 'cancelled'
    );
  },

  getTodayOrders: () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return get().orders.filter(o => {
      const created = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return created >= startOfDay;
    });
  },

  getTodayCompleted: () => {
    return get().getTodayOrders().filter(o => o.status === 'completed');
  },

  getTodayRevenue: () => {
    return get().getTodayCompleted().reduce((sum, o) => sum + (o.subtotal || 0), 0);
  },

  // Fetch order history (paginated)
  fetchHistory: async (merchantUid, isNew = true) => {
    if (get().isLoadingHistory) return;
    set({ isLoadingHistory: true });

    try {
      let q = query(
        collection(db, "orders"),
        where("merchantId", "==", merchantUid),
        where("status", "in", ["completed", "cancelled"]),
        orderBy("createdAt", "desc"),
        limit(20)
      );

      if (!isNew && get().historyLastDoc) {
        q = query(q, startAfter(get().historyLastDoc));
      }

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

      set({
        historyOrders: isNew ? docs : [...get().historyOrders, ...docs],
        historyLastDoc: lastDoc,
        historyHasMore: docs.length === 20,
        isLoadingHistory: false
      });
    } catch (err) {
      console.error("Error fetching history:", err);
      set({ isLoadingHistory: false });
    }
  }
}));
