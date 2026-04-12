import { create } from 'zustand';

export const useAdminStore = create((set) => ({
  adminUser: null,
  authLoading: true,
  platformFeePercent: 10,
  activeDrivers: 0,
  totalOrdersToday: 0,

  // New multi-service pricing structure
  pricing: {
    jek: { baseFare: 10000, ratePerKm: 2500, minDistance: 3.5 },
    car: { baseFare: 20000, ratePerKm: 5000, minDistance: 2 },
    food: { baseFare: 5000, ratePerKm: 2000, minDistance: 0 },
    send: { baseFare: 8000, ratePerKm: 2000, weightFareRate: 2000, minDistance: 0 },
    tip: { baseFare: 0, ratePerKm: 3000, serviceFee: 15000, minDistance: 0 }
  },

  pointsPerTenk: 1, // 1 point per 10k
  pointsToRedeem: 50, // 50 points to get voucher
  
  // New lists for dashboard
  banners: [],
  drivers: [],
  transactions: [],
  topupRequests: [],

  // Actions
  setAdminUser: (user) => set({ adminUser: user, authLoading: false }),
  setAuthLoading: (loading) => set({ authLoading: loading }),
  
  setPlatformFee: (percent) => set({ platformFeePercent: percent }),
  
  // Lists actions
  setBanners: (banners) => set({ banners }),
  setDrivers: (drivers) => set({ drivers }),
  setTransactions: (transactions) => set({ transactions }),
  setTopupRequests: (list) => set({ topupRequests: list }),

  // Dynamic pricing action
  setServicePricing: (service, field, value) => set((state) => ({
    pricing: {
      ...state.pricing,
      [service]: {
        ...state.pricing[service],
        [field]: value
      }
    }
  })),

  // Bulk set (useful for fetching from Firestore)
  // Merge with existing defaults to prevent blank screen if Firestore is missing some keys
  setAllPricing: (pricingData) => set((state) => ({ 
    pricing: { ...state.pricing, ...pricingData } 
  })),

  setPointsPerTenk: (val) => set({ pointsPerTenk: val }),
  setPointsToRedeem: (val) => set({ pointsToRedeem: val }),
  updateMetrics: (drivers, orders) => set({ activeDrivers: drivers, totalOrdersToday: orders }),
  
  logout: () => set({ adminUser: null, authLoading: false }),
}));
