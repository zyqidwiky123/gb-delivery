import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BLITAR_CENTER, DEFAULT_ZOOM, MIN_ZOOM } from './mapConfig';
import {
  OSM_TILES,
  OSM_ATTRIBUTION,
  createLeafletIcon,
  osmSearch,
  nominatimReverse,
  getCached,
  setCached,
} from './mapProvider';
import type { SearchResult } from './mapProvider';

interface LocationCoords {
  lat: number;
  lng: number;
  address?: string;
}

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (location: LocationCoords) => void;
  initialLocation?: LocationCoords | null;
  mode?: 'pickup' | 'dropoff';
}

/**
 * FASE 2 — LocationPickerModal versi OSM (Leaflet + Photon/Nominatim).
 * Props & tampilan IDENTIK dengan versi Google (rollback-safe).
 * Perbedaan internal:
 * - Search: Photon (primer) -> Nominatim (fallback), tanpa session token.
 * - Pilih hasil: langsung pakai lat/lng (tanpa Place Details call).
 * - Klik/geser peta: Nominatim reverse (dengan cache 7 hari).
 */
function MapInteraction({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
    dragend(e) {
      const c = e.target.getCenter();
      onPick(c.lat, c.lng);
    },
  });
  return null;
}

const LocationPickerModal: React.FC<LocationPickerModalProps> = ({ isOpen, onClose, onConfirm, initialLocation = null, mode = 'pickup' }) => {
  const mapRef = useRef<LeafletMap | null>(null);

  const [center, setCenter] = useState<LocationCoords>(initialLocation || BLITAR_CENTER);
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [isDragging, setIsDragging] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (initialLocation) {
      setCenter(initialLocation);
      if (initialLocation.address) {
        setAddress(initialLocation.address);
      }
    }
  }, [initialLocation]);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    const cacheKey = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = getCached<string>(cacheKey);
    if (cached) {
      setAddress(cached);
      return;
    }
    try {
      const result = await nominatimReverse(lat, lng);
      if (result) {
        setAddress(result.displayName);
        setCached(cacheKey, result.displayName);
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
    }
  }, []);

  const handlePick = useCallback(async (lat: number, lng: number) => {
    setCenter({ lat, lng });
    setIsDragging(true);
    await reverseGeocode(lat, lng);
    setIsDragging(false);
  }, [reverseGeocode]);

  const fetchPredictions = useCallback(async (query: string) => {
    if (!query || query.trim().length < 3) {
      setPredictions([]);
      return;
    }
    setIsSearching(true);
    try {
      const cacheKey = `search:${query.trim().toLowerCase()}`;
      const cached = getCached<SearchResult[]>(cacheKey);
      if (cached) {
        setPredictions(cached);
        return;
      }
      const results = await osmSearch(query);
      setPredictions(results);
      setCached(cacheKey, results);
    } catch (error) {
      console.error('Search error:', error);
      setPredictions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(value), 400);
  };

  const selectPrediction = (result: SearchResult) => {
    const location: LocationCoords = {
      lat: result.lat,
      lng: result.lng,
      address: result.displayName,
    };

    setCenter(location);
    setAddress(location.address || '');
    setSearchQuery('');
    setPredictions([]);
    mapRef.current?.panTo([result.lat, result.lng]);
  };

  const handleConfirm = () => {
    onConfirm({ ...center, address });
    onClose();
  };

  if (!isOpen) return null;

  const markerIcon = createLeafletIcon(mode === 'pickup' ? 'pickup' : 'dropoff');

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
          <div className="absolute z-[1000] mt-1 w-[calc(100%-2rem)] mx-4 bg-[#1e1e1e] rounded-xl shadow-2xl border border-white/5 max-h-60 overflow-y-auto">
            {predictions.map((pred) => (
              <button
                key={`${pred.lat},${pred.lng}-${pred.mainText}`}
                onClick={() => selectPrediction(pred)}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-none"
              >
                <p className="text-sm text-white font-medium">{pred.mainText}</p>
                <p className="text-xs text-on-surface-variant">{pred.secondaryText}</p>
              </button>
            ))}
          </div>
        )}

        <div className="relative h-[400px]">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={DEFAULT_ZOOM}
            minZoom={MIN_ZOOM}
            zoomControl={false}
            ref={mapRef}
            style={{ width: '100%', height: '100%', background: '#0d0d0d' }}
          >
            <TileLayer url={OSM_TILES.dark} attribution={OSM_ATTRIBUTION} />
            <MapInteraction onPick={handlePick} />
            <Marker position={[center.lat, center.lng]} icon={markerIcon} />
          </MapContainer>

          <div className="absolute top-4 left-4 right-4 pointer-events-none z-[500]">
            <div className="bg-black/70 backdrop-blur-md rounded-xl px-4 py-3 border border-white/5">
              <p className="text-xs text-on-surface-variant font-medium">Lokasi {mode === 'pickup' ? 'Penjemputan' : 'Tujuan'}</p>
              <p className="text-sm text-white font-medium mt-0.5">{address || 'Pilih lokasi di peta...'}</p>
            </div>
          </div>
          {isDragging && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] bg-black/70 rounded-full px-4 py-1.5">
              <span className="text-[10px] text-white/70 font-bold tracking-widest uppercase">Mencari alamat...</span>
            </div>
          )}
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
