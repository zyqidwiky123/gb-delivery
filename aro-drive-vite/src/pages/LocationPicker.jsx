import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import { ArrowLeft, LocateFixed, Search, Sparkles } from 'lucide-react';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Navigation, MapPin, Home, Briefcase, ScrollText, CheckCircle2, History } from 'lucide-react';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  BLITAR_CENTER,
  DEFAULT_ZOOM,
  isInsideBounds,
  createMarkerIcon,
  getMapOptions,
  autocompleteOptions,
} from '../utils/mapConfig';
import { useThemeStore } from '../store/themeStore';

const containerStyle = { width: '100%', height: '100%' };

function LocationPicker() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const mode = queryParams.get('mode') || 'pickup'; // pickup, dest, sendPickup, sendDropoff, shopPickup, shopDropoff
  const index = parseInt(queryParams.get('index') || '0');

  const {
    ridePickup, rideDropoff, setRidePickup, setRideDropoff,
    sendPickup, sendDropoff, setSendPickup, setSendDropoff,
    shopPickups, shopDropoff, setShopPickupAt, setShopDropoff,
    foodDeliveryLocation, setFoodDelivery
  } = useOrderStore();

  const { addSavedAddress } = useUserStore();
  const { currentLocation } = useCurrentLocation();
  const { theme } = useThemeStore();
  const mapOptions = useMemo(() => getMapOptions(theme), [theme]);

  // State targetCenter: untuk memaksa peta pindah (panTo dipicu perubahan ini)
  const getInitialLocation = () => {
    if (mode === 'pickup' && ridePickup?.lat) return { lat: ridePickup.lat, lng: ridePickup.lng };
    if (mode === 'dest' && rideDropoff?.lat) return { lat: rideDropoff.lat, lng: rideDropoff.lng };
    if (mode === 'sendPickup' && sendPickup?.lat) return { lat: sendPickup.lat, lng: sendPickup.lng };
    if (mode === 'sendDropoff' && sendDropoff?.lat) return { lat: sendDropoff.lat, lng: sendDropoff.lng };
    if (mode === 'shopPickup' && shopPickups[index]?.lat) return { lat: shopPickups[index].lat, lng: shopPickups[index].lng };
    if (mode === 'shopDropoff' && shopDropoff?.lat) return { lat: shopDropoff.lat, lng: shopDropoff.lng };
    if (mode === 'foodDelivery' && foodDeliveryLocation?.lat) return { lat: foodDeliveryLocation.lat, lng: foodDeliveryLocation.lng };
    return BLITAR_CENTER;
  };

  const getInitialAddress = () => {
    if (mode === 'pickup' && ridePickup) return ridePickup.address;
    if (mode === 'dest' && rideDropoff) return rideDropoff.address;
    if (mode === 'sendPickup' && sendPickup) return sendPickup.address;
    if (mode === 'sendDropoff' && sendDropoff) return sendDropoff.address;
    if (mode === 'shopPickup' && shopPickups[index]?.address) return shopPickups[index].address;
    if (mode === 'shopDropoff' && shopDropoff) return shopDropoff.address;
    if (mode === 'foodDelivery' && foodDeliveryLocation) return foodDeliveryLocation.address;
    return '';
  };

  const [targetCenter, setTargetCenter] = useState(getInitialLocation());
  const [address, setAddress] = useState(getInitialAddress());
  const [isDragging, setIsDragging] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const sessionTokenRef = useRef(null);

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('location_history');
    return saved ? JSON.parse(saved) : [];
  });
  const { savedAddresses } = useUserStore();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Init Geocoder
  useEffect(() => {
    if (isLoaded && window.google) {
      geocoderRef.current = new window.google.maps.Geocoder();
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    }
  }, [isLoaded]);

  // Map Loaded Callback
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    if (targetCenter) map.panTo(targetCenter);
  }, []);

  const onDragStart = () => setIsDragging(true);

  const isInitialIdle = useRef(true);

  // Map Idle - Reverse Geocode the center!
  const onIdle = () => {
    setIsDragging(false);
    if (!mapRef.current || !geocoderRef.current) return;

    const center = mapRef.current.getCenter();
    if (!center) return;

    const latlng = { lat: center.lat(), lng: center.lng() };

    // Skip geocoding on first load if no initial address is provided
    if (isInitialIdle.current) {
      isInitialIdle.current = false;
      if (!getInitialAddress()) {
        console.log("Skipping initial geocode as requested.");
        return;
      }
    }

    setIsGeocoding(true);
    geocoderRef.current.geocode({ location: latlng }, (results, status) => {
      setIsGeocoding(false);
      if (status === 'OK') {
        if (results[0]) {
          const shortAddress = results[0].formatted_address.split(',')[0];
          setAddress(shortAddress);
        } else {
          setAddress('Alamat tidak ditemukan');
        }
      } else {
        setAddress('Titik di peta');
      }
    });
  };

  // Search Predictions
  useEffect(() => {
    if (!searchQuery || !autocompleteServiceRef.current) {
      setPredictions([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      setSearchError(null);

      // Initialize session token if not exists
      if (!sessionTokenRef.current && window.google) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }

      const blitarBounds = new window.google.maps.LatLngBounds(
        { lat: -8.35, lng: 111.95 }, // South West
        { lat: -7.95, lng: 112.45 }  // North East
      );

      autocompleteServiceRef.current.getPlacePredictions({
        input: searchQuery,
        locationBias: blitarBounds,
        componentRestrictions: { country: 'id' },
        sessionToken: sessionTokenRef.current
      }, (results, status) => {
        setIsSearching(false);
        if (status === 'OK') {
          setPredictions(results || []);
        } else if (status === 'ZERO_RESULTS') {
          setPredictions([]);
        } else {
          console.error('Google Maps Search Error:', status);
          setSearchError('Terjadi kesalahan saat mencari lokasi');
          setPredictions([]);
        }
      });
    }, 400); // Slightly longer debounce for better stability

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectPrediction = (prediction) => {
    if (!mapRef.current || !window.google) return;

    if (!placesServiceRef.current) {
      placesServiceRef.current = new window.google.maps.places.PlacesService(mapRef.current);
    }

    placesServiceRef.current.getDetails({
      placeId: prediction.place_id,
      fields: ['geometry', 'formatted_address', 'name']
    }, (place, status) => {
      if (status === 'OK' && place.geometry?.location) {
        const coords = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        const locName = place.name || place.formatted_address;
        
        setTargetCenter(coords);
        setAddress(locName);
        mapRef.current.panTo(coords);
        setIsSearchOpen(false);
        setSearchQuery('');
        // Clear session token for next search session
        sessionTokenRef.current = null;

        // Save to History
        const newHistory = [
          { 
            id: prediction.place_id, 
            name: locName, 
            address: place.formatted_address,
            lat: coords.lat,
            lng: coords.lng
          },
          ...history.filter(h => h.id !== prediction.place_id)
        ].slice(0, 5);
        setHistory(newHistory);
        localStorage.setItem('location_history', JSON.stringify(newHistory));
      }
    });
  };

  const selectFromList = (item) => {
    const coords = { lat: item.lat, lng: item.lng };
    setTargetCenter(coords);
    setAddress(item.name || item.address);
    if (mapRef.current) mapRef.current.panTo(coords);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  // User Locate
  const handleLocateMe = (e) => {
    if (e) e.stopPropagation();
    if ("geolocation" in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition((pos) => {
        setIsLocating(false);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        setTargetCenter(coords);
        if (mapRef.current) mapRef.current.panTo(coords);

        if (!isInsideBounds(coords)) {
          alert("Lokasi Anda berada diluar area operasional Blitar. Tetap memusatkan ke lokasi Anda.");
        }
      }, (err) => {
        setIsLocating(false);
        alert("Gagal mendapatkan lokasi. Pastikan GPS aktif/izin lokasi diberikan.");
      }, { enableHighAccuracy: true, timeout: 10000 });
    }
  };

  const handleConfirm = () => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    const locData = {
      lat: center ? center.lat() : targetCenter.lat,
      lng: center ? center.lng() : targetCenter.lng,
      address: address || 'Lokasi Terpilih'
    };

    if (mode === 'pickup') setRidePickup(locData);
    else if (mode === 'dest') setRideDropoff(locData);
    else if (mode === 'sendPickup') setSendPickup(locData);
    else if (mode === 'sendDropoff') setSendDropoff(locData);
    else if (mode === 'shopPickup') setShopPickupAt(index, locData);
    else if (mode === 'shopDropoff') setShopDropoff(locData);
    else if (mode === 'foodDelivery') setFoodDelivery(locData);
    else if (mode === 'saveUserAddress') {
      const label = prompt("Beri nama alamat ini (Contoh: Rumah, Kantor, Kost):", "Lokasi Saya");
      if (label) {
        addSavedAddress({ ...locData, label });
      } else {
        return; // Don't navigate back if cancelled
      }
    }

    navigate(-1);
  };

  if (!isLoaded) {
    return (
      <div className="bg-background text-on-surface h-screen flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-2 border-primary/20 rounded-full animate-ping absolute inset-0"></div>
          <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="mt-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-primary animate-pulse">Memuat Peta</p>
          <p className="mt-2 text-[10px] text-on-surface/30 uppercase font-bold tracking-widest">Menyiapkan Sistem Navigasi ARO</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-background overflow-hidden font-body flex flex-col max-w-xl mx-auto border-l border-r border-[#1a1a1a]">
      {/* Top UI Overlay */}
      <div className="fixed top-15 left-1/2 -translate-x-1/2 max-w-xl w-full z-10 px-6 mt-safe flex flex-col gap-3 pointer-events-none">
        <div className="flex items-center gap-3 w-full pointer-events-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-surface/90 backdrop-blur-xl border border-outline rounded-xl flex items-center justify-center text-primary shadow-2xl active:scale-95 transition-all shrink-0"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Enhanced Search Trigger */}
          <div 
            onClick={() => setIsSearchOpen(true)}
            className="flex-grow bg-surface/90 backdrop-blur-xl border border-outline rounded-xl h-12 flex items-center px-4 shadow-[0_10px_30px_rgba(0,0,0,0.3)] cursor-pointer group active:scale-[0.99] transition-all"
          >
            <Search size={18} className="text-primary mr-3 group-hover:scale-110 transition-transform" />
            <input 
              readOnly
              type="text"
              autoComplete="off"
              value={address}
              placeholder={mode === 'foodDelivery' ? "Cari lokasi pengiriman..." : "Cari lokasi..."}
              className="bg-transparent border-none outline-none text-sm font-semibold text-on-surface w-full placeholder:text-on-surface-variant placeholder:opacity-50 pointer-events-none"
            />
          </div>
        </div>

        {/* Gunakan Lokasi Saat Ini Button - Wide & Small */}
        <div className="flex flex-col items-start w-full pointer-events-auto">
          <button
            onClick={handleLocateMe}
            disabled={isLocating}
            className={`w-full py-2 border rounded-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 backdrop-blur-md ${isLocating ? 'bg-primary/5 border-primary/10 text-primary/40' : 'bg-primary/10 border-primary/20 text-primary'}`}
          >
            {isLocating ? (
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <LocateFixed size={14} />
            )}
            <span className="text-[10px] font-black uppercase tracking-[0.15em]">
              {isLocating ? 'Mencari Lokasi...' : 'Gunakan Lokasi Saat Ini'}
            </span>
          </button>

          <p className="mt-1.5 text-[9px] text-on-surface-variant opacity-30 italic px-1 font-bold">
            * Mohon aktifkan GPS untuk lokasi yang akurat
          </p>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-grow w-full relative z-0">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={targetCenter}
          zoom={DEFAULT_ZOOM}
          options={mapOptions}
          onLoad={onMapLoad}
          onDragStart={onDragStart}
          onIdle={onIdle}
        >
          {/* User Current Location (Blue Dot) */}
          {currentLocation && (
            <MarkerF
              position={currentLocation}
              icon={createMarkerIcon('user')}
            />
          )}
        </GoogleMap>

        {/* Center Pin UI */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10 filter drop-shadow-2xl flex flex-col items-center">
          <div className="bg-surface px-3 py-1.5 rounded-full border border-primary/30 mb-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            {isGeocoding ? (
              <span className="text-[10px] text-on-surface-variant opacity-50 font-bold tracking-widest uppercase">Mencari...</span>
            ) : (
              <span className="text-[10px] text-primary font-bold tracking-widest uppercase whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis inline-block">
                {mode.includes('pickup') || mode.includes('Pickup') || mode === 'shopPickup' ? 'Ambil' : 'Antar'}
              </span>
            )}
          </div>
          <div className="relative">
            <div className={`absolute inset-0 ${mode.toLowerCase().includes('pickup') || mode === 'pickup' ? 'bg-primary/20' : 'bg-error/20'} blur-xl rounded-full scale-150`}></div>
            <img
              src={mode.toLowerCase().includes('pickup') || mode === 'pickup'
                ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png"
                : "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png"}
              alt="pin"
              className={`w-8 h-12 object-contain transition-transform duration-300 ${isDragging ? '-translate-y-4 scale-110 drop-shadow-[0_15px_15px_rgba(0,0,0,0.5)]' : 'translate-y-0 scale-100 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]'}`}
            />
          </div>
        </div>

        {/* Locate Me Button */}
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          className="absolute bottom-6 right-6 w-12 h-12 bg-surface/90 backdrop-blur-xl border border-outline rounded-full flex items-center justify-center text-primary shadow-2xl active:scale-95 transition-all z-10 disabled:opacity-50"
        >
          {isLocating ? (
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <LocateFixed size={20} />
          )}
        </button>
      </div>

      {/* Bottom Selection Card */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-xl w-full z-20 bg-background border-t border-outline px-6 pt-5 pb-6 rounded-t-[2rem] shadow-[0_-15px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
          <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Lokasi Dipilih</span>
        </div>
        <h3 className="font-headline font-bold text-base text-on-surface mb-4 line-clamp-2 min-h-[44px] flex items-center">
          {address || "Geser peta untuk menentukan titik"}
        </h3>
        
        <button
          onClick={handleConfirm}
          className="w-full py-3.5 text-primary-fg font-headline font-black text-base rounded-xl active:scale-[0.98] transition-all kinetic-gradient shadow-[0_8px_30px_rgb(var(--primary)/0.4)] uppercase italic"
        >
          Konfirmasi Lokasi
        </button>
      </div>


      {/* SUPER CANGGIH SEARCH OVERLAY */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[100] bg-background flex flex-col max-w-xl mx-auto border-l border-r border-outline"
          >
            {/* Overlay Header */}
            <div className="px-6 pt-12 pb-4 bg-gradient-to-b from-surface to-transparent">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsSearchOpen(false)}
                  className="w-10 h-10 flex items-center justify-center bg-surface-container rounded-full text-on-surface"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="flex-grow bg-surface-container rounded-2xl flex items-center px-4 border border-outline h-12">
                  <Search size={18} className="text-primary mr-3" />
                  <input
                    autoFocus
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Masukan nama jalan, gedung atau area..."
                    className="bg-transparent border-none outline-none text-on-surface text-base w-full placeholder:text-on-surface-variant placeholder:opacity-50"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="text-on-surface-variant opacity-20"
                    >
                      <Navigation size={14} className="rotate-45" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Overlay Content */}
            <div className="flex-grow overflow-y-auto px-6 py-4 scrollbar-hide">
              {/* If no search query, show history and saved addresses */}
              {!searchQuery ? (
                <div className="space-y-8 mt-4">
                  {/* Direct Map Button */}
                  <button
                    onClick={() => setIsSearchOpen(false)}
                    className="w-full bg-primary/10 border border-primary/20 rounded-3xl p-5 flex items-center gap-4 active:scale-[0.98] transition-all group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-black shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                      <Navigation size={24} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-on-surface uppercase tracking-tight">Pilih Titik di Peta</p>
                      <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Geser pin secara manual</p>
                    </div>
                  </button>

                  <div className="h-px bg-surface-container w-full"></div>

                  {/* Saved Addresses Section */}
                  {savedAddresses?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4 px-1">
                        <CheckCircle2 size={12} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-40">Alamat Tersimpan</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {savedAddresses.map((addr, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectFromList(addr)}
                            className="bg-surface-container border border-outline rounded-2xl p-4 flex flex-col items-start gap-2 active:scale-95 transition-all text-left"
                          >
                            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                              {addr.label?.toLowerCase() === 'rumah' ? <Home size={16} /> : 
                               addr.label?.toLowerCase() === 'kantor' ? <Briefcase size={16} /> : <MapPin size={16} />}
                            </div>
                            <div className="min-w-0 w-full">
                              <p className="text-xs font-black text-on-surface uppercase tracking-wider truncate">{addr.label}</p>
                              <p className="text-[10px] text-on-surface-variant opacity-40 line-clamp-1">{addr.address}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* History Section */}
                  {history.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <History size={12} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-40">Riwayat Terakhir</span>
                      </div>
                      <div className="space-y-1">
                        {history.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => selectFromList(item)}
                            className="w-full flex items-center gap-4 py-3 active:bg-surface-container transition-all group"
                          >
                            <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant opacity-30 group-active:text-primary group-active:bg-primary/10">
                              <Clock size={16} />
                            </div>
                            <div className="flex-grow text-left border-b border-outline pb-3">
                              <p className="text-sm font-bold text-on-surface group-active:text-primary transition-colors">{item.name}</p>
                              <p className="text-xs text-on-surface-variant opacity-30 line-clamp-1">{item.address}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Operational Area Note */}
                  <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex gap-4">
                    <Navigation className="text-primary shrink-0 rotate-45" size={20} />
                    <div>
                      <h4 className="text-sm font-black text-on-surface-variant opacity-90 uppercase tracking-wider mb-1">Blitar Area</h4>
                      <p className="text-xs text-on-surface-variant opacity-40 leading-relaxed font-medium capitalize">Pastikan lokasi yang Anda cari berada di dalam cakupan layanan ARO di Kota & Kabupaten Blitar.</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Search Results */
                <div className="space-y-4">
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-sm font-bold uppercase tracking-widest">Mencari "{searchQuery}"</p>
                    </div>
                  ) : searchError ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-error opacity-60">
                      <Navigation size={48} className="mb-4 rotate-45" />
                      <p className="text-sm font-bold">Koneksi Error</p>
                      <p className="text-[10px] mt-1 uppercase tracking-widest">Gagal menjangkau server lokasi</p>
                    </div>
                  ) : predictions.length > 0 ? (
                    predictions.map((p) => (
                      <button
                        key={p.place_id}
                        onClick={() => selectPrediction(p)}
                        className="w-full flex items-center gap-4 py-3 group active:bg-surface-container rounded-xl transition-all"
                      >
                        <div className="w-10 h-10 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant opacity-20 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                          <MapPin size={18} />
                        </div>
                        <div className="flex-grow text-left border-b border-outline pb-3">
                          <p className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                            {p.structured_formatting?.main_text || p.description}
                          </p>
                          <p className="text-[11px] text-on-surface-variant opacity-30 line-clamp-1">
                            {p.structured_formatting?.secondary_text || ''}
                          </p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                      <Search size={48} className="mb-4" />
                      <p className="text-sm font-bold">Lokasi tidak ditemukan</p>
                      <p className="text-[10px] mt-1 uppercase tracking-widest">Coba gunakan nama jalan/gedung yang lebih spesifik</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Overlay Footer / Branding */}
            <div className="p-6 border-t border-outline flex items-center justify-between">
              <div className="flex items-center gap-2 opacity-40">
                <Sparkles size={12} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">ARO Intelligence v2.1</span>
              </div>
              <span className="text-[9px] font-bold text-on-surface-variant opacity-20 uppercase tracking-tighter">Powered by Super Canggih Engine</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LocationPicker;
