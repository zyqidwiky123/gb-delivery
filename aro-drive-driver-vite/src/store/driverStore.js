import { create } from 'zustand';

export const useDriverStore = create((set) => ({
  isOnline: false,
  walletBalance: 0,
  activeJob: null, // Holds current order data ({ pickUp, dropOff, fee, etc })
  
  // Actions
  toggleStatus: () => set((state) => ({ isOnline: !state.isOnline })),
  setWalletBalance: (balance) => set({ walletBalance: balance }),
  acceptJob: (jobData) => set({ activeJob: jobData }),
  completeJob: () => set({ activeJob: null }),
}));
