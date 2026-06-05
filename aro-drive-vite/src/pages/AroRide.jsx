import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, MarkerF, Autocomplete } from '@react-google-maps/api';
import { ArrowLeft, Navigation, Wallet, ChevronUp, ArrowRight } from 'lucide-react';
import { Drawer } from 'vaul';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  BLITAR_CENTER,
  DEFAULT_ZOOM,
  createMarkerIcon,
  calculateDistance,
  isInsideBounds,
  defaultMapOptions,
  autocompleteOptions,
  getMapOptions,
} from '../utils/mapConfig';
import { useThemeStore } from '../store/themeStore';

const containerStyle = { width: '100%', height: '100%' };

function AroRide() {
  const navigate = useNavigate();
  const [position, setPosition] = useState(BLITAR_CENTER);
  const [destination, setDestination] = useState(null);
  const [distance, setDistance] = useState(0);
  const [fee, setFee] = useState(0);
  const [rideMode, setRideMode] = useState('jek'); // 'jek' or 'car'

  // Map ref
  const mapRef = useRef(null);

  // State untuk SnapPoint Drawer
  const [snap, setSnap] = useState('460px');

  const { setRouteDetails, calculateFee, ridePickup, rideDropoff, setRidePickup, setRideDropoff } = useOrderStore();
  const { user, savedAddresses } = useUserStore();
  const { currentLocation } = useCurrentLocation();
  const { ui } = useAdminStore();
  const { theme } = useThemeStore();
  const rideUI = ui.aroRide;
  const commonUI = ui.common;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Get current location on mount if pickup not set
  useEffect(() => {
    if (ridePickup && ridePickup.lat && ridePickup.lng) {
      const coords = { lat: ridePickup.lat, lng: ridePickup.lng };
      setPosition(coords);
      if (mapRef.current) {
        mapRef.current.panTo(coords);
      }
    } else if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(coords);
        if (mapRef.current) {
          mapRef.current.panTo(coords);
        }
      }, (err) => {
        console.warn("Geolocation denied or failed, using default.");
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    }
  }, [ridePickup]);

  // Set destination if available
  useEffect(() => {
    if (rideDropoff && rideDropoff.lat && rideDropoff.lng) {
      setDestination({ lat: rideDropoff.lat, lng: rideDropoff.lng });
    }
  }, [rideDropoff]);

  // Update distance & fee when points change
  useEffect(() => {
    if (position && destination) {
      const d = calculateDistance(position, destination);
      setDistance(d);

      const estimatedFee = calculateFee(d, rideMode);
      setFee(estimatedFee);

      setRouteDetails({
        type: 'ride',
        pickup: [position.lat, position.lng],
        dropoff: [destination.lat, destination.lng],
        distance: d,
        fee: estimatedFee
      });

      // Buka drawer 100% (full screen) saat rute didapatkan
      setSnap('100%');
    }
  }, [position, destination, calculateFee, setRouteDetails]);


  // Map loaded
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;

    // Jika ada rute lengkap, sesuaikan zoom bounds
    if (ridePickup && rideDropoff && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      if (ridePickup.lat && ridePickup.lng) {
        bounds.extend({ lat: ridePickup.lat, lng: ridePickup.lng });
      }
      if (rideDropoff.lat && rideDropoff.lng) {
        bounds.extend({ lat: rideDropoff.lat, lng: rideDropoff.lng });
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 50); // 50px padding
      }
    }
  }, [ridePickup, rideDropoff]);

  // Locate me
  const handleLocateMe = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isInsideBounds(coords)) {
          alert(commonUI.errorLocation || "Lokasi Anda berada di luar area operasional Blitar.");
          if (mapRef.current) mapRef.current.panTo(BLITAR_CENTER);
        } else {
          setPosition(coords);
          if (mapRef.current) mapRef.current.panTo(coords);
        }
      }, (err) => {
        alert(commonUI.errorLocation || "Gagal mendapatkan lokasi. Pastikan GPS aktif.");
        console.warn(err);
      }, { enableHighAccuracy: true });
    }
  };

  // Fungsi toggle drawer antara middle snap dan full expanded
  const toggleDrawer = () => {
    setSnap(prev => (prev === '460px' ? '100%' : '460px'));
  };

  const centerOnUser = handleLocateMe; // Alias untuk konsistensi

  if (!isLoaded) {
    return (
      <div className="bg-background text-on-background h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary/60">{commonUI.loadingPeta || "Memuat peta..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background font-body h-screen flex flex-col overflow-hidden relative">
      {/* Floating Home Button / Back Button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-6 left-6 z-[120] w-12 h-12 rounded-2xl bg-surface/60 backdrop-blur-xl flex items-center justify-center text-primary shadow-2xl border border-outline active:scale-95 transition-all"
      >
        <ArrowLeft size={24} />
      </button>

      {/* Main Interaction Canvas */}
      <main className="relative flex-grow h-full w-full max-w-xl mx-auto z-0">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={position}
          zoom={DEFAULT_ZOOM}
          options={getMapOptions(theme)}
          onLoad={onMapLoad}
        >
          {/* User Current Location (Blue Dot) */}
          {currentLocation && (
            <MarkerF
              position={currentLocation}
              icon={createMarkerIcon('user')}
            />
          )}

          {/* Pickup Marker */}
          <MarkerF
            position={position}
            icon={createMarkerIcon('pickup')}
          />

          {/* Destination Marker */}
          {destination && (
            <MarkerF
              position={destination}
              icon={createMarkerIcon('dropoff')}
            />
          )}
        </GoogleMap>

        {/* Unified Floating Header */}
        <div className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-[110] pointer-events-none mt-safe">
          <div className="w-full pointer-events-auto bg-surface/90 backdrop-blur-2xl border border-outline rounded-[2.5rem] p-5 shadow-[0_15px_50px_rgba(0,0,0,0.6)] flex flex-col gap-4">
            
            <div className="flex gap-4">
              {/* Visual Connector Column */}
              <div className="flex flex-col items-center pt-2 gap-1 flex-none">
                <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgb(var(--primary)/0.8)]"></div>
                <div className="w-0.5 h-8 border-l border-dashed border-outline"></div>
                <div className="w-3 h-3 rounded-full bg-error shadow-[0_0_10px_rgba(255,80,80,0.8)]"></div>
              </div>

              {/* Address Inputs Column */}
              <div className="flex-grow flex flex-col gap-4">
                {/* Pickup Field */}
                <button
                  onClick={() => navigate('/location-picker?mode=pickup')}
                  className="flex flex-col items-start w-full text-left active:opacity-70 transition-opacity"
                >
                  <span className="text-[10px] font-black uppercase text-primary tracking-widest leading-none mb-1.5 opacity-80">{rideUI.pickupLabel || "Titik Jemput"}</span>
                  <span className="text-sm font-bold text-on-surface truncate leading-tight">
                    {ridePickup ? ridePickup.address : (rideUI.pickupPlaceholder || 'Mau dijemput di mana?')}
                  </span>
                </button>

                {/* Divider Line */}
                <div className="h-px bg-outline/5 w-full"></div>

                {/* Destination Field */}
                <button
                  onClick={() => navigate('/location-picker?mode=dest')}
                  className="flex flex-col items-start w-full text-left active:opacity-70 transition-opacity"
                >
                  <span className="text-[10px] font-black uppercase text-error tracking-widest leading-none mb-1.5 opacity-80">{rideUI.dropoffLabel || "Titik Tujuan"}</span>
                  <span className="text-sm font-bold text-on-surface truncate leading-tight">
                    {rideDropoff ? rideDropoff.address : (rideUI.dropoffPlaceholder || 'Mau ke mana hari ini?')}
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Saved Address Bar */}
            {user && savedAddresses.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pt-3 border-t border-outline -mx-5 px-5 mt-1">
                {savedAddresses.map(addr => (
                  <button
                    key={addr.id}
                    onClick={() => {
                      setRideDropoff({ address: addr.address, lat: addr.lat, lng: addr.lng });
                      if (mapRef.current) {
                        mapRef.current.panTo({ lat: addr.lat, lng: addr.lng });
                      }
                    }}
                    className="flex-none bg-on-surface/5 border border-outline rounded-full px-4 py-2 flex items-center gap-2 active:scale-95 transition-all text-on-surface/50 hover:text-on-surface"
                  >
                     <span className="material-symbols-outlined text-sm">
                       {addr.label?.toLowerCase() === 'rumah' ? 'home' : addr.label?.toLowerCase() === 'kantor' ? 'work' : 'bookmark'}
                     </span>
                     <span className="text-[10px] font-bold uppercase tracking-tight">{addr.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Action FAB (Locate Me) */}
        <button
          onClick={handleLocateMe}
          className="absolute bottom-4 right-6 z-[100] w-14 h-14 bg-surface/80 backdrop-blur-2xl rounded-2xl flex items-center justify-center text-primary shadow-2xl border border-outline active:scale-90 transition-all hover:bg-surface-container-high"
        >
          <Navigation size={24} />
        </button>
      </main>

      {/* Sticky Bottom Sheet Ride Selection (Using Vaul for Slidable UI) */}
      <Drawer.Root
        open={true}
        modal={false}
        snapPoints={['460px', '100%']}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        dismissible={false}
      >
        <Drawer.Portal>
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[1000] outline-none">
            <div className="max-w-xl mx-auto w-full h-[100dvh] bg-surface/98 backdrop-blur-3xl rounded-t-[2.5rem] pt-2 pb-10 shadow-[0_-15px_50px_rgba(0,0,0,1)] border-t border-outline flex flex-col">

              {/* Handle - Visual & Interaction Area */}
              <div 
                className="flex w-full justify-center mb-2 shrink-0 py-6 cursor-grab active:cursor-grabbing group"
                onClick={toggleDrawer}
              >
                <div className="w-16 h-1.5 bg-on-surface/20 group-hover:bg-on-surface/40 active:bg-primary transition-all rounded-full shadow-inner" />
              </div>

              {/* Stack semua menu di area atas agar muat di snap point 460px */}
              <div className="px-3 flex flex-col">
                {/* Header Info */}
                <div className="px-3 mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="font-headline font-black text-on-surface text-3xl italic tracking-tighter leading-none uppercase">{rideUI.title || "ARO JEK"}</h2>
                    <p className="text-on-surface/40 text-[9px] font-extrabold uppercase tracking-widest mt-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                      {rideUI.subtitle || "Jemputan Cepat & Aman"}
                    </p>
                  </div>
                  {distance > 0 && (
                    <div className="bg-on-surface/5 px-4 py-2 rounded-2xl border border-outline text-right">
                      <p className="text-[8px] font-black text-primary uppercase tracking-widest leading-none">JARAK</p>
                      <p className="font-headline font-black text-on-surface italic text-base mt-1">{distance.toFixed(1)} KM</p>
                    </div>
                  )}
                </div>

                {/* Service Selection: Motor vs Mobil */}
                <div className="flex gap-3 mb-6 px-1">
                  <button 
                    onClick={() => setRideMode('jek')}
                    className={`flex-1 py-2.5 rounded-2xl border transition-all duration-300 flex items-center justify-center gap-3 group ${
                      rideMode === 'jek' 
                        ? 'bg-primary text-primary-fg border-primary shadow-[0_5px_15px_rgb(var(--primary)/0.15)]' 
                        : 'bg-on-surface/5 text-on-surface/40 border-outline hover:border-on-surface/20'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">moped</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">{rideUI.modeMotor || "Motor"}</span>
                  </button>
                  <button 
                    onClick={() => alert(rideUI.carComingSoon || "fitur belum tersedia, system akan terus mengupdate. terima kasih")}
                    className="flex-1 py-2.5 rounded-2xl border border-outline bg-on-surface/5 text-on-surface/20 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center backdrop-blur-[1px]">
                       <span className="text-[7px] font-black uppercase tracking-tighter bg-on-surface/10 px-1.5 py-0.5 rounded text-on-surface/60">nanti</span>
                    </div>
                    <span className="material-symbols-outlined text-xl">directions_car</span>
                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">{rideUI.modeMobil || "Mobil"}</span>
                  </button>
                </div>

                {/* Card Ride Option (Selected) */}
                <div className="mb-4">
                  <div className="bg-surface-container/40 backdrop-blur-xl p-3 px-4 rounded-2xl flex items-center justify-between border border-outline shadow-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-on-surface/5 rounded-xl flex items-center justify-center overflow-hidden border border-outline">
                        {rideMode === 'jek' ? (
                          <img alt="Motor" className="w-[110%] h-[110%] object-contain opacity-90" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDN3gDyAv4w9mgfrGFIQbDEEVY4eoX2-QUQw7L_CQ0zZqvshsLMmvIzKd3c7USMDp7y-Hq2t7t3SLFRUd5WMj4YjfsOkG0x3NTWU3MxhSvPFHytlwhV_2caj76Wwj91Chs1Anjh72u-SOgRNpusN-oCtUCGSmi7WESxXST0cL3PcInX8LBczwx-4rTjmTQrU0dm9sPGUGCyJydsuW61RV_CtvtbN7BB8UOFX1_9p-nY66tatr39q-guaeYbmJFajZE8II1_QKKVjc" />
                        ) : (
                          <span className="material-symbols-outlined text-on-surface/40 text-4xl">directions_car</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-headline font-black text-on-surface text-base italic leading-none uppercase">
                          {rideMode === 'jek' ? 'ARO JEK' : 'ARO CAR'}
                        </h3>
                        <p className="text-on-surface/30 text-[7px] font-bold uppercase tracking-widest mt-1">
                          {rideMode === 'jek' ? 'FAST RIDE' : 'COMFORT RIDE'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-headline font-black text-on-surface text-xl italic tracking-tighter">Rp {fee.toLocaleString()}</p>
                      <span className="text-[7px] font-black uppercase text-primary tracking-tighter bg-primary/10 px-1.5 py-0.5 rounded mt-1 inline-block">MURAH</span>
                    </div>
                  </div>
                </div>

                {/* Payment & Order Actions Container */}
                <div className="bg-on-surface/5 backdrop-blur-xl border border-outline rounded-[2rem] p-5 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
                        <Wallet size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] text-on-surface/40 font-black uppercase tracking-[0.15em]">Pembayaran</p>
                        <h4 className="text-on-surface font-bold text-sm">Tunai</h4>
                      </div>
                    </div>
                    <div className="bg-on-surface/10 px-3 py-1.5 rounded-xl border border-outline">
                      <p className="text-on-surface text-[10px] font-black uppercase tracking-widest">Ubah</p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/checkout')}
                    disabled={!destination}
                    className={`w-full py-4 rounded-2xl font-headline font-black text-xl italic tracking-tight uppercase transition-all flex items-center justify-center gap-3 ${destination 
                      ? 'bg-primary text-primary-fg shadow-[0_10px_30px_rgb(var(--primary)/0.3)] active:scale-95' 
                      : 'bg-on-surface/5 text-on-surface/20 border border-outline cursor-not-allowed grayscale'
                    }`}
                  >
                    KONFIRMASI ORDER
                    <ArrowRight size={24} />
                  </button>
                </div>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

export default AroRide;
