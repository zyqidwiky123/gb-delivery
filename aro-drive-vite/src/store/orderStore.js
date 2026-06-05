import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '../firebase/config';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

export const useOrderStore = create(
  persist(
    (set, get) => ({
      cart: [], // Array of items for AroFood/AroShop
      currentOrder: null, // For Ride/Send: { pickup: {...}, dropoff: {...}, distance: 0, fee: 0 }
      foodDeliveryLocation: null, // { address, lat, lng }
      ridePickup: null, // { lat, lng, address }
      rideDropoff: null, // { lat, lng, address }
      
      // Aro Send Locations
      sendPickup: null, // { lat, lng, address }
      sendDropoff: null, // { lat, lng, address }

      // Aro Shop Locations
      shopPickups: [], // [{ id, name, address, lat, lng }]
      shopDropoff: null, // { name, phone, address, lat, lng }
      shopList: '',
      shopWeight: 1,

      // Centralized Pricing Data
      pricing: {
        jek: { baseFare: 10000, ratePerKm: 2500, minDistance: 3.5, commission: 10 },
        car: { baseFare: 0, ratePerKm: 0, minDistance: 0, commission: 10 },
        food: { baseFare: 5000, ratePerKm: 2000, minDistance: 0, commission: 10 },
        send: { baseFare: 8000, ratePerKm: 2000, weightFareRate: 2000, commission: 10 },
        shop: { baseFare: 0, ratePerKm: 3000, serviceFee: 0, commission: 10 },
        appServiceFee: { blockDistance: 3, feePerBlock: 1000 }
      },
      
      setFoodDelivery: (location) => set({ foodDeliveryLocation: location }),
      
      // Cart Actions
      addToCart: (item) => set((state) => {
        const exists = state.cart.find(i => i.id === item.id);
        if (exists) {
          return { cart: state.cart.map(i => i.id === item.id ? { ...i, qty: i.qty + (item.qty || 1) } : i )};
        }
        return { cart: [...state.cart, { ...item, qty: item.qty || 1 }] };
      }),
      removeFromCart: (itemId) => set((state) => ({ 
        cart: state.cart.filter((i) => i.id !== itemId) 
      })),
      clearCart: () => set({ cart: [] }),
      
      // Ride/Send Actions
      setRouteDetails: (details) => set({ currentOrder: details }),
      clearRoute: () => set({ currentOrder: null }),
      setRidePickup: (location) => set({ ridePickup: location }),
      setRideDropoff: (location) => set({ rideDropoff: location }),
      clearRideLocations: () => set({ ridePickup: null, rideDropoff: null }),

      // Send Actions
      setSendPickup: (location) => set({ sendPickup: location }),
      setSendDropoff: (location) => set({ sendDropoff: location }),
      clearSendLocations: () => {
        sessionStorage.removeItem('aroSend_sender');
        sessionStorage.removeItem('aroSend_receiver');
        sessionStorage.removeItem('aroSend_item');
        set({ sendPickup: null, sendDropoff: null });
      },

      // Shop Actions
      setShopPickups: (locations) => set({ shopPickups: locations }),
      setShopPickupAt: (index, location) => set((state) => {
        const newShops = [...state.shopPickups];
        if (newShops[index]) {
          newShops[index] = { ...newShops[index], ...location };
        } else {
          newShops[index] = { ...location };
        }
        return { shopPickups: newShops };
      }),
      setShopDropoff: (location) => set({ shopDropoff: location }),
      addShopPickup: (data = null) => set((state) => ({
        shopPickups: [...state.shopPickups, { 
          id: Date.now(), 
          name: '', 
          address: '', 
          lat: null, 
          lng: null,
          ...(data || {}) 
        }]
      })),
      removeShopPickup: (id) => set((state) => ({
        shopPickups: state.shopPickups.filter(s => s.id !== id)
      })),
      updateShopPickup: (id, field, value) => set((state) => ({
        shopPickups: state.shopPickups.map(s => s.id === id ? { ...s, [field]: value } : s)
      })),
      setShopWeight: (weight) => set({ shopWeight: weight }),
      setShopList: (list) => set({ shopList: list }),
      clearShopLocations: () => set({ shopPickups: [], shopDropoff: null, shopList: '', shopWeight: 1 }),

      // Pricing Actions
      initPricing: () => {
        const unsub = onSnapshot(doc(db, 'settings', 'pricing'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            set((state) => {
              const merged = { ...state.pricing };
              // Merge each service carefully
              ['jek', 'car', 'food', 'send', 'shop', 'appServiceFee'].forEach(key => {
                if (data[key]) {
                  merged[key] = { ...merged[key], ...data[key] };
                }
              });
              
              // Ensure shop and tip are synced if one is missing
              if (data.tip || data.shop) {
                const shopData = data.shop || data.tip;
                merged.shop = { ...merged.shop, ...shopData };
                merged.tip = merged.shop;
              }

              return { pricing: merged };
            });
          }
        });
        return unsub;
      },
      
      // Helper for distance-based service fee (Biaya Layanan)
      // Rp 1.000 for every 3km block: 0-3km = 1000, 3-6km = 2000, etc.
      calculateAppServiceFee: (distance) => {
        if (!distance || distance <= 0) return 0;
        const { pricing } = get();
        const settings = pricing.appServiceFee || { blockDistance: 3, feePerBlock: 1000 };
        return Math.ceil(distance / settings.blockDistance) * settings.feePerBlock;
      },

      calculateFee: (distance, type = 'jek', weight = 0) => {
        const { pricing } = get();
        // Support both 'shop' and 'tip' as aliases
        const p = pricing[type] || (type === 'shop' ? pricing['tip'] : null) || pricing['jek'];
        
        let total = p.baseFare || 0;
        
        // Fee for Aro Shop includes a service fee
        if (type === 'shop' || type === 'tip') {
            total = (p.serviceFee || 0) + (distance * (p.ratePerKm || 0));
            // Additional Weight for Shop (same logic as Send)
            if (weight > 1) {
              const extraWeight = weight - 1;
              const weightSurcharge = Math.ceil(extraWeight / 2) * (p.weightFareRate || 0);
              total += weightSurcharge;
            }
        } else {
            // Logic for others (Jek, Food, Send)
            // Jarak tambahan setelah minDistance
            const minDistance = p.minDistance || 0;
            if (distance > minDistance) {
              total += (distance - minDistance) * p.ratePerKm;
            }

            // Additional Weight for Send
            if (type === 'send' && weight > 1) {
              const extraWeight = weight - 1;
              const weightSurcharge = Math.ceil(extraWeight / 2) * (p.weightFareRate || 2000);
              total += weightSurcharge;
            }
        }
        
        // Add distance-based app service fee (Biaya Layanan)
        const { calculateAppServiceFee } = get();
        total += calculateAppServiceFee(distance);

        // Bulatkan ke ribuan terdekat (Rounding to nearest 1000)
        // < 500 dibulatkan ke bawah, >= 500 dibulatkan ke atas
        return Math.round(total / 1000) * 1000;
      },
    }),
    {
      name: 'aro-order-storage', // key di localStorage
      partialize: (state) => ({
        cart: state.cart,
        currentOrder: state.currentOrder,
        ridePickup: state.ridePickup,
        rideDropoff: state.rideDropoff,
        sendPickup: state.sendPickup,
        sendDropoff: state.sendDropoff,
        shopPickups: state.shopPickups,
        shopDropoff: state.shopDropoff,
        shopList: state.shopList,
        shopWeight: state.shopWeight,
        foodDeliveryLocation: state.foodDeliveryLocation,
      }),
    }
  )
);
