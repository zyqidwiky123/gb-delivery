import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';
import { 
  calculateDistance,
} from '../utils/mapConfig';

const containerStyle = { width: '100%', height: '100%' };

function AroSend() {
  const navigate = useNavigate();
  const { 
    calculateFee, setRouteDetails,
    sendPickup, sendDropoff,
  } = useOrderStore();

  const { user, savedAddresses } = useUserStore();
  
  // Form States
  const [sender, setSender] = useState({ name: '', phone: '', address: '', latlng: null });
  const [receiver, setReceiver] = useState({ name: '', phone: '', address: '', latlng: null });
  const [item, setItem] = useState({ name: '', weight: 1 });

  // UI States
  const [distance, setDistance] = useState(0);
  const [totalFee, setTotalFee] = useState(0);
  const [addressPickerTarget, setAddressPickerTarget] = useState(null); // 'sender' or 'receiver'

  // Sync with Store Locations
  useEffect(() => {
    if (sendPickup && sendPickup.lat && sendPickup.lng) {
      setSender(prev => ({ 
        ...prev, 
        address: sendPickup.address, 
        latlng: { lat: sendPickup.lat, lng: sendPickup.lng } 
      }));
    }
  }, [sendPickup]);

  useEffect(() => {
    if (sendDropoff && sendDropoff.lat && sendDropoff.lng) {
      setReceiver(prev => ({ 
        ...prev, 
        address: sendDropoff.address, 
        latlng: { lat: sendDropoff.lat, lng: sendDropoff.lng } 
      }));
    }
  }, [sendDropoff]);

  // Auto-fill member data on mount
  useEffect(() => {
    if (user && !sender.name) {
      const homeAddr = savedAddresses.find(a => a.label?.toLowerCase() === 'rumah');
      setSender({
        name: user.displayName || '',
        phone: user.whatsapp || '',
        address: homeAddr?.address || '',
        latlng: homeAddr?.lat ? { lat: homeAddr.lat, lng: homeAddr.lng } : null
      });
    }
  }, [user]);

  const selectSavedAddress = (addr) => {
    if (addressPickerTarget === 'sender') {
      setSender({ ...sender, address: addr.address, latlng: { lat: addr.lat, lng: addr.lng } });
    } else {
      setReceiver({ ...receiver, address: addr.address, latlng: { lat: addr.lat, lng: addr.lng } });
    }
    setAddressPickerTarget(null);
  };

  // Update distance & fee
  useEffect(() => {
    if (sender.latlng && receiver.latlng) {
      const d = calculateDistance(sender.latlng, receiver.latlng);
      setDistance(d);
      setTotalFee(calculateFee(d, 'send', Number(item.weight || 0)));
    }
  }, [sender.latlng, receiver.latlng, item.weight, calculateFee]);

  const handlePickLocation = (mode) => {
    navigate(`/location-picker?mode=${mode === 'sender' ? 'sendPickup' : 'sendDropoff'}`);
  };

  const handleCheckout = () => {
    if (!sender.name || !sender.address || !sender.phone || !sender.latlng ||
        !receiver.name || !receiver.address || !receiver.phone || !receiver.latlng ||
        !item.name) {
      alert("Mohon lengkapi semua data pengirim, penerima, item, dan titik peta.");
      return;
    }

    setRouteDetails({
      type: 'send',
      sender: { ...sender, latlng: [sender.latlng.lat, sender.latlng.lng] },
      receiver: { ...receiver, latlng: [receiver.latlng.lat, receiver.latlng.lng] },
      item,
      distance,
      fee: totalFee,
      pickup: [sender.latlng.lat, sender.latlng.lng],
      dropoff: [receiver.latlng.lat, receiver.latlng.lng],
    });
    navigate('/checkout');
  };

  return (
    <div className="bg-background min-h-screen pb-40 text-white font-body">
      <main className="max-w-xl mx-auto px-6 space-y-6 mt-6">
        {/* Screen Title */}
        <div className="mb-4">
          <h2 className="font-headline font-black text-xl tracking-tight text-primary uppercase italic">Kirim Paket</h2>
          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mt-1 opacity-70">Layanan Antar Barang Satset</p>
        </div>
        {/* Sender Details */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">outbox</span>
              <h2 className="font-headline font-extrabold text-lg uppercase tracking-wider">Sender Details</h2>
            </div>
            {user && savedAddresses.length > 0 && (
              <button onClick={() => setAddressPickerTarget('sender')} className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">bookmark_heart</span>
                Favorit
              </button>
            )}
          </div>
          <div className="bg-[#131313] p-6 rounded-[2rem] space-y-5 border border-white/5 shadow-lg">
            <input value={sender.name} onChange={e => setSender({...sender, name: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5" placeholder="Sender Name" type="text" />
            <input value={sender.phone} onChange={e => setSender({...sender, phone: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5" placeholder="Sender Phone" type="tel" />
            <div className="relative group">
              <textarea value={sender.address} onChange={e => setSender({...sender, address: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 resize-none" placeholder="Sender Address" rows="3"></textarea>
              <button
                onClick={() => handlePickLocation('sender')}
                className={`absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md ${sender.latlng ? 'bg-primary text-black' : 'bg-primary-container text-on-primary-container'}`}
              >
                <span className="material-symbols-outlined text-sm">{sender.latlng ? 'check_circle' : 'map'}</span>
                {sender.latlng ? 'Titik Oke' : 'Pilih di Peta'}
              </button>
            </div>
          </div>
        </section>

        {/* Receiver Details */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ece856]">move_to_inbox</span>
              <h2 className="font-headline font-extrabold text-lg uppercase tracking-wider">Receiver Details</h2>
            </div>
            {user && savedAddresses.length > 0 && (
              <button onClick={() => setAddressPickerTarget('receiver')} className="text-[10px] font-black uppercase tracking-widest text-[#ece856] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">bookmark_heart</span>
                Pilih Alamat
              </button>
            )}
          </div>
          <div className="bg-[#131313] p-6 rounded-[2rem] space-y-5 border border-white/5 shadow-lg">
            <input value={receiver.name} onChange={e => setReceiver({...receiver, name: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5" placeholder="Recipient Name" type="text" />
            <input value={receiver.phone} onChange={e => setReceiver({...receiver, phone: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5" placeholder="Recipient Phone" type="tel" />
            <div className="relative group">
              <textarea value={receiver.address} onChange={e => setReceiver({...receiver, address: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 resize-none" placeholder="Recipient Address" rows="3"></textarea>
              <button
                onClick={() => handlePickLocation('receiver')}
                className={`absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md ${receiver.latlng ? 'bg-primary text-black' : 'bg-primary-container text-on-primary-container'}`}
              >
                <span className="material-symbols-outlined text-sm">{receiver.latlng ? 'check_circle' : 'location_on'}</span>
                {receiver.latlng ? 'Titik Oke' : 'Pilih di Peta'}
              </button>
            </div>
          </div>
        </section>

        {/* Item Info */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[#ffeea5]">package_2</span>
            <h2 className="font-headline font-bold text-lg uppercase tracking-wider text-on-surface-variant">Item Info</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#131313] p-5 rounded-2xl space-y-2 border border-white/5">
              <label className="font-label text-[10px] uppercase text-on-surface-variant ml-1">Nama Barang</label>
              <input
                value={item.name}
                onChange={e => setItem({...item, name: e.target.value})}
                className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 outline-none"
                placeholder="Contoh: Dokumen"
                type="text"
              />
            </div>
            <div className="bg-[#131313] p-5 rounded-2xl space-y-2 border border-white/5">
              <label className="font-label text-[10px] uppercase text-on-surface-variant ml-1">Weight (kg)</label>
              <input value={item.weight} onChange={e => setItem({...item, weight: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4" type="number" min="1" />
            </div>
          </div>
        </section>

        {/* Saved Address Picker Overlay */}
        {addressPickerTarget && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             <div className="w-full max-w-xl bg-surface-container-high rounded-[2.5rem] p-6 space-y-4 shadow-2xl border border-white/10 animate-in slide-in-from-bottom-10 duration-300">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-headline font-black text-lg text-primary uppercase italic">Pilih Alamat</h3>
                  <button onClick={() => setAddressPickerTarget(null)} className="text-on-surface-variant">
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
      </main>



      {/* Bottom Summary */}
      <div className="fixed bottom-0 left-0 w-full z-50">
        <div className="max-w-xl mx-auto bg-[#262626]/80 backdrop-blur-2xl rounded-t-[32px] px-8 pt-6 pb-10 shadow-[0_-8px_48px_rgba(0,0,0,0.5)] border-t border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#f3ffca]/60">Estimasi Jarak: {distance.toFixed(2)} KM</p>
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

export default AroSend;
