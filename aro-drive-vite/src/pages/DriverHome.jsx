import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenForAvailableOrders, acceptOrder, updateDriverStatus, getDriverData } from '../firebase/orderService';
import { useUserStore } from '../store/userStore';

function DriverHome() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [isOnline, setIsOnline] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!user?.id) return;
      setStatusLoading(true);
      const data = await getDriverData(user.id);
      if (data && data.status) {
        setIsOnline(data.status === 'online');
      }
      setStatusLoading(false);
    };
    fetchStatus();
  }, [user?.id]);

  useEffect(() => {
    if (statusLoading || !isOnline) {
      setOrders([]);
      return;
    }

    const unsubscribe = listenForAvailableOrders((data) => {
      setOrders(data);
    });

    return () => unsubscribe();
  }, [isOnline]);

  const handleToggleOnline = async () => {
    if (!user?.id) return;
    
    const newStatus = !isOnline;
    setIsOnline(newStatus); // Optimistic UI
    
    try {
      await updateDriverStatus(user.id, { status: newStatus ? 'online' : 'offline' });
    } catch (e) {
      console.error("Gagal update status:", e);
      setIsOnline(!newStatus); // Rollback
    }
  };

  const handleAccept = async (orderId) => {
    setLoading(true);
    try {
      await acceptOrder(orderId, user?.id || "DRIVER_DEMO_01");
      navigate(`/driver/order/${orderId}`);
    } catch (e) {
      alert("Gagal mengambil order. Mungkin sudah diambil driver lain.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white font-body pb-20">
      {/* Driver Header */}
      <header className="bg-[#131313] p-6 sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-[#f3ffca] p-0.5 shadow-lg shadow-primary/20">
               <div className="w-full h-full bg-[#131313] rounded-[0.9rem] flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">sports_motorsports</span>
               </div>
            </div>
            <div>
              <h1 className="font-headline font-black text-xl italic tracking-tight">DRIVER APP</h1>
              <p className="text-[10px] uppercase font-bold tracking-widest text-[#f3ffca]/60">ARO DRIVE PARTNER</p>
            </div>
          </div>
          
          {/* Online Toggle */}
          <button 
            disabled={statusLoading}
            onClick={handleToggleOnline}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${isOnline ? 'bg-primary/10 border-primary text-primary' : 'bg-zinc-800 border-zinc-700 text-zinc-500'} ${statusLoading ? 'opacity-50' : ''}`}
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-primary shadow-[0_0_10px_rgba(202,253,0,0.8)] animate-pulse' : 'bg-zinc-600'}`}></span>
            <span className="text-xs font-black uppercase tracking-widest">
              {statusLoading ? 'LOADING...' : isOnline ? 'Online' : 'Offline'}
            </span>
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-6 space-y-6 mt-4">
        {/* Earnings Card */}
        <section className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] p-6 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
           <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#f3ffca]/50 mb-1">Pendapatan Hari Ini</p>
           <div className="flex items-baseline gap-2">
              <span className="text-4xl font-headline font-black text-white italic tracking-tighter">IDR 142.500</span>
              <span className="text-primary font-bold text-sm">/ 12 Trip</span>
           </div>
           <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <span className="material-symbols-outlined text-primary text-sm">stars</span>
                 <span className="text-xs font-bold">Rating 5.0</span>
              </div>
              <button className="text-[10px] uppercase font-black text-primary tracking-widest border-b border-primary/30">Cek Dompet</button>
           </div>
        </section>

        {/* Order Feed */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-2">
             <h2 className="text-sm font-black uppercase tracking-widest text-[#f3ffca]">Order Masuk ({orders.length})</h2>
             {isOnline && <span className="text-[10px] text-zinc-500 animate-pulse">Monitoring...</span>}
          </div>

          {!isOnline ? (
            <div className="bg-zinc-900/50 rounded-3xl p-12 text-center border border-dashed border-zinc-800">
               <span className="material-symbols-outlined text-4xl text-zinc-700 mb-4">do_not_disturb_on</span>
               <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest">Aktifkan status Online<br/>untuk melihat order</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-zinc-900/50 rounded-3xl p-12 text-center border border-dashed border-zinc-800">
               <span className="material-symbols-outlined text-4xl text-zinc-700 mb-4 animate-bounce">radar</span>
               <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest">Mencari pesanan di sekitarmu...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-[#131313] p-5 rounded-3xl border border-white/5 shadow-lg group hover:border-primary/30 transition-all active:scale-[0.98]">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary">
                               {order.serviceType === 'food' ? 'restaurant' : order.serviceType === 'ride' ? 'moped' : 'package_2'}
                            </span>
                         </div>
                         <div>
                            <p className="text-xs font-black text-white uppercase tracking-tight">ARO {order.serviceType?.toUpperCase()}</p>
                            <p className="text-[10px] text-[#f3ffca]/60 font-bold">{order.distance?.toFixed(1) || '0'} KM - Estimasi 15m</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-lg font-headline font-black text-primary italic">Rp {order.total?.toLocaleString()}</p>
                         <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Tagihan Tunai</p>
                      </div>
                   </div>

                   <div className="flex items-center gap-3 bg-[#0a0a0a] p-4 rounded-2xl mb-5">
                      <div className="flex flex-col items-center gap-1">
                         <div className="w-2 h-2 rounded-full bg-primary"></div>
                         <div className="w-0.5 h-4 bg-zinc-800"></div>
                         <div className="w-2 h-2 rounded-full bg-error"></div>
                      </div>
                      <div className="flex-grow space-y-1">
                         <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter truncate">Pickup: {order.serviceType === 'food' ? 'Restoran Terdekat' : 'Titik Sesuai Peta'}</p>
                         <p className="text-[10px] text-white font-bold truncate">Antar: {order.receiver?.address || 'Lokasi Tujuan User'}</p>
                      </div>
                   </div>

                   <button 
                    disabled={loading}
                    onClick={() => handleAccept(order.id)}
                    className="w-full kinetic-gradient py-4 rounded-2xl text-black font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all"
                   >
                     {loading ? 'MEMPROSES...' : 'AMBIL ORDER!'}
                   </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Driver Footer Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/80 backdrop-blur-2xl border-t border-white/5 p-4 z-50">
         <div className="max-w-xl mx-auto flex justify-around">
            <button className="flex flex-col items-center text-primary">
               <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>grid_view</span>
               <span className="text-[8px] font-black uppercase mt-1 tracking-widest">Dashboard</span>
            </button>
            <button className="flex flex-col items-center text-zinc-600">
               <span className="material-symbols-outlined text-2xl">history</span>
               <span className="text-[8px] font-black uppercase mt-1 tracking-widest">Riwayat</span>
            </button>
            <button className="flex flex-col items-center text-zinc-600">
               <span className="material-symbols-outlined text-2xl">account_circle</span>
               <span className="text-[8px] font-black uppercase mt-1 tracking-widest">Profile</span>
            </button>
         </div>
      </nav>
    </div>
  );
}

export default DriverHome;
