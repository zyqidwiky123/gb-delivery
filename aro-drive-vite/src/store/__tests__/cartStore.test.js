import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(), getApp: vi.fn() }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
  GoogleAuthProvider: vi.fn(function () {
    this.setCustomParameters = vi.fn();
    return this;
  }),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(), connectStorageEmulator: vi.fn() }));
vi.mock('firebase/performance', () => ({ getPerformance: vi.fn() }));

import { onSnapshot } from 'firebase/firestore';
import { useCartStore } from '../cartStore';

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

describe('cartStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCartStore.setState(initialState);
  });

  test('addToCart adds new item', () => {
    useCartStore.getState().addToCart({ id: 'item1', name: 'Nasi Goreng', price: 15000 });
    const cart = useCartStore.getState().cart;
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(1);
  });

  test('addToCart increments quantity for existing item', () => {
    useCartStore.getState().addToCart({ id: 'item1' });
    useCartStore.getState().addToCart({ id: 'item1' });
    expect(useCartStore.getState().cart[0].qty).toBe(2);
  });

  test('removeFromCart removes item', () => {
    useCartStore.setState({ cart: [{ id: 'a' }, { id: 'b' }] });
    useCartStore.getState().removeFromCart('a');
    expect(useCartStore.getState().cart).toHaveLength(1);
    expect(useCartStore.getState().cart[0].id).toBe('b');
  });

  test('clearCart empties cart', () => {
    useCartStore.setState({ cart: [{ id: 'a' }] });
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().cart).toEqual([]);
  });

  test('setRouteDetails / clearRoute', () => {
    useCartStore.getState().setRouteDetails({ distance: 5 });
    expect(useCartStore.getState().currentOrder).toEqual({ distance: 5 });
    useCartStore.getState().clearRoute();
    expect(useCartStore.getState().currentOrder).toBeNull();
  });

  test('initPricing subscribes', () => {
    useCartStore.getState().initPricing();
    expect(onSnapshot).toHaveBeenCalled();
  });

  describe('calculateAppServiceFee', () => {
    test('returns 0 for zero distance', () => {
      expect(useCartStore.getState().calculateAppServiceFee(0)).toBe(0);
    });
    test('Rp 1000 per 3km block', () => {
      expect(useCartStore.getState().calculateAppServiceFee(3)).toBe(1000);
    });
  });

  describe('calculateFee', () => {
    test('jek returns rounded fee', () => {
      const fee = useCartStore.getState().calculateFee(2, 'jek');
      expect(fee % 1000).toBe(0);
      expect(fee).toBeGreaterThan(0);
    });
    test('food returns fee', () => {
      expect(useCartStore.getState().calculateFee(3, 'food')).toBeGreaterThan(0);
    });
    test('send with weight', () => {
      expect(useCartStore.getState().calculateFee(5, 'send', 3)).toBeGreaterThan(0);
    });
  });
});
