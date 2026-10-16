import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock sessionStorage for clearSendLocations
const mockSessionStorage = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
  configurable: true,
});

// locationStore uses zustand's persist which is safe in Node 22 (no localStorage needed).
// Firebase modules are not imported by locationStore, but kept for consistency.
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
  onSnapshot: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(), connectStorageEmulator: vi.fn() }));
vi.mock('firebase/performance', () => ({ getPerformance: vi.fn() }));

import { useLocationStore } from '../locationStore';

const initialState = {
  foodDeliveryLocation: null,
  ridePickup: null,
  rideDropoff: null,
  sendPickup: null,
  sendDropoff: null,
  shopPickups: [],
  shopDropoff: null,
  shopList: '',
  shopWeight: 1,
};

describe('locationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocationStore.setState(initialState);
  });

  test('setFoodDelivery', () => {
    useLocationStore.getState().setFoodDelivery({ lat: -6.2, lng: 106.8 });
    expect(useLocationStore.getState().foodDeliveryLocation).toEqual({ lat: -6.2, lng: 106.8 });
  });

  test('setRidePickup / setRideDropoff / clearRideLocations', () => {
    useLocationStore.getState().setRidePickup({ lat: -6.2 });
    useLocationStore.getState().setRideDropoff({ lat: -6.3 });
    expect(useLocationStore.getState().ridePickup).toEqual({ lat: -6.2 });
    useLocationStore.getState().clearRideLocations();
    expect(useLocationStore.getState().ridePickup).toBeNull();
  });

  test('setSendPickup / setSendDropoff / clearSendLocations', () => {
    useLocationStore.getState().setSendPickup({ lat: -6.2 });
    useLocationStore.getState().setSendDropoff({ lat: -6.3 });
    expect(useLocationStore.getState().sendPickup).toEqual({ lat: -6.2 });
    useLocationStore.getState().clearSendLocations();
    expect(useLocationStore.getState().sendPickup).toBeNull();
  });

  test('addShopPickup appends with defaults', () => {
    useLocationStore.getState().addShopPickup();
    expect(useLocationStore.getState().shopPickups).toHaveLength(1);
    expect(useLocationStore.getState().shopPickups[0].name).toBe('');
  });

  test('addShopPickup with data', () => {
    useLocationStore.getState().addShopPickup({ name: 'Toko A' });
    expect(useLocationStore.getState().shopPickups[0].name).toBe('Toko A');
  });

  test('removeShopPickup', () => {
    useLocationStore.setState({ shopPickups: [{ id: 1 }, { id: 2 }] });
    useLocationStore.getState().removeShopPickup(1);
    expect(useLocationStore.getState().shopPickups).toHaveLength(1);
    expect(useLocationStore.getState().shopPickups[0].id).toBe(2);
  });

  test('updateShopPickup', () => {
    useLocationStore.setState({ shopPickups: [{ id: 1, name: 'A' }] });
    useLocationStore.getState().updateShopPickup(1, 'name', 'B');
    expect(useLocationStore.getState().shopPickups[0].name).toBe('B');
  });

  test('setShopPickupAt updates by index', () => {
    useLocationStore.setState({ shopPickups: [{ id: 1, name: 'A' }] });
    useLocationStore.getState().setShopPickupAt(0, { name: 'B', lat: -6.2 });
    expect(useLocationStore.getState().shopPickups[0].name).toBe('B');
    expect(useLocationStore.getState().shopPickups[0].lat).toBe(-6.2);
  });

  test('setShopWeight and setShopList', () => {
    useLocationStore.getState().setShopWeight(3);
    useLocationStore.getState().setShopList('Beras');
    expect(useLocationStore.getState().shopWeight).toBe(3);
    expect(useLocationStore.getState().shopList).toBe('Beras');
  });

  test('clearShopLocations', () => {
    useLocationStore.setState({
      shopPickups: [{ id: 1 }],
      shopDropoff: {},
      shopList: 'x',
      shopWeight: 5,
    });
    useLocationStore.getState().clearShopLocations();
    expect(useLocationStore.getState().shopPickups).toEqual([]);
    expect(useLocationStore.getState().shopDropoff).toBeNull();
    expect(useLocationStore.getState().shopList).toBe('');
    expect(useLocationStore.getState().shopWeight).toBe(1);
  });
});
