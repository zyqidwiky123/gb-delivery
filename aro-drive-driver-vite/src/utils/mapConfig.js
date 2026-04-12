export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export const GOOGLE_MAPS_LIBRARIES = ['places'];

export const BLITAR_CENTER = { lat: -8.0983, lng: 112.1681 };

export const BLITAR_BOUNDS = {
  north: -7.95,
  south: -8.35,
  east: 112.45,
  west: 111.95,
};

export const BLITAR_RESTRICTION = {
  latLngBounds: BLITAR_BOUNDS,
  strictBounds: false,
};

export const DEFAULT_ZOOM = 15;
export const MIN_ZOOM = 12;

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
  user: {
    url: "data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='16' cy='16' r='14' fill='%234285F4' fill-opacity='0.2'/%3E%3Ccircle cx='16' cy='16' r='8' fill='white'/%3E%3Ccircle cx='16' cy='16' r='6' fill='%234285F4'/%3E%3C/svg%3E",
    scaledSize: { width: 32, height: 32 },
    anchor: { x: 16, y: 16 },
  }
};

export const createMarkerIcon = (type) => {
  const config = MARKER_ICONS[type];
  if (!config || !window.google) return undefined;
  return {
    url: config.url,
    scaledSize: new window.google.maps.Size(config.scaledSize.width, config.scaledSize.height),
    anchor: new window.google.maps.Point(config.anchor.x, config.anchor.y),
  };
};

export const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#0d0d0d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d0d0d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a4a4a' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#6a6a6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#4a4a4a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#111111' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3a3a3a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#131313' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#222222' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#cafd00' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#111111' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#4a4a4a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#080808' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

export const defaultMapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: darkMapStyles,
  restriction: BLITAR_RESTRICTION,
  minZoom: MIN_ZOOM,
  gestureHandling: 'greedy',
  clickableIcons: false,
};
