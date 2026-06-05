import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { GoogleMap, useJsApiLoader, MarkerF, DirectionsRenderer } from '@react-google-maps/api';
import { rateOrder, cancelOrder, updateOrderPaymentMethod } from '../firebase/orderService';
import { useUserStore } from '../store/userStore';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  BLITAR_CENTER,
  createMarkerIcon,
  defaultMapOptions,
} from '../utils/mapConfig';
import { useAdminStore } from '../store/adminStore';

const containerStyle = { width: '100%', height: '100%' };

// Memoized Map component to prevent frame drops during bottom sheet animation
const MapView = memo(({ 
  isLoaded, 
  mapCenter, 
  defaultMapOptions, 
  onMapLoad, 
  onDragStart, 
  userInteracted, 
  onRecenter, 
  driverPos, 
  directions, 
  currentLocation,
  pickupPos,
  dropoffPos,
  orderStatus,
  createMarkerIcon
}) => {
  if (!isLoaded) return null;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      defaultCenter={mapCenter}
      zoom={14}
      options={defaultMapOptions}
      onLoad={onMapLoad}
      onDragStart={onDragStart}
    >
      {userInteracted && (
        <button 
          onClick={onRecenter}
          className="fixed bottom-[40%] right-6 z-[1000] bg-primary text-black px-4 py-2 rounded-full text-[10px] font-black tracking-widest shadow-2xl animate-bounce"
        >
           RECENTER DRIVER
        </button>
      )}

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
             }
           }}
        />
      )}

      {currentLocation && (
        <MarkerF
          position={currentLocation}
          icon={createMarkerIcon('user')}
        />
      )}

      {driverPos && (
        <MarkerF
          position={driverPos}
          icon={createMarkerIcon(
            orderStatus === 'accepted' || orderStatus === 'picked_up' ? 'driver_motor' : 'driver'
          )}
          zIndex={100}
        />
      )}

      {pickupPos && orderStatus === 'accepted' && (
        <MarkerF
          position={pickupPos}
          icon={createMarkerIcon('pickup')}
        />
      )}

      {dropoffPos && (
        <MarkerF
          position={dropoffPos}
          icon={createMarkerIcon('dropoff')}
        />
      )}
    </GoogleMap>
  );
}, (prev, next) => {
  return (
    prev.isLoaded === next.isLoaded &&
    prev.mapCenter?.lat === next.mapCenter?.lat &&
    prev.mapCenter?.lng === next.mapCenter?.lng &&
    prev.userInteracted === next.userInteracted &&
    prev.driverPos?.lat === next.driverPos?.lat &&
    prev.driverPos?.lng === next.driverPos?.lng &&
    prev.directions === next.directions &&
    prev.currentLocation?.lat === next.currentLocation?.lat &&
    prev.currentLocation?.lng === next.currentLocation?.lng &&
    prev.orderStatus === next.orderStatus
  );
});

