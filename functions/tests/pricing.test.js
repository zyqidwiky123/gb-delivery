const { calculatePickupFee } = require('../src/pricing');

jest.mock('firebase-admin', () => ({
  firestore: () => ({
    collection: () => ({
      doc: () => ({
        get: jest.fn().mockResolvedValue({ exists: false }),
      }),
    }),
  }),
}));

describe('calculatePickupFee', () => {
  const basePricing = {
    pickupSurcharge: {
      freePickupRadius: 3,
      ratePerKm: 2000,
      maxFee: 15000,
    },
  };

  test('zero fee when within free radius', () => {
    const result = calculatePickupFee(
      { lat: -6.2, lng: 106.8 },
      { lat: -6.21, lng: 106.81 },
      basePricing
    );
    expect(result.fee).toBe(0);
    expect(result.distance).toBeGreaterThan(0);
    expect(result.distance).toBeLessThanOrEqual(3);
  });

  test('calculates fee for distance beyond free radius', () => {
    const result = calculatePickupFee(
      { lat: -6.2, lng: 106.8 },
      { lat: -6.3, lng: 106.9 },
      basePricing
    );
    expect(result.fee).toBeGreaterThan(0);
    expect(result.distance).toBeGreaterThan(3);
  });

  test('caps fee at maxFee', () => {
    const farDriver = { lat: -6.0, lng: 106.5 };
    const farPickup = { lat: -7.0, lng: 107.5 };
    const result = calculatePickupFee(farDriver, farPickup, {
      pickupSurcharge: {
        freePickupRadius: 1,
        ratePerKm: 50000,
        maxFee: 15000,
      },
    });
    expect(result.fee).toBeLessThanOrEqual(15000);
  });

  test('returns zero fee for invalid coordinates', () => {
    const result = calculatePickupFee(null, { lat: -6.2, lng: 106.8 }, basePricing);
    expect(result.fee).toBe(0);
    expect(result.distance).toBe(0);
  });

  test('works without pricing argument (defaults)', () => {
    const result = calculatePickupFee(
      { lat: -6.2, lng: 106.8 },
      { lat: -6.5, lng: 107.0 },
      undefined
    );
    expect(result.fee).toBeGreaterThanOrEqual(0);
    expect(result.distance).toBeGreaterThan(0);
  });
});
