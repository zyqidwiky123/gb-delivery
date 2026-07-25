const {
  DISPATCH_CONFIG,
  DRIVER_OFFER_TIMEOUT_MS,
  getDispatchRegionConfig,
} = require('../src/dispatch');

jest.mock('firebase-admin', () => ({
  firestore: () => ({
    collection: () => ({
      get: jest.fn().mockResolvedValue({ forEach: jest.fn() }),
    }),
  }),
  database: () => ({
    ref: () => ({
      once: jest.fn().mockResolvedValue({ forEach: jest.fn() }),
    }),
  }),
  messaging: () => ({
    send: jest.fn().mockResolvedValue({}),
  }),
}));

describe('DISPATCH_CONFIG', () => {
  test('has config for all service types', () => {
    expect(DISPATCH_CONFIG).toHaveProperty('transport');
    expect(DISPATCH_CONFIG).toHaveProperty('food');
    expect(DISPATCH_CONFIG).toHaveProperty('express');
    expect(DISPATCH_CONFIG).toHaveProperty('send');
    expect(DISPATCH_CONFIG).toHaveProperty('shop');
  });

  test('food has smaller radius than transport', () => {
    expect(DISPATCH_CONFIG.food.initRadiusKm).toBeLessThanOrEqual(DISPATCH_CONFIG.transport.initRadiusKm);
    expect(DISPATCH_CONFIG.food.maxRadiusKm).toBeLessThanOrEqual(DISPATCH_CONFIG.transport.maxRadiusKm);
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
