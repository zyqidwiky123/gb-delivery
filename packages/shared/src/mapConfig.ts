export const GOOGLE_MAPS_API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

export const GOOGLE_MAPS_LIBRARIES: ['places'] = ['places'];

export const BLITAR_CENTER: { lat: number; lng: number } = { lat: -8.0983, lng: 112.1681 };

export const JATIM_BOUNDS = {
  north: -6.7,
  south: -8.8,
  east: 114.6,
  west: 111.0,
};

export const JATIM_RESTRICTION = {
  latLngBounds: JATIM_BOUNDS,
  strictBounds: false,
};

export const DEFAULT_ZOOM = 15;
export const MIN_ZOOM = 12;

interface MarkerIconConfig {
  url: string;
  scaledSize: { width: number; height: number };
  anchor: { x: number; y: number };
}

export const MARKER_ICONS: Record<string, MarkerIconConfig> = {
  pickup: {
    url: 'https://cdn0.iconfinder.com/data/icons/small-n-flat/24/678111-map-marker-512.png',
    scaledSize: { width: 32, height: 32 },
    anchor: { x: 16, y: 32 },
  },
  dropoff: {
    url: 'https://cdn4.iconfinder.com/data/icons/generic-interaction/160/location-marker-destination-512.png',
    scaledSize: { width: 32, height: 32 },
    anchor: { x: 16, y: 32 },
  },
  driver: {
    url: 'https://cdn1.iconfinder.com/data/icons/transport-set-1-3/100/Untitled-1-24-512.png',
    scaledSize: { width: 40, height: 40 },
    anchor: { x: 20, y: 20 },
  },
  driver_motor: {
    url: "data:image/svg+xml,...",
    scaledSize: { width: 40, height: 40 },
    anchor: { x: 20, y: 38 },
  },
  user: {
    url: "data:image/svg+xml,...",
    scaledSize: { width: 32, height: 32 },
    anchor: { x: 16, y: 16 },
  },
};

export interface MarkerIconDescriptor {
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

/**
 * FASE 2: versi netral — tidak lagi butuh window.google.
 * Untuk peta Leaflet/OSM pakai createLeafletIcon() dari './mapProvider'.
 * (Implementasi Google lama disimpan di git history untuk rollback.)
 */
export const createMarkerIcon = (type: string): MarkerIconDescriptor | undefined => {
  const config = MARKER_ICONS[type];
  if (!config) return undefined;
  return {
    url: config.url,
    width: config.scaledSize.width,
    height: config.scaledSize.height,
    anchorX: config.anchor.x,
    anchorY: config.anchor.y,
  };
};

export const calculateDistance = (p1: { lat: number; lng: number } | null, p2: { lat: number; lng: number } | null): number => {
  if (!p1 || !p2) return 0;
  const R = 6371;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg: number): number => deg * (Math.PI / 180);

export const isInsideBounds = (coords: { lat: number; lng: number } | null): boolean => {
  if (!coords) return false;
  return (
    coords.lat >= JATIM_BOUNDS.south &&
    coords.lat <= JATIM_BOUNDS.north &&
    coords.lng >= JATIM_BOUNDS.west &&
    coords.lng <= JATIM_BOUNDS.east
  );
};

export const darkMapStyles: Record<string, unknown>[] = [
  { elementType: 'geometry', stylers: [{ color: '#0d0d0d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d0d0d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a4a4a' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6a6a6a' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a4a4a' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#111111' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3a3a3a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1a1a1a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#131313' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#555555' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#222222' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1a1a' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cafd00' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#111111' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a4a4a' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#080808' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#2a2a2a' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
];

export const lightMapStyles: Record<string, unknown>[] = [];

export const getMapOptions = (theme: string) => ({
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: theme === 'dark' ? darkMapStyles : lightMapStyles,
  restriction: JATIM_RESTRICTION,
  minZoom: MIN_ZOOM,
  gestureHandling: 'greedy' as const,
  clickableIcons: false,
});

export const defaultMapOptions = getMapOptions('dark');

export const autocompleteOptions = {
  componentRestrictions: { country: 'id' },
  fields: ['formatted_address', 'geometry', 'name'],
  bounds: {
    north: JATIM_BOUNDS.north,
    south: JATIM_BOUNDS.south,
    east: JATIM_BOUNDS.east,
    west: JATIM_BOUNDS.west,
  },
};
