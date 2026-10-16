jest.mock('firebase-admin', () => {
  const mockDoc = { get: jest.fn() };
  const mockCol = { doc: jest.fn(() => mockDoc) };
  const firestoreFn = jest.fn(() => ({ collection: jest.fn(() => mockCol) }));
  return {
    firestore: firestoreFn,
    database: jest.fn(),
    messaging: jest.fn(),
    initializeApp: jest.fn(),
    credential: { applicationDefault: jest.fn() },
  };
});

const PricingService = require('../../src/services/pricingService');

describe('PricingService', () => {
  let service;

  beforeEach(() => {
    service = new PricingService();
  });

  describe('calculatePickupFee', () => {
    const basePricing = {
      pickupSurcharge: { freePickupRadius: 3, ratePerKm: 2000, maxFee: 15000 },
    };

    test('zero fee when within free radius', () => {
      const result = service.calculatePickupFee(
        { lat: -6.2, lng: 106.8 },
        { lat: -6.21, lng: 106.81 },
        basePricing
      );
      expect(result.fee).toBe(0);
      expect(result.distance).toBeGreaterThan(0);
      expect(result.distance).toBeLessThanOrEqual(3);
    });

    test('calculates fee for distance beyond free radius', () => {
      const result = service.calculatePickupFee(
        { lat: -6.2, lng: 106.8 },
        { lat: -6.3, lng: 106.9 },
        basePricing
      );
      expect(result.fee).toBeGreaterThan(0);
      expect(result.distance).toBeGreaterThan(3);
    });

    test('caps fee at maxFee', () => {
      const result = service.calculatePickupFee(
        { lat: -6.0, lng: 106.5 },
        { lat: -7.0, lng: 107.5 },
        { pickupSurcharge: { freePickupRadius: 1, ratePerKm: 50000, maxFee: 15000 } }
      );
      expect(result.fee).toBeLessThanOrEqual(15000);
    });

    test('zero fee for invalid coordinates', () => {
      const result = service.calculatePickupFee(null, { lat: -6.2, lng: 106.8 }, basePricing);
      expect(result.fee).toBe(0);
      expect(result.distance).toBe(0);
    });
  });

  describe('calculateFinalFee', () => {
    test('calculates fee minus commission', () => {
      const result = service.calculateFinalFee({ total: 50000, commissionRate: 0.1 });
      expect(result).toEqual({ fee: 45000, commission: 5000 });
    });

    test('uses default commission rate', () => {
      const result = service.calculateFinalFee({ total: 100000 });
      expect(result).toEqual({ fee: 90000, commission: 10000 });
    });

    test('handles zero total', () => {
      const result = service.calculateFinalFee({ total: 0 });
      expect(result).toEqual({ fee: 0, commission: 0 });
    });
  });
});
