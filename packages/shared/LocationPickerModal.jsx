import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES, BLITAR_CENTER, DEFAULT_ZOOM, getMapOptions, isInsideBounds } from './mapConfig';

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
    if (initialLocation) {
      setCenter(initialLocation);
      if (initialLocation.address) {
        setAddress(initialLocation.address);
      }
    }
  }, [initialLocation]);

  useEffect(() => {
    if (isLoaded && !geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  }, [isLoaded]);

  const fetchPredictions = useCallback(async (query) => {
    if (!query || !autocompleteServiceRef.current) {
      setPredictions([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await autocompleteServiceRef.current.getPlacePredictions({
        input: query,
        componentRestrictions: { country: 'id' },
        sessionToken: sessionTokenRef.current,
      });
      setPredictions(response.predictions || []);
    } catch (error) {
      console.error("Autocomplete error:", error);
      setPredictions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const debounceRef = useRef(null);
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(value), 300);
  };

  const selectPrediction = async (prediction) => {
    if (!placesServiceRef.current) {
      placesServiceRef.current = new window.google.maps.places.PlacesService(document.createElement('div'));
    }

    try {
      const place = await new Promise((resolve, reject) => {
        placesServiceRef.current.getDetails(
          { placeId: prediction.place_id, fields: ['geometry', 'formatted_address', 'name'] },
          (result, status) => {
            if (status === 'OK') resolve(result);
            else reject(status);
          }
        );
      });

      const location = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        address: place.formatted_address || place.name,
      };

      setCenter(location);
      setAddress(location.address);
      setSearchQuery('');
      setPredictions([]);

      if (sessionTokenRef.current) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
    } catch (error) {
      console.error("Place details error:", error);
    }
  };

  const handleMapClick = useCallback(async (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setCenter({ lat, lng });

    if (geocoderRef.current) {
      try {
        const result = await geocoderRef.current.geocode({ location: { lat, lng } });
        if (result.results[0]) {
          setAddress(result.results[0].formatted_address);
        }
      } catch (error) {
        console.error("Geocoding error:", error);
      }
    }
  }, []);

  const handleDragEnd = useCallback(async () => {
    if (!mapRef.current) return;
    setIsDragging(false);
    const center = mapRef.current.getCenter();
    const lat = center.lat();
    const lng = center.lng();
    setCenter({ lat, lng });

    if (geocoderRef.current) {
      try {
        const result = await geocoderRef.current.geocode({ location: { lat, lng } });
        if (result.results[0]) {
          setAddress(result.results[0].formatted_address);
        }
      } catch (error) {
        console.error("Geocoding error:", error);
      }
    }
  }, []);

  const handleConfirm = () => {
    onConfirm({ ...center, address });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-surface-container-low rounded-2xl w-full max-w-2xl mx-4 overflow-hidden shadow-2xl border border-white/5">
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input
              type="text"
              placeholder="Cari alamat atau tempat..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-[#1e1e1e] text-white rounded-xl py-3 pl-10 pr-4 text-sm placeholder:text-outline focus:ring-1 focus:ring-primary outline-none"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="animate-spin w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full inline-block"></span>
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {predictions.length > 0 && (
          <div className="absolute z-10 mt-1 w-[calc(100%-2rem)] mx-4 bg-[#1e1e1e] rounded-xl shadow-2xl border border-white/5 max-h-60 overflow-y-auto">
            {predictions.map((pred) => (
              <button
                key={pred.place_id}
                onClick={() => selectPrediction(pred)}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-none"
              >
                <p className="text-sm text-white font-medium">{pred.structured_formatting?.main_text || pred.description}</p>
                <p className="text-xs text-on-surface-variant">{pred.structured_formatting?.secondary_text || ''}</p>
              </button>
            ))}
          </div>
        )}

        <div className="relative h-[400px]">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={center}
              zoom={DEFAULT_ZOOM}
              options={mapOptions}
              onClick={handleMapClick}
              onLoad={(map) => { mapRef.current = map; }}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
            >
              <MarkerF position={center} />
            </GoogleMap>
          ) : (
            <div className="flex items-center justify-center h-full bg-[#0d0d0d]">
              <span className="animate-spin w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full"></span>
            </div>
          )}

          <div className="absolute top-4 left-4 right-4 pointer-events-none">
            <div className="bg-black/70 backdrop-blur-md rounded-xl px-4 py-3 border border-white/5">
              <p className="text-xs text-on-surface-variant font-medium">Lokasi {mode === 'pickup' ? 'Penjemputan' : 'Tujuan'}</p>
              <p className="text-sm text-white font-medium mt-0.5">{address || 'Pilih lokasi di peta...'}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-on-surface-variant hover:text-white hover:bg-white/5 transition-all text-sm font-bold"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={!address}
            className="flex-1 py-3 rounded-xl bg-primary text-black font-black hover:shadow-lg active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Konfirmasi Lokasi
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerModal;
