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
import { usePromoStore } from '../promoStore';

const initialState = {
  adminWhatsApp: '6285748343842',
  categories: ['All'],
  promoHeadline: '',
  bentoPromos: [],
  vouchers: [],
  defaultDeliveryTime: '20-30',
  platformFeePercent: 10,
  pointsPerTenk: 1000,
  pointsToRedeem: 5000,
};

describe('promoStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePromoStore.setState(initialState);
  });

  test('initPromo subscribes to Firestore doc', () => {
    const unsub = usePromoStore.getState().initPromo();
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(typeof unsub).toBe('function');
  });

  test('updates state from Firestore snapshot', () => {
    usePromoStore.getState().initPromo();

    const callback = vi.mocked(onSnapshot).mock.calls[0][1];
    callback({
      exists: () => true,
      data: () => ({
        platformFeePercent: 15,
        pointsPerTenk: 2000,
        promoHeadline: 'Diskon 50%',
        vouchers: [{ code: 'FREEOG' }],
      }),
    });

    const state = usePromoStore.getState();
    expect(state.platformFeePercent).toBe(15);
    expect(state.pointsPerTenk).toBe(2000);
    expect(state.promoHeadline).toBe('Diskon 50%');
    expect(state.vouchers).toEqual([{ code: 'FREEOG' }]);
  });

  test('keeps defaults on partial update', () => {
    usePromoStore.getState().initPromo();

    const callback = vi.mocked(onSnapshot).mock.calls[0][1];
    callback({ exists: () => true, data: () => ({}) });

    expect(usePromoStore.getState().platformFeePercent).toBe(10);
    expect(usePromoStore.getState().pointsPerTenk).toBe(1000);
  });
});
