import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { GoogleMap, useJsApiLoader, MarkerF, DirectionsRenderer } from '@react-google-maps/api';
import { useUserStore } from '../store/userStore';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  BLITAR_CENTER,
  createMarkerIcon,
  defaultMapOptions,
} from '../utils/mapConfig';

const containerStyle = { width: '100%', height: '100%' };

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
  
  const mapRef = useRef(null);
  const lastPanPos = useRef(null);
  const lastRouteOrigin = useRef(null);
  const lastRouteDest = useRef(null);
  const userInteracted = useRef(false);
  const pointsAdded = useRef(false);

  const { user, addPoints, lastOrderId } = useUserStore();
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

  // Fetch Driver Profile
  useEffect(() => {
    const driverId = order?.driverId || order?.driver?.id;
    if (!driverId || (order?.paymentMethod === 'TUNAI')) return;

    const unsubscribe = onSnapshot(doc(db, "drivers", driverId), (docSnap) => {
      if (docSnap.exists()) {
        setDriverProfile(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, [order?.driverId, order?.driver?.id, order?.paymentMethod]);

  const handleContactDriver = () => {
    const driverPhone = order?.driver?.phone || '';
    if (!driverPhone) {
      alert('Nomor driver belum tersedia');
      return;
    }
    window.location.href = `https://wa.me/${driverPhone}?text=Halo%20Pak%20Driver,%20posisi%20dimana?`;
  };

  if (loading) return (
    <div className="bg-[#0e0e0e] min-h-screen flex items-center justify-center text-primary font-black italic">
       Memuat data pesanan...
    </div>
  );

  if (error) return (
    <div className="bg-[#0e0e0e] min-h-screen flex flex-col items-center justify-center text-white p-6">
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
    <div className="bg-background min-h-screen text-on-background font-body flex flex-col overflow-hidden relative">

      {/* Floating Home Button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-6 left-6 z-[1000] w-12 h-12 rounded-2xl bg-[#131313]/80 backdrop-blur-md flex items-center justify-center text-primary shadow-2xl border border-white/10 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined">home</span>
      </button>

      <div className="fixed top-6 right-6 z-[1000] bg-[#131313]/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex items-center gap-3 shadow-2xl">
        <span className={`w-2 h-2 rounded-full animate-pulse ${order.status === 'searching' ? 'bg-primary' : 'bg-green-400'}`}></span>
        <span className="text-[10px] font-black tracking-widest uppercase text-white">
          {order.status === 'accepted' ? 'Driver Menuju Lokasi' :
           order.status === 'picked_up' ? 'Driver Menuju Tujuan' :
           order.status === 'searching' ? 'Mencari Driver...' : 'Selesai'}
        </span>
      </div>

      {/* Real Map Canvas */}
      <main className="absolute inset-0 z-0 h-full w-full">
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={containerStyle}
            defaultCenter={mapCenter}
            zoom={14}
            options={defaultMapOptions}
            onLoad={(map) => (mapRef.current = map)}
            onDragStart={() => (userInteracted.current = true)}
          >
            {/* Show Recenter Button if user interacted */}
            {userInteracted.current && (
                <button 
                  onClick={() => {
                      userInteracted.current = false;
                      if (driverPos) mapRef.current.panTo(driverPos);
                  }}
                  className="fixed bottom-[40%] right-6 z-[1000] bg-primary text-black px-4 py-2 rounded-full text-[10px] font-black tracking-widest shadow-2xl animate-bounce"
                >
                   RECENTER DRIVER
                </button>
            )}
            {/* Show Markers and Directions */}
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

            {/* User Current Location (Blue Dot) */}
            {currentLocation && (
              <MarkerF
                position={currentLocation}
                icon={createMarkerIcon('user')}
              />
            )}

            {/* Drivers live position */}
            {driverPos && (order.status === 'accepted' || order.status === 'picked_up') && (
              <MarkerF position={driverPos} icon={createMarkerIcon('driver')} />
            )}

            {/* Always show relevant markers to avoid flicker */}
            {pickupPos && (
               <MarkerF position={pickupPos} icon={createMarkerIcon('pickup')} />
            )}
            {dropoffPos && (
               <MarkerF position={dropoffPos} icon={createMarkerIcon('dropoff')} />
            )}
          </GoogleMap>
        )}
      </main>

      {/* Driver Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[1000] pointer-events-none">
        <div className="max-w-xl mx-auto relative pointer-events-auto">
          {order.status === 'accepted' && (
            <div className="flex justify-end pr-6 mb-4">
              <div className="bg-[#262626]/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-white">Tiba dalam</span>
                <div className="flex items-baseline gap-1 text-primary">
                  <span className="text-3xl font-headline font-black italic">8</span>
                  <span className="text-sm font-bold">min</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#131313]/90 backdrop-blur-2xl rounded-t-[2.5rem] px-6 pt-5 pb-8 shadow-[0_-12px_48px_rgba(0,0,0,0.6)] border-t border-white/5">
            <div className="flex justify-center mb-6">
              <div className="w-12 h-1.5 bg-on-surface-variant/30 rounded-full"></div>
            </div>

            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-surface-container-highest border-2 border-primary overflow-hidden">
                  <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAr5XAajWHWnCVcEoi2VhomU2RRi1oJj14RBhltVEwmTbfEKW_i84dn2BDkUz9qAQj07nsW1VB0znDXOW5qiwlc18aHqhw7Gb53jOgqu22HqidGCHExwD202ID9AIWBaNt6MkzajfHVnmrUTACMJknmlViLwxT-oUuNyAm-gWNyh8y73S-6_JDv5sLo-ZwmgEHwjPyTeaqbJyqf_UDWD4h30dkfYwiVwaVX5dP2bncVn6yn1IfcqPjFpKBz4VY49nkar4KuReEa7jY" alt="Driver" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-lg text-white">{order.driver?.name || (order.status === 'searching' ? 'Mencari...' : 'Driver')}</h3>
                  <p className="text-on-surface-variant text-sm font-bold tracking-wider text-primary">{order.driver?.plate || '-'}</p>
                </div>
              </div>

              <button
                onClick={handleContactDriver}
                className="w-12 h-12 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-all"
              >
                <span className="material-symbols-outlined text-xl">chat</span>
              </button>
            </div>
            <div className="bg-[#0e0e0e] p-5 rounded-3xl border border-white/5 space-y-4 shadow-inner text-white">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[#f3ffca]/60">Layanan {order.serviceType?.toUpperCase()}</p>
                  <p className="font-bold text-sm text-white mt-1">
                    {order.status === 'accepted' ? 'Driver Menuju Lokasi' :
                     order.status === 'searching' ? 'Mohon tunggu sebentar...' : 'Pesanan Telah Selesai'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 border border-primary/30">
                  <span className="material-symbols-outlined text-primary">
                    {order.serviceType === 'food' ? 'restaurant' : order.serviceType === 'ride' ? 'directions_bike' : 'package_2'}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-end pt-1">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[#f3ffca]/60">Total Pembayaran</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-headline font-black text-white italic">Rp {order.total?.toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-primary tracking-widest mb-1">Metode</p>
                  <p className="text-xs font-bold text-white uppercase">{order.paymentMethod}</p>
                </div>
              </div>
            </div>

            {/* Payment Details Section for Non-Cash */}
            {(order.paymentMethod === 'TRANSFER' || order.paymentMethod === 'QRIS') && order.status === 'accepted' && (
              <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button 
                  onClick={() => setShowPaymentDetails(!showPaymentDetails)}
                  className="w-full flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-2xl hover:bg-primary/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">
                      {order.paymentMethod === 'QRIS' ? 'qr_code_2' : 'account_balance'}
                    </span>
                    <span className="text-sm font-bold text-white">Lihat Detail Pembayaran</span>
                  </div>
                  <span className={`material-symbols-outlined text-primary transition-transform ${showPaymentDetails ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {showPaymentDetails && (
                  <div className="mt-2 bg-[#1a1a1a] p-5 rounded-2xl border border-white/5 space-y-4 shadow-xl">
                    {order.paymentMethod === 'TRANSFER' ? (
                      <div className="space-y-4">
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Pilih Salah Satu Rekening Driver</p>
                        
                        {(driverProfile?.bankAccounts && driverProfile.bankAccounts.length > 0) ? (
                          driverProfile.bankAccounts.map((acc, idx) => (
                            <div key={acc.id || idx} className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-2 group hover:border-primary/40 transition-colors">
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{acc.bankName}</span>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(acc.accountNumber);
                                    alert(`Nomor Rekening ${acc.bankName} Berhasil Disalin!`);
                                  }}
                                  className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary active:scale-90 transition-all"
                                >
                                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                </button>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-lg font-headline font-black text-white tracking-widest italic">{acc.accountNumber}</span>
                                <span className="text-[10px] font-bold text-white/40 uppercase mt-0.5">A.N. {acc.accountHolder}</span>
                              </div>
                            </div>
                          ))
                        ) : driverProfile?.bankName ? (
                          /* Fallback for legacy single account data */
                          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-2">
                             <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{driverProfile.bankName}</span>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(driverProfile.accountNumber);
                                    alert("Salin Rekening Berhasil!");
                                  }}
                                  className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary active:scale-90 transition-all"
                                >
                                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                </button>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-lg font-headline font-black text-white tracking-widest italic">{driverProfile.accountNumber}</span>
                                <span className="text-[10px] font-bold text-white/40 uppercase mt-0.5">A.N. {driverProfile.accountHolder}</span>
                              </div>
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                            <p className="text-xs text-white/40 italic">Driver belum mengisi info rekening</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Scan QRIS Driver Berikut</p>
                        {driverProfile?.qrisUrl ? (
                          <div className="bg-white p-3 rounded-2xl shadow-2xl">
                             <img src={driverProfile.qrisUrl} alt="QRIS Driver" className="max-w-[200px] h-auto" />
                          </div>
                        ) : (
                          <div className="p-8 bg-white/5 rounded-2xl border border-dashed border-white/10 text-center">
                            <span className="material-symbols-outlined text-white/20 text-4xl mb-2">qr_code_2</span>
                            <p className="text-xs text-white/40 italic">Driver belum mengunggah QRIS</p>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[9px] text-on-surface-variant italic text-center leading-relaxed">
                      *Silakan tunjukkan bukti transfer kepada driver jika diperlukan.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[1001] bg-[#0e0e0e]/95 backdrop-blur-xl flex items-center justify-center p-6">
           <div className="max-w-xs w-full bg-surface-container-low rounded-[2.5rem] p-8 border border-primary/30 shadow-2xl text-center">
              <div className="w-20 h-20 bg-primary rounded-3xl mx-auto flex items-center justify-center mb-6 rotate-12 shadow-lg">
                 <span className="material-symbols-outlined text-black text-4xl font-black">loyalty</span>
              </div>
              <h2 className="font-headline font-black text-2xl text-white mb-2 italic uppercase">Poin Masuk!</h2>
              <p className="text-on-surface-variant text-sm mb-6 text-white/70">Terima kasih telah menggunakan Aro Drive. Poin Anda telah bertambah.</p>
              <div className="bg-[#131313] rounded-2xl p-4 mb-8 border border-white/5">
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Poin Baru</p>
                 <p className="text-4xl font-headline font-black text-white italic">+{order.earnedPoints || 0}</p>
              </div>
              <button onClick={() => navigate('/')} className="w-full py-4 bg-primary text-black font-black rounded-2xl uppercase tracking-widest text-xs active:scale-95 transition-transform">Kembali ke Home</button>
           </div>
        </div>
      )}
    </div>
  );
}

export default Tracking;
