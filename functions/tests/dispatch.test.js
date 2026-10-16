const mockOrderRepoUpdate = jest.fn();
const mockOrderRepoGetById = jest.fn();
const mockDriverRepoGetOnlineDrivers = jest.fn();
const mockDriverRepoSetIncomingOrder = jest.fn();
const mockDriverRepoGetOnlineAvailableDriversCount = jest.fn();
const mockNotifySendToUser = jest.fn();
const mockNotifySendWA = jest.fn();
const mockCalculateDistance = jest.fn();
const mockIsDriverOverDailyLimit = jest.fn();
const mockIsDriverLocationFresh = jest.fn();
const mockNormalizeServiceType = jest.fn((t) => t || 'transport');

jest.mock('../src/repositories/orderRepo', () =>
  jest.fn(() => ({
    update: (...args) => mockOrderRepoUpdate(...args),
    getById: (...args) => mockOrderRepoGetById(...args),
  }))
);

jest.mock('../src/repositories/driverRepo', () =>
  jest.fn(() => ({
    getOnlineDrivers: (...args) => mockDriverRepoGetOnlineDrivers(...args),
    setIncomingOrder: (...args) => mockDriverRepoSetIncomingOrder(...args),
    getOnlineAvailableDriversCount: (...args) =>
      mockDriverRepoGetOnlineAvailableDriversCount(...args),
  }))
);

jest.mock('../src/services/notificationService', () =>
  jest.fn(() => ({
    sendToUser: (...args) => mockNotifySendToUser(...args),
    sendWA: (...args) => mockNotifySendWA(...args),
  }))
);

jest.mock('../src/utils', () => ({
  calculateDistance: (...args) => mockCalculateDistance(...args),
  isDriverOverDailyLimit: (...args) => mockIsDriverOverDailyLimit(...args),
  isDriverLocationFresh: (...args) => mockIsDriverLocationFresh(...args),
  normalizeServiceType: (...args) => mockNormalizeServiceType(...args),
}));

jest.mock('firebase-admin', () => {
  const mockDoc = { update: jest.fn(), get: jest.fn(), set: jest.fn() };
  const mockCol = { doc: jest.fn(() => mockDoc), add: jest.fn(), get: jest.fn() };
  const firestoreFn = jest.fn(() => ({ collection: jest.fn(() => mockCol) }));
  firestoreFn.FieldValue = {
    increment: jest.fn((n) => n),
    serverTimestamp: jest.fn(() => new Date()),
    delete: jest.fn(() => '__delete__'),
  };
  firestoreFn.Timestamp = {
    fromDate: jest.fn((d) => ({ toDate: () => d })),
  };
  return {
    firestore: firestoreFn,
    database: jest.fn(() => ({
      ref: jest.fn(() => ({
        once: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
        child: jest.fn(),
      })),
    })),
    messaging: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) })),
    initializeApp: jest.fn(),
    credential: { applicationDefault: jest.fn() },
  };
});

const {
  DISPATCH_CONFIG,
  DRIVER_OFFER_TIMEOUT_MS,
  getDispatchRegionConfig,
  dispatchOrder,
  setNoDriverStatus,
  getOnlineDrivers,
  getOnlineAvailableDriversCount,
} = require('../src/dispatch');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DISPATCH_CONFIG', () => {
  test('has config for all service types', () => {
    expect(DISPATCH_CONFIG).toHaveProperty('transport');
    expect(DISPATCH_CONFIG).toHaveProperty('food');
    expect(DISPATCH_CONFIG).toHaveProperty('express');
    expect(DISPATCH_CONFIG).toHaveProperty('send');
    expect(DISPATCH_CONFIG).toHaveProperty('shop');
  });

  test('food has smaller radius than transport', () => {
    expect(DISPATCH_CONFIG.food.initRadiusKm).toBeLessThanOrEqual(
      DISPATCH_CONFIG.transport.initRadiusKm
    );
    expect(DISPATCH_CONFIG.food.maxRadiusKm).toBeLessThanOrEqual(
      DISPATCH_CONFIG.transport.maxRadiusKm
    );
  });

  test('express has largest max radius', () => {
    expect(DISPATCH_CONFIG.express.maxRadiusKm).toBe(20);
  });
});

describe('DRIVER_OFFER_TIMEOUT_MS', () => {
  test('is 60 seconds', () => {
    expect(DRIVER_OFFER_TIMEOUT_MS).toBe(60000);
  });
});

