import React, { useState } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const ManualOrderForm = ({ onClose, onOrderCreated }) => {
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState({
    customerName: '',
    customerWA: '',
    serviceType: 'food',
    pickupAddress: '',
    dropoffAddress: '',
    items: '',
    total: 0,
    paymentMethod: 'TUNAI'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orderData.customerWA || !orderData.customerName) {
      alert("Nama dan WA User wajib diisi!");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        status: 'searching',
        serviceType: orderData.serviceType,
        subtotal: Number(orderData.total),
        deliveryFee: 0, // Admin-created manual order might have fixed price
        serviceFee: 0,
        total: Number(orderData.total),
        paymentMethod: orderData.paymentMethod,
        pickupAddress: orderData.pickupAddress,
        dropoffAddress: orderData.dropoffAddress,
        items: orderData.items,
        customer: {
          name: orderData.customerName,
          wa: orderData.customerWA,
          isManual: true, // Mark as admin-created
          isGuest: true
        },
        createdAt: serverTimestamp(),
        createdBy: 'admin'
      };

      const docRef = await addDoc(collection(db, "orders"), payload);
      alert(`Pesanan Berhasil Dibuat! ID: ${docRef.id}`);
      if (onOrderCreated) onOrderCreated(docRef.id);
      onClose();
    } catch (error) {
      console.error("Error creating manual order:", error);
      alert("Gagal membuat pesanan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-[#131313] w-full max-w-lg rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h3 className="text-xl font-black text-[#f3ffca] font-headline uppercase italic tracking-tight">Buat Pesanan Manual</h3>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">Input order dari WhatsApp Admin</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-error/20 hover:text-error transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f3ffca]/60 ml-1">Nama Customer</label>
              <input 
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:ring-1 focus:ring-[#f3ffca] transition-all"
                placeholder="Contoh: Budi"
                value={orderData.customerName}
                onChange={e => setOrderData({...orderData, customerName: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f3ffca]/60 ml-1">WA Customer</label>
              <input 
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:ring-1 focus:ring-[#f3ffca] transition-all"
                placeholder="628xxxx"
                value={orderData.customerWA}
                onChange={e => setOrderData({...orderData, customerWA: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f3ffca]/60 ml-1">Jenis Layanan</label>
            <div className="grid grid-cols-4 gap-2">
              {['food', 'ride', 'send', 'shop'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderData({...orderData, serviceType: type})}
                  className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    orderData.serviceType === type 
                    ? 'bg-primary text-black border-primary' 
                    : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f3ffca]/60 ml-1">Titik Jemput / Toko</label>
              <textarea 
                rows="2"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:ring-1 focus:ring-[#f3ffca] transition-all resize-none"
                placeholder="Alamat lengkap penjemputan"
                value={orderData.pickupAddress}
                onChange={e => setOrderData({...orderData, pickupAddress: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f3ffca]/60 ml-1">Titik Antar / Tujuan</label>
              <textarea 
                rows="2"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:ring-1 focus:ring-[#f3ffca] transition-all resize-none"
                placeholder="Alamat lengkap tujuan"
                value={orderData.dropoffAddress}
                onChange={e => setOrderData({...orderData, dropoffAddress: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f3ffca]/60 ml-1">Detail Pesanan</label>
            <textarea 
              rows="3"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:ring-1 focus:ring-[#f3ffca] transition-all resize-none"
              placeholder="Contoh: Nasi Goreng 1x, Es Teh 1x"
              value={orderData.items}
              onChange={e => setOrderData({...orderData, items: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f3ffca]/60 ml-1">Total Biaya (Rp)</label>
            <input 
              type="number"
              className="w-full bg-primary/10 border border-primary/20 rounded-2xl px-5 py-4 text-xl font-headline font-black text-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="0"
              value={orderData.total}
              onChange={e => setOrderData({...orderData, total: e.target.value})}
            />
          </div>
        </form>

        <div className="p-8 bg-white/5 border-t border-white/5">
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-5 rounded-full text-black font-headline font-black text-lg uppercase tracking-widest shadow-lg active:scale-95 transition-all ${loading ? 'bg-zinc-700 opacity-50' : 'bg-[#f3ffca]'}`}
          >
            {loading ? 'MEMPROSES...' : 'GAS INPUT PESANAN!'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualOrderForm;
