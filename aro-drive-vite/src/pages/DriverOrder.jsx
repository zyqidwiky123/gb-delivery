import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { completeOrder } from '../firebase/orderService';
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF } from '@react-google-maps/api';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  BLITAR_CENTER,
  createMarkerIcon,
  defaultMapOptions,
} from '../utils/mapConfig';

const containerStyle = { width: '100%', height: '100%' };

function DriverOrder() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Listen to order data
  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = onSnapshot(doc(db, "orders", orderId), (docSnap) => {
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() });
      }
    });

    return () => unsubscribe();
  }, [orderId]);

  // Real-time GPS: kirim lokasi driver ke Firestore
  useEffect(() => {
    if (!orderId || !order || order.status !== 'accepted') return;
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        try {
          await updateDoc(doc(db, "orders", orderId), {
            driverLocation: coords,
          });
        } catch (e) {
          console.warn("Gagal update lokasi driver:", e);
        }
      },
      (err) => console.warn("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [orderId, order?.status]);

  const handleComplete = async () => {
    if (!order) return;
    setLoading(true);
    try {
      await completeOrder(order.id, order.driverId, order.total);
      navigate('/driver');
    } catch (e) {
      alert("Gagal menyelesaikan order.");
    } finally {
      setLoading(false);
    }
  };

  // Convert [lat, lng] array to {lat, lng} object for Google Maps
  const toLatLng = (arr) => {
    if (!arr) return null;
    if (Array.isArray(arr)) return { lat: arr[0], lng: arr[1] };
    return arr;
  };

  if (!order) return (
    <div className="bg-[#0a0a0a] min-h-screen flex items-center justify-center text-primary font-black italic">
       Memuat Data Order...
    </div>
  );

  const pickupPos = toLatLng(order.pickup);
  const dropoffPos = toLatLng(order.dropoff);
  const mapCenter = pickupPos || BLITAR_CENTER;

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white font-body pb-20 relative">
      {/* Map Header */}
      <header className="fixed top-0 left-0 right-0 z-[1000] p-6 pointer-events-none">
        <div className="max-w-xl mx-auto flex items-center justify-between pointer-events-auto">
          <div className="bg-[#131313]/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/5 flex items-center gap-3 shadow-xl">
             <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl animate-spin" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
             </div>
             <div>
                <p className="text-[10px] uppercase font-black text-primary tracking-widest leading-none mb-1">Status Perjalanan</p>
                <p className="text-sm font-bold text-white uppercase italic tracking-tight">{order.status === 'accepted' ? 'Menuju Tujuan' : 'Selesai'}</p>
             </div>
          </div>
          <button
            onClick={() => navigate('/driver')}
            className="w-12 h-12 rounded-full bg-[#131313] border border-white/5 flex items-center justify-center text-zinc-500 shadow-lg"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </header>

      {/* Driver Map Tracker */}
      <main className="absolute inset-0 z-0 w-full h-full">
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={15}
            options={defaultMapOptions}
          >
            {pickupPos && <MarkerF position={pickupPos} icon={createMarkerIcon('pickup')} />}
            {dropoffPos && <MarkerF position={dropoffPos} icon={createMarkerIcon('dropoff')} />}

            {pickupPos && dropoffPos && (
              <PolylineF
                path={[pickupPos, dropoffPos]}
                options={{
                  strokeColor: '#cafd00',
                  strokeWeight: 4,
                  strokeOpacity: 0.8,
                  geodesic: true,
                }}
              />
            )}
          </GoogleMap>
        )}
      </main>

      {/* Driver Order Summary & Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-[1000] pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto">
          <div className="bg-[#131313]/95 backdrop-blur-2xl rounded-t-[3rem] px-8 pt-6 pb-12 shadow-[0_-12px_64px_rgba(0,0,0,0.8)] border-t border-white/5">
            <div className="flex justify-center mb-6">
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full"></div>
            </div>

            <div className="flex justify-between items-center mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-surface-container-highest border border-white/5 overflow-hidden p-0.5">
                     <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDhvGbfQcTBTs-MwFKtiEIuopYsrYOKdIZotGJdI1XPg3h0oV9b6K_YWqpZjJJYLPoOx0jejmCAmTxI2qczzP1w3iqb0W2iTwfrCuQTqAHR5Fxau8NsrM6-qfQjYTuG_odvVFaDehyVV14nBKRj88SgI1Y8UbtY6DRnQv6CZWdVvE12f2gvWNU-iNMmKDUWU1Uo4q64b0u3EJhhXCa8Y2_TBOgXHJJplOr-XlwwiFGHSODrHfwIYqVrOdGLjXo5whDwSzUJg5XZfzk" alt="Customer" className="w-full h-full object-cover rounded-[0.9rem]" />
                  </div>
                  <div>
                     <h2 className="font-headline font-black text-xl italic uppercase text-white tracking-tight">{order.customer?.name || "Budi Waluyo"}</h2>
                     <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#f3ffca]/60 mt-0.5">Customer • VIP Status</p>
                  </div>
               </div>
               <button className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group active:scale-90 transition-all">
                  <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">call</span>
               </button>
            </div>

            <div className="bg-[#0a0a0a] p-6 rounded-[2rem] border border-white/5 space-y-4 shadow-inner mb-8">
               <div className="flex justify-between items-center">
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-[#f3ffca]/40 mb-1">Detail Tujuan</p>
                     <p className="text-sm font-bold text-white">{order.receiver?.address || 'Jl. Lokasi Sesuai Peta'}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black uppercase tracking-widest text-[#f3ffca]/40 mb-1">Jarak</p>
                     <p className="text-2xl font-headline font-black text-primary italic leading-none">{order.distance?.toFixed(1) || '0.0'} KM</p>
                  </div>
               </div>
               <div className="pt-4 border-t border-white/5 flex justify-between items-end">
                  <div>
                     <p className="text-[10px] uppercase font-bold text-[#f3ffca]/40 tracking-widest mb-1">Metode Bayar</p>
                     <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary">payments</span>
                        <span className="text-sm font-black uppercase text-white tracking-widest">TUNAI</span>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black uppercase tracking-widest text-[#f3ffca]/40 mb-1">Harus Ditagih</p>
                     <p className="text-2xl font-headline font-black text-white italic">Rp {order.total?.toLocaleString()}</p>
                  </div>
               </div>
            </div>

            <button
              disabled={loading}
              onClick={handleComplete}
              className="w-full kinetic-gradient py-5 rounded-[1.5rem] text-black font-headline font-black text-xl uppercase tracking-widest shadow-[0_12px_48px_rgba(202,253,0,0.3)] active:scale-95 transition-all"
            >
              {loading ? 'MEMPROSES...' : 'SELESAIKAN PESANAN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DriverOrder;
