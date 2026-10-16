import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(), getApp: vi.fn() }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
  GoogleAuthProvider: vi.fn(function () {
    this.setCustomParameters = vi.fn();
  }),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  connectFirestoreEmulator: vi.fn(),
}));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(), connectStorageEmulator: vi.fn() }));
vi.mock('firebase/performance', () => ({ getPerformance: vi.fn() }));

import { onSnapshot } from 'firebase/firestore';
import { usePricingStore } from '../pricingStore';

const initialState = {
  baseFare: 10000,
  ratePerKm: 2500,
  minDistance: 3.5,
  weightFareRate: 2000,
  serviceFeePercent: 0,
};

describe('pricingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePricingStore.setState(initialState);
  });

  test('initPricing subscribes to Firestore doc', () => {
    const unsub = usePricingStore.getState().initPricing();
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(typeof unsub).toBe('function');
  });

  test('updates state from Firestore snapshot', () => {
    usePricingStore.getState().initPricing();

    const cb = vi.mocked(onSnapshot).mock.calls[0][1];
    cb({
      exists: () => true,
      data: () => ({
        jek: { baseFare: 12000, ratePerKm: 3000, minDistance: 2 },
        send: { weightFareRate: 2500 },
      }),
    });

    const state = usePricingStore.getState();
    expect(state.baseFare).toBe(12000);
    expect(state.ratePerKm).toBe(3000);
    expect(state.minDistance).toBe(2);
    expect(state.weightFareRate).toBe(2500);
  });

  test('keeps defaults when snapshot has partial data', () => {
    usePricingStore.getState().initPricing();

    const cb = vi.mocked(onSnapshot).mock.calls[0][1];
    cb({ exists: () => true, data: () => ({ jek: {} }) });

    const state = usePricingStore.getState();
    expect(state.baseFare).toBe(10000);
    expect(state.ratePerKm).toBe(2500);
  });
});
