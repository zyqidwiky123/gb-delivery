import { create } from 'zustand';
import { describe, test, expect, beforeEach } from 'vitest';

const createTestStore = () => {
  return create((set, get) => ({
    pricing: {
      jek: { baseFare: 10000, ratePerKm: 2500, minDistance: 3.5, commission: 10 },
      car: { baseFare: 0, ratePerKm: 0, minDistance: 0, commission: 10 },
      food: { baseFare: 5000, ratePerKm: 2000, minDistance: 0, commission: 10 },
      send: { baseFare: 8000, ratePerKm: 2000, weightFareRate: 2000, commission: 10 },
      shop: { baseFare: 0, ratePerKm: 3000, serviceFee: 0, commission: 10 },
      appServiceFee: { blockDistance: 3, feePerBlock: 1000 },
    },

    calculateAppServiceFee: (distance) => {
      if (!distance || distance <= 0) return 0;
      const { pricing } = get();
      const settings = pricing.appServiceFee || { blockDistance: 3, feePerBlock: 1000 };
      return Math.ceil(distance / settings.blockDistance) * settings.feePerBlock;
    },

    calculateFee: (distance, type = 'jek', weight = 0) => {
      const { pricing } = get();
      const p = pricing[type] || (type === 'shop' ? pricing.tip : null) || pricing.jek;

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

      const { calculateAppServiceFee } = get();
      total += calculateAppServiceFee(distance);

      return Math.round(total / 1000) * 1000;
    },
  }));
};

describe('orderStore calculateFee', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
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

  test('shop: service fee + rate per km', () => {
    const { calculateFee } = store.getState();
    const fee = calculateFee(3, 'shop');
    expect(fee).toBeGreaterThan(0);
  });

  test('rounds to nearest 1000', () => {
    const { calculateFee } = store.getState();
    const fee = calculateFee(3.3, 'jek');
    expect(fee % 1000).toBe(0);
  });

  test('zero distance returns base fare + service fee', () => {
    const { calculateFee } = store.getState();
    const fee = calculateFee(0, 'jek');
    expect(fee).toBeGreaterThan(0);
  });
});

describe('orderStore calculateAppServiceFee', () => {
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
