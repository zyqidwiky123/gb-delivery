import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, DirectionsRenderer } from '@react-google-maps/api';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  BLITAR_CENTER,
  createMarkerIcon,
  defaultMapOptions,
  DEFAULT_ZOOM,
} from '../utils/mapConfig';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useDriverStore } from '../store/useDriverStore';

const containerStyle = { width: '100%', height: '100%', borderRadius: '1rem' };

// Helpers
const toLatLng = (arr) => {
  if (!arr) return null;
  if (Array.isArray(arr)) return { lat: arr[0], lng: arr[1] };
  return arr;
};

const dist = (p1, p2) => {
  if (!p1 || !p2) return 999;
  return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2)) * 111320;
};

function MapComponent({ activeJob }) {
  const { user } = useDriverStore();
  const [driverLocation, setDriverLocation] = useState(BLITAR_CENTER);
  const [directions, setDirections] = useState(null);
  const [mapError, setMapError] = useState('');
  const mapRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Track Driver Location
  useEffect(() => {
    if (!navigator.geolocation) {
      setMapError("Geolocation is not supported by your browser");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const newLoc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setDriverLocation(newLoc);

        // Optional: Update to firestore so user app can see live map!
        if (user?.uid && activeJob?.id) {
            try {
               await updateDoc(doc(db, "orders", activeJob.id), {
                 driverLocation: newLoc
               });
            } catch(e) { console.error("Failed to sync driver location to order", e) }
        }
      },
      () => {
        setMapError("Unable to retrieve your location");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user?.uid, activeJob?.id]);

  // Handle Routing Logic
  useEffect(() => {
    if (!isLoaded || !activeJob || !window.google) {
      setDirections(null);
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();

    let destination = null;
    let origin = driverLocation;

    const pickupPos = toLatLng(activeJob.pickup);
    const dropoffPos = toLatLng(activeJob.dropoff);

    // Dynamic routing: switch destination based on job status
    if (activeJob.status === 'accepted') {
        if (activeJob.pickups && activeJob.pickups.length > 0) {
            // STEP-BY-STEP: Arahkan ke titik pickup yang belum selesai (pickupsDone)
            const points = activeJob.pickups.map(p => toLatLng(p)).filter(Boolean);
            const currentPickupIndex = activeJob.pickupsDone || 0;
            destination = points[Math.min(currentPickupIndex, points.length - 1)];
        } else {
            // Single pickup
            destination = pickupPos || dropoffPos;
        }
    } else if (activeJob.status === 'picked_up') {
        destination = dropoffPos;
    }

    const lastLoc = mapRef.current?.lastRouteOrigin;
    const lastDest = mapRef.current?.lastRouteDest;

    const shouldUpdate = !directions || 
                       dist(lastLoc, origin) > 30 || 
                       dist(lastDest, destination) > 5;

    if (origin && destination && shouldUpdate) {
      // Tidak lagi pakai waypoints, karena rute dibuat 1-by-1
      directionsService.route(
        {
          origin: origin,
          destination: destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            setDirections(result);
            if (mapRef.current) {
                mapRef.current.lastRouteOrigin = origin;
                mapRef.current.lastRouteDest = destination;
            }
          } else {
            console.error(`Error fetching directions: ${status}`);
          }
        }
      );
    }
  }, [isLoaded, activeJob?.status, activeJob?.pickupsDone, driverLocation, activeJob?.pickup, activeJob?.dropoff, directions === null]);

  const openGoogleMapsApp = () => {
      if (!activeJob) return;

      const originPos = driverLocation;
      if (!originPos) {
          setMapError("Lokasi driver belum tersedia.");
          return;
      }
      
      const origin = `${originPos.lat},${originPos.lng}`;
      let destination = "";

      // Logic: Route 1-by-1
      if (activeJob.status === 'accepted') {
          if (activeJob.pickups && activeJob.pickups.length > 0) {
              const points = activeJob.pickups.map(p => toLatLng(p)).filter(Boolean);
              if (points.length === 0) return;
              
              const currentPickupIndex = activeJob.pickupsDone || 0;
              const targetPickup = points[Math.min(currentPickupIndex, points.length - 1)];
              
              destination = `${targetPickup.lat},${targetPickup.lng}`;
          } else {
              // Single pickup
              const pickupPos = toLatLng(activeJob.pickup);
              if (!pickupPos) return;
              destination = `${pickupPos.lat},${pickupPos.lng}`;
          }
      } else if (activeJob.status === 'picked_up') {
          // Going to dropoff
          const dropoffPos = toLatLng(activeJob.dropoff);
          if (!dropoffPos) return;
          destination = `${dropoffPos.lat},${dropoffPos.lng}`;
      } else {
          const dropoffPos = toLatLng(activeJob.dropoff);
          if (!dropoffPos) return;
          destination = `${dropoffPos.lat},${dropoffPos.lng}`;
      }

      const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      window.open(url, '_blank');
  };

  // Ref for previous routed coordinate to check threshold
  const lastPanPos = useRef(null);

  // Smooth follow driver location
  useEffect(() => {
    if (!mapRef.current || !driverLocation) return;
    
    const d = dist(lastPanPos.current, driverLocation);
    // Only pan if driver moved > 15m to avoid GPS jitter
    if (!lastPanPos.current || d > 15) {
      mapRef.current.panTo(driverLocation);
      lastPanPos.current = driverLocation;
    }
  }, [driverLocation]);

  if (!isLoaded) return <div className="w-full h-full bg-surface-container-highest animate-pulse rounded-2xl flex items-center justify-center text-on-surface-variant font-bold text-xs uppercase tracking-widest">Loading Map...</div>;

  return (
    <div className="relative w-full h-[300px] md:h-[400px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      <GoogleMap
        mapContainerStyle={containerStyle}
        defaultCenter={driverLocation} 
        zoom={DEFAULT_ZOOM}
        options={defaultMapOptions}
        onLoad={(map) => (mapRef.current = map)}
      >
        <MarkerF position={driverLocation} icon={createMarkerIcon('user')} />
        {!directions && <MarkerF position={driverLocation} icon={createMarkerIcon('driver')} />}
        
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              preserveViewport: true,
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#cafd00',
                strokeWeight: 5,
                strokeOpacity: 0.8,
              },
            }}
          />
        )}

        {/* Custom endpoints if routed */}
        {directions && activeJob && (
           <>
             <MarkerF position={driverLocation} icon={createMarkerIcon('driver')} />
              {activeJob.status === 'accepted' && (
                <>
                  {activeJob.pickups && activeJob.pickups.length > 0 ? (
                     activeJob.pickups.map((p, idx) => (
                       <MarkerF 
                         key={`pickup-${idx}`} 
                         position={toLatLng(p)} 
                         icon={createMarkerIcon('pickup')} 
                         label={{ text: (idx + 1).toString(), color: 'black', fontWeight: 'bold', fontSize: '10px' }}
                       />
                     ))
                  ) : (
                     <MarkerF position={toLatLng(activeJob?.pickup)} icon={createMarkerIcon('pickup')} />
                  )}
                </>
              )}
              {/* Always show dropoff marker if active */}
              <MarkerF position={toLatLng(activeJob?.dropoff)} icon={createMarkerIcon('dropoff')} />
            </>
         )}
      </GoogleMap>

      {/* Locate Me FAB */}
      <button 
        className="absolute bottom-4 right-4 bg-[#1a1a1a]/80 backdrop-blur-md p-3 rounded-full border border-white/10 text-primary shadow-lg hover:bg-surface-container-highest transition-colors active:scale-95"
        onClick={() => {
           if (mapRef.current && driverLocation) {
             mapRef.current.panTo(driverLocation);
             mapRef.current.setZoom(DEFAULT_ZOOM);
           }
        }}
      >
         <span className="material-symbols-outlined">my_location</span>
      </button>

      {/* External Map Nav Button */}
      {activeJob && (
          <button 
             onClick={openGoogleMapsApp}
             className="absolute top-4 right-4 bg-primary text-black font-bold text-xs px-4 py-2 rounded-full shadow-lg border border-primary/20 active:scale-95 transition-transform flex items-center gap-2"
          >
             <span className="material-symbols-outlined text-sm">navigation</span>
             NAVIGASI MAPS
          </button>
      )}

      {mapError && (
          <div className="absolute top-4 left-4 bg-error/90 text-white text-[10px] px-3 py-1 rounded-full font-bold">
            {mapError}
          </div>
      )}
    </div>
  );
}

export default React.memo(MapComponent);
