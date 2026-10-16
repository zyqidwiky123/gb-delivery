import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@aro/shared/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const initialState = {
  cart: [],
  currentOrder: null,
  pricing: {
    jek: { baseFare: 10000, ratePerKm: 2500, minDistance: 3.5, commission: 10 },
    car: { baseFare: 0, ratePerKm: 0, minDistance: 0, commission: 10 },
    food: { baseFare: 5000, ratePerKm: 2000, minDistance: 0, commission: 10 },
    send: { baseFare: 8000, ratePerKm: 2000, weightFareRate: 2000, commission: 10 },
    shop: { baseFare: 0, ratePerKm: 3000, serviceFee: 0, commission: 10 },
    appServiceFee: { blockDistance: 3, feePerBlock: 1000 },
  },
};

export const useCartStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      addToCart: (item) =>
        set((state) => {
          const exists = state.cart.find((i) => i.id === item.id);
          if (exists) {
            return {
              cart: state.cart.map((i) =>
                i.id === item.id ? { ...i, qty: i.qty + (item.qty || 1) } : i
              ),
            };
          }
          return { cart: [...state.cart, { ...item, qty: item.qty || 1 }] };
        }),
      removeFromCart: (itemId) =>
        set((state) => ({
          cart: state.cart.filter((i) => i.id !== itemId),
        })),
      clearCart: () => set({ cart: [] }),
      setRouteDetails: (details) => set({ currentOrder: details }),
      clearRoute: () => set({ currentOrder: null }),

      initPricing: () => {
        const unsub = onSnapshot(doc(db, 'settings', 'pricing'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            set((state) => {
              const merged = { ...state.pricing };
              ['jek', 'car', 'food', 'send', 'shop', 'appServiceFee'].forEach((key) => {
                if (data[key]) {
                  merged[key] = { ...merged[key], ...data[key] };
                }
              });
              if (data.tip || data.shop) {
                const shopData = data.shop || data.tip;
                merged.shop = { ...merged.shop, ...shopData };
              }
              return { pricing: merged };
            });
          }
        });
        return unsub;
      },

      calculateAppServiceFee: (distance) => {
        const { pricing } = get();
        const settings = pricing.appServiceFee || { blockDistance: 3, feePerBlock: 1000 };
        return Math.ceil(distance / settings.blockDistance) * settings.feePerBlock;
      },

      calculateFee: (distance, type = 'jek', weight = 0) => {
        const { pricing, calculateAppServiceFee } = get();
        const p = pricing[type] || (type === 'shop' ? pricing.tip : null) || pricing.jek;
        let total = p.baseFare || 0;
        if (type === 'shop' || type === 'tip') {
          total = (p.serviceFee || 0) + distance * (p.ratePerKm || 0);
          if (weight > 1) {
            total += Math.ceil((weight - 1) / 2) * (p.weightFareRate || 0);
          }
        } else {
          const minDistance = p.minDistance || 0;
          if (distance > minDistance) {
            total += (distance - minDistance) * p.ratePerKm;
          }
          if (type === 'send' && weight > 1) {
            total += Math.ceil((weight - 1) / 2) * (p.weightFareRate || 2000);
          }
        }
        total += calculateAppServiceFee(distance);
        return Math.round(total / 1000) * 1000;
      },
    }),
    {
      name: 'aro-cart-storage',
      partialize: (state) => ({
        cart: state.cart,
        currentOrder: state.currentOrder,
      }),
    }
  )
);
