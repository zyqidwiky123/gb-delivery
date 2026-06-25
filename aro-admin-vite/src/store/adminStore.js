import { create } from 'zustand';

export const useAdminStore = create((set, get) => ({
  adminUser: null,
  authLoading: true,
  platformFeePercent: 10,
  activeDrivers: 0,
  totalOrdersToday: 0,

  // New multi-service pricing structure
  pricing: {
    jek: { baseFare: 10000, ratePerKm: 2500, minDistance: 3.5, commission: 10 },
    car: { baseFare: 20000, ratePerKm: 5000, minDistance: 2, commission: 10 },
    food: { baseFare: 5000, ratePerKm: 2000, minDistance: 0, commission: 10 },
    send: { baseFare: 8000, ratePerKm: 2000, weightFareRate: 2000, minDistance: 0, commission: 10 },
    tip: { baseFare: 0, ratePerKm: 3000, serviceFee: 15000, minDistance: 0, commission: 10 },
    appServiceFee: { blockDistance: 3, feePerBlock: 1000 },
    pickupSurcharge: { freePickupRadius: 3, ratePerKm: 2000, maxFee: 15000 }
  },

  pointsPerTenk: 1, // 1 point per 10k
  pointsToRedeem: 50, // 50 points to get voucher
  bentoPromos: [], // List of hero grid promos on member app
  vouchers: [], // Global voucher templates
  
  // New lists for dashboard
  banners: [],
  drivers: [],
  transactions: [],
  topupRequests: [],
  users: [],

  // Actions
  setAdminUser: (user) => set({ adminUser: user, authLoading: false }),
  setAuthLoading: (loading) => set({ authLoading: loading }),
  
  setPlatformFee: (percent) => set({ platformFeePercent: percent }),
  
  // Lists actions
  setBanners: (banners) => set({ banners }),
  setDrivers: (drivers) => set({ drivers }),
  setTransactions: (transactions) => set({ transactions }),
  setTopupRequests: (list) => set({ topupRequests: list }),
  setUsers: (users) => set({ users }),
  setBentoPromos: (list) => set({ bentoPromos: list }),
  setVouchers: (list) => set({ vouchers: list }),

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
  setAllPricing: (pricingData) => set((state) => {
    const merged = { ...state.pricing, ...pricingData };
    if (merged.tip) merged.shop = { ...merged.shop, ...merged.tip };
    if (merged.shop) merged.tip = { ...merged.tip, ...merged.shop };
    return { pricing: merged };
  }),

  setPointsPerTenk: (val) => set({ pointsPerTenk: val }),
  setPointsToRedeem: (val) => set({ pointsToRedeem: val }),
  updateMetrics: (drivers, orders) => set({ activeDrivers: drivers, totalOrdersToday: orders }),

  calculateAppServiceFee: (distance) => {
    if (!distance || distance <= 0) return 0;
    const { pricing } = get();
    const settings = pricing.appServiceFee || { blockDistance: 3, feePerBlock: 1000 };
    return Math.ceil(distance / settings.blockDistance) * settings.feePerBlock;
  },

  calculateFee: (distance, type = 'jek', weight = 0) => {
    if (!distance || distance <= 0) return 0;
    const { pricing, calculateAppServiceFee } = get();
    const p = pricing[type] || (type === 'shop' ? pricing['tip'] : null) || pricing['jek'];

    let total = p.baseFare || 0;

    if (type === 'shop' || type === 'tip') {
      total = (p.serviceFee || 0) + (distance * (p.ratePerKm || 0));
      if (weight > 1) {
        const extraWeight = weight - 1;
        const weightSurcharge = Math.ceil(extraWeight / 2) * (p.weightFareRate || 0);
        total += weightSurcharge;
      }
    } else {
      const minDistance = p.minDistance || 0;
      if (distance > minDistance) {
        total += (distance - minDistance) * p.ratePerKm;
      }
      if (type === 'send' && weight > 1) {
        const extraWeight = weight - 1;
        const weightSurcharge = Math.ceil(extraWeight / 2) * (p.weightFareRate || 2000);
        total += weightSurcharge;
      }
    }

    total += calculateAppServiceFee(distance);
    return Math.round(total / 1000) * 1000;
  },

  logout: () => set({ adminUser: null, authLoading: false }),
}));