function Tracking() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('id');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [driverProfile, setDriverProfile] = useState(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [directions, setDirections] = useState(null);

  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNoDriverModal, setShowNoDriverModal] = useState(false);

  const cancelReasons = [
    "Salah alamat / detail pesanan",
    "Driver terlalu jauh / lama",
    "Ganti metode pembayaran",
    "Ingin merubah pesanan",
    "Lainnya"
  ];
  
  const mapRef = useRef(null);
  const lastPanPos = useRef(null);
  const lastRouteOrigin = useRef(null);
  const lastRouteDest = useRef(null);
  const userInteracted = useRef(false);
  const pointsAdded = useRef(false);

  const { user, addPoints, lastOrderId } = useUserStore();
  const { adminWhatsApp } = useAdminStore();
  const { currentLocation } = useCurrentLocation();
  const activeOrderId = orderId || lastOrderId;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Convert [lat, lng] array to {lat, lng} object for Google Maps
  const toLatLng = (arr) => {
    if (!arr) return null;
    if (Array.isArray(arr)) return { lat: arr[0], lng: arr[1] };
    return arr;
  };

  const driverPos = order ? toLatLng(order.driverLocation) : null;
  const pickupPos = order ? toLatLng(order.pickup) : null;
  const dropoffPos = order ? toLatLng(order.dropoff) : null;
  const mapCenter = driverPos || pickupPos || BLITAR_CENTER;

  useEffect(() => {
    if (!activeOrderId) {
      setError('Belum ada pesanan aktif yang dapat dilacak.');
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "orders", activeOrderId), (docSnap) => {
      setLoading(false);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOrder(data);
        if (data.status === 'completed') {
           setShowSuccessModal(true);
           if (user && !pointsAdded.current && data.earnedPoints > 0) {
             addPoints(data.earnedPoints);
             pointsAdded.current = true;
           }
        } else if (data.status === 'no_driver') {
           setShowNoDriverModal(true);
        } else if (data.status === 'cancelled' || data.status === 'canceled') {
           setError('Pesanan ini telah dibatalkan.');
        }
      } else {
        setError('Pesanan tidak ditemukan atau sudah kedaluwarsa.');
      }
    }, (err) => {
      setLoading(false);
      setError('Gagal memuat data pesanan.');
      console.error("Error fetching order:", err);
    });

    return () => unsubscribe();
  }, [activeOrderId, user]);

  // Handle Routing Logic
  useEffect(() => {
    if (!isLoaded || !order || !window.google || !driverPos) {
        setDirections(null);
        return;
    }

    const directionsService = new window.google.maps.DirectionsService();

    let destination = null;
    if (order.status === 'accepted') {
        destination = pickupPos || dropoffPos;
    } else if (order.status === 'picked_up') {
        destination = dropoffPos;
    }

    // Distance calc
    const dist = (p1, p2) => {
       if (!p1 || !p2) return 999;
       return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2)) * 111320;
    };

    const shouldUpdate = !directions || 
                       dist(lastRouteOrigin.current, driverPos) > 40 || 
                       dist(lastRouteDest.current, destination) > 5;

    if (driverPos && destination && shouldUpdate) {
        directionsService.route(
            {
                origin: driverPos,
                destination: destination,
                travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === window.google.maps.DirectionsStatus.OK) {
                    setDirections(result);
                    lastRouteOrigin.current = driverPos;
                    lastRouteDest.current = destination;
                } else {
                    console.error("Error fetching directions:", status);
                }
            }
        );
    }
  }, [isLoaded, order?.status, driverPos, pickupPos, dropoffPos]);

  // Smooth follow driver location
  useEffect(() => {
    if (!mapRef.current || !driverPos || userInteracted.current) return;
    
    const dist = (p1, p2) => {
       if (!p1 || !p2) return 999;
       return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2)) * 111320;
    };

    const d = dist(lastPanPos.current, driverPos);
    if (!lastPanPos.current || d > 15) {
      mapRef.current.panTo(driverPos);
      lastPanPos.current = driverPos;
    }
  }, [driverPos]);

  // Fetch Driver Profile (Run regardless of payment method if driverId exists)
  useEffect(() => {
    const driverId = order?.driverId || order?.driver?.id;
    if (!driverId) return;

    const unsubscribe = onSnapshot(doc(db, "drivers", driverId), (docSnap) => {
      if (docSnap.exists()) {
        setDriverProfile(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, [order?.driverId, order?.driver?.id]);

  const handleContactDriver = () => {
    const phone = driverProfile?.whatsapp || driverProfile?.phone || order?.driver?.phone || '';
    if (!phone) {
      alert('Nomor driver belum tersedia');
      return;
    }

    // Format to 62...
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    } else if (!cleanPhone.startsWith('62')) {
      cleanPhone = '62' + cleanPhone;
    }

    const waMessage = order.serviceType === 'food' ? "Halo Bang Driver, saya customer ARO-FOOD. Pesanan saya sudah diproses?" : "Halo Bang Driver, saya customer ARO-DRIVE. Posisi dimana ya?";
    const message = encodeURIComponent(waMessage);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handleCancelOrder = async () => {
    if (!cancelReason) {
      alert('Silakan pilih alasan pembatalan');
      return;
    }
    
    setIsCancelling(true);
    try {
      await cancelOrder(activeOrderId, cancelReason, 'user');
      navigate('/');
    } catch (err) {
      alert('Gagal membatalkan pesanan');
    } finally {
      setIsCancelling(false);
      setShowCancelModal(false);
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      alert('Silakan pilih rating bintang terlebih dahulu.');
      return;
    }
    setIsSubmittingRating(true);
    try {
      await rateOrder(activeOrderId, rating, review);
      setRatingSubmitted(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      alert('Gagal mengirim ulasan.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleDownloadQRIS = async (url) => {
    if (!url) return;
    const fileName = `QRIS_${activeOrderId}.png`;

    // Primary method: draw image to canvas and export as blob (bypasses CORS fetch issues)
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        // Append a cache-busting param to avoid stale CORS-less cached responses
        img.src = url + (url.includes('?') ? '&' : '?') + 'ts=' + Date.now();
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      return;
    } catch (e) {
      console.warn('Canvas download failed, trying fetch...', e);
    }

    // Fallback: direct fetch (works when CORS headers are present)
    try {
      const response = await fetch(url, { mode: 'cors' });
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('All download methods failed:', err);
      // Last resort: create a temporary anchor with download attribute
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) return (
    <div className="bg-background min-h-screen flex items-center justify-center text-primary font-black italic">
       Memuat data pesanan...
    </div>
  );

  if (error) return (
    <div className="bg-background min-h-screen flex flex-col items-center justify-center text-on-surface p-6">
       <span className="material-symbols-outlined text-6xl text-error mb-4">error_outline</span>
       <p className="text-lg font-bold mb-4">{error}</p>
       <button
         onClick={() => navigate('/')}
         className="bg-primary text-black font-bold px-6 py-3 rounded-full"
       >
         Kembali ke Home
       </button>
    </div>
  );

  if (!order) return null;

  return (
    <div data-theme="dark" className="bg-background min-h-screen text-on-background font-body flex flex-col overflow-hidden relative">

      {/* Beautiful Premium Glassmorphic Searching Overlay */}
      {order.status === 'searching' && (
        <div className="absolute inset-0 z-[1500] bg-background text-on-background flex flex-col justify-between p-6 overflow-hidden">
          {/* Floating background gradient/neon circles for premium look */}
          <div className="absolute top-[-10%] left-[-20%] w-[300px] h-[300px] rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-20%] w-[300px] h-[300px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

          {/* Header */}
          <header className="flex justify-between items-center z-10 pt-4">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
              <span className="text-xs font-black tracking-[0.2em] uppercase text-primary">
                Mencari Driver Terdekat
              </span>
            </div>
            <div className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
              <span className="text-[9px] font-black text-primary uppercase tracking-widest animate-pulse">
                ARO-{order.serviceType?.toUpperCase()}
              </span>
            </div>
          </header>

          {/* Central Immersive Radar Animation */}
          <div className="flex-1 flex flex-col items-center justify-center z-10 my-8">
            <div className="relative w-64 h-64 flex items-center justify-center">
              {/* Outer ripples */}
              <div className="absolute inset-0 rounded-full border border-primary/10 animate-ping duration-[3000ms]" />
              <div className="absolute inset-4 rounded-full border border-primary/20 animate-ping duration-[2000ms]" />
              <div className="absolute inset-8 rounded-full border border-primary/30 animate-pulse duration-[1500ms]" />
              
              {/* Sonar sweep */}
              <div className="absolute inset-0 rounded-full border border-primary/10 overflow-hidden animate-spin" style={{ animationDuration: '4s' }}>
                <div className="w-1/2 h-1/2 bg-gradient-to-tr from-primary/20 to-transparent origin-bottom-right" 
                     style={{
                       position: 'absolute',
                       right: '50%',
                       bottom: '50%',
                       transformOrigin: '100% 100%',
                     }}
                />
              </div>

              {/* Inner glowing circle */}
              <div className="w-32 h-32 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_50px_rgb(var(--primary)/0.15)] relative">
                <span className="material-symbols-outlined text-primary text-5xl animate-bounce">
                  {order.serviceType === 'food' ? 'delivery_dining' : order.serviceType === 'ride' ? 'directions_bike' : 'package_2'}
                </span>
              </div>
            </div>

            <div className="text-center mt-8 space-y-2">
              <h2 className="font-headline font-black text-2xl text-on-background italic uppercase tracking-tight">
                Menghubungi Driver...
              </h2>
              <p className="text-xs text-[#A3A3A3] max-w-xs leading-relaxed animate-pulse">
                Memasangkan pesananmu dengan mitra ARO DRIVE di sekitar area penjemputan. Mohon tunggu sebentar.
              </p>
            </div>
          </div>

          {/* Route Details Card & Cancel Button */}
          <div className="z-10 space-y-4 pb-6">
            <div className="bg-surface/60 backdrop-blur-md p-5 rounded-[2rem] border border-on-background/5 space-y-3 shadow-2xl">
              {/* Pickup */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-none mt-0.5 border border-primary/20">
                  <span className="material-symbols-outlined text-primary text-xs">pin_drop</span>
                </div>
                <div className="flex-1">
                  <p className="text-[8px] font-black uppercase tracking-widest text-primary/60">Titik Jemput</p>
                  <p className="text-xs font-bold text-on-background line-clamp-1">{order.pickupAddress || 'Lokasi Penjemputan'}</p>
                </div>
              </div>
              {/* Divider Line */}
              <div className="w-[1px] h-3 bg-primary/20 ml-3" />
              {/* Dropoff */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center flex-none mt-0.5 border border-red-500/20">
                  <span className="material-symbols-outlined text-red-400 text-xs">location_on</span>
                </div>
                <div className="flex-1">
                  <p className="text-[8px] font-black uppercase tracking-widest text-red-400/60">Tujuan</p>
                  <p className="text-xs font-bold text-on-background line-clamp-1">{order.dropoffAddress || 'Lokasi Tujuan'}</p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-headline font-black text-sm uppercase tracking-[0.2em] transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">cancel</span>
              Batalkan Pesanan
            </button>
          </div>
        </div>
      )}


      {/* Floating Home Button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-6 left-6 z-[1000] w-12 h-12 rounded-2xl bg-surface/80 backdrop-blur-md flex items-center justify-center text-primary shadow-2xl border border-outline active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined">home</span>
      </button>

      <div className={`fixed top-6 right-6 z-[1000] backdrop-blur-md px-4 py-3 rounded-2xl border flex items-center gap-3 shadow-2xl ${
        order.status === 'no_driver'
          ? 'bg-red-500/20 border-red-500/40'
          : 'bg-surface/80 border-outline'
      }`}>
        <span className={`w-2 h-2 rounded-full animate-pulse ${
          order.status === 'no_driver' ? 'bg-red-400' :
          order.status === 'searching' ? 'bg-primary' : 'bg-green-400'
        }`}></span>
        <span className="text-[10px] font-black tracking-widest uppercase text-on-surface">
          {order.status === 'accepted'   ? 'Driver Menuju Lokasi'  :
           order.status === 'picked_up'  ? 'Driver Menuju Tujuan'  :
           order.status === 'searching'  ? 'Mencari Driver...'     :
           order.status === 'no_driver'  ? 'Driver Tidak Tersedia' : 'Selesai'}
        </span>
      </div>

      {/* Real Map Canvas */}
      <main className="absolute inset-0 z-0 h-full w-full">
        <MapView 
          isLoaded={isLoaded}
          mapCenter={mapCenter}
          defaultMapOptions={defaultMapOptions}
          onMapLoad={(map) => (mapRef.current = map)}
          onDragStart={() => (userInteracted.current = true)}
          userInteracted={userInteracted.current}
          onRecenter={() => {
            userInteracted.current = false;
            if (driverPos) mapRef.current.panTo(driverPos);
          }}
          driverPos={driverPos}
          directions={directions}
          currentLocation={currentLocation}
          pickupPos={pickupPos}
          dropoffPos={dropoffPos}
          orderStatus={order?.status}
          createMarkerIcon={createMarkerIcon}
        />
      </main>

      {/* Driver Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[1000] pointer-events-none">
        <div className="max-w-xl mx-auto relative pointer-events-auto">
          <AnimatePresence>
            {order.status === 'accepted' && (
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="flex justify-end pr-6 mb-4"
              >
                <div className="bg-surface-container/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-outline shadow-2xl flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tiba dalam</span>
                  <div className="flex items-baseline gap-1 text-primary">
                    <span className="text-3xl font-headline font-black italic">
                      {directions?.routes[0]?.legs[0]?.duration?.value 
                        ? Math.ceil(directions.routes[0].legs[0].duration.value / 60) 
                        : (order.distance ? Math.ceil(order.distance * 3) + 2 : 8)}
                    </span>
                    <span className="text-sm font-bold">min</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div 
            layout
            initial={false}
            animate={{ 
              height: isExpanded ? 'auto' : '110px',
            }}
            transition={{ 
              type: 'spring', 
              damping: 25, 
              stiffness: 180,
              mass: 0.6
            }}
            className="bg-surface/90 backdrop-blur-md rounded-t-[2.5rem] shadow-[0_-12px_48px_rgba(0,0,0,0.6)] border-t border-outline overflow-hidden will-change-[height,transform]"
          >
            {/* Handle & Toggle Area */}
            <div 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex flex-col items-center pt-3 pb-4 cursor-pointer active:bg-on-surface/5 transition-colors"
            >
              <div className="w-10 h-1 bg-on-surface/10 rounded-full mb-1"></div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/40">
                {isExpanded ? 'Tarik kebawah' : 'Ketuk untuk detail'}
              </p>
            </div>

            <div className="px-6 pb-8">
              {/* Driver Profile Section (Minimalist Version) */}
              <div className="flex items-center justify-between mb-4 bg-on-surface/[0.03] p-3 rounded-2xl border border-outline backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  {/* Driver Photo */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container-highest border border-outline overflow-hidden shadow-xl relative z-10">
                      <img 
                        src={driverProfile?.photoUrl || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop&q=80"} 
                        alt="Driver" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    {order.status !== 'searching' && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-[#131313] rounded-full z-20"></div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <h3 className="font-headline font-black text-base text-on-surface tracking-tight leading-none uppercase italic">
                      {driverProfile?.name || order.driver?.name || (order.status === 'searching' ? 'Mencari...' : 'Driver')}
                    </h3>
                    
                    {order.status !== 'searching' && (
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-[9px] font-mono font-bold text-on-surface-variant">
                          {driverProfile?.plateNumber || order.driver?.plate || 'AG ---- ---'}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-on-surface/10"></div>
                        <span className="text-[9px] font-black uppercase text-primary tracking-widest">
                          {driverProfile?.vehicleType || 'Motor'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {order.status !== 'searching' && (
                   <button
                     onClick={(e) => { e.stopPropagation(); handleContactDriver(); }}
                     className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center border border-[#25D366]/20 shadow-lg"
                   >
                     <span className="material-symbols-outlined text-[18px]">chat</span>
                   </button>
                )}
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                    exit={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="space-y-4"
                  >
                    <div className="bg-surface-container p-4 rounded-2xl border border-outline space-y-3 shadow-inner text-on-surface">
                      <div className="flex justify-between items-center border-b border-outline pb-3">
                        <div>
                          <p className="text-[8px] uppercase font-bold tracking-widest text-primary/60">Layanan {order.serviceType?.toUpperCase()}</p>
                          <p className="font-bold text-xs text-on-surface mt-0.5">
                            {order.status === 'accepted' ? 'Driver Menuju Lokasi' :
                             order.status === 'searching' ? 'Mohon tunggu sebentar...' : 'Pesanan Telah Selesai'}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 border border-primary/30">
                          <span className="material-symbols-outlined text-primary text-sm">
                            {order.serviceType === 'food' ? 'restaurant' : order.serviceType === 'ride' ? 'directions_bike' : 'package_2'}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-start pt-1">
                        <div>
                          <p className="text-[8px] uppercase font-bold tracking-widest text-primary/60">Total Pembayaran</p>
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-headline font-black text-on-surface italic">Rp {order.total?.toLocaleString()}</span>
                            </div>
                            {order.actualShoppingCost !== undefined && (
                              <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">
                                Sesuai Struk Belanja
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] uppercase font-bold text-primary tracking-widest mb-0.5">Metode</p>
                          <p className="text-[10px] font-bold text-on-surface uppercase">{order.paymentMethod}</p>
                        </div>
                      </div>

                      {order.pickupFee > 0 && (
                        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-yellow-500 uppercase tracking-widest">
                            <span>Jarak Jemput Driver</span>
                            <span>{order.pickupDistance ? `${order.pickupDistance.toFixed(1)} KM` : '-'}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold text-yellow-500 uppercase tracking-widest">
                            <span>Biaya Penjemputan</span>
                            <span>+Rp {order.pickupFee.toLocaleString()}</span>
                          </div>
                          <p className="text-[8px] text-yellow-500/70 font-medium leading-normal italic mt-1">
                            *Biaya ini otomatis ditambahkan untuk kompensasi driver menjemput dari jarak jauh (&gt;3km).
                          </p>
                        </div>
                      )}

                      {/* Payment Method Selection */}
                      {(!order.customer?.isGuest && ['searching', 'accepted', 'picked_up', 'on_route'].includes(order.status)) ? (
                        <div className="mt-3 pt-3 border-t border-outline">
                          <p className="text-[8px] uppercase font-bold text-primary tracking-widest mb-2">Pilih Metode Pembayaran</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'TUNAI', label: 'Tunai', icon: 'payments' },
                              { id: 'TRANSFER', label: 'Transfer', icon: 'account_balance' },
                              { id: 'QRIS', label: 'QRIS', icon: 'qr_code_2' }
                            ].map((method) => (
                              <button
                                key={method.id}
                                onClick={(e) => { e.stopPropagation(); updateOrderPaymentMethod(activeOrderId, method.id); }}
                                className={`flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl border transition-all ${
                                  order.paymentMethod === method.id
                                    ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgb(var(--primary)/0.1)]'
                                    : 'bg-on-surface/5 border-transparent hover:border-outline'
                                }`}
                              >
                                <span className={`material-symbols-outlined text-[16px] ${order.paymentMethod === method.id ? 'text-primary' : 'text-on-surface-variant'}`}>
                                  {method.icon}
                                </span>
                                <span className={`text-[8px] font-bold ${order.paymentMethod === method.id ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                                  {method.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : order.customer?.isGuest && (
                        <div className="mt-3 pt-3 border-t border-outline flex items-center justify-between">
                           <p className="text-[8px] uppercase font-bold text-on-surface-variant tracking-widest">Metode Pembayaran</p>
                           <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
                             <span className="material-symbols-outlined text-[12px] text-primary">payments</span>
                             <span className="text-[8px] font-bold text-on-surface uppercase">Tunai (Guest)</span>
                           </div>
                        </div>
                      )}
                    </div>

                    {/* Payment Details Section for Non-Cash */}
                    {(order.paymentMethod === 'TRANSFER' || order.paymentMethod === 'QRIS') && ['accepted', 'picked_up', 'on_route'].includes(order.status) && (
                      <div className="mt-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowPaymentDetails(!showPaymentDetails); }}
                          className="w-full flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-sm">
                              {order.paymentMethod === 'QRIS' ? 'qr_code_2' : 'account_balance'}
                            </span>
                            <span className="text-xs font-bold text-on-surface">Lihat Detail Pembayaran</span>
                          </div>
                          <span className={`material-symbols-outlined text-primary text-sm transition-transform ${showPaymentDetails ? 'rotate-180' : ''}`}>
                            expand_more
                          </span>
                        </button>

                        {showPaymentDetails && (
                          <div className="mt-2 bg-surface-container-highest p-4 rounded-xl border border-outline space-y-3 shadow-xl max-h-[200px] overflow-y-auto">
                            {order.paymentMethod === 'TRANSFER' ? (
                              <div className="space-y-3">
                                {(driverProfile?.bankAccounts && driverProfile.bankAccounts.length > 0) ? (
                                  driverProfile.bankAccounts.map((acc, idx) => (
                                    <div key={acc.id || idx} className="bg-on-surface/5 border border-outline p-3 rounded-xl space-y-1">
                                      <div className="flex justify-between items-start">
                                        <span className="text-[8px] font-black text-primary uppercase tracking-widest">{acc.bankName}</span>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(acc.accountNumber);
                                            alert(`Salin Rekening Berhasil!`);
                                          }}
                                          className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary"
                                        >
                                          <span className="material-symbols-outlined text-[10px]">content_copy</span>
                                        </button>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-sm font-headline font-black text-on-surface italic">{acc.accountNumber}</span>
                                        <span className="text-[8px] font-bold text-on-surface-variant uppercase">A.N. {acc.accountHolder}</span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-4 text-center bg-on-background/5 rounded-xl border border-dashed border-on-background/10">
                                    <p className="text-[10px] text-on-background/40 italic">Driver belum mengisi info rekening</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-3">
                                {driverProfile?.qrisUrl ? (
                                  <div className="flex flex-col items-center gap-4 w-full">
                                     <div className="bg-white p-3 rounded-2xl shadow-2xl">
                                        <img src={driverProfile.qrisUrl} alt="QRIS Driver" className="max-w-[180px] h-auto rounded-lg" />
                                     </div>
                                     <button
                                       onClick={(e) => { e.stopPropagation(); handleDownloadQRIS(driverProfile.qrisUrl); }}
                                       className="flex items-center gap-2 px-6 py-3 bg-primary text-black rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                                     >
                                       <span className="material-symbols-outlined text-sm">download</span>
                                       Simpan QRIS
                                     </button>
                                  </div>
                                ) : (
                                  <div className="p-4 bg-on-background/5 rounded-xl border border-dashed border-on-background/10 text-center w-full">
                                    <p className="text-[10px] text-on-background/40 italic">Driver belum mengunggah QRIS</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cancel Button */}
                    {(order.status === 'searching' || order.status === 'accepted') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowCancelModal(true); }}
                        className="w-full mt-2 py-2 text-[8px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 hover:text-error transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-xs">cancel</span>
                        Batalkan Pesanan
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[1001] bg-background/95 backdrop-blur-xl flex items-center justify-center p-6">
           <div className="max-w-md w-full bg-surface rounded-[2.5rem] p-8 border border-outline shadow-2xl text-center space-y-6">
              {!ratingSubmitted ? (
                <>
                  <div className="w-20 h-20 bg-primary rounded-3xl mx-auto flex items-center justify-center rotate-12 shadow-lg mb-2">
                    <span className="material-symbols-outlined text-black text-4xl font-black">star</span>
                  </div>
                  
                  <div>
                    <h2 className="font-headline font-black text-2xl text-on-surface mb-1 italic uppercase">Kasih Rating Bang!</h2>
                    <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">Gimana pelayanan driver tadi?</p>
                  </div>

                  {/* Star Rating UI */}
                  <div className="flex justify-center gap-3 my-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`p-2 transition-all active:scale-90 ${rating >= star ? 'text-primary scale-110' : 'text-on-surface-variant/40 hover:text-on-surface-variant'}`}
                      >
                        <span className={`material-symbols-outlined text-4xl ${rating >= star ? 'filled' : ''}`}>star</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    placeholder="Tulis ulasan singkat (opsional)..."
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    className="w-full bg-surface-container border border-outline rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary/30 outline-none transition-all resize-none h-24"
                  />

                  <div className="bg-surface-container-high rounded-2xl p-4 border border-outline flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">Poin Didapat</p>
                      <p className="text-2xl font-headline font-black text-on-surface italic">+{order.earnedPoints || 0}</p>
                    </div>
                    <span className="material-symbols-outlined text-primary/40 text-4xl">loyalty</span>
                  </div>

                  <button 
                    onClick={handleSubmitRating}
                    disabled={isSubmittingRating}
                    className="w-full py-5 bg-primary text-primary-fg font-headline font-black rounded-3xl uppercase tracking-[0.2em] text-sm active:scale-95 transition-all shadow-[0_10px_30px_rgb(var(--primary)/0.2)]"
                  >
                    {isSubmittingRating ? 'MENGIRIM...' : 'KIRIM ULASAN'}
                  </button>
                  
                  <button 
                    onClick={() => navigate('/')}
                    className="text-on-surface-variant/40 text-[10px] font-black uppercase tracking-widest hover:text-on-surface transition-colors"
                  >
                    Nanti Saja
                  </button>
                </>
              ) : (
                <div className="py-12 flex flex-col items-center space-y-4 animate-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.3)]">
                    <span className="material-symbols-outlined text-on-background text-4xl font-black">check</span>
                  </div>
                  <h2 className="font-headline font-black text-2xl text-on-surface italic uppercase">Terima Kasih!</h2>
                  <p className="text-on-surface-variant text-sm">Ulasan kamu sangat berarti buat kami.</p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* No Driver Available Modal */}
      {showNoDriverModal && (
        <div className="fixed inset-0 z-[2001] bg-background/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface rounded-[2.5rem] border border-outline shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

            {/* Top accent bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-orange-400 to-red-600" />

            <div className="p-8 space-y-6">
              {/* Icon */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-[2rem] bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.15)] rotate-3">
                    <span className="material-symbols-outlined text-red-400 text-5xl">sentiment_dissatisfied</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="material-symbols-outlined text-on-background text-[12px]">close</span>
                  </div>
                </div>

                <div className="text-center">
                  <h2 className="font-headline font-black text-2xl text-on-surface italic uppercase tracking-tight">
                    Driver Tidak Tersedia
                  </h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400 mt-1">
                    Tidak ada mitra di area kamu
                  </p>
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-surface-container rounded-2xl border border-outline p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-none mt-0.5">
                    <span className="material-symbols-outlined text-orange-400 text-sm">info</span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Semua driver mitra ARO DRIVE sedang sibuk atau belum ada driver yang tersedia di area kamu saat ini.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-none mt-0.5">
                    <span className="material-symbols-outlined text-primary text-sm">schedule</span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    Pesanan ini dibatalkan otomatis. Coba lagi beberapa menit ke depan.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/')}
                  className="w-full py-4 bg-primary text-primary-fg font-headline font-black rounded-2xl uppercase tracking-[0.2em] text-sm active:scale-95 transition-all shadow-[0_8px_24px_rgb(var(--primary)/0.2)] flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Pesan Ulang
                </button>

                <button
                  onClick={() => {
                    const adminWA = adminWhatsApp || '6285157517798';
                    const msg = encodeURIComponent('Halo Admin ARO DRIVE, saya tidak dapat menemukan driver. Mohon bantuan 🙏');
                    window.open(`https://wa.me/${adminWA}?text=${msg}`, '_blank');
                  }}
                  className="w-full py-4 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 font-headline font-black rounded-2xl uppercase tracking-[0.2em] text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">chat</span>
                  Hubungi Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[2000] bg-background/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface rounded-[2.5rem] border border-outline shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-outline flex justify-between items-start">
              <div>
                <h3 className="text-xl font-black text-on-surface italic uppercase tracking-tight">Batalkan Pesanan?</h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">Beritahu kami alasannya</p>
              </div>
              <button 
                onClick={() => setShowCancelModal(false)}
                className="w-10 h-10 bg-on-surface/5 rounded-full flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-on-surface">close</span>
              </button>
            </div>
            
            <div className="p-8 space-y-3">
              {cancelReasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setCancelReason(reason)}
                  className={`w-full p-4 rounded-2xl text-left text-sm font-bold transition-all border ${cancelReason === reason ? 'bg-primary/10 border-primary text-primary' : 'bg-on-surface/5 border-transparent text-on-surface-variant hover:bg-on-surface/10'}`}
                >
                  {reason}
                </button>
              ))}

              <div className="pt-6">
                <button
                  disabled={isCancelling}
                  onClick={handleCancelOrder}
                  className="w-full py-5 bg-error text-on-error font-headline font-black rounded-3xl uppercase tracking-[0.2em] text-sm active:scale-95 transition-all shadow-lg"
                >
                  {isCancelling ? 'MEMBATALKAN...' : 'KONFIRMASI PEMBATALAN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tracking;
