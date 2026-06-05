import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, limit, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../store/adminStore';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';
import {
  calculateDistance,
  getMapOptions
} from '../utils/mapConfig';
import { useThemeStore } from '../store/themeStore';

function AroShop() {
  const navigate = useNavigate();
  const { 
    calculateFee, setRouteDetails,
    shopPickups, shopDropoff,
    setShopPickups, setShopDropoff,
    addShopPickup, removeShopPickup, updateShopPickup,
    shopList, setShopList, shopWeight, setShopWeight
  } = useOrderStore();
  const { user, savedAddresses } = useUserStore();
  const { ui } = useAdminStore();
  const { theme } = useThemeStore();
  const shopUI = ui.aroShop;
  const commonUI = ui.common;

  // Local UI States

  const [shopMode, setShopMode] = useState('auto'); // Default to auto
  const [merchants, setMerchants] = useState([]);
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(false);
  const [merchantSearch, setMerchantSearch] = useState('');
  const [isOrderDetailsExpanded, setIsOrderDetailsExpanded] = useState(false);
  
  const [delivery, setDelivery] = useState({ 
    name: shopDropoff?.name || '', 
    phone: shopDropoff?.phone || '', 
    address: shopDropoff?.address || '', 
    latlng: shopDropoff?.lat && shopDropoff?.lng ? { lat: shopDropoff.lat, lng: shopDropoff.lng } : null 
  });

  // Fetch shops/merchants for auto mode
  useEffect(() => {
    const fetchShops = async () => {
      setIsLoadingMerchants(true);
      try {
        const q = query(collection(db, "merchants"), where("type", "==", "shop"), limit(200));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMerchants(list);
      } catch (e) {
        console.error("Error fetching shops:", e);
      } finally {
        setIsLoadingMerchants(false);
      }
    };
    fetchShops();
  }, []);

  const filteredMerchants = useMemo(() => {
    let filtered = merchants;
    if (merchantSearch) {
      const search = merchantSearch.toLowerCase();
      filtered = merchants.filter(m => 
        (m.name || '').toLowerCase().includes(search) || 
        (m.category || '').toLowerCase().includes(search) ||
        (m.address || '').toLowerCase().includes(search)
      );
    }

    const userLoc = delivery?.latlng || (shopDropoff?.lat ? { lat: shopDropoff.lat, lng: shopDropoff.lng } : null);
    
    // Compute distances exactly once per merchant
    const withDistance = filtered.map(m => {
      const getLoc = (x) => {
        if (x.lat && x.lng) return { lat: Number(x.lat), lng: Number(x.lng) };
        if (x.location?.lat && x.location?.lng) return { lat: Number(x.location.lat), lng: Number(x.location.lng) };
        return null;
      };
      const loc = getLoc(m);
      const dist = (userLoc && loc) ? calculateDistance(userLoc, loc) : 0;
      return { ...m, distance: dist };
    });

    if (userLoc && withDistance.length > 0) {
      return [...withDistance].sort((a, b) => {
        const typePriority = (t) => (t === 'shop' ? 0 : 1);
        const prioA = typePriority(a.type);
        const prioB = typePriority(b.type);
        if (prioA !== prioB) return prioA - prioB;

        return a.distance - b.distance;
      });
    }
    return withDistance;
  }, [merchants, merchantSearch, delivery.latlng, shopDropoff]);

  const handleToggleMerchant = (merchant) => {
    const isAlreadySelected = shopPickups.find(s => s.place_id === merchant.place_id || s.name === merchant.name);
    
    if (isAlreadySelected) {
      if (shopPickups.length > 1) {
        removeShopPickup(isAlreadySelected.id);
      } else {
        updateShopPickup(shopPickups[0].id, 'name', '');
        updateShopPickup(shopPickups[0].id, 'address', '');
        updateShopPickup(shopPickups[0].id, 'lat', null);
        updateShopPickup(shopPickups[0].id, 'lng', null);
        updateShopPickup(shopPickups[0].id, 'place_id', null);
      }
    } else {
      const getLoc = (m) => {
        if (m.lat && m.lng) return { lat: Number(m.lat), lng: Number(m.lng) };
        if (m.location?.lat && m.location?.lng) return { lat: Number(m.location.lat), lng: Number(m.location.lng) };
        return { lat: null, lng: null };
      };
      const loc = getLoc(merchant);
      
      if (!shopPickups[0].name) {
        updateShopPickup(shopPickups[0].id, 'name', merchant.name);
        updateShopPickup(shopPickups[0].id, 'address', merchant.address);
        updateShopPickup(shopPickups[0].id, 'lat', loc.lat);
        updateShopPickup(shopPickups[0].id, 'lng', loc.lng);
        updateShopPickup(shopPickups[0].id, 'place_id', merchant.place_id || merchant.id);
      } else {
        addShopPickup({
          name: merchant.name,
          address: merchant.address,
          lat: loc.lat,
          lng: loc.lng,
          place_id: merchant.place_id || merchant.id
        });
      }
    }
  };

  useEffect(() => {
    if (shopPickups && shopPickups.length === 0) {
      addShopPickup();
    }
  }, [shopPickups, addShopPickup]);

  useEffect(() => {
    if (shopDropoff) {
      setDelivery({
        name: shopDropoff.name || delivery.name,
        phone: shopDropoff.phone || delivery.phone,
        address: shopDropoff.address || delivery.address,
        latlng: shopDropoff.lat && shopDropoff.lng ? { lat: shopDropoff.lat, lng: shopDropoff.lng } : delivery.latlng
      });
    }
  }, [shopDropoff]);

  useEffect(() => {
    if (user && !delivery.name && !delivery.address && !shopDropoff) {
      const homeAddr = savedAddresses.find(a => a.label?.toLowerCase() === 'rumah');
      const newDelivery = {
        name: user.displayName || '',
        phone: user.whatsapp || '',
        address: homeAddr?.address || '',
        latlng: homeAddr?.lat ? { lat: homeAddr.lat, lng: homeAddr.lng } : null
      };
      setDelivery(newDelivery);
      setShopDropoff({ ...newDelivery, ...newDelivery.latlng });
    }
  }, [user, shopDropoff]);



  const [distance, setDistance] = useState(0);
  const [totalFee, setTotalFee] = useState(0);

  useEffect(() => {
    const filledShops = shopPickups.filter(s => s.lat && s.lng);
    if (filledShops.length === 0 || !delivery.latlng) {
      setDistance(0);
      setTotalFee(0);
      return;
    }

    let totalDist = 0;
    for (let i = 1; i < filledShops.length; i++) {
      const p1 = { lat: filledShops[i-1].lat, lng: filledShops[i-1].lng };
      const p2 = { lat: filledShops[i].lat, lng: filledShops[i].lng };
      totalDist += calculateDistance(p1, p2);
    }
    const lastShop = filledShops[filledShops.length - 1];
    totalDist += calculateDistance({ lat: lastShop.lat, lng: lastShop.lng }, delivery.latlng);

    setDistance(totalDist || 0);
    setTotalFee(calculateFee(totalDist || 0, 'shop', Number(shopWeight || 0)));
  }, [shopPickups, delivery.latlng, shopWeight, calculateFee]);

  const handlePickLocation = (type, shopIndex) => {
    if (type === 'delivery') {
      navigate('/location-picker?mode=shopDropoff');
    } else {
      navigate(`/location-picker?mode=shopPickup&index=${shopIndex}`);
    }
  };

  const handleCheckout = () => {
    const invalidShop = shopPickups.find(s => !s.name || !s.address || !s.lat || !s.lng);
    if (invalidShop) {
      alert(commonUI.errorIncomplete || "Mohon lengkapi semua data lokasi toko dan pilih titik di peta.");
      return;
    }
    if (!delivery.name || !delivery.phone || !delivery.address || !delivery.latlng) {
      alert(commonUI.errorIncomplete || "Mohon lengkapi data penerima dan pilih titik pengiriman di peta.");
      return;
    }

    const convertedShops = shopPickups.map(s => ({
      ...s,
      latlng: [s.lat, s.lng]
    }));

    setRouteDetails({
      type: 'shop',
      serviceType: 'shop',
      shopLocations: convertedShops,
      delivery: { ...delivery, latlng: [delivery.latlng.lat, delivery.latlng.lng] },
      items: shopList,
      weight: shopWeight,
      distance,
      fee: totalFee,
      pickup: [shopPickups[0].lat, shopPickups[0].lng],
      dropoff: [delivery.latlng.lat, delivery.latlng.lng]
    });
    
    navigate('/checkout');
  };

  const handleModeChange = (mode) => {
    if (mode !== shopMode) {
      setShopMode(mode);
      setShopPickups([{ id: Date.now(), name: '', address: '', lat: null, lng: null }]);
    }
  };

  return (
    <div className="bg-background min-h-screen pb-48 text-on-surface font-body overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 z-[60] bg-background/80 backdrop-blur-xl border-b border-outline px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 mb-0.5">Antar Ke</p>
            <button 
              onClick={() => navigate('/location-picker?mode=shopDropoff')}
              className="flex items-center gap-2 w-full text-left group"
            >
              <span className="material-symbols-outlined text-primary text-xl flex-none">location_on</span>
              <span className="text-xs font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                {delivery.address || 'Pilih Lokasi Pengiriman...'}
              </span>
              <span className="material-symbols-outlined text-on-surface-variant/20 text-sm">map</span>
            </button>
          </div>
          <div className="flex bg-surface-container-highest p-1 rounded-2xl border border-outline shadow-inner">
            <button 
              onClick={() => handleModeChange('auto')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${shopMode === 'auto' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Otomatis
            </button>
            <button 
              onClick={() => handleModeChange('manual')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${shopMode === 'manual' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Manual
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 space-y-8 pt-28">
        {/* Quick Saved Addresses Bar */}
        {savedAddresses.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mt-4 -mx-6 px-6">
            {savedAddresses.map(addr => (
              <button
                key={addr.id}
                onClick={() => {
                  setDelivery({
                    address: addr.address,
                    lat: addr.lat,
                    lng: addr.lng,
                    name: user?.name || '',
                    phone: user?.phone || ''
                  });
                  // Also sync to store
                  setShopDropoff({ address: addr.address, lat: addr.lat, lng: addr.lng });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-on-surface/5 border border-outline rounded-full flex-none hover:bg-primary/10 hover:border-primary/30 transition-all group"
              >
                <span className="material-symbols-outlined text-primary text-sm">
                  {addr.label?.toLowerCase() === 'rumah' ? 'home' : addr.label?.toLowerCase() === 'kantor' ? 'work' : 'push_pin'}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">{addr.label}</span>
              </button>
            ))}
            <button
               onClick={() => navigate('/saved-addresses')}
               className="flex items-center gap-2 px-4 py-2 bg-on-surface/5 border border-outline rounded-full flex-none opacity-40 hover:opacity-100 transition-all"
            >
               <span className="material-symbols-outlined text-sm">settings</span>
            </button>
          </div>
        )}

        <div>
          <h2 className="font-headline font-black text-3xl tracking-tight text-on-surface mb-1">
            {shopMode === 'auto' ? 'Mau belanja kemana?' : 'Input Belanja Manual'}
          </h2>
          <p className="text-on-surface-variant text-[11px] uppercase font-bold tracking-widest opacity-60">
            {shopMode === 'auto' ? 'Pilih satu atau beberapa toko terdekat' : 'Tuliskan toko dan barang sesuka hati'}
          </p>
        </div>

        {shopMode === 'auto' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {shopPickups.some(s => s.name) && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 -mx-2 px-2">
                {shopPickups.filter(s => s.name).map(s => (
                  <div key={s.id} className="bg-primary/10 border border-primary/20 rounded-full px-4 py-2 flex items-center gap-2 flex-none animate-in zoom-in-95 duration-200">
                    <span className="text-[10px] font-black text-primary uppercase whitespace-nowrap">{s.name}</span>
                    <button onClick={() => removeShopPickup(s.id)} className="text-primary hover:text-on-surface transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 text-xl group-focus-within:text-primary transition-colors">search</span>
              <input 
                type="text"
                value={merchantSearch}
                onChange={(e) => setMerchantSearch(e.target.value)}
                placeholder={shopUI.searchPlaceholder || "Cari Minimarket, Pasar, atau Toko..."}
                className="w-full bg-surface-container-highest border border-outline rounded-[1.5rem] py-5 pl-12 pr-6 text-sm focus:border-primary/50 focus:bg-surface-container-high transition-all shadow-xl"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              {isLoadingMerchants ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-[0.2em]">Mencari Merchant Terbaik...</p>
                </div>
              ) : filteredMerchants.length > 0 ? (
                filteredMerchants.map(m => {
                  const isSelected = shopPickups.some(s => s.place_id === m.place_id || s.name === m.name);
                  return (
                    <div 
                      key={m.id}
                      onClick={() => handleToggleMerchant(m)}
                      className={`relative overflow-hidden bg-surface-container-low p-5 rounded-[2rem] border transition-all duration-300 cursor-pointer group flex items-center gap-5 ${isSelected ? 'border-primary ring-1 ring-primary shadow-lg shadow-primary/10' : 'border-outline hover:border-on-surface/20'}`}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex-none overflow-hidden relative border border-outline">
                        {m.image ? (
                          <img src={m.image} alt={m.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-primary/30 bg-gradient-to-br from-on-surface/5 to-transparent">
                             <span className="material-symbols-outlined text-3xl">{m.type === 'shop' ? 'storefront' : 'restaurant'}</span>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center backdrop-blur-[2px]">
                            <span className="material-symbols-outlined text-primary text-3xl font-black">check</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-black text-base transition-colors truncate ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{m.name}</h4>
                        </div>
                        <p className="text-[11px] text-on-surface-variant line-clamp-1 opacity-60 mb-2 italic">{m.address}</p>
                        <div className="flex items-center gap-3">
                          {m.rating > 0 && (
                            <div className="flex items-center gap-1 bg-on-surface/5 px-2 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-[12px] text-primary" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                              <span className="text-[10px] font-black text-on-surface/70">{m.rating}</span>
                            </div>
                          )}
                          <div className="text-[10px] font-black text-primary/80 uppercase tracking-tighter bg-primary/5 px-2 py-0.5 rounded-full">
                            ± {Number(m.distance || 0).toFixed(1)} KM
                          </div>
                        </div>
                      </div>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-primary text-on-primary' : 'bg-on-surface/5 text-on-surface-variant group-hover:bg-on-surface/10'}`}>
                        <span className="material-symbols-outlined">{isSelected ? 'remove_circle' : 'add_circle'}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center bg-surface-container-low rounded-[2.5rem] border border-dashed border-outline">
                  <span className="material-symbols-outlined text-6xl text-on-surface-variant/5 mb-4">storefront_off</span>
                  <p className="text-sm text-on-surface-variant/20 font-black uppercase tracking-widest">Tidak ada merchant di area ini</p>
                </div>
              )}
            </div>
          </div>
        )}

        {shopMode === 'manual' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {shopPickups.map((shop, index) => (
              <div key={shop.id} className="bg-surface-container-low p-6 rounded-[2.5rem] space-y-6 border border-outline shadow-2xl relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                      {index + 1}
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">Detail Toko {index + 1}</span>
                  </div>
                  {index > 0 && (
                    <button onClick={() => removeShopPickup(shop.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/10">
                      <span className="material-symbols-outlined text-sm">delete</span>
                      Hapus
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="font-label text-[10px] uppercase text-on-surface-variant ml-2 tracking-[0.2em] font-black">Nama Toko / Pasar</label>
                    <input
                      value={shop.name}
                      onChange={(e) => updateShopPickup(shop.id, 'name', e.target.value)}
                      className="w-full bg-surface-container-highest border-outline rounded-2xl py-5 px-6 mt-2 focus:border-primary/40 transition-all text-on-surface"
                      placeholder="Contoh: Pasar Legi Blitar"
                      type="text"
                    />
                  </div>
                  <div className="relative group">
                    <label className="font-label text-[10px] uppercase text-on-surface-variant ml-2 tracking-[0.2em] font-black">Alamat Lengkap</label>
                    <textarea
                      value={shop.address}
                      onChange={(e) => updateShopPickup(shop.id, 'address', e.target.value)}
                      className="w-full bg-surface-container-highest border-outline rounded-2xl py-5 px-6 resize-none mt-2 pr-28 text-on-surface"
                      placeholder="Alamat lengkap toko untuk memudahkan driver"
                      rows="3"
                    ></textarea>
                    <button
                      onClick={() => handlePickLocation('shop', index)}
                      className={`absolute bottom-5 right-5 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${shop.lat ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-primary border border-primary/20'}`}
                    >
                      <span className="material-symbols-outlined text-sm">{shop.lat ? 'check_circle' : 'map'}</span>
                      {shop.lat ? 'Titik Oke' : 'Pilih Map'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button onClick={() => addShopPickup()} className="w-full py-6 rounded-[2rem] border-2 border-dashed border-outline hover:border-primary/40 text-on-surface-variant hover:text-primary flex items-center justify-center gap-3 transition-all group bg-on-surface/[0.02]">
              <span className="material-symbols-outlined group-hover:scale-125 transition-transform">add_circle</span>
              <span className="text-xs font-black uppercase tracking-[0.2em]">Tambah Lokasi Toko Lain</span>
            </button>
          </div>
        )}

      </main>

      <div className="fixed bottom-0 left-0 w-full z-[70] pointer-events-none">
        <motion.div 
          animate={{ y: isOrderDetailsExpanded ? 0 : 'calc(100% - 130px)' }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="max-w-xl mx-auto bg-surface-container-high/95 backdrop-blur-3xl rounded-t-[3rem] shadow-[0_-12px_60px_rgba(0,0,0,0.6)] border-t border-outline overflow-hidden pointer-events-auto"
        >
          <div 
            onClick={() => setIsOrderDetailsExpanded(!isOrderDetailsExpanded)}
            className="w-full py-4 flex flex-col items-center cursor-pointer group"
          >
            <div className="w-12 h-1.5 bg-on-surface/10 rounded-full group-hover:bg-primary/40 transition-colors mb-2"></div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-on-surface-variant group-hover:text-primary transition-colors">
              {isOrderDetailsExpanded ? 'Tarik kebawah untuk sembunyi' : 'Lihat Detail Pesanan'}
            </p>
          </div>

          <div className="px-8 pb-10 space-y-8 max-h-[80vh] overflow-y-auto no-scrollbar">
            <div className="space-y-6 pt-2">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-2xl">assignment_add</span>
                <h2 className="font-headline font-black text-xl tracking-tight uppercase italic text-on-surface">Konfigurasi Pesanan</h2>
              </div>

              <div className="bg-surface-container-low p-6 rounded-[2rem] space-y-6 border border-outline">
                <div>
                  <label className="font-label text-[10px] uppercase text-on-surface-variant ml-2 tracking-[0.2em] font-black">Apa yang mau dibeli?</label>
                  <textarea
                    value={shopList}
                    onChange={(e) => setShopList(e.target.value)}
                    className="w-full bg-surface-container-highest border-none rounded-[1.5rem] py-4 px-5 resize-none mt-3 leading-relaxed min-h-[120px] text-sm focus:ring-2 ring-primary/20 transition-all text-on-surface"
                    placeholder={shopUI.itemPlaceholder || "Contoh:\n- Susu Ultra 1L (2)\n- Telur Ayam 1kg\n- Kopi Kapal Api 1 bks"}
                  ></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container-highest p-4 rounded-2xl border border-outline">
                    <label className="font-label text-[10px] uppercase text-on-surface-variant tracking-widest font-black block mb-2">Estimasi Berat</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={shopWeight}
                        onChange={(e) => setShopWeight(Number(e.target.value) || 0)}
                        className="w-full bg-transparent border-none p-0 text-lg font-black text-on-surface focus:ring-0"
                        placeholder="0"
                        type="number"
                      />
                      <span className="text-[10px] font-black text-primary italic">KG</span>
                    </div>
                  </div>
                  <div className="bg-surface-container-highest p-4 rounded-2xl border border-outline">
                    <label className="font-label text-[10px] uppercase text-on-surface-variant tracking-widest font-black block mb-2">Jumlah Toko</label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-on-surface">{shopPickups.filter(s => s.name).length}</span>
                      <span className="text-[10px] font-black text-primary italic uppercase tracking-tighter">Store</span>
                    </div>
                  </div>
                </div>
              </div>
 
              <div className="bg-surface-container-low p-6 rounded-[2rem] space-y-6 border border-outline">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">person_pin</span>
                  </div>
                  <h3 className="font-headline font-black text-lg tracking-tight uppercase italic text-on-surface">Data Penerima</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="font-label text-[10px] uppercase text-on-surface-variant ml-2 tracking-[0.2em] font-black">Nama Penerima</label>
                    <input
                      value={delivery.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDelivery(prev => ({ ...prev, name: val }));
                        setShopDropoff({ ...delivery, name: val, ...delivery.latlng });
                      }}
                      className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-5 mt-2 focus:ring-2 ring-primary/20 transition-all text-sm text-on-surface"
                      placeholder="Nama lengkap penerima"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="font-label text-[10px] uppercase text-on-surface-variant ml-2 tracking-[0.2em] font-black">Nomor WhatsApp</label>
                    <input
                      value={delivery.phone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDelivery(prev => ({ ...prev, phone: val }));
                        setShopDropoff({ ...delivery, phone: val, ...delivery.latlng });
                      }}
                      className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-5 mt-2 focus:ring-2 ring-primary/20 transition-all text-sm text-on-surface"
                      placeholder="08123456789"
                      type="tel"
                    />
                  </div>
                  <button 
                    onClick={() => navigate('/location-picker?mode=shopDropoff')}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-on-primary transition-all border border-primary/20"
                  >
                    <span className="material-symbols-outlined text-sm">map</span>
                    {delivery.latlng ? 'Ubah Titik Lokasi Pengiriman' : 'Pilih Titik Lokasi Pengiriman'}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-outline">
              <div className="flex items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 overflow-hidden">
                    <div className="flex items-center gap-1 bg-on-surface/5 px-2 py-0.5 rounded-full flex-none">
                      <span className="material-symbols-outlined text-[10px] text-primary">distance</span>
                      <span className="text-[9px] font-black text-on-surface-variant uppercase">{(distance || 0).toFixed(1)} KM</span>
                    </div>
                    <div className="flex items-center gap-1 bg-on-surface/5 px-2 py-0.5 rounded-full flex-none">
                      <span className="material-symbols-outlined text-[10px] text-primary">shopping_bag</span>
                      <span className="text-[9px] font-black text-on-surface-variant uppercase">{shopWeight || 0} KG</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black text-primary italic">IDR</span>
                    <span className="text-4xl font-headline font-black text-on-surface tracking-tighter">
                      {totalFee.toLocaleString()}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={handleCheckout}
                  disabled={!distance || distance === 0}
                  className={`flex-none h-16 px-10 rounded-[1.5rem] font-headline font-black text-lg flex items-center gap-3 active:scale-95 transition-all duration-300 ${distance > 0 ? 'bg-gradient-to-br from-primary to-[#f3ffca] text-on-primary shadow-2xl shadow-primary/30' : 'bg-on-surface/5 text-on-surface-variant/10 grayscale'}`}
                >
                  {shopUI.confirmBtn || "ORDER"}
                  <span className="material-symbols-outlined font-black">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>


    </div>
  );
}

export default AroShop;
