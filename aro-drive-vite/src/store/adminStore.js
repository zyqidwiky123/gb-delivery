import { create } from 'zustand';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useOrderStore } from './orderStore';

export const useAdminStore = create((set, get) => ({
  // Pricing Settings
  baseFare: 10000,
  ratePerKm: 2500,
  weightFareRate: 2000, // Tarif per kelipatan 2 KG (setelah 1 KG pertama)
  serviceFeePercent: 10,
  isLoading: false,
  
  // Dashboard Metrics
  totalRevenue: 2450000,
  totalOrders: 154,
  activeDrivers: 12,
  
  // Actions
  // Real-time synchronization
  initSettings: () => {
    const unsub = onSnapshot(doc(db, "settings", "platform"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({ 
          platformFeePercent: data.platformFeePercent || 10,
          pointsPerTenk: data.pointsPerTenk || 10000,
          pointsToRedeem: data.pointsToRedeem || 5000
        });
      }
    });
    return unsub;
  },

  updatePricing: async (base, rate, serviceFee, weightFare) => {
    set({ isLoading: true });
    try {
      await updateDoc(doc(db, "settings", "system"), {
        baseFare: base,
        ratePerKm: rate,
        weightFareRate: weightFare,
        serviceFeePercent: serviceFee,
        updatedAt: new Date()
      });
      set({ baseFare: base, ratePerKm: rate, serviceFeePercent: serviceFee, weightFareRate: weightFare });
      // Also update orderStore pricing
      useOrderStore.getState().setPricing(base, rate, weightFare);
    } catch (error) {
      console.error("Error updating settings:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateStats: (stats) => set((state) => ({ ...state, ...stats })),
}));

