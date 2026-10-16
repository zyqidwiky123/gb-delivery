interface LatLng {
  lat: number;
  lng: number;
}

export const haversine = (p1: LatLng | null, p2: LatLng | null): number => {
  if (!p1 || !p2) return 0;
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat * Math.PI/180) * Math.cos(p2.lat * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

export const safeNum = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);

type FieldValue = { isEqual: (other: unknown) => boolean };

export const deepClean = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return undefined;
  if (typeof obj === 'number' && !isFinite(obj)) return 0;
  if (typeof obj === 'object' && (obj as FieldValue).isEqual !== undefined) return obj;
  if (Array.isArray(obj)) return obj.map(deepClean).filter(v => v !== undefined);
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const val = deepClean(v);
      if (val !== undefined) cleaned[k] = val;
    }
    return cleaned;
  }
  return obj;
};
