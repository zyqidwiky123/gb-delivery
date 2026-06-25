/**
 * Google Maps Configuration & Helpers
 * Konfigurasi peta dan fungsi-fungsi pendukung untuk ARO DRIVE
 */

// API Key dari environment
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Libraries yang dibutuhkan Google Maps
export const GOOGLE_MAPS_LIBRARIES = ['places'];

// Pusat kota Blitar (Tetap sebagai pusat operasional awal)
export const BLITAR_CENTER = { lat: -8.0983, lng: 112.1681 };

// Batas area operasional Jawa Timur
export const JATIM_BOUNDS = {
  north: -6.7,
  south: -8.8,
  east: 114.6,
  west: 111.0,
};

// Restriction untuk peta (agar tidak keluar area Jatim)
export const JATIM_RESTRICTION = {
  latLngBounds: JATIM_BOUNDS,
  strictBounds: false,
};

// Default zoom
export const DEFAULT_ZOOM = 15;
export const MIN_ZOOM = 12;

// Icon URLs (tetap pakai icon custom neon)
export const MARKER_ICONS = {
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
    url: "data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 38C20 38 34 26.5 34 16.5C34 8.5 27.5 3 20 3C12.5 3 6 8.5 6 16.5C6 26.5 20 38 20 38Z' fill='%230A0A0A' fill-opacity='0.95' stroke='%23cafd00' stroke-width='2' stroke-linejoin='round'/%3E%3Ccircle cx='20' cy='16.5' r='10' fill='%23cafd00' fill-opacity='0.1' stroke='%23cafd00' stroke-width='1' stroke-dasharray='2,2'/%3E%3Cg transform='translate(10, 6.5) scale(0.8)'%3E%3Ccircle cx='6' cy='18' r='3' stroke='%23cafd00' stroke-width='2'/%3E%3Ccircle cx='18' cy='18' r='3' stroke='%23cafd00' stroke-width='2'/%3E%3Cpath d='M6 15h12' stroke='%23cafd00' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M12 18v-6H7' stroke='%23cafd00' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='m15 6 3 3v3H9' stroke='%23cafd00' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3C/svg%3E",
    scaledSize: { width: 40, height: 40 },
    anchor: { x: 20, y: 38 },
  },
  user: {
    url: "data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='16' cy='16' r='14' fill='%234285F4' fill-opacity='0.2'/%3E%3Ccircle cx='16' cy='16' r='8' fill='white'/%3E%3Ccircle cx='16' cy='16' r='6' fill='%234285F4'/%3E%3C/svg%3E",
    scaledSize: { width: 32, height: 32 },
    anchor: { x: 16, y: 16 },
  }
};

/**
 * Buat icon object untuk Google Maps MarkerF
 * @param {'pickup'|'dropoff'|'driver'} type 
 * @returns {google.maps.Icon}
 */
export const createMarkerIcon = (type) => {
  const config = MARKER_ICONS[type];
  if (!config || !window.google) return undefined;
  return {
    url: config.url,
    scaledSize: new window.google.maps.Size(config.scaledSize.width, config.scaledSize.height),
    anchor: new window.google.maps.Point(config.anchor.x, config.anchor.y),
  };
};

/**
 * Hitung jarak antara dua titik (dalam kilometer)
 * Menggunakan rumus Haversine
 * @param {{lat: number, lng: number}} p1 
 * @param {{lat: number, lng: number}} p2 
 * @returns {number} jarak dalam km
 */
export const calculateDistance = (p1, p2) => {
  if (!p1 || !p2) return 0;
  const R = 6371; // Radius bumi dalam km
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg) => deg * (Math.PI / 180);

/**
 * Cek apakah koordinat berada di dalam area operasional Jawa Timur
 * @param {{lat: number, lng: number}} coords 
 * @returns {boolean}
 */
export const isInsideBounds = (coords) => {
  if (!coords) return false;
  return (
    coords.lat >= JATIM_BOUNDS.south &&
    coords.lat <= JATIM_BOUNDS.north &&
    coords.lng >= JATIM_BOUNDS.west &&
    coords.lng <= JATIM_BOUNDS.east
  );
};

/**
 * Google Maps Dark Mode Style
 * Tema gelap premium sesuai estetika ARO DRIVE (#0A0A0A)
 */
export const darkMapStyles = [
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
    stylers: [{ color: '#cafd00' }],  // Neon primary color for major roads
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

/**
 * Google Maps Light Mode Style (Standard)
 */
export const lightMapStyles = []; // Default Google Maps look for Light Mode

/**
 * Mendapatkan opsi peta berdasarkan tema
 * @param {'light'|'dark'} theme 
 * @returns {google.maps.MapOptions}
 */
export const getMapOptions = (theme) => ({
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: theme === 'dark' ? darkMapStyles : lightMapStyles,
  restriction: JATIM_RESTRICTION,
  minZoom: MIN_ZOOM,
  gestureHandling: 'greedy',
  clickableIcons: false,
});

/**
 * Opsi default untuk GoogleMap component (Legacy support)
 */
export const defaultMapOptions = getMapOptions('dark');

/**
 * Opsi untuk Autocomplete (batasi wilayah Indonesia / Jawa Timur)
 */
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