describe('getDispatchRegionConfig', () => {
  test('returns kota config for kota', () => {
    const config = getDispatchRegionConfig('kota');
    expect(config.initialRadius).toBe(3);
    expect(config.maxRadius).toBe(10);
    expect(config.maxSearchMinutes).toBe(5);
  });

  test('returns kabupaten config for kabupaten', () => {
    const config = getDispatchRegionConfig('kabupaten');
    expect(config.initialRadius).toBe(4);
    expect(config.maxRadius).toBe(20);
    expect(config.maxSearchMinutes).toBe(7);
  });

  test('defaults to kota for unknown region', () => {
    const config = getDispatchRegionConfig('unknown');
    expect(config.initialRadius).toBe(3);
  });
});

describe('getOnlineDrivers', () => {
  test('delegates to driverRepo.getOnlineDrivers', async () => {
    const fakeDrivers = [{ id: 'd1' }, { id: 'd2' }];
    mockDriverRepoGetOnlineDrivers.mockResolvedValue(fakeDrivers);
    const result = await getOnlineDrivers();
    expect(result).toEqual(fakeDrivers);
  });
});

describe('getOnlineAvailableDriversCount', () => {
  test('delegates to driverRepo.getOnlineAvailableDriversCount', async () => {
    mockDriverRepoGetOnlineAvailableDriversCount.mockResolvedValue(5);
    const result = await getOnlineAvailableDriversCount();
    expect(result).toBe(5);
  });
});

describe('dispatchOrder', () => {
  const orderId = 'order123';
  const baseOrderData = {
    serviceType: 'food',
    pickup: { lat: -6.2, lng: 106.8 },
  };
  const baseDispatchState = {
    currentRadius: 3,
    notifiedDrivers: [],
    rejectedDrivers: [],
    iteration: 1,
  };

  function makeDriver(overrides = {}) {
    return {
      id: 'd1',
      location: { lat: -6.21, lng: 106.81 },
      rating: 4.8,
      lastJobAt: null,
      balance: 1000,
      fcmToken: 'fcm_d1',
      ...overrides,
    };
  }

  beforeEach(() => {
    mockNormalizeServiceType.mockImplementation((t) => t || 'transport');
    mockCalculateDistance.mockReturnValue(1.5);
    mockIsDriverOverDailyLimit.mockReturnValue(false);
    mockIsDriverLocationFresh.mockReturnValue(true);
    mockDriverRepoGetOnlineDrivers.mockResolvedValue([makeDriver()]);
    mockOrderRepoUpdate.mockResolvedValue(undefined);
    mockDriverRepoSetIncomingOrder.mockResolvedValue(undefined);
  });

  test('returns false when no candidates in radius', async () => {
    mockDriverRepoGetOnlineDrivers.mockResolvedValue([]);
    const result = await dispatchOrder(orderId, baseOrderData, baseDispatchState);
    expect(result).toBe(false);
  });

  test('skips rejected drivers', async () => {
    const drivers = [
      makeDriver({ id: 'd1' }),
      makeDriver({ id: 'd2', location: { lat: -6.22, lng: 106.82 } }),
    ];
    mockDriverRepoGetOnlineDrivers.mockResolvedValue(drivers);
    const state = { ...baseDispatchState, rejectedDrivers: ['d1'] };
    const result = await dispatchOrder(orderId, baseOrderData, state);
    expect(result).toBe(true);
    expect(mockOrderRepoUpdate).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ 'dispatch.offeredTo': 'd2' })
    );
  });

  test('skips previously notified drivers', async () => {
    const drivers = [
      makeDriver({ id: 'd1' }),
      makeDriver({ id: 'd2', location: { lat: -6.22, lng: 106.82 } }),
    ];
    mockDriverRepoGetOnlineDrivers.mockResolvedValue(drivers);
    const state = { ...baseDispatchState, notifiedDrivers: ['d1'] };
    const result = await dispatchOrder(orderId, baseOrderData, state);
    expect(result).toBe(true);
    expect(mockOrderRepoUpdate).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ 'dispatch.offeredTo': 'd2' })
    );
  });

  test('skips drivers over daily limit', async () => {
    const drivers = [
      makeDriver({ id: 'd1' }),
      makeDriver({ id: 'd2', location: { lat: -6.22, lng: 106.82 } }),
    ];
    mockDriverRepoGetOnlineDrivers.mockResolvedValue(drivers);
    mockIsDriverOverDailyLimit.mockImplementation((d) => d.id === 'd1');
    const result = await dispatchOrder(orderId, baseOrderData, baseDispatchState);
    expect(result).toBe(true);
    expect(mockOrderRepoUpdate).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ 'dispatch.offeredTo': 'd2' })
    );
  });

  test('skips drivers with negative balance', async () => {
    const drivers = [
      makeDriver({ id: 'd1', balance: -500 }),
      makeDriver({ id: 'd2', location: { lat: -6.22, lng: 106.82 } }),
    ];
    mockDriverRepoGetOnlineDrivers.mockResolvedValue(drivers);
    const result = await dispatchOrder(orderId, baseOrderData, baseDispatchState);
    expect(result).toBe(true);
    expect(mockOrderRepoUpdate).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ 'dispatch.offeredTo': 'd2' })
    );
  });

  test('skips drivers with stale location', async () => {
    const drivers = [
      makeDriver({ id: 'd1' }),
      makeDriver({ id: 'd2', location: { lat: -6.22, lng: 106.82 } }),
    ];
    mockDriverRepoGetOnlineDrivers.mockResolvedValue(drivers);
    mockIsDriverLocationFresh.mockImplementation((d) => d.id !== 'd1');
    const result = await dispatchOrder(orderId, baseOrderData, baseDispatchState);
    expect(result).toBe(true);
    expect(mockOrderRepoUpdate).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ 'dispatch.offeredTo': 'd2' })
    );
  });

  test('selects nearest driver with pickup array coordinates', async () => {
    const orderData = { serviceType: 'food', pickup: [-6.2, 106.8] };
    const drivers = [
      makeDriver({ id: 'd1', location: { lat: -6.5, lng: 107.0 } }),
      makeDriver({ id: 'd2', location: { lat: -6.21, lng: 106.81 } }),
    ];
    mockCalculateDistance.mockReturnValueOnce(25).mockReturnValueOnce(1.5);
    mockDriverRepoGetOnlineDrivers.mockResolvedValue(drivers);
    const result = await dispatchOrder(orderId, orderData, baseDispatchState);
    expect(result).toBe(true);
    expect(mockOrderRepoUpdate).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ 'dispatch.offeredTo': 'd2' })
    );
  });

  test('updates Firestore with dispatch fields', async () => {
    const result = await dispatchOrder(orderId, baseOrderData, baseDispatchState);
    expect(result).toBe(true);
    expect(mockOrderRepoUpdate).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({
        'dispatch.offeredTo': 'd1',
        'dispatch.notifiedDrivers': ['d1'],
      })
    );
  });

  test('sets incoming order in RTDB', async () => {
    await dispatchOrder(orderId, baseOrderData, baseDispatchState);
    expect(mockDriverRepoSetIncomingOrder).toHaveBeenCalledWith('d1', orderId);
  });

  test('handles RTDB write failure gracefully', async () => {
    mockDriverRepoSetIncomingOrder.mockRejectedValue(new Error('RTDB timeout'));
    await expect(dispatchOrder(orderId, baseOrderData, baseDispatchState)).resolves.toBe(true);
  });
});

