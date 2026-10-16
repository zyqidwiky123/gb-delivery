import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useLocationStore = create(
  persist(
    (set) => ({
      foodDeliveryLocation: null,
      ridePickup: null,
      rideDropoff: null,
      sendPickup: null,
      sendDropoff: null,
      shopPickups: [],
      shopDropoff: null,
      shopList: '',
      shopWeight: 1,

      setFoodDelivery: (location) => set({ foodDeliveryLocation: location }),
      setRidePickup: (location) => set({ ridePickup: location }),
      setRideDropoff: (location) => set({ rideDropoff: location }),
      clearRideLocations: () => set({ ridePickup: null, rideDropoff: null }),
      setSendPickup: (location) => set({ sendPickup: location }),
      setSendDropoff: (location) => set({ sendDropoff: location }),
      clearSendLocations: () => {
        sessionStorage.removeItem('aroSend_sender');
        sessionStorage.removeItem('aroSend_receiver');
        sessionStorage.removeItem('aroSend_item');
        set({ sendPickup: null, sendDropoff: null });
      },
      setShopPickups: (locations) => set({ shopPickups: locations }),
      setShopPickupAt: (index, location) =>
        set((state) => {
          const newShops = [...state.shopPickups];
          if (newShops[index]) {
            newShops[index] = { ...newShops[index], ...location };
          } else {
            newShops[index] = { ...location };
          }
          return { shopPickups: newShops };
        }),
      setShopDropoff: (location) => set({ shopDropoff: location }),
      addShopPickup: (data = null) =>
        set((state) => ({
          shopPickups: [
            ...state.shopPickups,
            {
              id: Date.now(),
              name: '',
              address: '',
              lat: null,
              lng: null,
              ...(data || {}),
            },
          ],
        })),
      removeShopPickup: (id) =>
        set((state) => ({
          shopPickups: state.shopPickups.filter((s) => s.id !== id),
        })),
      updateShopPickup: (id, field, value) =>
        set((state) => ({
          shopPickups: state.shopPickups.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
        })),
      setShopWeight: (weight) => set({ shopWeight: weight }),
      setShopList: (list) => set({ shopList: list }),
      clearShopLocations: () =>
        set({ shopPickups: [], shopDropoff: null, shopList: '', shopWeight: 1 }),
    }),
    {
      name: 'aro-location-storage',
      partialize: (state) => ({
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
