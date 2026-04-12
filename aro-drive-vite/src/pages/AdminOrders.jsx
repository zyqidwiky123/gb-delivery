import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'searching': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'accepted': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'completed': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-zinc-800 text-zinc-500';
    }
  };

  return (
    <div className="flex min-h-screen bg-[#080808] text-white font-body">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#111] border-r border-white/5 hidden md:flex flex-col">
        <div className="p-8">
           <h1 className="font-['Plus_Jakarta_Sans'] font-black text-2xl italic text-primary tracking-tighter">ARO ADMIN</h1>
        </div>
        
        <nav className="flex-grow px-4 space-y-2">
           <Link to="/admin" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">dashboard</span>
              <span className="font-bold text-sm">Dashboard</span>
           </Link>
           <Link to="/admin/orders" className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 text-primary group border border-primary/20">
              <span className="material-symbols-outlined text-xl">list_alt</span>
              <span className="font-bold text-sm">Semua Pesanan</span>
           </Link>
           <Link to="/admin/settings" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">settings</span>
              <span className="font-bold text-sm">Pengaturan Tarif</span>
           </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-8 md:p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
            <div>
               <h2 className="text-3xl font-headline font-black italic tracking-tight mb-1 uppercase">Monitor Pesanan</h2>
               <p className="text-zinc-500 text-sm font-medium">Memantau seluruh aktivitas transaksi secara real-time.</p>
            </div>
            <div className="flex bg-[#111] p-1 rounded-xl border border-white/5">
                <button className="px-6 py-2 bg-primary text-black font-black uppercase text-[10px] rounded-lg tracking-widest">Semua</button>
                <button className="px-6 py-2 text-zinc-500 font-bold uppercase text-[10px] tracking-widest hover:text-white">Aktif</button>
                <button className="px-6 py-2 text-zinc-500 font-bold uppercase text-[10px] tracking-widest hover:text-white">Selesai</button>
            </div>
        </header>

        {loading ? (
          <div className="p-20 text-center animate-pulse text-zinc-500 font-black uppercase tracking-widest italic text-xl">
             Loading Data Order...
          </div>
        ) : (
          <div className="bg-[#111] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-[#1a1a1a] text-zinc-500 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                      <th className="px-8 py-6">ID Pesanan</th>
                      <th className="px-8 py-6">Layanan</th>
                      <th className="px-8 py-6">Pelanggan</th>
                      <th className="px-8 py-6">Total Tagihan</th>
                      <th className="px-8 py-6">Status</th>
                      <th className="px-8 py-6 text-right">Aksi</th>
                   </tr>
                </thead>
                <tbody>
                   {orders.map((order) => (
                      <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                         <td className="px-8 py-6 text-xs font-mono text-zinc-500">#{order.id?.slice(-6).toUpperCase()}</td>
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center border border-white/5">
                                  <span className="material-symbols-outlined text-primary text-sm">
                                     {order.serviceType === 'food' ? 'restaurant' : order.serviceType === 'ride' ? 'moped' : 'package_2'}
                                  </span>
                               </div>
                               <span className="text-sm font-bold uppercase">{order.serviceType}</span>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <p className="text-sm font-bold">{order.customer?.name || 'Guest'}</p>
                            <p className="text-[10px] text-zinc-500 font-bold">{order.customer?.email || 'Customer'}</p>
                         </td>
                         <td className="px-8 py-6">
                            <span className="text-sm font-black text-white italic">Rp {order.total?.toLocaleString()}</span>
                         </td>
                         <td className="px-8 py-6">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(order.status)}`}>
                               {order.status === 'searching' ? 'Mencari' : 
                                order.status === 'accepted' ? 'Driver' : 'Selesai'}
                            </span>
                         </td>
                         <td className="px-8 py-6 text-right">
                            <button onClick={() => navigate(`/tracking?id=${order.id}`)} className="material-symbols-outlined text-zinc-600 hover:text-primary transition-colors">visibility</button>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminOrders;
