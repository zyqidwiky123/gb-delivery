const admin = require('firebase-admin');

const mockPricingServiceGetPricing = jest.fn();
const mockPricingServiceCalcFee = jest.fn();

jest.mock('firebase-admin', () => {
  const mockDoc = { get: jest.fn(), update: jest.fn(), set: jest.fn() };
  const mockCol = { doc: jest.fn(() => mockDoc), get: jest.fn(), add: jest.fn() };
  const mockRef = {
    once: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    child: jest.fn(() => ({ set: jest.fn() })),
  };
  const firestoreFn = jest.fn(() => ({ collection: jest.fn(() => mockCol) }));
  firestoreFn.FieldValue = {
    increment: jest.fn((n) => n),
    serverTimestamp: jest.fn(() => new Date()),
    delete: jest.fn(() => '__delete__'),
  };
  firestoreFn.Timestamp = { fromDate: jest.fn(), now: jest.fn() };
  return {
    firestore: firestoreFn,
    database: jest.fn(() => ({ ref: jest.fn(() => mockRef) })),
    messaging: jest.fn(() => ({ send: jest.fn() })),
    initializeApp: jest.fn(),
    credential: { applicationDefault: jest.fn() },
    __mockDoc: mockDoc,
  };
});

jest.mock('../../src/services/pricingService', () => {
  return jest.fn().mockImplementation(() => ({
    getPricing: (...args) => mockPricingServiceGetPricing(...args),
    calculatePickupFee: (...args) => mockPricingServiceCalcFee(...args),
  }));
});

const surchargeHandler = require('../../src/handlers/surchargeHandler');

function makeEvent(overrides = {}) {
  return {
    newValue: {
      status: 'accepted',
      serviceType: 'food',
      driverId: 'driver1',
      pickupLocation: { lat: -6.2, lng: 106.8 },
      total: 50000,
      ...overrides.newValue,
    },
    previousValue: {
      status: 'searching',
      ...overrides.previousValue,
    },
    orderId: overrides.orderId || 'order123',
  };
}

const getDoc = () => admin.__mockDoc;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('surchargeHandler', () => {
  test('returns early when status is not accepted', async () => {
    const event = makeEvent({ newValue: { status: 'completed' } });
    await surchargeHandler(event);
    expect(mockPricingServiceGetPricing).not.toHaveBeenCalled();
    expect(getDoc().update).not.toHaveBeenCalled();
  });

  test('returns early when previous status was already accepted', async () => {
    const event = makeEvent({ previousValue: { status: 'accepted' } });
    await surchargeHandler(event);
    expect(mockPricingServiceGetPricing).not.toHaveBeenCalled();
  });

  test('calculates and applies surcharge for accepted order', async () => {
    mockPricingServiceGetPricing.mockResolvedValue({
      pickupSurcharge: { freePickupRadius: 3, ratePerKm: 2000, maxFee: 15000 },
    });
    mockPricingServiceCalcFee.mockReturnValue({ fee: 5000, distance: 5 });

    const admin = require('firebase-admin');
    const rtdbRef = admin.database().ref(`drivers/driver1/location`);
    rtdbRef.once.mockResolvedValue({ val: () => ({ lat: -6.19, lng: 106.79 }) });

    await surchargeHandler(makeEvent());
    expect(getDoc().update).toHaveBeenCalledWith(
      expect.objectContaining({ pickupFee: 5000, pickupDistance: 5 })
    );
  });

  test('adds surcharge to existing total', async () => {
    mockPricingServiceGetPricing.mockResolvedValue({
      pickupSurcharge: { freePickupRadius: 3, ratePerKm: 2000, maxFee: 15000 },
    });
    mockPricingServiceCalcFee.mockReturnValue({ fee: 5000, distance: 5 });

    const admin = require('firebase-admin');
    admin
      .database()
      .ref()
      .once.mockResolvedValue({ val: () => ({ lat: -6.19, lng: 106.79 }) });

    await surchargeHandler(makeEvent({ newValue: { total: 30000 } }));
    expect(getDoc().update).toHaveBeenCalledWith(
      expect.objectContaining({ pickupFee: 5000, total: 35000 })
    );
  });

  test('handles missing driverId gracefully (getPricing is called first)', async () => {
    mockPricingServiceGetPricing.mockResolvedValue({
      pickupSurcharge: { freePickupRadius: 3, ratePerKm: 2000, maxFee: 15000 },
    });
    const event = makeEvent({ newValue: { driverId: undefined } });
    await surchargeHandler(event);
    expect(mockPricingServiceGetPricing).toHaveBeenCalled();
    expect(getDoc().update).not.toHaveBeenCalled();
  });
});
