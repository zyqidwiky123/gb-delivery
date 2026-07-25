export const haversine = (p1, p2) => {
  if (!p1 || !p2) return 0;
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat * Math.PI/180) * Math.cos(p2.lat * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

export const safeNum = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

export const calculateFee = (distance, type = 'jek', weight = 0) => {
  const pricing = {
    jek: { baseFare: 10000, ratePerKm: 2500, minDistance: 3.5, commission: 10 },
    car: { baseFare: 20000, ratePerKm: 5000, minDistance: 2, commission: 10 },
    food: { baseFare: 5000, ratePerKm: 2000, minDistance: 0, commission: 10 },
    send: { baseFare: 8000, ratePerKm: 2000, weightFareRate: 2000, minDistance: 0, commission: 10 },
    shop: { baseFare: 0, ratePerKm: 3000, serviceFee: 0, commission: 10 },
  };

  const cfg = pricing[type] || pricing.jek;
  const billableKm = Math.max(0, distance - cfg.minDistance);
  let total = cfg.baseFare + (billableKm * cfg.ratePerKm);

  if (type === 'send' && weight > 1) {
    const weightBlocks = Math.ceil((weight - 1) / 2);
    total += weightBlocks * (cfg.weightFareRate || 2000);
  }

  if (type === 'shop') {
    total += cfg.serviceFee || 0;
  }

  return Math.round(total);
};
