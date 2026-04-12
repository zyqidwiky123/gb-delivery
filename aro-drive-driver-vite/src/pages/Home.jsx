import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { updateDriverStatus } from '../firebase/driverService';
import { listenForAvailableOrders, listenForActiveJobs, acceptOrder, completeOrder, pickupOrder } from '../firebase/orderService';
import { useDriverStore } from '../store/useDriverStore';
import MapComponent from '../components/MapComponent';

function Home() {
  const { user, profile, updateProfile } = useDriverStore();
  const [incomingOrders, setIncomingOrders] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const audioRef = useRef(new Audio('/sounds/tung.mp3'));

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    // Hanya pantau pesanan baru jika driver sedang ONLINE
    if (!profile?.isOnline) {
      setIncomingOrders([]);
      return;
    }

    // Start listening for orders from Firebase
    const unsubscribeIncoming = listenForAvailableOrders((orders) => {
      if (orders.length > incomingOrders.length) {
        // Play "Tung" sound if there's a new order
        audioRef.current.play().catch(e => console.log("Audio play blocked by browser:", e));
      }
      setIncomingOrders(orders);
    });

    let unsubscribeActive = () => {};
    if (user?.uid) {
      unsubscribeActive = listenForActiveJobs(user.uid, (jobs) => {
        setActiveJobs(jobs);
      });
    }

    return () => {
      unsubscribeIncoming();
      unsubscribeActive();
    };
  }, [profile?.isOnline, incomingOrders.length, user?.uid]);

  const handleAccept = async (orderId) => {
    try {
      if (!user?.uid) return;
      await acceptOrder(orderId, user.uid);
      alert("Pesanan diterima! Silakan jemput kustomer/ke warung.");
    } catch (e) {
      alert("Gagal menerima pesanan.");
    }
  };

  const handlePickup = async (orderId) => {
    try {
      await pickupOrder(orderId);
      showToast("Berhasil konfirmasi jemput!");
    } catch (e) {
      showToast("Gagal memperbarui status jemput.", "error");
    }
  };

  const handleComplete = async (orderId, total) => {
    if (window.confirm("Selesaikan pesanan ini? Pastikan barang/kustomer sudah sampai tujuan.")) {
       try {
         const result = await completeOrder(orderId, total);
         const feeInfo = result 
           ? `\n\n💰 Potongan biaya layanan: Rp ${result.platformFee.toLocaleString()}\n💳 Sisa saldo: Rp ${result.newBalance.toLocaleString()}`
           : '';
         alert(`Pesanan Selesai! ✅${feeInfo}`);
       } catch (e) {
         alert("Gagal menyelesaikan pesanan.");
       }
    }
  };

  const toggleOnlineStatus = async () => {
    if (!user?.uid) return;
    const newStatus = !profile?.isOnline;
    const success = await updateDriverStatus(user.uid, newStatus);
    if (success) {
      updateProfile({ isOnline: newStatus });
    } else {
      alert("Gagal memperbarui status.");
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen pb-32 font-body selection:bg-primary selection:text-on-primary-fixed">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#0e0e0e]/60 backdrop-blur-xl flex justify-center shadow-[0_48px_48px_rgba(0,0,0,0.06)] h-20">
        <div className="max-w-xl w-full flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden ring-2 ring-primary">
              <img alt="Profile Avatar" src={profile?.photoUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuB1uS3ff2JpvqzPJfBz6jy9Gwt4iZW5fHAgnymzDNUfKxsIt0aGrdYRzaaTJC_O2HtqQKeHtnENQp3S9HwDZlWq5JMmnN2DbKWsjyMr7GThLWvjH6Pv0l1ti83JuyqVGdKThmAnR658TxQ7pfyItmhSzFqKM49rIZuLio_9Rh81dX_ys82EoBYTYJUHoKOgm4WbooNmSL0Vu7TfyegTXQe9eCIN4YUx77MIk4i4uFuy1Irma1PI3zoru41Sf2WYo0cOketOMvQnN7g"} />
            </div>
            <div>
              <h1 className="font-headline font-bold tracking-tight text-[#f3ffca] leading-none">Mitra Aktif</h1>
              <span className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest">{profile?.name || "DRIVER"}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleOnlineStatus}
              className={`flex items-center px-3 py-1.5 rounded-full border border-outline-variant/15 active:scale-95 duration-200 transition-all ${profile?.isOnline ? 'bg-primary/10 border-primary/20' : 'bg-surface-container-low grayscale opacity-60'}`}
            >
              <span className={`w-2 h-2 rounded-full mr-2 ${profile?.isOnline ? 'bg-primary animate-pulse' : 'bg-outline-variant'}`}></span>
              <span className={`text-[11px] font-bold font-label ${profile?.isOnline ? 'text-primary' : 'text-on-surface-variant'}`}>
                {profile?.isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </button>
            <button className="text-primary transition-opacity hover:opacity-80 active:scale-95 duration-200">
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
      </header>
      
      <main className="pt-24 px-4 space-y-6 max-w-xl mx-auto">
        {/* Interactive Map View */}
        <section className="relative w-full rounded-xl overflow-hidden shadow-2xl group">
           <MapComponent activeJob={activeJobs[0]} />
        </section>

        {/* Active Jobs Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="font-headline font-extrabold text-xl tracking-tight text-white italic">Active Jobs</h2>
            <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded">{activeJobs.length} TASK</span>
          </div>

          {activeJobs.length === 0 ? (
            <div className="bg-surface-container-low p-8 rounded-xl border border-dashed border-white/10 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">work_history</span>
              <p className="text-sm text-on-surface-variant">Belum ada data tugas aktif saat ini.</p>
            </div>
          ) : (
            activeJobs.map(job => (
              <div key={job.id} className="bg-surface-container-low rounded-xl p-4 relative overflow-hidden group border border-outline-variant/10">
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] font-label text-on-surface-variant tracking-[0.1em]">ORDER ID</span>
                    <h3 className="font-headline font-extrabold text-lg text-white">#ARO-{job.id.slice(-5).toUpperCase()}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-label text-on-surface-variant tracking-[0.1em]">EST. EARNING</span>
                    <h3 className="font-headline font-extrabold text-lg text-primary">Rp {job.total?.toLocaleString() || 0}</h3>
                  </div>
                </div>
                <div className="space-y-4 mb-6 pt-2">
                  {/* Service Type Badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/20 border border-primary/30">
                    <span className="material-symbols-outlined text-[14px] text-primary">
                      {job.serviceType === 'food' ? 'restaurant' : 
                       job.serviceType === 'ride' ? 'directions_bike' : 
                       job.serviceType === 'send' ? 'package_2' : 'shopping_bag'}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                      ARO {job.serviceType?.toUpperCase()}
                    </span>
                  </div>

                  {/* Customer & WA */}
                  <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center border border-white/10">
                        <span className="material-symbols-outlined text-primary">person</span>
                      </div>
                      <div>
                         <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Kustomer</p>
                         <p className="text-sm font-bold">{job.customer?.name} {job.customer?.isGuest ? '(GUEST)' : ''}</p>
                      </div>
                    </div>
                    {job.customer?.wa && (
                      <a 
                        href={`https://wa.me/${job.customer.wa.replace(/\D/g, '')}?text=${encodeURIComponent(`Halo ${job.customer.name}, saya driver ARO-DRIVE. Saya sedang memproses pesanan ARO-${job.id.slice(-5).toUpperCase()} Anda. Mohon ditunggu ya!`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">chat</span>
                        Chat WA
                      </a>
                    )}
                  </div>

                  {/* Addresses */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(202,253,0,0.5)]"></div>
                      <div className="w-0.5 h-8 bg-white/10"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-error shadow-[0_0_8px_rgba(255,80,80,0.5)]"></div>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] leading-none">
                            {job.pickups && job.pickups.length > 1 ? `Pickup #${(job.pickupsDone || 0) + 1}` : 'Pickup'}
                          </p>
                          {job.pickups && job.pickups.length > 1 && (
                            <span className="bg-primary text-black px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter leading-none">{job.pickups.length} TITIK</span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-white line-clamp-2">
                           {(() => {
                             if (job.pickups && job.pickups.length > 1 && job.pickupAddress) {
                               const points = job.pickupAddress.split(', ');
                               return points[job.pickupsDone] || job.pickupAddress;
                             }
                             return job.pickupAddress || 'Lokasi Penjemputan';
                           })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-error font-black uppercase tracking-[0.2em] leading-none mb-1">Dropoff</p>
                        <p className="text-xs font-bold text-white line-clamp-2">{job.dropoffAddress || 'Lokasi Tujuan'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Items for Food/Shop/Send */}
                  {(job.serviceType === 'food' || job.serviceType === 'shop' || job.serviceType === 'send') && job.items && (
                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 max-h-32 overflow-y-auto no-scrollbar">
                      <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Detail Pesanan</p>
                      {Array.isArray(job.items) ? (
                        <ul className="space-y-1.5">
                          {job.items.map((it, idx) => (
                            <li key={idx} className="flex justify-between text-xs">
                              <span className="text-white/80"><span className="font-bold text-primary mr-2">{it.qty}x</span> {it.name}</span>
                              <span className="text-white/40">Rp {(it.price * it.qty).toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-white/80 whitespace-pre-wrap">{job.items}</p>
                      )}
                    </div>
                  )}
                </div>
                {/* Unified Action Button */}
                <div 
                  className={`relative h-14 rounded-full flex items-center px-2 group cursor-pointer overflow-hidden border transition-all duration-300 ${
                    job.status === 'accepted' 
                      ? 'bg-primary/10 border-primary/20 hover:bg-primary/15' 
                      : 'bg-green-500/10 border-green-500/20 hover:bg-green-500/15'
                  }`}
                  onClick={() => {
                    if (job.status === 'accepted') {
                      const total = job.pickups?.length || 1;
                      const done = job.pickupsDone || 0;
                      const next = done + 1;
                      
                      const msg = total > 1 
                        ? `Konfirmasi sudah menjemput pesanan di titik ke-${next} dari ${total}?`
                        : "Konfirmasi sudah menjemput barang/kustomer?";
                        
                      if (window.confirm(msg)) {
                        handlePickup(job.id);
                      }
                    } else {
                      handleComplete(job.id, job.total || 0);
                    }
                  }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r from-transparent to-transparent ${
                    job.status === 'accepted' ? 'hover:from-primary/5' : 'hover:from-green-500/5'
                  }`}></div>
                  
                  <div className={`z-10 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-active:scale-90 ${
                    job.status === 'accepted' ? 'bg-primary' : 'bg-green-500'
                  }`}>
                    <span className="material-symbols-outlined">
                      {job.status === 'accepted' ? 'local_shipping' : 'check_circle'}
                    </span>
                  </div>
                  
                  <span className={`z-10 ml-4 text-[10px] font-black tracking-[0.2em] animate-pulse uppercase italic transition-colors duration-300 ${
                    job.status === 'accepted' ? 'text-primary' : 'text-green-400'
                  }`}>
                    {job.status === 'accepted' 
                      ? (job.pickups && job.pickups.length > 1 
                          ? `KONFIRMASI JEMPUT (${(job.pickupsDone || 0) + 1}/${job.pickups.length})` 
                          : "KONFIRMASI JEMPUT")
                      : "SELESAIKAN PESANAN"}
                  </span>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Incoming Orders Bento */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="font-headline font-extrabold text-xl tracking-tight text-white italic">Pesanan Masuk</h2>
            <span className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded">{incomingOrders.length} ORDER</span>
          </div>

          {incomingOrders.length === 0 ? (
            <div className="bg-surface-container-low p-8 rounded-xl border border-dashed border-white/10 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">radar</span>
              <p className="text-sm text-on-surface-variant">Belum ada pesanan nih, Boss. <br/>Sambil nunggu, ngopi dulu!</p>
            </div>
          ) : (
            incomingOrders.map(order => (
              <div key={order.id} className="bg-surface-container-highest rounded-xl p-5 border border-primary/30 animate-pulse-subtle">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-headline font-bold text-sm uppercase text-primary">#{order.id.slice(-5)}</span>
                  </div>
                  <div className="bg-background px-3 py-1 rounded-full border border-primary/20">
                    <span className="text-xs font-bold text-primary">Rp {order.total?.toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-3 mb-5">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <span className="material-symbols-outlined text-primary text-[14px]">person</span>
                       <p className="text-xs font-bold text-white">{order.customer?.name} {order.customer?.isGuest ? '(GUEST)' : ''}</p>
                     </div>
                     <div className="px-2 py-0.5 rounded bg-primary/20 border border-primary/30">
                        <span className="text-[8px] font-black uppercase tracking-tighter text-primary">ARO {order.serviceType?.toUpperCase()}</span>
                     </div>
                   </div>
                   <div className="flex items-start gap-2 pt-2 border-t border-white/5">
                     <span className="material-symbols-outlined text-primary text-[14px] mt-0.5">location_on</span>
                     <div className="flex-1">
                        <p className="text-[8px] text-white/40 font-black uppercase tracking-widest">Alamat</p>
                        <p className="text-xs text-white/80 line-clamp-1">{order.pickupAddress || 'Lokasi Jemput'}</p>
                        <p className="text-[14px] text-primary rotate-90 w-4 ml-[-4px]">arrow_forward</p>
                        <p className="text-xs text-white/80 line-clamp-1">{order.dropoffAddress || 'Lokasi Tujuan'}</p>
                     </div>
                   </div>
                </div>
                <button 
                  onClick={() => handleAccept(order.id)}
                  className="w-full py-4 bg-gradient-to-br from-primary-container to-primary text-black font-headline font-black text-xs tracking-widest rounded-xl shadow-lg uppercase active:scale-95"
                >
                  Terima Pesanan
                </button>
              </div>
            ))
          )}
        </section>
      </main>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border ${toast.type === 'error' ? 'bg-error/20 border-error text-error' : 'bg-primary/20 border-primary text-primary'}`}>
            <span className="material-symbols-outlined text-lg">
              {toast.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}

      {/* FAB for Quick Actions */}
      <div className="fixed bottom-32 right-0 w-full z-40 pointer-events-none">
        <div className="max-w-xl mx-auto relative h-full">
          <button className="absolute right-6 w-16 h-16 rounded-full bg-[#0e0e0e]/80 backdrop-blur-xl border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(243,255,202,0.15)] active:scale-90 transition-all group pointer-events-auto">
            <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform">support_agent</span>
          </button>
        </div>
      </div>


    </div>
  );
}

export default Home;
