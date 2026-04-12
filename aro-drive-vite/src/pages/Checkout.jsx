import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';
import { createOrder } from '../firebase/orderService';
import { calculateDistance } from '../utils/mapConfig';
import { useAdminStore } from '../store/adminStore';
import { db, auth } from '../firebase/config';
import { collection, query, where, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

function Checkout() {
  const navigate = useNavigate();
  const { 
    cart, currentOrder, clearCart, clearRoute, 
    foodDeliveryLocation, clearShopLocations, clearSendLocations,
    calculateFee
  } = useOrderStore();
  const { user, setLastOrderId } = useUserStore();
  
  const [guestName, setGuestName] = useState('');
  const [guestWA, setGuestWA] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbOrder, setDbOrder] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('TUNAI');

  // Sync with Database
  React.useEffect(() => {
    if (!user) {
      setIsInitializing(false);
      return;
    }

    const q = query(
      collection(db, "orders"),
      where("customerId", "==", user.id),
      where("status", "in", ["searching", "accepted", "on_route"]),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setDbOrder({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setDbOrder(null);
        // Jika tidak ada pesanan di DB, dan keranjang lokal masih ada rute lama tanpa aktivitas baru,
        // kita bisa memilih untuk membersihkannya di sini jika diinginkan.
        // Namun instruksi user adalah "kosongkan jika tidak ada pesanan".
      }
      setIsInitializing(false);
    });

    return () => unsub();
  }, [user]);

  // Determine Service Type
  const isCartOrder = (cart.length > 0) || (dbOrder?.items?.length > 0 && (dbOrder?.type === 'food' || dbOrder?.serviceType === 'food'));
  const isRouteOrder = !!currentOrder || (!!dbOrder && dbOrder.serviceType !== 'food');
  const hasActiveSession = isCartOrder || isRouteOrder;
  
  // Jika ada data di DB, gunakan itu. Jika tidak, gunakan sesi lokal.
  // Jika keduanya tidak ada, baru kosongkan.
  const displayOrder = dbOrder || (hasActiveSession ? (isCartOrder ? { type: 'food', items: cart } : currentOrder) : null);
  const isEmpty = !displayOrder && !isInitializing;
  const serviceType = displayOrder?.type || displayOrder?.serviceType || (isCartOrder ? 'food' : null);

  const { serviceFeePercent } = useAdminStore();
  
  // Pricing Logic (Centralized in orderStore)
  const subtotal = dbOrder ? (dbOrder.subtotal || 0) : (isCartOrder ? cart.reduce((sum, item) => sum + (item.price * item.qty), 0) : 0);
  
  // Calculate delivery fee dynamically if not from DB
  const getDeliveryFee = () => {
    if (dbOrder) return dbOrder.deliveryFee || 0;
    if (isCartOrder) {
      if (serviceType === 'food') {
        // Collect unique merchants from cart
        const merchants = [];
        const seen = new Set();
        cart.forEach(item => {
          if (item.merchantId && !seen.has(item.merchantId)) {
            seen.add(item.merchantId);
            merchants.push({ 
              id: item.merchantId, 
              name: item.merchantName, 
              loc: item.merchantLocation ? { lat: item.merchantLocation[0], lng: item.merchantLocation[1] } : null 
            });
          }
        });

        if (merchants.length === 0 || !foodDeliveryLocation) return calculateFee(0, 'food', 0);

        // Calculate Route Distance: M1 -> M2 -> ... -> Dest
        let totalDist = 0;
        for (let i = 1; i < merchants.length; i++) {
          if (merchants[i-1].loc && merchants[i].loc) {
            totalDist += calculateDistance(merchants[i-1].loc, merchants[i].loc);
          }
        }
        
        const lastMerchant = merchants[merchants.length - 1];
        if (lastMerchant.loc && foodDeliveryLocation) {
          totalDist += calculateDistance(lastMerchant.loc, { lat: foodDeliveryLocation.lat, lng: foodDeliveryLocation.lng });
        }

        return calculateFee(totalDist, 'food', 0);
      }
      return calculateFee(0, 'food', 0);
    }
    if (isRouteOrder) return calculateFee(currentOrder.distance || 0, currentOrder.serviceType, currentOrder.weight || 0);
    return 0;
  };
  const deliveryFee = getDeliveryFee();
  
  // Service Fee from Platform Settings (Admin Store)
  const rawServiceFee = dbOrder ? (dbOrder.serviceFee || 0) : ((subtotal + deliveryFee) * (serviceFeePercent / 100));
  const serviceFee = dbOrder ? (dbOrder.serviceFee || 0) : (Math.round(rawServiceFee / 1000) * 1000);
  
  const total = dbOrder ? (dbOrder.total || 0) : (subtotal + deliveryFee + serviceFee);

  const handleOrder = async () => {
    if (!user && (!guestName || !guestWA)) {
      alert('Mohon isi Nama dan WhatsApp Anda.');
      return;
    }

    // Validation for Locations
    if (isCartOrder && !foodDeliveryLocation) {
      alert('Alamat pengiriman belum ditentukan. Silakan kembali ke pencarian makanan.');
      return;
    }

    if (isRouteOrder && (!currentOrder.pickup || !currentOrder.dropoff)) {
      alert('Rute penjemputan atau tujuan belum lengkap.');
      return;
    }

    setLoading(true);
    try {
      // Ensure we have some auth for guests to satisfy potential persistent rule issues
      if (!user && !auth.currentUser) {
        try {
          await signInAnonymously(auth);
          console.log("Guest signed in anonymously");
        } catch (authError) {
          console.warn("Anonymous sign-in failed, proceeding anyway:", authError);
        }
      }

      // --- HELPER FUNCTIONS ---

      // Firestore does NOT support nested arrays (array inside array).
      // So ALL coordinates must be objects {lat, lng} instead of arrays [lat, lng].
      const DEFAULT_POS = { lat: -8.100, lng: 112.160 }; // Fallback: Blitar center

      // Safe number: convert to finite number, fallback to 0
      const safeNum = (val, fallback = 0) => {
        const n = Number(val);
        return (Number.isFinite(n)) ? n : fallback;
      };

      // Sanitize position: ALWAYS returns a valid {lat, lng} object (never null/undefined/array)
      const sanitizePos = (pos) => {
        if (!pos) return { ...DEFAULT_POS };
        let lat, lng;
        if (Array.isArray(pos) && pos.length >= 2) {
          lat = Number(pos[0]);
          lng = Number(pos[1]);
        } else if (typeof pos === 'object') {
          lat = Number(pos.lat);
          lng = Number(pos.lng || pos.lon);
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ...DEFAULT_POS };
        return { lat, lng };
      };

      // Deep-clean: recursively strip undefined, null, NaN, Infinity from objects
      // This ensures Firestore never receives invalid values
      const deepClean = (obj) => {
        if (obj === undefined || obj === null) return undefined;
        if (Array.isArray(obj)) {
          return obj.map(deepClean).filter(v => v !== undefined && v !== null);
        }
        if (typeof obj === 'object') {
          const out = {};
          for (const [k, v] of Object.entries(obj)) {
            if (v === undefined || v === null) continue;
            if (typeof v === 'number' && !Number.isFinite(v)) { out[k] = 0; continue; }
            const cleaned = deepClean(v);
            if (cleaned !== undefined && cleaned !== null) {
              out[k] = cleaned;
            }
          }
          return out;
        }
        if (typeof obj === 'number' && !Number.isFinite(obj)) return 0;
        return obj;
      };

      // Ensure a string value (never undefined/null)
      const safeStr = (val, fallback = '') => (typeof val === 'string' && val) ? val : fallback;

      // --- PAYLOAD CONSTRUCTION ---
      
      // 1. Core Data (all values guaranteed safe)
      const basePayload = {
        status: 'searching',
        serviceType: safeStr(serviceType, 'food'),
        customerId: safeStr(user?.id, safeStr(auth.currentUser?.uid, '')),
        subtotal: safeNum(subtotal),
        deliveryFee: safeNum(deliveryFee),
        serviceFee: safeNum(serviceFee),
        total: safeNum(total),
        paymentMethod: safeStr(paymentMethod, 'TUNAI'),
        pickupAddress: '',
        dropoffAddress: '',
        customer: user ? { 
          id: safeStr(user.id),
          name: safeStr(user.displayName, 'User'),
          email: safeStr(user.email),
          wa: safeStr(user.whatsapp || user.phoneNumber)
        } : { 
          name: safeStr(guestName, 'Guest'), 
          wa: safeStr(guestWA), 
          isGuest: true 
        }
      };

      // 2. Service Specific Data
      if (isCartOrder) {
        // FOOD ORDER — items only include clean, necessary fields
        // merchantLocation is now {lat, lng} object (NOT array) to avoid Firestore nested-array error
        basePayload.items = cart.map(item => ({
          id: safeStr(item.id, Date.now().toString()),
          name: safeStr(item.name, 'Pesanan Manual'),
          price: safeNum(item.price),
          qty: safeNum(item.qty, 1),
          merchantId: safeStr(item.merchantId),
          merchantName: safeStr(item.merchantName, 'Restoran'),
          merchantLocation: sanitizePos(item.merchantLocation)
        }));

        const uniqueMerchants = [];
        const merchantSeen = new Set();
        cart.forEach(item => {
          if (item.merchantId && !merchantSeen.has(item.merchantId)) {
            merchantSeen.add(item.merchantId);
            uniqueMerchants.push({ 
              name: safeStr(item.merchantName, 'Restoran'), 
              loc: sanitizePos(item.merchantLocation)
            });
          }
        });

        // pickups is array of {lat, lng} objects (NOT array of arrays!)
        basePayload.pickups = uniqueMerchants.map(m => m.loc);
        basePayload.pickup = basePayload.pickups[0] || { ...DEFAULT_POS };
        basePayload.dropoff = sanitizePos(foodDeliveryLocation);
        basePayload.pickupAddress = uniqueMerchants.map(m => m.name).join(', ') || "Restoran";
        basePayload.dropoffAddress = safeStr(foodDeliveryLocation?.address, 'Alamat Pengiriman');
      } else if (isRouteOrder && currentOrder) {
        // RIDE / SEND / SHOP
        basePayload.pickup = sanitizePos(currentOrder.pickup);
        basePayload.dropoff = sanitizePos(currentOrder.dropoff);
        basePayload.distance = safeNum(currentOrder.distance);

        if (serviceType === 'send') {
          basePayload.sender = {
            address: safeStr(currentOrder.sender?.address),
            lat: safeNum(currentOrder.sender?.lat),
            lng: safeNum(currentOrder.sender?.lng),
            phone: safeStr(currentOrder.sender?.phone)
          };
          basePayload.receiver = {
            address: safeStr(currentOrder.receiver?.address),
            lat: safeNum(currentOrder.receiver?.lat),
            lng: safeNum(currentOrder.receiver?.lng),
            phone: safeStr(currentOrder.receiver?.phone)
          };
          basePayload.itemMeta = {
            name: safeStr(currentOrder.item?.name, 'Paket'),
            weight: safeNum(currentOrder.item?.weight, 1)
          };
          basePayload.items = `${basePayload.itemMeta.name} (${basePayload.itemMeta.weight}kg)`;
          basePayload.pickupAddress = safeStr(currentOrder.sender?.address, 'Lokasi Pengirim');
          basePayload.dropoffAddress = safeStr(currentOrder.receiver?.address, 'Lokasi Penerima');
        } else if (serviceType === 'shop') {
          basePayload.shopLocations = (currentOrder.shopLocations || []).map(s => ({
            id: s.id || Date.now(),
            name: safeStr(s.name),
            address: safeStr(s.address),
            latlng: sanitizePos(s.latlng || [s.lat, s.lng])
          }));
          basePayload.delivery = {
            name: safeStr(currentOrder.delivery?.name),
            phone: safeStr(currentOrder.delivery?.phone),
            address: safeStr(currentOrder.delivery?.address),
            latlng: sanitizePos(currentOrder.delivery?.latlng || [currentOrder.delivery?.lat, currentOrder.delivery?.lng])
          };
          basePayload.items = currentOrder.items || "Daftar Belanjaan";
          basePayload.weight = safeNum(currentOrder.weight, 1);
          // pickups is array of {lat, lng} objects (NOT array of arrays!)
          basePayload.pickups = basePayload.shopLocations.map(s => s.latlng);
          basePayload.pickupAddress = basePayload.shopLocations.map(s => s.name || s.address).join(', ') || "Lokasi Belanja";
          basePayload.dropoffAddress = safeStr(basePayload.delivery.address, 'Lokasi Pengantaran');
        } else {
          // Default RIDE
          basePayload.items = "Layanan Ojek";
          basePayload.pickupAddress = safeStr(currentOrder.pickupAddress, 'Titik Jemput');
          basePayload.dropoffAddress = safeStr(currentOrder.dropoffAddress, 'Titik Tujuan');
        }
      }

      // 3. Final Sanitization
      // Step 1: JSON round-trip removes Zustand proxy, undefined values, circular refs  
      // Step 2: deepClean strips any remaining NaN, Infinity, null, or undefined
      const rawJson = JSON.parse(JSON.stringify(basePayload));
      const cleanedPayload = deepClean(rawJson) || {};
      cleanedPayload.createdAt = serverTimestamp();

      console.log("=== FOOD CHECKOUT DEBUG ===");
      console.log("Cart items:", cart.length);
      console.log("foodDeliveryLocation:", foodDeliveryLocation);
      console.log("FINAL FIREBASE PAYLOAD:", JSON.stringify(cleanedPayload, null, 2));

      const orderId = await createOrder(cleanedPayload);
      
      if (isCartOrder) clearCart();
      if (isRouteOrder) {
        clearRoute();
        if (serviceType === 'shop') clearShopLocations();
        if (serviceType === 'send') clearSendLocations();
      }
      setLastOrderId(orderId);
      
      navigate(`/tracking?id=${orderId}`);
    } catch (e) {
      console.error("DEBUG ORDER ERROR:", e);
      console.error("Error code:", e.code);
      console.error("Error message:", e.message);
      console.error("Full error:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
      const errDetail = e.code || e.message || 'Error tidak dikenal.';
      alert(`Gagal membuat pesanan [${serviceType?.toUpperCase()}]:\n${errDetail}`);
    } finally {
      setLoading(false);
    }
  };

  if (isEmpty) {
    return (
      <div className="bg-surface text-on-surface font-body min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-primary text-5xl">shopping_cart_off</span>
        </div>
        <h2 className="text-2xl font-headline font-black text-white uppercase italic tracking-tight mb-2">Keranjang Kosong</h2>
        <p className="text-sm text-on-surface-variant max-w-xs mb-8">
          Belum ada pesanan yang akan dibayar. Silakan pilih layanan kami terlebih dahulu.
        </p>
        <button 
          onClick={() => navigate(user ? '/member' : '/')}
          className="bg-primary text-black px-10 py-4 rounded-full font-headline font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all"
        >
          Mulai Pesan
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen pb-40">
      <main className="max-w-xl mx-auto px-6 py-8 space-y-8 text-white relative">
        {/* Manual Back Button since Header is hidden */}
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-0 left-6 flex items-center gap-2 text-primary hover:text-[#f3ffca] transition-colors font-bold text-sm"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Kembali</span>
        </button>

        <div className="pt-8 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-headline font-extrabold text-[#f3ffca] uppercase italic tracking-tight mb-1">
              {dbOrder ? `Order Aktif` : `Checkout ${serviceType}`}
            </h2>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">
              {dbOrder ? `ID: ${dbOrder.id?.slice(-8).toUpperCase() || 'PROSES'}` : 'Selesaikan Pembayaran Anda'}
            </p>
          </div>
          {dbOrder && (
            <div className="bg-primary/20 border border-primary/40 px-3 py-1.5 rounded-xl">
               <span className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">
                {dbOrder.status === 'searching' ? 'Mencari Driver' : 
                 (dbOrder.status === 'accepted' ? 'Driver Menuju Lokasi' : 
                 (dbOrder.status === 'on_route' ? 'Dalam Perjalanan' : dbOrder.status))}
               </span>
            </div>
          )}
        </div>
        {/* Delivery / Route Summary */}
        <section className="bg-surface-container-low p-6 rounded-[2rem] border border-white/5 space-y-4 shadow-lg">
          <div className="flex items-center gap-3">
             <span className="material-symbols-outlined text-primary">assistant_navigation</span>
             <div className="flex-1">
               <h3 className="font-bold text-sm">Lokasi & Rute</h3>
               <p className="text-xs text-on-surface-variant italic">
                 {displayOrder?.distance ? `${displayOrder.distance.toFixed(1)} KM` : 
                  (isCartOrder ? "Alamat sesuai titik jemput Resto" : "Rute belum ditentukan")}
               </p>
             </div>
          </div>
        </section>

        {/* Order Details */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-label font-bold uppercase tracking-widest text-[#f3ffca]/60">Ringkasan Pesanan</h2>
            {isCartOrder && !dbOrder && (
              <button 
                onClick={() => {
                  if(window.confirm('Kosongkan keranjang belanja?')) {
                    clearCart();
                  }
                }}
                className="text-[10px] font-black text-error uppercase tracking-widest bg-error/10 px-3 py-1.5 rounded-lg border border-error/20 active:scale-95 transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                Hapus Keranjang
              </button>
            )}
          </div>
          <div className="space-y-3">
            {isCartOrder ? (dbOrder?.items || cart).map((item, idx) => (
              <div key={item.id || idx} className="flex justify-between items-center bg-[#131313] p-4 rounded-2xl border border-white/5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="bg-primary/20 text-primary w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold">{item.qty}x</span>
                  <span className="text-sm font-bold">{item.name}</span>
                </div>
                <span className="text-sm font-medium text-on-surface-variant">Rp {(item.price * item.qty).toLocaleString()}</span>
              </div>
            )) : (
              <div className="flex justify-between items-center bg-[#131313] p-5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary text-3xl">
                    {serviceType === 'ride' ? 'directions_bike' : 'package_2'}
                  </span>
                  <div>
                    <span className="text-sm font-bold block uppercase tracking-tight">ARO {serviceType?.toUpperCase()}</span>
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
                      Priority Service {displayOrder?.weight ? `• ${displayOrder.weight} KG` : ''}
                    </span>
                  </div>
                </div>
                <span className="text-lg font-headline font-black text-white italic">Rp {total.toLocaleString()}</span>
              </div>
            )}

            {/* Additional Details for Shop Service */}
            {serviceType === 'shop' && displayOrder?.items && (
              <div className="bg-[#131313] p-5 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <span className="material-symbols-outlined text-primary text-sm">shopping_list</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#f3ffca]/60">Daftar Barang</span>
                </div>
                <p className="text-sm font-medium text-white/90 leading-relaxed whitespace-pre-wrap">
                  {displayOrder.items}
                </p>
                <div className="pt-2 flex items-center justify-between">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Estimasi Berat</span>
                   <span className="bg-primary/20 text-primary px-3 py-1 rounded-lg text-xs font-black uppercase italic tracking-tighter">
                     {displayOrder.weight || 0} KG
                   </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Payment Summary */}
        <section className="bg-surface-container-highest/40 p-6 rounded-3xl border border-white/5 space-y-3 shadow-md">
          {isCartOrder && (
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant font-medium">Subtotal</span>
              <span className="font-bold">Rp {subtotal.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant font-medium">Biaya Kirim</span>
            <span className="font-bold">Rp {deliveryFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant font-medium">Biaya Layanan</span>
            <span className="font-bold">Rp {serviceFee.toLocaleString()}</span>
          </div>
          <hr className="border-white/5 my-2" />
          <div className="flex justify-between text-2xl font-headline font-black text-[#cafd00] italic">
            <span>TOTAL</span>
            <span>Rp {total.toLocaleString()}</span>
          </div>
        </section>

        {/* Metode Pembayaran */}
        <section className="space-y-4">
          <h2 className="text-xs font-label font-bold uppercase tracking-widest text-[#f3ffca]/60 ml-1">Metode Pembayaran</h2>
          
          {user ? (
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'TUNAI', label: 'Tunai (COD)', icon: 'payments', desc: 'Bayar cash ke driver' },
                { id: 'TRANSFER', label: 'Transfer Bank', icon: 'account_balance', desc: 'Transfer ke rekening driver' },
                { id: 'QRIS', label: 'QRIS', icon: 'qr_code_2', desc: 'Scan QRIS driver' }
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`flex items-center gap-4 p-5 rounded-3xl border transition-all text-left ${
                    paymentMethod === method.id 
                    ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(202,253,0,0.1)]' 
                    : 'bg-[#131313] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                    paymentMethod === method.id ? 'bg-primary text-black' : 'bg-white/5 text-primary/60'
                  }`}>
                    <span className="material-symbols-outlined text-2xl">{method.icon}</span>
                  </div>
                  <div className="flex-grow">
                    <p className={`font-headline font-bold text-base ${paymentMethod === method.id ? 'text-white' : 'text-white/70'}`}>
                      {method.label}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold opacity-60">
                      {method.desc}
                    </p>
                  </div>
                  {paymentMethod === method.id && (
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-[#131313] p-5 rounded-3xl border border-primary/20 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">payments</span>
              </div>
              <div className="flex-grow">
                <p className="text-[10px] uppercase tracking-widest text-[#f3ffca]/60 font-black">Metode Pembayaran</p>
                <p className="text-lg font-headline font-bold text-white">Tunai ke Driver</p>
              </div>
              <span className="material-symbols-outlined text-primary">check_circle</span>
            </div>
          )}
        </section>

        {/* Identity for Guest */}
        {!user && (
          <section className="space-y-4">
             <h2 className="text-xs font-label font-bold uppercase tracking-widest text-[#f3ffca]/60">Informasi Pemesan (Guest)</h2>
             <div className="bg-[#131313] p-6 rounded-3xl border border-primary/20 space-y-4">
               <input placeholder="Nama Lengkap" value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full bg-surface-container-highest border-none rounded-2xl px-5 py-4 text-sm" />
               <input placeholder="No. WhatsApp (Aktif)" value={guestWA} onChange={e => setGuestWA(e.target.value)} className="w-full bg-surface-container-highest border-none rounded-2xl px-5 py-4 text-sm" />
             </div>
          </section>
        )}
      </main>

      {/* Place Order Button */}
      {!dbOrder && (
        <div className="fixed bottom-0 w-full z-50 bg-[#0e0e0e]/80 backdrop-blur-3xl border-t border-white/5 pb-10 pt-4 px-6">
          <div className="max-w-xl mx-auto">
            <button 
              onClick={handleOrder}
              disabled={loading}
              className={`w-full py-5 rounded-full text-black font-headline font-black text-xl uppercase tracking-widest shadow-[0_10px_40px_rgba(202,253,0,0.4)] active:scale-95 transition-all ${loading ? 'bg-zinc-700 opacity-50' : 'bg-gradient-to-br from-[#cafd00] to-[#f3ffca]'}`}
            >
              {loading ? 'MEMPROSES...' : 'GAS ORDER!'}
            </button>
          </div>
        </div>
      )}

      {dbOrder && (
        <div className="fixed bottom-0 w-full z-50 bg-[#0e0e0e]/80 backdrop-blur-3xl border-t border-white/5 pb-10 pt-4 px-6">
          <div className="max-w-xl mx-auto">
            <button 
              onClick={() => navigate(`/tracking?id=${dbOrder.id}`)}
              className="w-full py-5 rounded-full bg-primary text-black font-headline font-black text-xl uppercase tracking-widest shadow-[0_10px_40px_rgba(202,253,0,0.4)] active:scale-95 transition-all"
            >
              Lacak Pesanan Aktif
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Checkout;
