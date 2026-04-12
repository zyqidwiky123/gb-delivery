import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useUserStore } from '../store/userStore';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

function AdminDashboard() {
  const navigate = useNavigate();
  const { totalRevenue, totalOrders, activeDrivers, updateStats } = useAdminStore();
  const { logout, user } = useUserStore();
  
  // Real-time Data Fetching
  useEffect(() => {
    // 1. Listen to Orders for Stats
    const unsubOrders = onSnapshot(collection(db, "orders"), (snapshot) => {
      let revenue = 0;
      let count = snapshot.size;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'completed') {
           // Admin revenue is 10% of total if we follow the plan, 
           // or we can show total transaction volume. Let's show total for now.
           revenue += (data.total || 0);
        }
      });
      updateStats({ totalRevenue: revenue, totalOrders: count });
    });

    // 2. Listen to Drivers for Stats
    const qDrivers = query(collection(db, "drivers"), where("status", "==", "online"));
    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      updateStats({ activeDrivers: snapshot.size });
    });

    return () => {
      unsubOrders();
      unsubDrivers();
    };
  }, [updateStats]);


  const stats = [
    { label: 'Total Pendapatan', value: `Rp ${totalRevenue.toLocaleString()}`, icon: 'payments', color: 'text-primary' },
    { label: 'Total Pesanan', value: totalOrders, icon: 'shopping_bag', color: 'text-[#cafd00]' },
    { label: 'Driver Online', value: activeDrivers, icon: 'moped', color: 'text-blue-400' },
    { label: 'Rating Sistem', value: '4.8/5.0', icon: 'star', color: 'text-yellow-400' },
  ];

  return (
    <div className="flex min-h-screen bg-[#080808] text-white font-body">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#111] border-r border-white/5 hidden md:flex flex-col">
        <div className="p-8">
           <h1 className="font-['Plus_Jakarta_Sans'] font-black text-2xl italic text-primary tracking-tighter">ARO ADMIN</h1>
           <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#f3ffca]/40">Console v2.0</p>
        </div>
        
        <nav className="flex-grow px-4 space-y-2">
           <Link to="/admin" className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 text-primary group border border-primary/20">
              <span className="material-symbols-outlined text-xl">dashboard</span>
              <span className="font-bold text-sm">Dashboard</span>
           </Link>
           <Link to="/admin/orders" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">list_alt</span>
              <span className="font-bold text-sm">Semua Pesanan</span>
           </Link>
           <Link to="/admin/settings" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">settings</span>
              <span className="font-bold text-sm">Pengaturan Tarif</span>
           </Link>
        </nav>

         <div className="p-8">
            <button 
               onClick={() => {
                 logout();
                 navigate('/login');
               }} 
               className="flex items-center gap-3 p-4 w-full rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all font-bold text-sm"
            >
               <span className="material-symbols-outlined text-xl">logout</span>
               <span>Logout</span>
            </button>
         </div>

      </aside>

      {/* Main Content */}
      <main className="flex-grow p-8 md:p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
            <div>
               <h2 className="text-3xl font-headline font-black italic tracking-tight mb-1 uppercase">Overview Dashboard</h2>
               <p className="text-zinc-500 text-sm font-medium">Selamat datang kembali, {user?.displayName || 'Superuser'}. Ini performa bisnismu hari ini.</p>
            </div>
            <div className="flex gap-4">
               <div className="bg-[#111] p-3 rounded-xl border border-white/5 text-xs font-bold text-zinc-400 uppercase tracking-widest px-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  System Online
               </div>
            </div>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-[#111] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group hover:border-primary/20 transition-all cursor-pointer">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"></div>
              <span className={`material-symbols-outlined text-3xl mb-4 ${stat.color}`}>{stat.icon}</span>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-500 mb-1">{stat.label}</p>
              <h3 className="text-2xl font-headline font-black italic">{stat.value}</h3>
            </div>
          ))}
        </section>

        {/* Info Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 bg-[#111] p-8 rounded-[2.5rem] border border-white/5 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-lg font-black uppercase tracking-widest text-[#f3ffca]">Monitoring Transaksi</h3>
                 <button onClick={() => navigate('/admin/orders')} className="text-[10px] font-black uppercase tracking-widest border-b border-primary text-primary">Lihat Semua</button>
              </div>
              
              <div className="space-y-4">
                 {[1, 2, 3].map(i => (
                   <div key={i} className="flex items-center justify-between p-5 bg-[#080808] rounded-3xl border border-white/5 hover:border-primary/20 transition-all">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-zinc-500">shopping_bag</span>
                         </div>
                         <div>
                            <p className="text-sm font-bold text-white">ARO JEK - Perjalanan #4512</p>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Baru Saja • Driver Selesai</p>
                         </div>
                      </div>
                      <span className="text-lg font-headline font-black text-primary italic">Rp 15.000</span>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-gradient-to-br from-[#111] to-[#080808] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                 <h3 className="text-lg font-black uppercase tracking-widest text-[#f3ffca]">Quick Settings</h3>
                 <p className="text-xs text-zinc-500 font-medium">Ubah tarif dasar dan tarif per kilometer secara instan di sini.</p>
              </div>
              
              <div className="space-y-6 my-8">
                 <div className="bg-[#080808] p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Base Fare</p>
                    <p className="text-xl font-headline font-black text-white italic">Rp 10.000</p>
                 </div>
                 <div className="bg-[#080808] p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Rate / KM</p>
                    <p className="text-xl font-headline font-black text-white italic">Rp 2.500</p>
                 </div>
              </div>

              <button onClick={() => navigate('/admin/settings')} className="w-full kinetic-gradient py-5 rounded-2xl text-black font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Update Pricing</button>
           </div>
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
