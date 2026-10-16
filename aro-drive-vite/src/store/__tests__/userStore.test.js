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
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  connectFirestoreEmulator: vi.fn(),
}));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(), connectStorageEmulator: vi.fn() }));
vi.mock('firebase/performance', () => ({ getPerformance: vi.fn() }));

import { useUserStore } from '../userStore';

const initialState = {
  user: null,
  isAdmin: false,
  isGuestMode: false,
  loyaltyPoints: 0,
  vouchers: [],
  savedAddresses: [],
  lastOrderId: null,
};

describe('userStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState(initialState);
  });

  test('login sets user data', () => {
    useUserStore.getState().login({ id: 'u1', name: 'User1' });
    expect(useUserStore.getState().user).toEqual({ id: 'u1', name: 'User1' });
    expect(useUserStore.getState().isAdmin).toBe(false);
  });

  test('login with admin flag', () => {
    useUserStore.getState().login({ id: 'u1', isAdmin: true });
    expect(useUserStore.getState().isAdmin).toBe(true);
  });

  test('logout clears state', () => {
    useUserStore.getState().login({ id: 'u1' });
    useUserStore.getState().logout();
    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().loyaltyPoints).toBe(0);
  });

  test('setGuestMode', () => {
    useUserStore.getState().setGuestMode(true);
    expect(useUserStore.getState().isGuestMode).toBe(true);
    expect(useUserStore.getState().user).toBeNull();
  });

  test('addPoints increments and syncs', () => {
    useUserStore.setState({ user: { id: 'u1' }, loyaltyPoints: 100 });
    useUserStore.getState().addPoints(50);
    expect(useUserStore.getState().loyaltyPoints).toBe(150);
  });

  test('redeemVoucher creates voucher', () => {
    useUserStore.setState({ user: { id: 'u1' }, loyaltyPoints: 10000 });
    useUserStore.getState().redeemVoucher(5000);
    expect(useUserStore.getState().loyaltyPoints).toBe(5000);
    expect(useUserStore.getState().vouchers).toHaveLength(1);
    expect(useUserStore.getState().vouchers[0].type).toBe('FREE_DELIVERY');
  });

  test('useVoucher marks as used', () => {
    useUserStore.setState({ user: { id: 'u1' }, vouchers: [{ id: 1, used: false }] });
    useUserStore.getState().useVoucher(1);
    expect(useUserStore.getState().vouchers[0].used).toBe(true);
  });

  test('setLastOrderId', () => {
    useUserStore.getState().setLastOrderId('order123');
    expect(useUserStore.getState().lastOrderId).toBe('order123');
  });
});
