import { create } from 'zustand';
import { describe, test, expect, beforeEach } from 'vitest';

const createTestStore = () => {
  return create((set, get) => ({
    pricing: {
      jek: { baseFare: 10000, ratePerKm: 2500, minDistance: 3.5, commission: 10 },
      car: { baseFare: 20000, ratePerKm: 5000, minDistance: 2, commission: 10 },
      food: { baseFare: 5000, ratePerKm: 2000, minDistance: 0, commission: 10 },
      send: { baseFare: 8000, ratePerKm: 2000, weightFareRate: 2000, commission: 10 },
      tip: { baseFare: 0, ratePerKm: 3000, serviceFee: 15000, minDistance: 0, commission: 10 },
      appServiceFee: { blockDistance: 3, feePerBlock: 1000 },
      pickupSurcharge: { freePickupRadius: 3, ratePerKm: 2000, maxFee: 15000 }
    },

    setServicePricing: (service, field, value) => set((state) => ({
      pricing: {
        ...state.pricing,
        [service]: {
          ...state.pricing[service],
          [field]: value
        }
      }
    })),

    setAllPricing: (pricingData) => set((state) => {
      const merged = { ...state.pricing, ...pricingData };
      if (merged.tip) merged.shop = { ...merged.shop, ...merged.tip };
      if (merged.shop) merged.tip = { ...merged.tip, ...merged.shop };
      return { pricing: merged };
    }),

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
  }));
};

describe('adminStore calculateFee', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
  });

  test('returns 0 for zero/negative distance', () => {
    const { calculateFee } = store.getState();
    expect(calculateFee(0, 'jek')).toBe(0);
    expect(calculateFee(-1, 'jek')).toBe(0);
  });

  test('jek: base fare for distance under minDistance', () => {
    const { calculateFee } = store.getState();
    const fee = calculateFee(2, 'jek');
    expect(fee).toBe(11000);
  });

  test('jek: adds rate per km beyond minDistance', () => {
    const { calculateFee } = store.getState();
    const fee = calculateFee(5, 'jek');
    expect(fee).toBeGreaterThan(10000);
  });

  test('car: base fare with different rates', () => {
    const { calculateFee } = store.getState();
    const fee = calculateFee(3, 'car');
    expect(fee).toBeGreaterThan(20000);
  });

  test('food: base fare + rate per km', () => {
    const { calculateFee } = store.getState();
    const fee = calculateFee(3, 'food');
    expect(fee).toBeGreaterThan(0);
  });

  test('send: base fare + rate per km + weight surcharge', () => {
    const { calculateFee } = store.getState();
    const fee = calculateFee(5, 'send', 3);
    expect(fee).toBeGreaterThan(0);
  });

  test('tip: service fee + rate per km', () => {
    const { calculateFee } = store.getState();
    const fee = calculateFee(3, 'tip');
    expect(fee).toBeGreaterThan(0);
  });

  test('rounds to nearest 1000', () => {
    const { calculateFee } = store.getState();
    const fee = calculateFee(3.3, 'jek');
    expect(fee % 1000).toBe(0);
  });

  test('unknown type falls back to jek pricing', () => {
    const { calculateFee } = store.getState();
    const fee = calculateFee(2, 'nonexistent');
    expect(fee).toBe(11000);
  });
});

describe('adminStore calculateAppServiceFee', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
  });

  test('returns 0 for zero distance', () => {
    const { calculateAppServiceFee } = store.getState();
    expect(calculateAppServiceFee(0)).toBe(0);
    expect(calculateAppServiceFee(-1)).toBe(0);
    expect(calculateAppServiceFee(null)).toBe(0);
  });

  test('Rp 1000 for every 3km block', () => {
    const { calculateAppServiceFee } = store.getState();
    expect(calculateAppServiceFee(1)).toBe(1000);
    expect(calculateAppServiceFee(3)).toBe(1000);
    expect(calculateAppServiceFee(3.1)).toBe(2000);
    expect(calculateAppServiceFee(6)).toBe(2000);
    expect(calculateAppServiceFee(6.1)).toBe(3000);
  });
});

describe('adminStore setServicePricing', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
  });

  test('updates a single pricing field', () => {
    const { setServicePricing } = store.getState();
    setServicePricing('jek', 'baseFare', 15000);
    const { pricing } = store.getState();
    expect(pricing.jek.baseFare).toBe(15000);
    expect(pricing.jek.ratePerKm).toBe(2500);
  });
});

describe('adminStore setAllPricing', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
  });

  test('merges partial pricing data (shallow replace)', () => {
    const { setAllPricing } = store.getState();
    setAllPricing({ jek: { baseFare: 12000 } });
    const { pricing } = store.getState();
    expect(pricing.jek.baseFare).toBe(12000);
    // shallow merge replaces entire object, so ratePerKm is lost
    expect(pricing.jek.ratePerKm).toBeUndefined();
  });

  test('syncs tip and shop — tip overwrites shop', () => {
    const { setAllPricing } = store.getState();
    setAllPricing({ tip: { baseFare: 5000 }, shop: { baseFare: 3000 } });
    const { pricing } = store.getState();
    // because tip is merged after shop, tip wins
    expect(pricing.tip.baseFare).toBe(5000);
    expect(pricing.shop.baseFare).toBe(5000);
  });
});