import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES, BLITAR_CENTER, DEFAULT_ZOOM, getMapOptions, isInsideBounds } from '../utils/mapConfig';

const containerStyle = { width: '100%', height: '100%' };

const LocationPickerModal = ({ isOpen, onClose, onConfirm, initialLocation = null, mode = 'pickup' }) => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const sessionTokenRef = useRef(null);

  const [center, setCenter] = useState(initialLocation || BLITAR_CENTER);
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const mapOptions = useMemo(() => getMapOptions('dark'), []);

  useEffect(() => {
    if (isOpen) {
      setCenter(initialLocation || BLITAR_CENTER);
      setAddress(initialLocation?.address || '');
      setSearchQuery('');
      setPredictions([]);
    }
  }, [isOpen, initialLocation]);

  useEffect(() => {
    if (isLoaded && window.google) {
      geocoderRef.current = new window.google.maps.Geocoder();
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    }
  }, [isLoaded]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    if (center) map.panTo(center);
  }, [center]);

  const onDragStart = () => setIsDragging(true);

  const onIdle = () => {
    setIsDragging(false);
    if (!mapRef.current || !geocoderRef.current) return;
    const c = mapRef.current.getCenter();
    if (!c) return;
    const latlng = { lat: c.lat(), lng: c.lng() };
    setIsGeocoding(true);
    geocoderRef.current.geocode({ location: latlng }, (results, status) => {
      setIsGeocoding(false);
      if (status === 'OK' && results[0]) {
        setAddress(results[0].formatted_address.split(',')[0]);
      } else {
        setAddress('Titik di peta');
      }
    });
  };

  // Search predictions
  useEffect(() => {
    if (!searchQuery || !autocompleteServiceRef.current) {
      setPredictions([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      if (!sessionTokenRef.current && window.google) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
      const bounds = new window.google.maps.LatLngBounds(
        { lat: -8.35, lng: 111.95 },
        { lat: -7.95, lng: 112.45 }
      );
      autocompleteServiceRef.current.getPlacePredictions({
        input: searchQuery,
        locationBias: bounds,
        componentRestrictions: { country: 'id' },
        sessionToken: sessionTokenRef.current,
      }, (results, status) => {
        setIsSearching(false);
        if (status === 'OK') {
          setPredictions(results || []);
        } else {
          setPredictions([]);
        }
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectPrediction = (prediction) => {
    if (!mapRef.current || !window.google) return;
    if (!placesServiceRef.current) {
      placesServiceRef.current = new window.google.maps.places.PlacesService(mapRef.current);
    }
    placesServiceRef.current.getDetails({
      placeId: prediction.place_id,
      fields: ['geometry', 'formatted_address', 'name'],
    }, (place, status) => {
      if (status === 'OK' && place.geometry?.location) {
        const coords = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        setCenter(coords);
        setAddress(place.name || place.formatted_address);
        mapRef.current.panTo(coords);
        setSearchQuery('');
        setPredictions([]);
        sessionTokenRef.current = null;
      }
    });
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCenter(coords);
      if (mapRef.current) mapRef.current.panTo(coords);
    }, () => {
      alert('Gagal mendapatkan lokasi. Pastikan GPS aktif.');
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  const handleConfirm = () => {
    if (!mapRef.current) return;
    const c = mapRef.current.getCenter();
    const locData = {
      lat: c ? c.lat() : center.lat,
      lng: c ? c.lng() : center.lng,
      address: address || 'Lokasi Terpilih',
    };
    onConfirm(locData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col">
      {/* Header with search */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-12 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-grow relative">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-xl px-4 h-12">
              <span className="material-symbols-outlined text-primary text-lg">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari alamat, jalan, atau gedung..."
                className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-zinc-500"
              />
            </div>
            {predictions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
                {predictions.map((p) => (
                  <button
                    key={p.place_id}
                    onClick={() => selectPrediction(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 text-left active:bg-zinc-700 transition-all"
                  >
                    <span className="material-symbols-outlined text-zinc-500 text-lg">location_on</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{p.structured_formatting?.main_text || p.description}</p>
                      <p className="text-xs text-zinc-400">{p.structured_formatting?.secondary_text || ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Locate me button */}
        <button onClick={handleLocateMe} className="mt-3 w-full py-2 bg-primary/10 border border-primary/20 rounded-xl text-primary text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
          <span className="material-symbols-outlined text-base">my_location</span>
          Gunakan Lokasi Saat Ini
        </button>
      </div>

      {/* Map */}
      <div className="flex-grow relative">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={DEFAULT_ZOOM}
            options={mapOptions}
            onLoad={onMapLoad}
            onDragStart={onDragStart}
            onIdle={onIdle}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-black">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Center pin */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10 flex flex-col items-center">
          <div className="bg-zinc-900/90 px-3 py-1 rounded-full border border-primary/30 mb-2">
            <span className="text-[10px] text-primary font-bold tracking-widest uppercase">
              {isGeocoding ? 'Mencari...' : (mode === 'pickup' || mode === 'pickup' ? 'AMBIL' : 'ANTAR')}
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150"></div>
            <span className="material-symbols-outlined text-4xl text-primary drop-shadow-2xl" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.8))' }}>
              location_on
            </span>
          </div>
        </div>

        {/* Locate me button (bottom right) */}
        <button onClick={handleLocateMe} className="absolute bottom-6 right-6 w-12 h-12 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center text-primary shadow-2xl active:scale-95 transition-all z-10">
          <span className="material-symbols-outlined">my_location</span>
        </button>
      </div>

      {/* Bottom confirm card */}
      <div className="bg-zinc-900 border-t border-zinc-800 px-6 py-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
          <span className="text-[10px] font-black uppercase text-primary tracking-widest">Lokasi Dipilih</span>
        </div>
        <p className="text-sm font-bold text-white mb-4 min-h-[20px]">
          {address || 'Geser peta untuk menentukan titik'}
        </p>
        <button
          onClick={handleConfirm}
          className="w-full py-3.5 rounded-xl bg-primary text-black font-headline font-black text-sm uppercase tracking-widest active:scale-[0.98] transition-all shadow-lg"
        >
          Konfirmasi Lokasi
        </button>
      </div>
    </div>
  );
};

export default LocationPickerModal;
