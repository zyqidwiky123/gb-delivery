import { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { createLeafletIcon, OSM_TILES, OSM_ATTRIBUTION } from '@aro/shared/mapProvider';
import { BLITAR_CENTER, DEFAULT_ZOOM, MIN_ZOOM } from '@aro/shared/mapConfig';

/**
 * FASE 2 — OrderMap versi OSM (Leaflet).
 * Props IDENTIK kecuali: `directions` (Google) -> `route` {coords,distanceMeters,durationSeconds},
 * `isLoaded` tidak lagi dipakai (Leaflet sinkron, tanpa API key).
 */
function FollowDriver({ driverPos, userInteracted, mapHolder, onReady }) {
  const map = useMap();
  const lastPan = useRef(null);

  useEffect(() => {
    if (mapHolder) mapHolder.current = map;
    if (onReady) onReady(map);
  }, [map]);

  // Auto-follow dengan threshold 15m agar tidak jitter (sama seperti versi Google)
  useEffect(() => {
    if (!map || !driverPos || userInteracted?.current) return;
    const prev = lastPan.current;
    const d = prev
      ? Math.sqrt(Math.pow(driverPos.lat - prev.lat, 2) + Math.pow(driverPos.lng - prev.lng, 2)) *
        111320
      : 999;
    if (d > 15) {
      map.panTo([driverPos.lat, driverPos.lng]);
      lastPan.current = driverPos;
    }
  }, [map, driverPos]);

  return null;
}

export default function OrderMap({
  driverPos,
  pickupPos,
  dropoffPos,
  route,
  mapRef,
  userInteracted,
  currentLocation,
  orderStatus,
}) {
  const [map, setMap] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const center = useMemo(() => {
    return driverPos || pickupPos || dropoffPos || currentLocation || BLITAR_CENTER;
  }, [driverPos, pickupPos, dropoffPos, currentLocation]);

  const handleDragStart = () => {
    if (userInteracted) userInteracted.current = true;
    setHasInteracted(true);
  };

  const handleRecenter = () => {
    if (userInteracted) userInteracted.current = false;
    setHasInteracted(false);
    if (driverPos && map) map.panTo([driverPos.lat, driverPos.lng]);
  };

  const routePositions = useMemo(() => {
    if (!route?.coords || route.coords.length < 2) return null;
    return route.coords.map((p) => [p.lat, p.lng]);
  }, [route]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM}
        zoomControl={false}
        style={{ width: '100%', height: '100%', background: '#0d0d0d' }}
      >
        <TileLayer url={OSM_TILES.dark} attribution={OSM_ATTRIBUTION} />
        <FollowDriver
          driverPos={driverPos}
          userInteracted={userInteracted}
          mapHolder={mapRef}
          onReady={setMap}
        />
        <MapDragWatcher onDragStart={handleDragStart} />

        {currentLocation && (
          <Marker
            position={[currentLocation.lat, currentLocation.lng]}
            icon={createLeafletIcon('user')}
          />
        )}

        {driverPos && (
          <Marker
            position={[driverPos.lat, driverPos.lng]}
            icon={createLeafletIcon(
              orderStatus === 'accepted' || orderStatus === 'picked_up' ? 'driver_motor' : 'driver'
            )}
            zIndexOffset={100}
          />
        )}

        {pickupPos && orderStatus === 'accepted' && (
          <Marker position={[pickupPos.lat, pickupPos.lng]} icon={createLeafletIcon('pickup')} />
        )}

        {dropoffPos && (
          <Marker position={[dropoffPos.lat, dropoffPos.lng]} icon={createLeafletIcon('dropoff')} />
        )}

        {routePositions && (
          <Polyline
            positions={routePositions}
            pathOptions={{ color: '#cafd00', weight: 5, opacity: 0.8 }}
          />
        )}
      </MapContainer>

      {hasInteracted && (
        <div className="fixed bottom-[40%] right-6 z-[1000]">
          <button
            onClick={handleRecenter}
            className="bg-primary text-black px-4 py-2 rounded-full text-[10px] font-black tracking-widest shadow-2xl animate-bounce"
          >
            RECENTER DRIVER
          </button>
        </div>
      )}
    </div>
  );
}

function MapDragWatcher({ onDragStart }) {
  useMapEvents({ dragstart: onDragStart });
  return null;
}
