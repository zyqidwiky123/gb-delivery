import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Autocomplete, MarkerF } from '@react-google-maps/api';
import { ArrowLeft, LocateFixed, Search } from 'lucide-react';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  BLITAR_CENTER,
  DEFAULT_ZOOM,
  isInsideBounds,
  createMarkerIcon,
  defaultMapOptions,
  autocompleteOptions,
} from '../utils/mapConfig';

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

  // State targetCenter: untuk memaksa peta pindah (panTo dipicu perubahan ini)
  const getInitialLocation = () => {
    if (mode === 'pickup' && ridePickup) return { lat: ridePickup.lat, lng: ridePickup.lng };
    if (mode === 'dest' && rideDropoff) return { lat: rideDropoff.lat, lng: rideDropoff.lng };
    if (mode === 'sendPickup' && sendPickup) return { lat: sendPickup.lat, lng: sendPickup.lng };
    if (mode === 'sendDropoff' && sendDropoff) return { lat: sendDropoff.lat, lng: sendDropoff.lng };
    if (mode === 'shopPickup' && shopPickups[index]?.lat) return { lat: shopPickups[index].lat, lng: shopPickups[index].lng };
    if (mode === 'shopDropoff' && shopDropoff) return { lat: shopDropoff.lat, lng: shopDropoff.lng };
    if (mode === 'foodDelivery' && foodDeliveryLocation) return { lat: foodDeliveryLocation.lat, lng: foodDeliveryLocation.lng };
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

  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Init Geocoder
  useEffect(() => {
    if (isLoaded && window.google) {
      geocoderRef.current = new window.google.maps.Geocoder();
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

          if (autocompleteRef.current) {
            const input = document.getElementById('location-search-input');
            if (input) input.value = shortAddress;
          }
        } else {
          setAddress('Alamat tidak ditemukan');
        }
      } else {
        setAddress('Titik di peta');
      }
    });
  };

  // Place Selected from Autocomplete
  const onPlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (place?.geometry?.location) {
      const coords = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };
      setTargetCenter(coords); // Ini akan memicu render map dengan center baru
      setAddress(place.name || place.formatted_address || '');
      if (mapRef.current) {
        mapRef.current.panTo(coords);
      }
    }
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
      <div className="bg-background text-on-background h-screen flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary/60">Memuat peta...</p>
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
            className="w-10 h-10 bg-[#131313]/90 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center text-primary shadow-2xl active:scale-95 transition-all shrink-0"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Expanded Search Bar */}
          <div className="flex-grow bg-[#131313]/90 backdrop-blur-xl border border-white/10 rounded-xl h-11 flex items-center px-4 shadow-2xl">
            <Search size={16} className="text-white/40 mr-3" />
            <Autocomplete
              onLoad={(ac) => (autocompleteRef.current = ac)}
              onPlaceChanged={onPlaceChanged}
              options={autocompleteOptions}
              className="w-full"
            >
              <input
                id="location-search-input"
                type="text"
                placeholder={
                  mode === 'foodDelivery' ? "Cari lokasi pengiriman makanan..." :
                  mode.includes('pickup') || mode.includes('Pickup') || mode === 'shopPickup' ? "Cari lokasi jemput/toko..." : "Cari tujuan..."
                }
                className="bg-transparent border-none outline-none text-white text-sm w-full font-medium placeholder:text-white/30"
                defaultValue={address}
              />
            </Autocomplete>
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

          <p className="mt-1.5 text-[9px] text-white/30 italic px-1 font-bold">
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
          options={defaultMapOptions}
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
          <div className="bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-primary/30 mb-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            {isGeocoding ? (
              <span className="text-[10px] text-white/50 font-bold tracking-widest uppercase">Mencari...</span>
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
          className="absolute bottom-6 right-6 w-12 h-12 bg-[#131313]/90 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-primary shadow-2xl active:scale-95 transition-all z-10 disabled:opacity-50"
        >
          {isLocating ? (
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <LocateFixed size={20} />
          )}
        </button>
      </div>

      {/* Bottom Selection Card */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 max-w-xl w-full z-20 bg-[#0A0A0A] border-t border-white/5 px-6 pt-5 pb-6 rounded-t-[2rem] shadow-[0_-15px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
          <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Lokasi Dipilih</span>
        </div>
        <h3 className="font-headline font-bold text-base text-white mb-4 line-clamp-2 min-h-[44px] flex items-center">
          {address || "Geser peta untuk menentukan titik"}
        </h3>
        
        <button
          onClick={handleConfirm}
          className="w-full py-3.5 text-black font-headline font-black text-base rounded-xl active:scale-[0.98] transition-all bg-gradient-to-br from-[#cafd00] to-[#f3ffca] shadow-[0_8px_30px_rgba(202,253,0,0.4)] uppercase italic"
        >
          Konfirmasi Lokasi
        </button>
      </div>
    </div>
  );
}

export default LocationPicker;
