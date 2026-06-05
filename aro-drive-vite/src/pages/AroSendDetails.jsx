import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';
import { calculateDistance } from '../utils/mapConfig';
import { useAdminStore } from '../store/adminStore';

function AroSendDetails() {
  const navigate = useNavigate();
  const { 
    calculateFee, setRouteDetails,
    sendPickup, sendDropoff,
  } = useOrderStore();

  const { user, savedAddresses } = useUserStore();
  const { ui } = useAdminStore();
  const sendUI = ui.aroSend || {};
  const commonUI = ui.common || {};

  // If locations are not picked, redirect back
  useEffect(() => {
    if (!sendPickup || !sendDropoff) {
      navigate('/send', { replace: true });
    }
  }, [sendPickup, sendDropoff, navigate]);
  
  // Form States
  const [sender, setSender] = useState(() => {
    const saved = sessionStorage.getItem('aroSend_sender');
    return saved ? JSON.parse(saved) : { name: '', phone: '', address: '', latlng: null };
  });
  const [receiver, setReceiver] = useState(() => {
    const saved = sessionStorage.getItem('aroSend_receiver');
    return saved ? JSON.parse(saved) : { name: '', phone: '', address: '', latlng: null };
  });
  const [item, setItem] = useState(() => {
    const saved = sessionStorage.getItem('aroSend_item');
    return saved ? JSON.parse(saved) : { name: '', weight: 1 };
  });

  useEffect(() => { sessionStorage.setItem('aroSend_sender', JSON.stringify(sender)); }, [sender]);
  useEffect(() => { sessionStorage.setItem('aroSend_receiver', JSON.stringify(receiver)); }, [receiver]);
  useEffect(() => { sessionStorage.setItem('aroSend_item', JSON.stringify(item)); }, [item]);

  // UI States
  const [distance, setDistance] = useState(0);
  const [totalFee, setTotalFee] = useState(0);
  const [addressPickerTarget, setAddressPickerTarget] = useState(null);

  // Sync with Store Locations (Wait, in this page, they shouldn't change, but it's good to keep in sync)
  useEffect(() => {
    if (sendPickup && sendPickup.lat && sendPickup.lng) {
      setSender(prev => {
        if (prev.latlng?.lat === sendPickup.lat && prev.latlng?.lng === sendPickup.lng) {
          return prev;
        }
        return { 
          ...prev, 
          address: sendPickup.address, 
          latlng: { lat: sendPickup.lat, lng: sendPickup.lng } 
        };
      });
    }
  }, [sendPickup]);

  useEffect(() => {
    if (sendDropoff && sendDropoff.lat && sendDropoff.lng) {
      setReceiver(prev => {
        if (prev.latlng?.lat === sendDropoff.lat && prev.latlng?.lng === sendDropoff.lng) {
          return prev;
        }
        return { 
          ...prev, 
          address: sendDropoff.address, 
          latlng: { lat: sendDropoff.lat, lng: sendDropoff.lng } 
        };
      });
    }
  }, [sendDropoff]);

  // Auto-fill member data on mount
  useEffect(() => {
    if (user && !sender.name) {
      const homeAddr = savedAddresses.find(a => a.label?.toLowerCase() === 'rumah');
      setSender(prev => ({
        ...prev,
        name: user.displayName || '',
        phone: user.whatsapp || '',
      }));
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

  const handleCheckout = () => {
    if (!sender.name || !sender.address || !sender.phone || !sender.latlng ||
        !receiver.name || !receiver.address || !receiver.phone || !receiver.latlng ||
        !item.name) {
      alert(commonUI.errorIncomplete || "Mohon lengkapi semua data pengirim, penerima, item, dan titik peta.");
      return;
    }

    setRouteDetails({
      type: 'send',
      sender: { ...sender, latlng: [sender.latlng.lat, sender.latlng.lng] },
      receiver: { ...receiver, latlng: [receiver.latlng.lat, receiver.latlng.lng] },
      item,
      weight: Number(item.weight) || 1,
      distance,
      fee: totalFee,
      pickup: [sender.latlng.lat, sender.latlng.lng],
      dropoff: [receiver.latlng.lat, receiver.latlng.lng],
    });
    navigate('/checkout');
  };

  return (
    <div className="bg-background min-h-screen pb-40 text-on-background font-body">
      <main className="max-w-xl mx-auto px-6 space-y-6 mt-6">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate('/send')} className="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center text-on-surface shadow-sm border border-outline hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="font-headline font-black text-xl tracking-tight text-primary uppercase italic">Detail Pengiriman</h2>
          </div>
        </div>

        {/* Sender Details */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">outbox</span>
              <h2 className="font-headline font-extrabold text-lg uppercase tracking-wider">{sendUI.senderTitle || "Data Pengirim"}</h2>
            </div>
            {user && savedAddresses.length > 0 && (
              <button onClick={() => setAddressPickerTarget('sender')} className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">bookmark_heart</span>
                Favorit
              </button>
            )}
          </div>
          <div className="bg-surface-container p-6 rounded-[2rem] space-y-5 border border-outline shadow-lg">
            <input value={sender.name} onChange={e => setSender({...sender, name: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 text-on-surface" placeholder={sendUI.senderNamePlaceholder || "Nama Pengirim"} type="text" />
            <input value={sender.phone} onChange={e => setSender({...sender, phone: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 text-on-surface" placeholder={sendUI.senderPhonePlaceholder || "WhatsApp Pengirim"} type="tel" />
            <div className="relative group">
              <textarea value={sender.address} onChange={e => setSender({...sender, address: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 resize-none text-on-surface" placeholder={sendUI.senderAddressPlaceholder || "Detail Alamat Pengirim"} rows="3"></textarea>
            </div>
          </div>
        </section>

        {/* Receiver Details */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ece856]">move_to_inbox</span>
              <h2 className="font-headline font-extrabold text-lg uppercase tracking-wider">{sendUI.receiverTitle || "Data Penerima"}</h2>
            </div>
            {user && savedAddresses.length > 0 && (
              <button onClick={() => setAddressPickerTarget('receiver')} className="text-[10px] font-black uppercase tracking-widest text-[#ece856] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">bookmark_heart</span>
                Pilih Alamat
              </button>
            )}
          </div>
          <div className="bg-surface-container p-6 rounded-[2rem] space-y-5 border border-outline shadow-lg">
            <input value={receiver.name} onChange={e => setReceiver({...receiver, name: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 text-on-surface" placeholder={sendUI.receiverNamePlaceholder || "Nama Penerima"} type="text" />
            <input value={receiver.phone} onChange={e => setReceiver({...receiver, phone: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 text-on-surface" placeholder={sendUI.receiverPhonePlaceholder || "WhatsApp Penerima"} type="tel" />
            <div className="relative group">
              <textarea value={receiver.address} onChange={e => setReceiver({...receiver, address: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-5 resize-none text-on-surface" placeholder={sendUI.receiverAddressPlaceholder || "Detail Alamat Penerima"} rows="3"></textarea>
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
            <div className="bg-surface-container p-5 rounded-2xl space-y-2 border border-outline">
              <label className="font-label text-[10px] uppercase text-on-surface-variant ml-1">Nama Barang</label>
              <input
                value={item.name}
                onChange={e => setItem({...item, name: e.target.value})}
                className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 outline-none text-on-surface"
                placeholder={sendUI.itemPlaceholder || "Contoh: Dokumen"}
                type="text"
              />
            </div>
            <div className="bg-surface-container p-5 rounded-2xl space-y-2 border border-outline">
              <label className="font-label text-[10px] uppercase text-on-surface-variant ml-1">Weight (kg)</label>
              <input value={item.weight} onChange={e => setItem({...item, weight: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface" type="number" min="1" />
            </div>
          </div>
        </section>

        {/* Saved Address Picker Overlay */}
        {addressPickerTarget && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             <div className="w-full max-w-xl bg-surface-container-high rounded-[2.5rem] p-6 space-y-4 shadow-2xl border border-outline animate-in slide-in-from-bottom-10 duration-300">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-headline font-black text-lg text-primary uppercase italic">Pilih Alamat</h3>
                  <button onClick={() => setAddressPickerTarget(null)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-none">
                  {savedAddresses.map(addr => (
                    <button 
                      key={addr.id}
                      onClick={() => selectSavedAddress(addr)}
                      className="w-full flex items-center gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline hover:border-primary/40 transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-sm">
                          {addr.label?.toLowerCase() === 'rumah' ? 'home' : addr.label?.toLowerCase() === 'kantor' ? 'work' : 'push_pin'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs uppercase tracking-tight text-on-surface mb-0.5">{addr.label}</p>
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
        <div className="max-w-xl mx-auto bg-surface/80 backdrop-blur-2xl rounded-t-[32px] px-8 pt-6 pb-10 shadow-[0_-8px_48px_rgba(0,0,0,0.5)] border-t border-outline">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Estimasi Jarak: {distance.toFixed(2)} KM</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xs font-bold text-primary italic">IDR</span>
                <span className="text-3xl font-headline font-black text-on-surface">{totalFee.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={handleCheckout}
              className={`px-8 py-4 rounded-full font-headline font-extrabold text-lg flex items-center gap-3 active:scale-95 transition-all ${distance > 0 ? 'bg-gradient-to-br from-[#cafd00] to-[#f3ffca] text-black shadow-lg shadow-primary/20' : 'bg-zinc-700 text-zinc-500 opacity-50'}`}
            >
              {sendUI.confirmBtn || "Pesan Sekarang"}
              <span className="material-symbols-outlined font-bold">rocket_launch</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AroSendDetails;
