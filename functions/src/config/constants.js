const RADIUS_EXPANSION_INTERVAL_MS = 60 * 1000;
const DRIVER_OFFER_TIMEOUT_MS = 60 * 1000;

const DISPATCH_CONFIG = {
  transport: { initRadiusKm: 3, maxRadiusKm: 15, offerTimeoutMs: 60000 },
  food: { initRadiusKm: 2, maxRadiusKm: 8, offerTimeoutMs: 45000 },
  express: { initRadiusKm: 4, maxRadiusKm: 20, offerTimeoutMs: 60000 },
  send: { initRadiusKm: 3, maxRadiusKm: 15, offerTimeoutMs: 60000 },
  shop: { initRadiusKm: 2, maxRadiusKm: 8, offerTimeoutMs: 60000 },
};

const DISPATCH_REGION_CONFIG = {
  kota: {
    initialRadius: 3,
    radiusIncrement: 2,
    maxRadius: 10,
    maxSearchMinutes: 5,
  },
  kabupaten: {
    initialRadius: 4,
    radiusIncrement: 3,
    maxRadius: 20,
    maxSearchMinutes: 7,
  },
};

module.exports = {
  RADIUS_EXPANSION_INTERVAL_MS,
  DRIVER_OFFER_TIMEOUT_MS,
  DISPATCH_CONFIG,
  DISPATCH_REGION_CONFIG,
};
