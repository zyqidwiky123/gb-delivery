export const haversine = (p1, p2) => {
  if (!p1 || !p2) return 0;
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat * Math.PI/180) * Math.cos(p2.lat * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

export const safeNum = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

export const deepClean = (obj) => {
  if (obj === null || obj === undefined) return undefined;
  if (typeof obj === 'number' && !isFinite(obj)) return 0;
  if (typeof obj === 'object' && obj.constructor?.name === 'FieldValue') return obj;
  if (Array.isArray(obj)) return obj.map(deepClean).filter(v => v !== undefined);
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [k, v] of Object.entries(obj)) {
      const val = deepClean(v);
      if (val !== undefined) cleaned[k] = val;
    }
    return cleaned;
  }
  return obj;
};
