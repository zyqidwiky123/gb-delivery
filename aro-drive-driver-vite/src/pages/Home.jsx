import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { updateDriverStatus, updateDriverLocation } from '../firebase/driverService';
import { listenForAvailableOrders, listenForActiveJobs, acceptOrder, completeOrder, pickupOrder, rejectOrder } from '../firebase/orderService';
import { useDriverStore } from '../store/useDriverStore';
import MapComponent from '../components/MapComponent';

function Home() {
  const { user, profile, updateProfile } = useDriverStore();
  const [incomingOrders, setIncomingOrders] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  
  const [costModal, setCostModal] = useState({ show: false, jobId: null, amount: '' });
  const [countdowns, setCountdowns] = useState({});
  const audioRef = useRef(new Audio('/notif-driver.mp3'));
  const prevOrdersCount = useRef(0);
  const lastKnownLocationRef = useRef(null);




  // 1. Listen for AVAILABLE orders offered to this driver (only when ONLINE)
  useEffect(() => {
    if (!profile?.isOnline || !user?.uid) {
      setIncomingOrders([]);
      return;
    }

    console.log("Driver: Mendengarkan pesanan yang ditawarkan...");
    const unsubscribeIncoming = listenForAvailableOrders(user.uid, (orders) => {
      console.log(`Driver: Ada ${orders.length} pesanan ditawarkan.`);
      if (orders.length > prevOrdersCount.current) {
        audioRef.current.play().catch(e => console.log("Audio play blocked:", e));
      }
      prevOrdersCount.current = orders.length;
      setIncomingOrders(orders);
    });

    return () => unsubscribeIncoming();
  }, [profile?.isOnline, user?.uid]);

  // Countdown timer for offered orders + auto-reject on expiry
  useEffect(() => {
    if (incomingOrders.length === 0) {
      setCountdowns({});
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const newCountdowns = {};
      incomingOrders.forEach(order => {
        const expiresAt = order.dispatch?.offerExpiresAt?.toMillis?.()
          || (order.dispatch?.offerExpiresAt?.seconds ? order.dispatch.offerExpiresAt.seconds * 1000 : null);
        if (expiresAt) {
          const secondsLeft = Math.max(0, Math.floor((expiresAt - now) / 1000));
          newCountdowns[order.id] = secondsLeft;

          // Auto-reject when countdown hits 0 (client-side fast path)
          if (secondsLeft === 0 && user?.uid) {
            rejectOrder(order.id, user.uid).catch(e => 
              console.warn("Auto-reject failed (scheduler will handle):", e.message)
            );
          }
        }
      });
      setCountdowns(newCountdowns);
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingOrders, user?.uid]);

  // 2. Listen for ACTIVE jobs (always when logged in)
  useEffect(() => {
    if (!user?.uid) return;

    console.log("Driver: Mendengarkan pekerjaan aktif...");
    const unsubscribeActive = listenForActiveJobs(user.uid, (jobs) => {
      console.log(`Driver: Ada ${jobs.length} pekerjaan sedang berjalan.`);
      setActiveJobs(jobs);
    });

    return () => unsubscribeActive();
  }, [user?.uid]);

  // Real-time Location Tracking when ONLINE
  useEffect(() => {
    if (!profile?.isOnline || !user?.uid) return;

    if (!navigator.geolocation) {
      console.warn("Geolocation not supported");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        lastKnownLocationRef.current = newLoc;
        updateDriverLocation(user.uid, newLoc);
      },
      (err) => console.error("Location watch error:", err),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [profile?.isOnline, user?.uid]);

  // Refresh the location timestamp while the driver is stationary and waiting.
  useEffect(() => {
    if (!profile?.isOnline || !user?.uid) return;

    const heartbeatId = setInterval(() => {
      if (lastKnownLocationRef.current) {
        updateDriverLocation(user.uid, lastKnownLocationRef.current);
      }
    }, 60000);

    return () => clearInterval(heartbeatId);
  }, [profile?.isOnline, user?.uid]);

  const handleAccept = async (orderId) => {
    try {
      if (!user?.uid) return;
      await acceptOrder(orderId, user.uid, profile);
      toast.success("Pesanan diterima! Silakan jemput kustomer/ke warung.");
    } catch (e) {
      console.error("HandleAccept Error:", e);
      alert("Gagal menerima pesanan. " + (e.message || "Mungkin sudah diambil driver lain."));
    }
  };

  const handleReject = async (orderId) => {
    try {
      if (!user?.uid) return;
      await rejectOrder(orderId, user.uid);
      toast.success("Pesanan ditolak, dialihkan ke driver lain.");
    } catch (e) {
      console.error("HandleReject Error:", e);
      toast.error("Gagal menolak pesanan.");
    }
  };

  const handlePickup = async (orderId, actualCost = null) => {
    try {
      await pickupOrder(orderId, actualCost);
      toast.success("Berhasil konfirmasi jemput!");
    } catch (e) {
      toast.error("Gagal memperbarui status jemput.");
    }
  };

  const handleComplete = async (orderId, total) => {
    if (window.confirm("Selesaikan pesanan ini? Pastikan barang/kustomer sudah sampai tujuan.")) {
       try {
         const result = await completeOrder(orderId, total);
         const feeInfo = result 
           ? `\n\n💳 Sisa saldo: Rp ${result.newBalance.toLocaleString()}`
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
      
      // "Unlock" audio context for browser autoplay policy
      if (newStatus) {
        audioRef.current.play()
          .then(() => {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            console.log("Audio context unlocked for notifications");
          })
          .catch(e => console.log("Audio unlock failed:", e));
      }
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
                    {job.voucherUsed && (
                      <span className="bg-primary/20 text-primary text-[8px] font-black px-2 py-0.5 rounded-full border border-primary/40 animate-pulse uppercase">
                        Gratis Ongkir (Subsidi)
                      </span>
                    )}
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
                        href={`https://wa.me/${(() => {
                          let clean = job.customer.wa.replace(/\D/g, '');
                          if (clean.startsWith('0')) clean = '62' + clean.slice(1);
                          if (!clean.startsWith('62')) clean = '62' + clean;
                          return clean;
                        })()}?text=${encodeURIComponent(`Halo ${job.customer.name}, saya driver ARO-DRIVE. Saya sedang memproses pesanan ARO-${job.id.slice(-5).toUpperCase()} Anda. Mohon ditunggu ya!`)}`}
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

                  {/* Sender & Receiver details for ARO Send */}
                  {job.serviceType === 'send' && (job.sender || job.receiver) && (
                    <div className="bg-[#131313]/90 p-4 rounded-xl border border-white/5 space-y-4 shadow-inner">
                      <p className="text-[9px] text-primary font-black uppercase tracking-widest border-b border-white/10 pb-1.5 italic flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[12px]">local_shipping</span> DETAIL PENGIRIMAN PAKET
                      </p>
                      
                      {/* Pengirim */}
                      {job.sender && (
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <div className="space-y-1">
                            <span className="bg-primary/20 text-primary text-[8px] font-black px-2 py-0.5 rounded border border-primary/30 uppercase tracking-wider">PENGIRIM</span>
                            <p className="text-xs font-bold text-white mt-1">{job.sender.name || 'Pengirim'}</p>
                            <p className="text-[10px] text-white/60 font-mono">{job.sender.phone || '-'}</p>
                          </div>
                          {job.sender.phone && (
                            <a 
                              href={`https://wa.me/${(() => {
                                let clean = job.sender.phone.replace(/\D/g, '');
                                if (clean.startsWith('0')) clean = '62' + clean.slice(1);
                                if (!clean.startsWith('62')) clean = '62' + clean;
                                return clean;
                              })()}?text=${encodeURIComponent(`Halo ${job.sender.name || 'Pengirim'}, saya driver ARO-DRIVE. Saya sedang menuju ke lokasi Anda untuk menjemput paket.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 text-primary px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-primary/5"
                            >
                              <span className="material-symbols-outlined text-[14px]">chat</span> Chat WA
                            </a>
                          )}
                        </div>
                      )}

                      {/* Penerima */}
                      {job.receiver && (
                        <div className="flex items-center justify-between pt-1">
                          <div className="space-y-1">
                            <span className="bg-[#ece856]/20 text-[#ece856] text-[8px] font-black px-2 py-0.5 rounded border border-[#ece856]/30 uppercase tracking-wider">PENERIMA</span>
                            <p className="text-xs font-bold text-white mt-1">{job.receiver.name || 'Penerima'}</p>
                            <p className="text-[10px] text-white/60 font-mono">{job.receiver.phone || '-'}</p>
                          </div>
                          {job.receiver.phone && (
                            <a 
                              href={`https://wa.me/${(() => {
                                let clean = job.receiver.phone.replace(/\D/g, '');
                                if (clean.startsWith('0')) clean = '62' + clean.slice(1);
                                if (!clean.startsWith('62')) clean = '62' + clean;
                                return clean;
                              })()}?text=${encodeURIComponent(`Halo ${job.receiver.name || 'Penerima'}, saya driver ARO-DRIVE. Saya sedang membawa paket pesanan Anda dari ${job.sender?.name || 'Pengirim'}.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-[#ece856]/10 hover:bg-[#ece856]/20 border border-[#ece856]/30 hover:border-[#ece856]/50 text-[#ece856] px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-[#ece856]/5"
                            >
                              <span className="material-symbols-outlined text-[14px]">chat</span> Chat WA
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items for Food/Shop/Send */}
                  {(job.serviceType === 'food' || job.serviceType === 'shop' || job.serviceType === 'send') && job.items && (
                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 no-scrollbar">
                      <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Detail Pesanan</p>
                      {Array.isArray(job.items) ? (
                        <ul className="space-y-3">
                          {job.items.map((it, idx) => (
                            <li key={idx} className="flex flex-col text-xs border-b border-white/5 pb-2 last:border-0">
                              <div className="flex justify-between w-full mb-1 gap-4">
                                <span className="text-white/80 font-bold whitespace-pre-wrap break-words flex-1"><span className="text-primary mr-2 font-black">{it.qty}x</span> {it.name}</span>
                                <span className="text-white/40 flex-none">Rp {(it.price * it.qty).toLocaleString()}</span>
                              </div>
                              {(it.isManual || it.desc) && (
                                <div className="bg-primary/5 p-2 rounded-lg border border-primary/10 mt-1">
                                  <p className="text-[9px] font-black text-primary uppercase tracking-tighter mb-1 italic">Instruksi Lengkap:</p>
                                  <p className="text-[11px] text-white/70 whitespace-pre-wrap leading-relaxed break-words">{it.desc}</p>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed break-words">{job.items}</p>
                      )}
                    </div>
                  )}

                  {/* Payment Breakdown */}
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                    <p className="text-[9px] text-primary font-black uppercase tracking-widest mb-3 border-b border-primary/20 pb-1 italic">Rincian Pembayaran</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/60">Total Belanja</span>
                        <span className="text-white font-bold">Rp {(job.actualShoppingCost || job.subtotal || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/60">Ongkir (Murni)</span>
                        <span className="text-white font-bold">Rp {((job.deliveryFee || 0) - (job.appServiceFee || 0)).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/60">Biaya Layanan</span>
                        <span className="text-white font-bold">Rp {(job.appServiceFee || 0).toLocaleString()}</span>
                      </div>
                      {job.pickupFee > 0 && (
                        <div className="flex justify-between items-center text-[11px] text-yellow-500 font-bold">
                          <span>Biaya Jemput (+{job.pickupDistance?.toFixed(1)}km)</span>
                          <span>Rp {job.pickupFee.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="pt-2 mt-2 border-t border-primary/20 flex justify-between items-center">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Total Tagihan</span>
                        <span className="text-sm font-black text-primary italic">Rp {( job.total || ( (job.actualShoppingCost || job.subtotal || 0) + (job.deliveryFee || 0) + (job.pickupFee || 0) ) ).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-tighter">Metode Pembayaran</span>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded ${job.paymentMethod === 'TUNAI' ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500'}`}>
                          {job.paymentMethod || 'TUNAI'}
                        </span>
                      </div>
                    </div>
                  </div>
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
                      if (job.serviceType === 'food' || job.serviceType === 'shop') {
                        setCostModal({ show: true, jobId: job.id, amount: '' });
                      } else {
                        const total = job.pickups?.length || 1;
                        const done = job.pickupsDone || 0;
                        const next = done + 1;
                        
                        const msg = total > 1 
                          ? `Konfirmasi sudah menjemput pesanan di titik ke-${next} dari ${total}?`
                          : "Konfirmasi sudah menjemput barang/kustomer?";
                          
                        if (window.confirm(msg)) {
                          handlePickup(job.id);
                        }
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
              <div key={order.id} className={`bg-surface-container-highest rounded-xl p-5 border transition-all duration-300 ${countdowns[order.id] <= 10 ? 'border-red-500/50 shadow-[0_0_20px_rgba(255,50,50,0.15)]' : 'border-primary/30'}`}>
                {/* Countdown Timer Bar */}
                {countdowns[order.id] !== undefined && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] font-black text-white/50 uppercase tracking-widest flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">timer</span>
                        Sisa Waktu
                      </span>
                      <span className={`text-sm font-black font-mono tabular-nums ${countdowns[order.id] <= 10 ? 'text-red-400 animate-pulse' : 'text-primary'}`}>
                        {countdowns[order.id]}s
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-linear ${countdowns[order.id] <= 10 ? 'bg-red-500' : 'bg-primary'}`}
                        style={{ width: `${Math.min(100, (countdowns[order.id] / 60) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

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
                      <div className="flex flex-col items-end gap-1">
                        <div className="px-2 py-0.5 rounded bg-primary/20 border border-primary/30">
                          <span className="text-[8px] font-black uppercase tracking-tighter text-primary">ARO {order.serviceType?.toUpperCase()}</span>
                        </div>
                        {order.voucherUsed && (
                          <div className="bg-white/10 px-2 py-0.5 rounded border border-white/10">
                            <span className="text-[7px] font-black text-white/60 uppercase">Voucher</span>
                          </div>
                        )}
                      </div>
                   </div>
                   <div className="flex items-start gap-2 pt-2 border-t border-white/5 pb-2">
                     <span className="material-symbols-outlined text-primary text-[14px] mt-0.5">location_on</span>
                     <div className="flex-1">
                        <p className="text-[8px] text-white/40 font-black uppercase tracking-widest">Alamat</p>
                        <p className="text-xs text-white/80 line-clamp-1">{order.pickupAddress || 'Lokasi Jemput'}</p>
                        <p className="text-[14px] text-primary rotate-90 w-4 ml-[-4px]">arrow_forward</p>
                        <p className="text-xs text-white/80 line-clamp-1">{order.dropoffAddress || 'Lokasi Tujuan'}</p>
                     </div>
                   </div>
                   
                   {/* Incoming Payment Detail */}
                   <div className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-1">
                     <div className="flex justify-between text-[10px]">
                       <span className="text-white/40">Belanja</span>
                       <span className="text-white">Rp {(order.actualShoppingCost || order.subtotal || 0).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between text-[10px]">
                       <span className="text-white/40">Ongkir (Driver)</span>
                       <span className="text-white">Rp {((order.deliveryFee || 0) - (order.appServiceFee || 0)).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between text-[10px]">
                       <span className="text-white/40">Biaya Layanan</span>
                       <span className="text-white">Rp {(order.appServiceFee || 0).toLocaleString()}</span>
                     </div>
                   </div>
                 </div>
                {/* Action Buttons: Tolak + Terima */}
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleReject(order.id)}
                    className="flex-1 py-4 bg-white/5 border border-white/10 text-white/60 font-headline font-black text-xs tracking-widest rounded-xl active:scale-95 uppercase transition-all hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400"
                  >
                    Tolak
                  </button>
                  <button 
                    onClick={() => handleAccept(order.id)}
                    className="flex-[2] py-4 bg-gradient-to-br from-primary-container to-primary text-black font-headline font-black text-xs tracking-widest rounded-xl shadow-lg uppercase active:scale-95"
                  >
                    Terima Pesanan
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      </main>
      {/* Cost Input Modal */}
      {costModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-container-low w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="font-headline font-bold text-xl text-white mb-2">Total Belanja Asli</h3>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Masukkan total harga belanjaan sesuai struk asli (tanpa ongkir). Harga ini akan mengupdate tagihan customer.
            </p>
            
            <div className="relative mb-6">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">Rp</span>
              <input 
                type="number"
                inputMode="numeric"
                value={costModal.amount}
                onChange={(e) => setCostModal({ ...costModal, amount: e.target.value })}
                className="w-full bg-background border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white font-headline font-bold text-lg focus:outline-none focus:border-primary transition-colors"
                placeholder="0"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setCostModal({ show: false, jobId: null, amount: '' })}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white font-bold text-sm active:scale-95 transition-all"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  if (costModal.amount === '' || isNaN(costModal.amount) || costModal.amount < 0) {
                    alert('Mohon masukkan nominal yang valid!');
                    return;
                  }
                  const amount = costModal.amount;
                  setCostModal({ show: false, jobId: null, amount: '' });
                  handlePickup(costModal.jobId, amount);
                }}
                className="flex-1 py-3 rounded-xl bg-primary text-black font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-[0_0_20px_rgba(202,253,0,0.3)]"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}




    </div>
  );
}

export default Home;