describe('setNoDriverStatus', () => {
  const orderId = 'order123';
  const orderData = {
    customerId: 'cust1',
    customer: { name: 'Budi', wa: '08123456789' },
  };

  test('updates order status to no_driver', async () => {
    await setNoDriverStatus(orderId, orderData);
    expect(mockOrderRepoUpdate).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ status: 'no_driver' })
    );
  });

  test('sends FCM notification to customer', async () => {
    await setNoDriverStatus(orderId, orderData);
    expect(mockNotifySendToUser).toHaveBeenCalledWith(
      'cust1',
      expect.objectContaining({ title: 'Driver Tidak Tersedia' })
    );
  });

  test('sends WA notification to customer', async () => {
    await setNoDriverStatus(orderId, orderData);
    expect(mockNotifySendWA).toHaveBeenCalledWith('08123456789', expect.any(String));
  });

  test('skips FCM when no customerId', async () => {
    await setNoDriverStatus(orderId, { customer: {} });
    expect(mockNotifySendToUser).not.toHaveBeenCalled();
  });

  test('skips WA when no WA number', async () => {
    await setNoDriverStatus(orderId, { customerId: 'cust1', customer: { name: 'Budi' } });
    expect(mockNotifySendWA).not.toHaveBeenCalled();
  });

  test('handles Firestore update failure gracefully', async () => {
    mockOrderRepoUpdate.mockRejectedValue(new Error('Firestore error'));
    await expect(setNoDriverStatus(orderId, orderData)).resolves.toBeUndefined();
  });
});
