import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';
import {
  calculateDistance,
} from '../utils/mapConfig';

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

  const [showAddressPicker, setShowAddressPicker] = useState(false);

  // Initialize store with one shop if empty on mount
  useEffect(() => {
    if (shopPickups && shopPickups.length === 0) {
      addShopPickup();
    }
  }, [shopPickups, addShopPickup]);

  const [delivery, setDelivery] = useState({ 
    name: shopDropoff?.name || '', 
    phone: shopDropoff?.phone || '', 
    address: shopDropoff?.address || '', 
    latlng: shopDropoff?.lat && shopDropoff?.lng ? { lat: shopDropoff.lat, lng: shopDropoff.lng } : null 
  });

  // Auto-fill for member on mount if data is empty
  useEffect(() => {
    if (user && !delivery.name && !delivery.address) {
      const homeAddr = savedAddresses.find(a => a.label?.toLowerCase() === 'rumah');
      setDelivery({
        name: user.displayName || '',
        phone: user.whatsapp || '',
        address: homeAddr?.address || '',
        latlng: homeAddr?.lat ? { lat: homeAddr.lat, lng: homeAddr.lng } : null
      });
    }
  }, [user]);

  const selectSavedAddress = (addr) => {
    setDelivery({
      ...delivery,
      address: addr.address,
      latlng: { lat: addr.lat, lng: addr.lng }
    });
    setShowAddressPicker(false);
  };

  // UI States
  const [distance, setDistance] = useState(0);
  const [totalFee, setTotalFee] = useState(0);

  // Shop helpers
  const addShop = () => {
    addShopPickup();
  };

  const removeShop = (id) => {
    if (shopPickups.length <= 1) return;
    removeShopPickup(id);
  };

  const updateShop = (id, field, value) => {
    updateShopPickup(id, field, value);
  };

  // Update distance & fee
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
    setTotalFee(calculateFee(totalDist || 0, 'tip', Number(shopWeight || 0)));
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
      alert("Mohon lengkapi semua data lokasi toko dan pilih titik di peta.");
      return;
    }
    if (!delivery.name || !delivery.phone || !delivery.address || !delivery.latlng) {
      alert("Mohon lengkapi data penerima dan pilih titik pengiriman di peta.");
      return;
    }

    const convertedShops = shopPickups.map(s => ({
      ...s,
      latlng: [s.lat, s.lng]
    }));

    setRouteDetails({
      type: 'shop',
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

  return (
    <div className="bg-background min-h-screen pb-40 text-white font-body">
      <main className="max-w-xl mx-auto px-6 space-y-6 mt-6">
        <div className="mb-4">
          <h2 className="font-headline font-black text-xl tracking-tight text-primary uppercase italic">Belanja Bulanan</h2>
          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mt-1 opacity-70">Layanan Jastip Belanja Satset</p>
        </div>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">shopping_cart</span>
            <h2 className="font-headline font-extrabold text-lg uppercase tracking-wider">Daftar Belanjaan</h2>
          </div>
          <div className="bg-[#131313] p-6 rounded-[2rem] space-y-5 border border-white/5 shadow-lg">
            <div>
              <label className="font-label text-[10px] uppercase text-on-surface-variant ml-1 tracking-widest font-bold">List Barang</label>
              <textarea
                value={shopList}
                onChange={(e) => setShopList(e.target.value)}
                className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 resize-none mt-2 leading-relaxed"
                placeholder={"Tulis daftar belanjaan Anda di sini\nContoh:\n- Susu Indomilk 2 kotak\n- Roti Tawar 1\n- Kopi Kapal Api 3 sachet\n- Telur 1 kg"}
                rows="6"
              ></textarea>
            </div>
            <div>
              <label className="font-label text-[10px] uppercase text-on-surface-variant ml-1 tracking-widest font-bold">Estimasi Berat (KG)</label>
              <input
                value={shopWeight}
                onChange={(e) => setShopWeight(Number(e.target.value) || 0)}
                className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 mt-2"
                placeholder="Perkiraan berat total belanjaan"
                type="number"
                min="0.5"
                step="0.5"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ece856]">storefront</span>
            <h2 className="font-headline font-extrabold text-lg uppercase tracking-wider">Lokasi Toko</h2>
          </div>

          {shopPickups.map((shop, index) => (
            <div key={shop.id} className="bg-[#131313] p-6 rounded-[2rem] space-y-5 border border-white/5 shadow-lg relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-headline font-black uppercase tracking-widest text-on-surface-variant">Toko {index + 1}</span>
                  {index === 0 && (
                    <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/20 text-primary px-2 py-0.5 rounded-full">wajib</span>
                  )}
                </div>
                {index > 0 && (
                  <button onClick={() => removeShop(shop.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                    <span className="material-symbols-outlined text-sm">close</span>
                    Hapus
                  </button>
                )}
              </div>

              <div>
                <label className="font-label text-[10px] uppercase text-on-surface-variant ml-1 tracking-widest font-bold">Nama Toko / Pasar</label>
                <input
                  value={shop.name}
                  onChange={(e) => updateShop(shop.id, 'name', e.target.value)}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 mt-2"
                  placeholder="Contoh: Pasar Legi Blitar"
                  type="text"
                />
              </div>
              <div className="relative group">
                <label className="font-label text-[10px] uppercase text-on-surface-variant ml-1 tracking-widest font-bold">Alamat Toko</label>
                <textarea
                  value={shop.address}
                  onChange={(e) => updateShop(shop.id, 'address', e.target.value)}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 resize-none mt-2"
                  placeholder="Alamat lengkap toko/pasar"
                  rows="3"
                ></textarea>
                <button
                  onClick={() => handlePickLocation('shop', index)}
                  className={`absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md ${shop.lat ? 'bg-primary text-black' : 'bg-primary-container text-on-primary-container'}`}
                >
                  <span className="material-symbols-outlined text-sm">{shop.lat ? 'check_circle' : 'map'}</span>
                  {shop.lat ? 'Titik Oke' : 'Pilih di Peta'}
                </button>
              </div>
            </div>
          ))}

          <button onClick={addShop} className="w-full py-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/40 text-on-surface-variant hover:text-primary flex items-center justify-center gap-2 transition-all">
            <span className="material-symbols-outlined">add_circle_outline</span>
            <span className="text-sm font-bold uppercase tracking-wider">Tambah Toko Lain</span>
          </button>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ffeea5]">home_pin</span>
              <h2 className="font-headline font-extrabold text-lg uppercase tracking-wider">Lokasi Pengiriman</h2>
            </div>
            {user && savedAddresses.length > 0 && (
              <button 
                onClick={() => setShowAddressPicker(true)}
                className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <span className="material-symbols-outlined text-sm">bookmark_heart</span>
                Pilih Alamat
              </button>
            )}
          </div>

          {/* Saved Address Picker Overlay */}
          {showAddressPicker && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
               <div className="w-full max-w-xl bg-surface-container-high rounded-[2.5rem] p-6 space-y-4 shadow-2xl border border-white/10 animate-in slide-in-from-bottom-10 duration-300">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-headline font-black text-lg text-primary uppercase italic">Pilih Alamat</h3>
                    <button onClick={() => setShowAddressPicker(false)} className="text-on-surface-variant">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-none">
                    {savedAddresses.map(addr => (
                      <button 
                        key={addr.id}
                        onClick={() => selectSavedAddress(addr)}
                        className="w-full flex items-center gap-4 bg-surface-container-low p-4 rounded-2xl border border-white/5 hover:border-primary/40 transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-sm">
                            {addr.label?.toLowerCase() === 'rumah' ? 'home' : addr.label?.toLowerCase() === 'kantor' ? 'work' : 'push_pin'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs uppercase tracking-tight text-white mb-0.5">{addr.label}</p>
                          <p className="text-[10px] text-on-surface-variant italic truncate">{addr.address}</p>
                        </div>
                        <span className="material-symbols-outlined text-primary text-sm">chevron_right</span>
                      </button>
                    ))}
                  </div>
               </div>
            </div>
          )}

          <div className="bg-[#131313] p-6 rounded-[2rem] space-y-5 border border-white/5 shadow-lg">
            <input value={delivery.name} onChange={(e) => setDelivery({ ...delivery, name: e.target.value })} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5" placeholder="Nama Penerima" type="text" />
            <input value={delivery.phone} onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5" placeholder="No. HP Penerima" type="tel" />
            <div className="relative group">
              <textarea value={delivery.address} onChange={(e) => setDelivery({ ...delivery, address: e.target.value })} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 resize-none" placeholder="Alamat Lengkap Pengiriman" rows="3"></textarea>
              <button
                onClick={() => handlePickLocation('delivery')}
                className={`absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md ${delivery.latlng ? 'bg-primary text-black' : 'bg-primary-container text-on-primary-container'}`}
              >
                <span className="material-symbols-outlined text-sm">{delivery.latlng ? 'check_circle' : 'location_on'}</span>
                {delivery.latlng ? 'Titik Oke' : 'Pilih di Peta'}
              </button>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 w-full z-50">
        <div className="max-w-xl mx-auto bg-[#262626]/80 backdrop-blur-2xl rounded-t-[32px] px-8 pt-6 pb-10 shadow-[0_-8px_48px_rgba(0,0,0,0.5)] border-t border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#f3ffca]/60">Est. Jarak: {(distance || 0).toFixed(2)} KM</p>
                <span className="text-[10px] text-on-surface-variant">•</span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#ece856]/80">🏪 {shopPickups.length} Toko</p>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xs font-bold text-primary italic">IDR</span>
                <span className="text-3xl font-headline font-black text-white">{totalFee.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={handleCheckout}
              className={`px-8 py-4 rounded-full font-headline font-extrabold text-lg flex items-center gap-3 active:scale-95 transition-all ${distance > 0 ? 'bg-gradient-to-br from-[#cafd00] to-[#f3ffca] text-black shadow-lg shadow-primary/20' : 'bg-zinc-700 text-zinc-500 opacity-50'}`}
            >
              Pesan Sekarang
              <span className="material-symbols-outlined font-bold">rocket_launch</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AroShop;
