import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db, database } from '../firebase/config';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import LocationPickerModal from '../components/LocationPickerModal';

const haversine = (p1, p2) => {
  if (!p1 || !p2) return 0;
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat * Math.PI/180) * Math.cos(p2.lat * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const safeNum = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

const deepClean = (obj) => {
  if (obj === null || obj === undefined) return undefined;
  if (typeof obj === 'number' && !isFinite(obj)) return 0;
  if (typeof obj === 'object' && obj.constructor?.name === 'FieldValue') return obj;
  if (Array.isArray(obj)) return obj.map(deepClean).filter(v => v !== undefined);
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [k, v] of Object.entries(obj)) {
      const val = deepClean(v);
      if (val !== undefined) cleaned[k] = val;
    }
    return cleaned;
  }
  return obj;
};

const AdminOrderCreate = () => {
  const navigate = useNavigate();
  const { user, logout } = useUserStore();
  const { pricing, calculateAppServiceFee } = useOrderStore();
  const { platformFeePercent } = useAdminStore();

  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [merchantSearch, setMerchantSearch] = useState('');
  const [showMerchantDropdown, setShowMerchantDropdown] = useState(false);

  // Location picker modal state
  const [locPickerOpen, setLocPickerOpen] = useState(false);
  const [locPickerMode, setLocPickerMode] = useState('pickup');
  const [locPickerCallback, setLocPickerCallback] = useState(null);
  const [locPickerInitial, setLocPickerInitial] = useState(null);

  // Customer
  const [customerName, setCustomerName] = useState('');
  const [customerWA, setCustomerWA] = useState('');
  const [serviceType, setServiceType] = useState('food');

  // Food
  const [foodMerchantId, setFoodMerchantId] = useState('');
  const [foodMerchantName, setFoodMerchantName] = useState('');
  const [foodMerchantLocation, setFoodMerchantLocation] = useState(null);
  const [foodItems, setFoodItems] = useState([{ _id: Date.now(), name: '', qty: 1, price: 0 }]);
  const [foodDelivery, setFoodDelivery] = useState(null);

  // Ride
  const [ridePickup, setRidePickup] = useState(null);
  const [rideDropoff, setRideDropoff] = useState(null);

  // Send
  const [sendSender, setSendSender] = useState({ name: '', phone: '', address: '', lat: null, lng: null });
  const [sendReceiver, setSendReceiver] = useState({ name: '', phone: '', address: '', lat: null, lng: null });
  const [sendItemName, setSendItemName] = useState('');
  const [sendWeight, setSendWeight] = useState(1);

  // Shop
  const [shopStores, setShopStores] = useState([{ _id: Date.now(), name: '', address: '', lat: null, lng: null }]);
  const [shopDelivery, setShopDelivery] = useState({ name: '', phone: '', address: '', lat: null, lng: null });
  const [shopList, setShopList] = useState('');
  const [shopWeight, setShopWeight] = useState(1);

  // Pricing
  const [manualPricing, setManualPricing] = useState(false);
  const [manualSubtotal, setManualSubtotal] = useState(0);
  const [manualDeliveryFee, setManualDeliveryFee] = useState(0);

  // Driver
  const [selectedDriver, setSelectedDriver] = useState('');
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [allDriverData, setAllDriverData] = useState([]);

  const handleLogout = async () => {
    logout();
    navigate('/login');
  };

  // Fetch merchants
  useEffect(() => {
    const q = query(collection(db, 'merchants'));
    const unsub = onSnapshot(q, (snap) => {
      setMerchants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Fetch online drivers (RTDB) + all driver data (Firestore)
  useEffect(() => {
    const driversRef = ref(database, 'drivers');
    const unsub = onValue(driversRef, (snap) => {
      const ids = new Set();
      snap.forEach(child => {
        if (child.val().isOnline) ids.add(child.key);
      });
      setOnlineIds(ids);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'drivers'));
    const unsub = onSnapshot(q, (snap) => {
      setAllDriverData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const drivers = useMemo(() =>
    allDriverData.filter(d => onlineIds.has(d.id)),
    [allDriverData, onlineIds]
  );

  const filteredMerchants = useMemo(() => {
    if (!merchantSearch) return merchants;
    return merchants.filter(m => m.name?.toLowerCase().includes(merchantSearch.toLowerCase()));
  }, [merchants, merchantSearch]);

  // Computed values
  const computedSubtotal = useMemo(() => {
    if (serviceType === 'food') {
      return foodItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
    }
    return 0;
  }, [serviceType, foodItems]);

  const distance = useMemo(() => {
    if (serviceType === 'ride' && ridePickup && rideDropoff) {
      return haversine(ridePickup, rideDropoff);
    }
    if (serviceType === 'food' && foodMerchantLocation && foodDelivery) {
      return haversine(foodMerchantLocation, foodDelivery);
    }
    if (serviceType === 'send' && sendSender.lat && sendReceiver.lat) {
      return haversine(sendSender, sendReceiver);
    }
    if (serviceType === 'shop' && shopStores[0]?.lat && shopDelivery.lat) {
      const storeLocs = shopStores.filter(s => s.lat && s.lng);
      if (storeLocs.length === 0) return 0;
      const avgLat = storeLocs.reduce((s, st) => s + st.lat, 0) / storeLocs.length;
      const avgLng = storeLocs.reduce((s, st) => s + st.lng, 0) / storeLocs.length;
      return haversine({ lat: avgLat, lng: avgLng }, shopDelivery);
    }
    return 0;
  }, [serviceType, ridePickup, rideDropoff, foodMerchantLocation, foodDelivery, sendSender, sendReceiver, shopStores, shopDelivery]);

  const weight = useMemo(() => {
    if (serviceType === 'send') return Number(sendWeight) || 1;
    if (serviceType === 'shop') return Number(shopWeight) || 1;
    return 0;
  }, [serviceType, sendWeight, shopWeight]);

  const calcDeliveryFee = useCallback((dist, type, w) => {
    if (!dist || dist <= 0) return 0;
    const p = pricing[type] || pricing['jek'];
    if (!p) return 0;
    let total = p.baseFare || 0;
    if (type === 'shop') {
      total = (p.serviceFee || 0) + (dist * (p.ratePerKm || 0));
      if (w > 1) {
        total += Math.ceil((w - 1) / 2) * (p.weightFareRate || 0);
      }
    } else {
      const minDist = p.minDistance || 0;
      if (dist > minDist) total += (dist - minDist) * (p.ratePerKm || 0);
      if (type === 'send' && w > 1) {
        total += Math.ceil((w - 1) / 2) * (p.weightFareRate || 2000);
      }
    }
    total += calculateAppServiceFee(dist);
    return Math.round(total / 1000) * 1000;
  }, [pricing, calculateAppServiceFee]);

  const autoDeliveryFee = useMemo(() => calcDeliveryFee(distance, serviceType, weight), [calcDeliveryFee, distance, serviceType, weight]);

  const subtotal = manualPricing ? Number(manualSubtotal) || 0 : computedSubtotal;
  const deliveryFee = manualPricing ? Number(manualDeliveryFee) || 0 : autoDeliveryFee;
  const total = subtotal + deliveryFee;

  const appServiceFee = useMemo(() => calculateAppServiceFee(distance), [calculateAppServiceFee, distance]);
  const rate = (pricing[serviceType]?.commission ?? platformFeePercent ?? 10) / 100;
  const platformCommission = Math.round((deliveryFee - appServiceFee) * rate);

  // Open location picker
  const openLocationPicker = (mode, initial, callback) => {
    setLocPickerMode(mode);
    setLocPickerInitial(initial);
    setLocPickerCallback(() => callback);
    setLocPickerOpen(true);
  };

  // Food item management
  const addFoodItem = () => setFoodItems(prev => [...prev, { _id: Date.now(), name: '', qty: 1, price: 0 }]);
  const removeFoodItem = (id) => setFoodItems(prev => prev.filter(i => i._id !== id));
  const updateFoodItem = (id, field, value) => setFoodItems(prev => prev.map(i => i._id === id ? { ...i, [field]: value } : i));

  // Shop store management
  const addShopStore = () => setShopStores(prev => [...prev, { _id: Date.now(), name: '', address: '', lat: null, lng: null }]);
  const removeShopStore = (id) => setShopStores(prev => prev.filter(s => s._id !== id));
  const updateShopStore = (id, field, value) => setShopStores(prev => prev.map(s => s._id === id ? { ...s, [field]: value } : s));

  // Validation
  const validate = () => {
    if (!customerName.trim() || !customerWA.trim()) {
      alert('Nama dan WA Customer wajib diisi!');
      return false;
    }
    if (serviceType === 'food') {
      if (!foodMerchantId) { alert('Pilih merchant terlebih dahulu!'); return false; }
      if (foodItems.length === 0 || foodItems.every(i => !i.name.trim())) { alert('Minimal satu item harus diisi!'); return false; }
      if (!foodDelivery) { alert('Pilih lokasi pengiriman!'); return false; }
    }
    if (serviceType === 'ride') {
      if (!ridePickup) { alert('Pilih titik jemput!'); return false; }
      if (!rideDropoff) { alert('Pilih titik tujuan!'); return false; }
    }
    if (serviceType === 'send') {
      if (!sendSender.name.trim() || !sendSender.phone.trim()) { alert('Data pengirim harus lengkap!'); return false; }
      if (!sendReceiver.name.trim() || !sendReceiver.phone.trim()) { alert('Data penerima harus lengkap!'); return false; }
      if (!sendItemName.trim()) { alert('Nama barang harus diisi!'); return false; }
    }
    if (serviceType === 'shop') {
      if (shopStores.length === 0 || shopStores.every(s => !s.name.trim())) { alert('Minimal satu toko harus diisi!'); return false; }
      if (!shopDelivery.name.trim() || !shopDelivery.phone.trim()) { alert('Data pengiriman harus lengkap!'); return false; }
      if (!shopList.trim()) { alert('Daftar belanjaan harus diisi!'); return false; }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const basePayload = {
        status: selectedDriver ? 'accepted' : 'searching',
        serviceType,
        customerId: user?.id || '',
        subtotal: safeNum(subtotal),
        deliveryFee: safeNum(deliveryFee),
        serviceFee: safeNum(platformCommission + appServiceFee),
        appServiceFee: safeNum(appServiceFee),
        total: safeNum(total),
        paymentMethod: 'TUNAI',
        earnedPoints: Math.floor(safeNum(total) / 10000),
        voucherUsed: false,
        voucherId: null,
        subsidizedFee: 0,
        customer: {
          name: customerName.trim(),
          wa: customerWA.trim(),
          isGuest: true,
          isManual: true,
        },
        createdBy: 'admin',
        createdAt: serverTimestamp(),
      };

      // Service-specific data
      if (serviceType === 'food') {
        const items = foodItems
          .filter(i => i.name.trim())
          .map(i => ({
            id: String(i._id),
            name: i.name.trim(),
            price: Number(i.price) || 0,
            qty: Number(i.qty) || 1,
            merchantId: foodMerchantId,
            merchantName: foodMerchantName,
            merchantLocation: foodMerchantLocation || { lat: -8.098, lng: 112.168 },
            desc: i.desc || '',
            isManual: true,
          }));
        basePayload.items = items;
        basePayload.merchantId = foodMerchantId;
        basePayload.merchantName = foodMerchantName;
        basePayload.pickups = [foodMerchantLocation || { lat: -8.098, lng: 112.168 }];
        basePayload.pickup = foodMerchantLocation || { lat: -8.098, lng: 112.168 };
        basePayload.dropoff = { lat: foodDelivery.lat, lng: foodDelivery.lng, address: foodDelivery.address || 'Alamat Pengiriman' };
        basePayload.pickupAddress = foodMerchantLocation?.address || foodMerchantName;
        basePayload.dropoffAddress = foodDelivery?.address || '';
      }

      if (serviceType === 'ride') {
        basePayload.items = 'Layanan Ojek';
        basePayload.pickup = { lat: ridePickup.lat, lng: ridePickup.lng, address: ridePickup.address || 'Titik Jemput' };
        basePayload.dropoff = { lat: rideDropoff.lat, lng: rideDropoff.lng, address: rideDropoff.address || 'Titik Tujuan' };
        basePayload.pickupAddress = ridePickup.address || '';
        basePayload.dropoffAddress = rideDropoff.address || '';
        basePayload.distance = Math.round(distance * 10) / 10;
      }

      if (serviceType === 'send') {
        basePayload.items = `${sendItemName} (${sendWeight}kg)`;
        basePayload.itemMeta = { name: sendItemName, weight: Number(sendWeight) || 1 };
        basePayload.sender = {
          name: sendSender.name,
          address: sendSender.address || sendSender.name,
          lat: sendSender.lat,
          lng: sendSender.lng,
          phone: sendSender.phone,
        };
        basePayload.receiver = {
          name: sendReceiver.name,
          address: sendReceiver.address || sendReceiver.name,
          lat: sendReceiver.lat,
          lng: sendReceiver.lng,
          phone: sendReceiver.phone,
        };
        basePayload.pickup = { lat: sendSender.lat, lng: sendSender.lng, address: sendSender.address || '' };
        basePayload.dropoff = { lat: sendReceiver.lat, lng: sendReceiver.lng, address: sendReceiver.address || '' };
        basePayload.pickupAddress = sendSender.address || '';
        basePayload.dropoffAddress = sendReceiver.address || '';
        basePayload.distance = Math.round(distance * 10) / 10;
      }

      if (serviceType === 'shop') {
        const validStores = shopStores.filter(s => s.name.trim());
        basePayload.items = shopList;
        basePayload.shopLocations = validStores.map(s => ({
          id: String(s._id),
          name: s.name,
          address: s.address || s.name,
          latlng: { lat: s.lat, lng: s.lng },
        }));
        basePayload.delivery = {
          name: shopDelivery.name,
          phone: shopDelivery.phone,
          address: shopDelivery.address || '',
          latlng: { lat: shopDelivery.lat, lng: shopDelivery.lng },
        };
        basePayload.weight = Number(shopWeight) || 1;
        basePayload.pickups = validStores.filter(s => s.lat && s.lng).map(s => ({ lat: s.lat, lng: s.lng }));
        if (basePayload.pickups.length > 0) {
          basePayload.pickup = basePayload.pickups[0];
        }
        basePayload.dropoff = { lat: shopDelivery.lat, lng: shopDelivery.lng, address: shopDelivery.address || '' };
        basePayload.merchantId = validStores[0]?.name || 'ARO Shop';
        basePayload.pickupAddress = validStores.map(s => s.name).join(', ');
        basePayload.dropoffAddress = shopDelivery.address || '';
        basePayload.distance = Math.round(distance * 10) / 10;
      }

      // Driver assignment
      if (selectedDriver) {
        basePayload.driverId = selectedDriver;
        basePayload.acceptedAt = serverTimestamp();
        basePayload.dispatch = {
          status: 'assigned',
          assignedDirectly: true,
          assignedAt: serverTimestamp(),
        };
      }

      const cleanedPayload = deepClean(basePayload) || {};
      const docRef = await addDoc(collection(db, 'orders'), cleanedPayload);

      // If driver assigned, also update driver status
      if (selectedDriver) {
        try {
          const driverRef = doc(db, 'drivers', selectedDriver);
          await updateDoc(driverRef, { status: 'busy' });
        } catch (err) {
          console.error('Error updating driver status:', err);
        }
      }

      alert(`Pesanan berhasil dibuat! ID: ${docRef.id}`);
      navigate('/admin/orders');
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Gagal membuat pesanan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Input class
  const inputClass = 'w-full bg-[#1a1a1a] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-zinc-600';
  const labelClass = 'text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1';

  return (
    <div className="flex min-h-screen bg-[#080808] text-on-background font-body">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111] border-r border-on-background/5 hidden md:flex flex-col">
        <div className="p-8">
          <h1 className="font-['Plus_Jakarta_Sans'] font-black text-2xl italic text-primary tracking-tighter">ARO ADMIN</h1>
        </div>
        <nav className="flex-grow px-4 space-y-2">
          <Link to="/admin" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-on-background/5 hover:text-on-background transition-all">
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span className="font-bold text-sm">Dashboard</span>
          </Link>
          <Link to="/admin/orders" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-on-background/5 hover:text-on-background transition-all">
            <span className="material-symbols-outlined text-xl">list_alt</span>
            <span className="font-bold text-sm">Semua Pesanan</span>
          </Link>
          <Link to="/admin/orders/create" className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 text-primary group border border-primary/20">
            <span className="material-symbols-outlined text-xl">add_circle</span>
            <span className="font-bold text-sm">Buat Pesanan</span>
          </Link>
          <Link to="/admin/merchants" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-on-background/5 hover:text-on-background transition-all">
            <span className="material-symbols-outlined text-xl">store</span>
            <span className="font-bold text-sm">Kelola Merchant</span>
          </Link>
          <Link to="/admin/settings" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-on-background/5 hover:text-on-background transition-all">
            <span className="material-symbols-outlined text-xl">settings</span>
            <span className="font-bold text-sm">Pengaturan Tarif</span>
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-8 md:p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <Link to="/admin"
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-primary transition-colors mb-2">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Kembali ke Dashboard
            </Link>
            <h2 className="text-3xl font-headline font-black italic tracking-tight mb-1 uppercase">Buat Pesanan Baru</h2>
            <p className="text-zinc-500 text-sm font-medium">Isi data pesanan dari WhatsApp customer.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/admin"
              className="px-6 py-3 bg-zinc-900 text-zinc-400 rounded-xl text-xs font-black uppercase tracking-widest border border-zinc-800 hover:text-white transition-all">
              Dashboard
            </Link>
            <Link to="/admin/orders"
              className="px-6 py-3 bg-zinc-900 text-zinc-400 rounded-xl text-xs font-black uppercase tracking-widest border border-zinc-800 hover:text-white transition-all">
              Batal
            </Link>
            <button onClick={handleLogout}
              className="px-6 py-3 bg-red-500/10 text-red-400 rounded-xl text-xs font-black uppercase tracking-widest border border-red-500/20 hover:bg-red-500/20 transition-all">
              Logout
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
          {/* Customer Info */}
          <section className="bg-[#111] rounded-[2.5rem] border border-white/5 p-8">
            <h3 className="text-lg font-black uppercase tracking-widest text-[#f3ffca] mb-6 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">person</span>
              Informasi Pelanggan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Nama Customer</label>
                <input required className={inputClass} placeholder="Contoh: Budi" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>WA Customer</label>
                <input required className={inputClass} placeholder="62812xxxx" value={customerWA} onChange={e => setCustomerWA(e.target.value)} />
              </div>
            </div>
          </section>

          <div className={`transition-all duration-500 ${!(customerName && customerWA) ? 'pointer-events-none opacity-30 select-none' : ''}`}>
            {!(customerName && customerWA) && (
              <div className="flex items-center gap-3 mb-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-4">
                <span className="material-symbols-outlined text-zinc-500 text-sm">lock</span>
                <span className="text-xs text-zinc-500 font-medium">Isi nama dan WA customer terlebih dahulu.</span>
              </div>
            )}

            {/* Service Type */}
          <section className="bg-[#111] rounded-[2.5rem] border border-white/5 p-8">
            <h3 className="text-lg font-black uppercase tracking-widest text-[#f3ffca] mb-6 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">rocket_launch</span>
              Jenis Layanan
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: 'food', label: 'ARO FOOD', icon: 'restaurant' },
                { id: 'ride', label: 'ARO JEK', icon: 'moped' },
                { id: 'send', label: 'ARO SEND', icon: 'package_2' },
                { id: 'shop', label: 'ARO SHOP', icon: 'shopping_cart' },
              ].map(s => (
                <button key={s.id} type="button" onClick={() => setServiceType(s.id)}
                  className={`p-5 rounded-2xl border text-center transition-all active:scale-[0.98] ${serviceType === s.id ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-[#1a1a1a] border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                  <span className="material-symbols-outlined text-2xl block mb-1">{s.icon}</span>
                  <span className="text-xs font-black uppercase tracking-wider">{s.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Service Details */}
          <section className="bg-[#111] rounded-[2.5rem] border border-white/5 p-8">
            <h3 className="text-lg font-black uppercase tracking-widest text-[#f3ffca] mb-6 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">map</span>
              Detail {serviceType === 'food' ? 'Pesanan Makanan' : serviceType === 'ride' ? 'Perjalanan' : serviceType === 'send' ? 'Kiriman' : 'Belanjaan'}
            </h3>

            {/* FOOD */}
            {serviceType === 'food' && (
              <div className="space-y-6">
                <div className="space-y-2 relative">
                  <label className={labelClass}>Pilih Merchant</label>
                  <div className="relative">
                    <input className={inputClass} placeholder="Cari merchant..." value={merchantSearch} onChange={e => { setMerchantSearch(e.target.value); setShowMerchantDropdown(true); }} onFocus={() => setShowMerchantDropdown(true)} />
                    {foodMerchantName && !merchantSearch && (
                      <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                        <span className="text-sm text-primary font-semibold">{foodMerchantName}</span>
                      </div>
                    )}
                    {showMerchantDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl max-h-48 overflow-y-auto shadow-2xl z-30">
                        {filteredMerchants.map(m => (
                          <button key={m.id} type="button" onClick={() => { setFoodMerchantId(m.id); setFoodMerchantName(m.name); setFoodMerchantLocation(m.location || null); setMerchantSearch(''); setShowMerchantDropdown(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 text-left transition-all">
                            <span className="material-symbols-outlined text-zinc-500 text-lg">store</span>
                            <div>
                              <p className="text-sm font-semibold text-white">{m.name}</p>
                              <p className="text-xs text-zinc-400">{m.category || m.type || '-'}</p>
                            </div>
                          </button>
                        ))}
                        {filteredMerchants.length === 0 && <p className="px-4 py-3 text-xs text-zinc-500">Tidak ada merchant ditemukan</p>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Items table */}
                <div className="space-y-2">
                  <label className={labelClass}>Item Pesanan</label>
                  <div className="space-y-2">
                    {foodItems.map((item, idx) => (
                      <div key={item._id} className="flex gap-2 items-center">
                        <input className={`${inputClass} flex-1`} placeholder="Nama item" value={item.name} onChange={e => updateFoodItem(item._id, 'name', e.target.value)} />
                        <input type="number" min="1" className={`${inputClass} w-20 text-center`} placeholder="Qty" value={item.qty} onChange={e => updateFoodItem(item._id, 'qty', e.target.value)} />
                        <input type="number" min="0" className={`${inputClass} w-28 text-right`} placeholder="Harga" value={item.price} onChange={e => updateFoodItem(item._id, 'price', e.target.value)} />
                        {foodItems.length > 1 && (
                          <button type="button" onClick={() => removeFoodItem(item._id)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all shrink-0">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addFoodItem} className="text-xs text-primary font-bold uppercase tracking-widest flex items-center gap-1 mt-2 hover:opacity-80 transition-all">
                    <span className="material-symbols-outlined text-sm">add</span>
                    Tambah Item
                  </button>
                </div>

                {/* Delivery location */}
                <div className="space-y-2">
                  <label className={labelClass}>Lokasi Pengiriman</label>
                  <button type="button" onClick={() => openLocationPicker('foodDelivery', foodDelivery, (loc) => setFoodDelivery(loc))}
                    className={`w-full ${inputClass} text-left flex items-center justify-between`}>
                    <span className={foodDelivery ? 'text-white' : 'text-zinc-600'}>{foodDelivery?.address || 'Pilih lokasi pengiriman...'}</span>
                    <span className="material-symbols-outlined text-primary text-lg">map</span>
                  </button>
                </div>
              </div>
            )}

            {/* RIDE */}
            {serviceType === 'ride' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className={labelClass}>Titik Jemput</label>
                  <button type="button" onClick={() => openLocationPicker('pickup', ridePickup, (loc) => setRidePickup(loc))}
                    className={`w-full ${inputClass} text-left flex items-center justify-between`}>
                    <span className={ridePickup ? 'text-white' : 'text-zinc-600'}>{ridePickup?.address || 'Pilih titik jemput...'}</span>
                    <span className="material-symbols-outlined text-primary text-lg">map</span>
                  </button>
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Titik Tujuan</label>
                  <button type="button" onClick={() => openLocationPicker('dest', rideDropoff, (loc) => setRideDropoff(loc))}
                    className={`w-full ${inputClass} text-left flex items-center justify-between`}>
                    <span className={rideDropoff ? 'text-white' : 'text-zinc-600'}>{rideDropoff?.address || 'Pilih titik tujuan...'}</span>
                    <span className="material-symbols-outlined text-primary text-lg">map</span>
                  </button>
                </div>
                {distance > 0 && (
                  <div className="bg-primary/5 border border-primary/10 rounded-2xl px-5 py-3 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">straighten</span>
                    <div>
                      <p className="text-xs text-zinc-400 font-medium">Estimasi Jarak</p>
                      <p className="text-sm font-bold text-white">{distance.toFixed(1)} km</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SEND */}
            {serviceType === 'send' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
                  <h4 className="md:col-span-2 text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">person_pin</span> Data Pengirim
                  </h4>
                  <div className="space-y-2">
                    <label className={labelClass}>Nama Pengirim</label>
                    <input className={inputClass} placeholder="Nama pengirim" value={sendSender.name} onChange={e => setSendSender(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>No. HP Pengirim</label>
                    <input className={inputClass} placeholder="628xxxx" value={sendSender.phone} onChange={e => setSendSender(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className={labelClass}>Lokasi Pengirim</label>
                    <button type="button" onClick={() => openLocationPicker('sendPickup', sendSender.lat ? sendSender : null, (loc) => setSendSender(p => ({ ...p, address: loc.address, lat: loc.lat, lng: loc.lng })))}
                      className={`w-full ${inputClass} text-left flex items-center justify-between`}>
                      <span className={sendSender.lat ? 'text-white' : 'text-zinc-600'}>{sendSender.address || 'Pilih lokasi pengirim...'}</span>
                      <span className="material-symbols-outlined text-primary text-lg">map</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
                  <h4 className="md:col-span-2 text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">person_pin</span> Data Penerima
                  </h4>
                  <div className="space-y-2">
                    <label className={labelClass}>Nama Penerima</label>
                    <input className={inputClass} placeholder="Nama penerima" value={sendReceiver.name} onChange={e => setSendReceiver(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>No. HP Penerima</label>
                    <input className={inputClass} placeholder="628xxxx" value={sendReceiver.phone} onChange={e => setSendReceiver(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className={labelClass}>Lokasi Penerima</label>
                    <button type="button" onClick={() => openLocationPicker('sendDropoff', sendReceiver.lat ? sendReceiver : null, (loc) => setSendReceiver(p => ({ ...p, address: loc.address, lat: loc.lat, lng: loc.lng })))}
                      className={`w-full ${inputClass} text-left flex items-center justify-between`}>
                      <span className={sendReceiver.lat ? 'text-white' : 'text-zinc-600'}>{sendReceiver.address || 'Pilih lokasi penerima...'}</span>
                      <span className="material-symbols-outlined text-primary text-lg">map</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Nama Barang</label>
                    <input className={inputClass} placeholder="Contoh: Dokumen" value={sendItemName} onChange={e => setSendItemName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Berat (kg)</label>
                    <input type="number" min="0.1" step="0.1" className={inputClass} value={sendWeight} onChange={e => setSendWeight(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* SHOP */}
            {serviceType === 'shop' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className={labelClass}>Daftar Toko</label>
                  {shopStores.map((store, idx) => (
                    <div key={store._id} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2 bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
                        <input className={inputClass} placeholder="Nama toko" value={store.name} onChange={e => updateShopStore(store._id, 'name', e.target.value)} />
                        <button type="button" onClick={() => openLocationPicker('shopPickup', store.lat ? store : null, (loc) => updateShopStore(store._id, 'address', loc.address) || updateShopStore(store._id, 'lat', loc.lat) || updateShopStore(store._id, 'lng', loc.lng))}
                          className={`w-full ${inputClass} text-left flex items-center justify-between`}>
                          <span className={store.lat ? 'text-white' : 'text-zinc-600'}>{store.address || 'Pilih lokasi toko...'}</span>
                          <span className="material-symbols-outlined text-primary text-lg">map</span>
                        </button>
                      </div>
                      {shopStores.length > 1 && (
                        <button type="button" onClick={() => removeShopStore(store._id)} className="mt-4 w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all shrink-0">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addShopStore} className="text-xs text-primary font-bold uppercase tracking-widest flex items-center gap-1 mt-2 hover:opacity-80 transition-all">
                    <span className="material-symbols-outlined text-sm">add</span>
                    Tambah Toko
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800">
                  <h4 className="md:col-span-2 text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">local_shipping</span> Data Pengiriman
                  </h4>
                  <div className="space-y-2">
                    <label className={labelClass}>Nama Penerima</label>
                    <input className={inputClass} placeholder="Nama penerima" value={shopDelivery.name} onChange={e => setShopDelivery(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>No. HP Penerima</label>
                    <input className={inputClass} placeholder="628xxxx" value={shopDelivery.phone} onChange={e => setShopDelivery(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className={labelClass}>Lokasi Pengiriman</label>
                    <button type="button" onClick={() => openLocationPicker('shopDropoff', shopDelivery.lat ? shopDelivery : null, (loc) => setShopDelivery(p => ({ ...p, address: loc.address, lat: loc.lat, lng: loc.lng })))}
                      className={`w-full ${inputClass} text-left flex items-center justify-between`}>
                      <span className={shopDelivery.lat ? 'text-white' : 'text-zinc-600'}>{shopDelivery.address || 'Pilih lokasi pengiriman...'}</span>
                      <span className="material-symbols-outlined text-primary text-lg">map</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Daftar Belanjaan</label>
                    <textarea rows={4} className={`${inputClass} resize-none`} placeholder="Contoh:&#10;Susu Ultra 1L (2)&#10;Telur 1kg" value={shopList} onChange={e => setShopList(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Estimasi Berat (kg)</label>
                    <input type="number" min="0.1" step="0.5" className={inputClass} value={shopWeight} onChange={e => setShopWeight(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Pricing */}
          <section className="bg-[#111] rounded-[2.5rem] border border-white/5 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black uppercase tracking-widest text-[#f3ffca] flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">payments</span>
                Harga
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Manual</span>
                <div onClick={() => setManualPricing(!manualPricing)} className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${manualPricing ? 'bg-primary' : 'bg-zinc-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${manualPricing ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </div>
              </label>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-zinc-900/50 rounded-xl px-5 py-4 border border-zinc-800">
                <span className="text-sm text-zinc-400 font-medium">Subtotal</span>
                {manualPricing ? (
                  <input type="number" className="w-40 bg-[#1a1a1a] border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white text-right font-bold focus:outline-none focus:border-primary/50" value={manualSubtotal} onChange={e => setManualSubtotal(e.target.value)} />
                ) : (
                  <span className="text-sm font-bold text-white">Rp {computedSubtotal.toLocaleString()}</span>
                )}
              </div>
              <div className="flex items-center justify-between bg-zinc-900/50 rounded-xl px-5 py-4 border border-zinc-800">
                <span className="text-sm text-zinc-400 font-medium">Ongkos Kirim</span>
                {manualPricing ? (
                  <input type="number" className="w-40 bg-[#1a1a1a] border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white text-right font-bold focus:outline-none focus:border-primary/50" value={manualDeliveryFee} onChange={e => setManualDeliveryFee(e.target.value)} />
                ) : (
                  <span className="text-sm font-bold text-white">Rp {autoDeliveryFee.toLocaleString()}</span>
                )}
              </div>
              {!manualPricing && distance > 0 && (
                <div className="flex items-center justify-between bg-zinc-900/30 rounded-xl px-5 py-3 border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Biaya Layanan (appServiceFee)</span>
                  <span className="text-xs text-zinc-400">Rp {appServiceFee.toLocaleString()}</span>
                </div>
              )}
              {!manualPricing && distance > 0 && (
                <div className="flex items-center justify-between bg-zinc-900/30 rounded-xl px-5 py-3 border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Komisi Platform ({Math.round(rate * 100)}%)</span>
                  <span className="text-xs text-zinc-400">Rp {(platformCommission).toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between bg-primary/5 rounded-xl px-5 py-5 border border-primary/10">
                <span className="text-sm font-black uppercase tracking-wider text-primary">Total</span>
                <span className="text-xl font-headline font-black text-primary italic">Rp {total.toLocaleString()}</span>
              </div>
              {distance > 0 && (
                <div className="text-right">
                  <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">Jarak: {distance.toFixed(1)} km</span>
                </div>
              )}
            </div>
          </section>

          {/* Driver Assignment */}
          <section className="bg-[#111] rounded-[2.5rem] border border-white/5 p-8">
            <h3 className="text-lg font-black uppercase tracking-widest text-[#f3ffca] mb-6 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">local_shipping</span>
              Driver (Opsional)
            </h3>
            <div className="space-y-2">
              <select className={inputClass} value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
                <option value="">— Biarkan sistem cari driver —</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name || d.displayName || d.id} {d.plateNumber ? `(${d.plateNumber})` : ''}</option>
                ))}
              </select>
              {selectedDriver && (
                <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Order akan langsung di-assign ke driver ini, melewati sistem dispatch.
                </p>
              )}
              {drivers.length === 0 && (
                <p className="text-[10px] text-zinc-500 font-medium mt-1">Tidak ada driver online saat ini.</p>
              )}
            </div>
          </section>

          {/* Submit */}
          <div className="flex gap-4 pb-12">
            <Link to="/admin/orders" className="flex-1 py-5 rounded-2xl bg-zinc-900 text-zinc-400 font-headline font-black text-sm uppercase tracking-widest border border-zinc-800 text-center hover:text-white transition-all">
              Batal
            </Link>
            <button type="submit" disabled={loading}
              className={`flex-[2] py-5 rounded-2xl font-headline font-black text-sm uppercase tracking-widest active:scale-[0.98] transition-all shadow-lg ${loading ? 'bg-zinc-700 text-zinc-500' : 'bg-primary text-black'}`}>
              {loading ? 'MEMPROSES...' : 'GAS PESANAN!'}
            </button>
          </div>
          </div>
        </form>
      </main>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={locPickerOpen}
        onClose={() => setLocPickerOpen(false)}
        onConfirm={(loc) => { if (locPickerCallback) locPickerCallback(loc); }}
        initialLocation={locPickerInitial}
        mode={locPickerMode}
      />
    </div>
  );
};

export default AdminOrderCreate;
